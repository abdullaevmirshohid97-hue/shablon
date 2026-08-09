import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SkladPackage,
  SkladPackageRow,
  SkladPackageSummary,
  SkladSalesClient,
  SkladScanHit,
} from '@mubosher/shared';
import type { Database } from '../database.types';

/**
 * The sales desk's first screen: who has bought, and for how much.
 *
 * Aggregated in Postgres rather than by fetching every invoice and grouping in
 * the browser — a year of sales is a large answer to a small question.
 */
export function useSalesByCounterparty(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  search = '',
) {
  return useQuery({
    queryKey: ['sklad-sales-clients', orgId, search],
    enabled: !!orgId,
    queryFn: async (): Promise<SkladSalesClient[]> => {
      const { data, error } = await supabase.rpc('sklad_sales_by_counterparty', {
        target_org_id: orgId!,
        p_search: search.trim() || null,
        p_limit: 300,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        counterpartyId: r.counterparty_id,
        counterpartyName: r.counterparty_name,
        phone: r.phone,
        invoiceCount: Number(r.invoice_count),
        openCount: Number(r.open_count),
        totalAmount: r.total_amount == null ? null : Number(r.total_amount),
        orderedDona: Number(r.ordered_dona),
        shippedDona: Number(r.shipped_dona),
        packageCount: Number(r.package_count),
        lastIssuedAt: r.last_issued_at,
        currency: r.currency,
      }));
    },
  });
}

/** The sacks standing against one invoice, each with what is inside it. */
export function useInvoicePackages(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  invoiceId: string | undefined,
) {
  return useQuery({
    queryKey: ['sklad-invoice-packages', orgId, invoiceId],
    enabled: !!orgId && !!invoiceId,
    queryFn: async (): Promise<SkladPackageSummary[]> => {
      const { data, error } = await supabase.rpc('sklad_invoice_packages', {
        target_org_id: orgId!,
        p_invoice_id: invoiceId!,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        packageId: r.package_id,
        code: r.code,
        barcode: r.barcode,
        status: r.status,
        packedAt: r.packed_at,
        grossKg: r.gross_kg == null ? null : Number(r.gross_kg),
        note: r.note,
        shipmentId: r.shipment_id,
        totalDona: Number(r.total_dona ?? 0),
        totalKg: r.total_kg == null ? null : Number(r.total_kg),
        lineCount: Number(r.line_count ?? 0),
        contents: r.contents,
      }));
    },
  });
}

/**
 * One sack, by its QR code, its printed number or its barcode — the same
 * lookup whichever of the three arrived, because the person holding the label
 * does not know which one they just used.
 */
export function useSkladPackage(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  code: string | undefined,
) {
  return useQuery({
    queryKey: ['sklad-package', orgId, code],
    enabled: !!orgId && !!code && code.trim().length > 0,
    queryFn: async (): Promise<SkladPackage | null> => {
      const { data, error } = await supabase.rpc('sklad_package_detail', {
        target_org_id: orgId!,
        p_code: code!.trim(),
      });
      if (error) throw error;

      const rows = data ?? [];
      const head = rows[0];
      if (!head) return null;

      return {
        packageId: head.package_id,
        code: head.code,
        barcode: head.barcode,
        status: head.status,
        packedAt: head.packed_at,
        grossKg: head.gross_kg == null ? null : Number(head.gross_kg),
        note: head.note,
        invoiceId: head.invoice_id,
        invoiceNo: head.invoice_no,
        counterpartyId: head.counterparty_id,
        counterpartyName: head.counterparty_name,
        shipmentId: head.shipment_id,
        packedByName: head.packed_by_name,
        // The left join means an empty sack comes back as one row of nulls
        // rather than as no sack at all.
        lines: rows
          .filter((r) => r.line_id != null)
          .map((r) => ({
            lineId: r.line_id!,
            itemId: r.item_id!,
            batchId: r.batch_id!,
            itemBarcode: r.item_barcode,
            kod: r.kod,
            itemName: r.item_name,
            widthCm: r.width_cm == null ? null : Number(r.width_cm),
            lengthCm: r.length_cm == null ? null : Number(r.length_cm),
            colorName: r.color_name,
            dona: Number(r.dona ?? 0),
            kg: r.kg == null ? null : Number(r.kg),
            batchQoldiqDona: r.batch_qoldiq_dona == null ? null : Number(r.batch_qoldiq_dona),
          })),
      };
    },
  });
}

/**
 * Whatever the scanner just produced: an invoice, a sack, or a product.
 *
 * A mutation rather than a query because a scan is an event — the same code
 * scanned twice is two actions, and a cached answer to the second one would be
 * wrong the moment the first changed anything.
 */
export function useSkladScan(supabase: SupabaseClient<Database>) {
  return useMutation({
    mutationFn: async (input: { orgId: string; code: string }): Promise<SkladScanHit | null> => {
      const { data, error } = await supabase.rpc('sklad_scan', {
        target_org_id: input.orgId,
        p_code: input.code.trim(),
      });
      if (error) throw error;

      const hit = (data ?? [])[0];
      if (!hit) return null;

      return {
        kind: hit.kind,
        id: hit.id,
        code: hit.code,
        label: hit.label,
        detail: hit.detail,
        invoiceId: hit.invoice_id,
        counterpartyId: hit.counterparty_id,
        counterpartyName: hit.counterparty_name,
        itemId: hit.item_id,
        batchId: hit.batch_id,
        availableDona: hit.available_dona == null ? null : Number(hit.available_dona),
        status: hit.status,
      };
    },
  });
}

/** A thousand pieces, fifty to a sack: twenty sacks and twenty labels. */
export function usePackBatch(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      orgId: string;
      batchId: string;
      perQop: number;
      totalDona?: number | null;
      invoiceId?: string | null;
      kgPerQop?: number | null;
      packedAt?: string | null;
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('sklad_pack_batch', {
        target_org_id: input.orgId,
        p_batch_id: input.batchId,
        p_per_qop: input.perQop,
        p_total_dona: input.totalDona ?? null,
        p_invoice_id: input.invoiceId ?? null,
        p_kg_per_qop: input.kgPerQop ?? null,
        p_packed_at: input.packedAt ?? null,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (_data, { orgId, invoiceId }) => {
      void queryClient.invalidateQueries({
        queryKey: ['sklad-invoice-packages', orgId, invoiceId],
      });
      void queryClient.invalidateQueries({ queryKey: ['sklad-sales-clients', orgId] });
    },
  });
}

/** A mixed sack, created or corrected — five models in one sack, written down. */
export function useSavePackage(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      orgId: string;
      rows: SkladPackageRow[];
      packageId?: string | null;
      invoiceId?: string | null;
      grossKg?: number | null;
      note?: string | null;
      packedAt?: string | null;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('sklad_save_package', {
        target_org_id: input.orgId,
        p_rows: input.rows,
        p_package_id: input.packageId ?? null,
        p_invoice_id: input.invoiceId ?? null,
        p_gross_kg: input.grossKg ?? null,
        p_note: input.note ?? null,
        p_packed_at: input.packedAt ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (packageId, { orgId, invoiceId }) => {
      void queryClient.invalidateQueries({
        queryKey: ['sklad-invoice-packages', orgId, invoiceId],
      });
      void queryClient.invalidateQueries({ queryKey: ['sklad-package', orgId, packageId] });
    },
  });
}

export function useDeletePackage(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { orgId: string; packageId: string }): Promise<void> => {
      const { error } = await supabase.rpc('sklad_delete_package', {
        target_org_id: input.orgId,
        p_package_id: input.packageId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-invoice-packages', orgId] });
    },
  });
}

/**
 * Confirming the sale: the despatch, the stock write-off and the sacks marked
 * gone, in one transaction. Everything the query cache knows about stock is
 * stale afterwards, which is why the invalidation here is broad.
 */
export function useIssuePackages(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      orgId: string;
      packageIds: string[];
      invoiceId?: string | null;
      carrier?: string | null;
      trackingNo?: string | null;
      shippedAt?: string | null;
      note?: string | null;
      managerId?: string | null;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('sklad_issue_packages', {
        target_org_id: input.orgId,
        p_package_ids: input.packageIds,
        p_invoice_id: input.invoiceId ?? null,
        p_carrier: input.carrier ?? null,
        p_tracking_no: input.trackingNo ?? null,
        p_shipped_at: input.shippedAt ?? null,
        p_note: input.note ?? null,
        p_manager_id: input.managerId ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { orgId }) => {
      for (const key of [
        'sklad-invoice-packages',
        'sklad-invoices',
        'sklad-invoice-code',
        'sklad-sales-clients',
        'sklad-batch-page',
        'sklad-batches',
        'sklad-movements',
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key, orgId] });
      }
      void queryClient.invalidateQueries({ queryKey: ['sklad-package'] });
    },
  });
}
