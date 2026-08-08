import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SkladInvoiceRow,
  SkladInvoiceStatus,
  SkladInvoiceSummary,
  SkladScannedInvoice,
  SkladShipmentNote,
} from '@mubosher/shared';
import type { Database } from '../database.types';

/** The invoice queue: what the office has sold and the bay has yet to send. */
export function useSkladInvoices(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  filters: { status?: SkladInvoiceStatus | ''; counterpartyId?: string; search?: string } = {},
) {
  return useQuery({
    queryKey: ['sklad-invoices', orgId, filters],
    enabled: !!orgId,
    queryFn: async (): Promise<SkladInvoiceSummary[]> => {
      const { data, error } = await supabase.rpc('sklad_invoice_page', {
        target_org_id: orgId!,
        p_status: filters.status ? filters.status : null,
        p_counterparty_id: filters.counterpartyId || null,
        p_search: filters.search?.trim() || null,
        p_limit: 200,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        invoiceId: r.invoice_id,
        invoiceNo: r.invoice_no,
        barcode: r.barcode,
        status: r.status,
        issuedAt: r.issued_at,
        dueDate: r.due_date,
        counterpartyId: r.counterparty_id,
        counterpartyName: r.counterparty_name,
        managerName: r.manager_name,
        orderNo: r.order_no,
        currency: r.currency,
        lineCount: Number(r.line_count),
        orderedDona: Number(r.ordered_dona),
        shippedDona: Number(r.shipped_dona),
        totalAmount: r.total_amount == null ? null : Number(r.total_amount),
      }));
    },
  });
}

/**
 * Resolves whatever the scanner just produced.
 *
 * The code may be the barcode, the printed invoice number, or the id out of
 * the QR link — the person at the desk does not know which, and the database
 * tries all three. `null` when nothing matches, which the screen shows as "not
 * found" rather than as an error.
 */
export function useInvoiceByCode(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  code: string,
) {
  return useQuery({
    queryKey: ['sklad-invoice-code', orgId, code],
    enabled: !!orgId && code.trim().length > 0,
    queryFn: async (): Promise<SkladScannedInvoice | null> => {
      const { data, error } = await supabase.rpc('sklad_invoice_by_code', {
        target_org_id: orgId!,
        p_code: code.trim(),
      });
      if (error) throw error;

      const rows = data ?? [];
      const head = rows[0];
      if (!head) return null;

      return {
        invoiceId: head.invoice_id,
        invoiceNo: head.invoice_no,
        barcode: head.barcode,
        status: head.status,
        issuedAt: head.issued_at,
        counterpartyId: head.counterparty_id,
        counterpartyName: head.counterparty_name,
        orderId: head.order_id,
        managerId: head.manager_id,
        currency: head.currency,
        note: head.note,
        // An invoice always has lines, but the left join means a malformed one
        // would come back as a single row of nulls rather than as a crash.
        lines: rows
          .filter((r) => r.line_id != null)
          .map((r) => ({
            lineId: r.line_id!,
            itemId: r.item_id,
            batchId: r.batch_id,
            kod: r.kod,
            itemName: r.item_name,
            widthCm: r.width_cm == null ? null : Number(r.width_cm),
            lengthCm: r.length_cm == null ? null : Number(r.length_cm),
            colorName: r.color_name,
            orderedDona: Number(r.ordered_dona ?? 0),
            shippedDona: Number(r.shipped_dona ?? 0),
            remainingDona: Number(r.remaining_dona ?? 0),
            batchQoldiqDona: r.batch_qoldiq_dona == null ? null : Number(r.batch_qoldiq_dona),
            unitPrice: r.unit_price == null ? null : Number(r.unit_price),
            amount: r.amount == null ? null : Number(r.amount),
          })),
      };
    },
  });
}

/** Header and lines in one call, so a manager never ends up with a numbered
 * document that has nothing on it. */
export function useCreateSkladInvoice(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      orgId: string;
      counterpartyId: string;
      rows: SkladInvoiceRow[];
      orderId?: string | null;
      managerId?: string | null;
      issuedAt?: string | null;
      dueDate?: string | null;
      currency?: string | null;
      note?: string | null;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('sklad_create_invoice', {
        target_org_id: input.orgId,
        p_counterparty_id: input.counterpartyId,
        p_rows: input.rows,
        p_order_id: input.orderId ?? null,
        p_manager_id: input.managerId ?? null,
        p_issued_at: input.issuedAt ?? null,
        p_due_date: input.dueDate ?? null,
        p_currency: input.currency ?? null,
        p_note: input.note ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-invoices', orgId] });
    },
  });
}

/** The despatch note, for the copy that travels with the driver. */
export function useShipmentNote(
  supabase: SupabaseClient<Database>,
  shipmentId: string | undefined,
) {
  return useQuery({
    queryKey: ['sklad-shipment-note', shipmentId],
    enabled: !!shipmentId,
    queryFn: async (): Promise<SkladShipmentNote | null> => {
      const { data, error } = await supabase.rpc('sklad_shipment_note', {
        p_shipment_id: shipmentId!,
      });
      if (error) throw error;

      const rows = data ?? [];
      const head = rows[0];
      if (!head) return null;

      return {
        shipmentId: head.shipment_id,
        documentNo: head.document_no,
        shippedAt: head.shipped_at,
        counterpartyName: head.counterparty_name,
        managerName: head.manager_name,
        orderNo: head.order_no,
        invoiceId: head.invoice_id,
        invoiceNo: head.invoice_no,
        invoiceBarcode: head.invoice_barcode,
        note: head.note,
        lines: rows
          .filter((r) => r.line_id != null)
          .map((r) => ({
            lineId: r.line_id!,
            kod: r.kod,
            itemName: r.item_name,
            widthCm: r.width_cm == null ? null : Number(r.width_cm),
            lengthCm: r.length_cm == null ? null : Number(r.length_cm),
            colorName: r.color_name,
            dona: Number(r.dona ?? 0),
            kg: r.kg == null ? null : Number(r.kg),
          })),
      };
    },
  });
}
