import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  SkladLineProgress,
  SkladOrderClient,
  SkladOrderLine,
  SkladOrderStatus,
  SkladOrderSummary,
  SkladIssuableBatch,
  SkladIssueRow,
  SkladReceiveRow,
  SkladStage,
  SkladStageCell,
  SkladStageEntry,
  SkladStageLoad,
} from '@mubosher/shared';
import type { Database } from '../database.types';
import { toSkladStage, toSkladOrderLine } from '../mappers';

// ---------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------

export function useSkladStages(supabase: SupabaseClient<Database>, orgId: string | undefined) {
  return useQuery({
    queryKey: ['sklad-stages', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<SkladStage[]> => {
      const { data, error } = await supabase
        .from('sklad_stages')
        .select('*')
        .eq('org_id', orgId!)
        .order('position');
      if (error) throw error;
      return data.map(toSkladStage);
    },
  });
}

export function useSaveSkladStage(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      orgId: string;
      stageId?: string;
      name: string;
      position: number;
      isFinal: boolean;
    }) => {
      const row = { name: input.name, position: input.position, is_final: input.isFinal };
      const { error } = input.stageId
        ? await supabase.from('sklad_stages').update(row).eq('id', input.stageId)
        : await supabase.from('sklad_stages').insert({ org_id: input.orgId, ...row });
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-stages', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-detail'] });
    },
  });
}

export function useDeleteSkladStage(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stageId }: { orgId: string; stageId: string }) => {
      const { error } = await supabase.from('sklad_stages').delete().eq('id', stageId);
      if (error) throw error;
    },
    onSuccess: (_data, { orgId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-stages', orgId] });
    },
  });
}

// ---------------------------------------------------------------------
// Order lines
// ---------------------------------------------------------------------

export function useSkladOrderLines(
  supabase: SupabaseClient<Database>,
  orderId: string | undefined,
) {
  return useQuery({
    queryKey: ['sklad-order-lines', orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<SkladOrderLine[]> => {
      const { data, error } = await supabase
        .from('sklad_order_lines')
        .select('*')
        .eq('order_id', orderId!)
        .order('position');
      if (error) throw error;
      return data.map(toSkladOrderLine);
    },
  });
}

export interface SkladOrderLineInput {
  orgId: string;
  orderId: string;
  lineId?: string;
  itemId?: string | null;
  position?: number;
  description?: string | null;
  sizeText?: string | null;
  colorText?: string | null;
  plannedDona?: number | null;
  plannedKg?: number | null;
  notes?: string | null;
}

export function useSaveSkladOrderLine(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SkladOrderLineInput) => {
      const row = {
        item_id: input.itemId ?? null,
        position: input.position ?? 0,
        description: input.description ?? null,
        size_text: input.sizeText ?? null,
        color_text: input.colorText ?? null,
        planned_dona: input.plannedDona ?? null,
        planned_kg: input.plannedKg ?? null,
        notes: input.notes ?? null,
      };
      const { error } = input.lineId
        ? await supabase.from('sklad_order_lines').update(row).eq('id', input.lineId)
        : await supabase
            .from('sklad_order_lines')
            .insert({ org_id: input.orgId, order_id: input.orderId, ...row });
      if (error) throw error;
    },
    onSuccess: (_data, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-lines', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-detail', orderId] });
    },
  });
}

export function useDeleteSkladOrderLine(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lineId }: { orderId: string; lineId: string }) => {
      const { error } = await supabase.from('sklad_order_lines').delete().eq('id', lineId);
      if (error) throw error;
    },
    onSuccess: (_data, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-lines', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-detail', orderId] });
    },
  });
}

// ---------------------------------------------------------------------
// The order screen: progress, the stage grid, and who has had what
// ---------------------------------------------------------------------

export interface SkladOrderDetail {
  progress: SkladLineProgress[];
  cells: SkladStageCell[];
  clients: SkladOrderClient[];
}

/**
 * Everything the order screen draws, in three round trips instead of one per
 * cell. Live, because the whole premise is several shops writing into the same
 * document at the same time — the dye house entering its numbers has to show
 * up on the sewing floor's screen without anyone pressing refresh.
 */
export function useSkladOrderDetail(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  orderId: string | undefined,
) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['sklad-order-detail', orderId],
    enabled: !!orderId,
    queryFn: async (): Promise<SkladOrderDetail> => {
      const [progress, matrix, clients] = await Promise.all([
        supabase.rpc('sklad_order_progress', { p_order_id: orderId! }),
        supabase.rpc('sklad_order_stage_matrix', { p_order_id: orderId! }),
        supabase.rpc('sklad_order_clients', { p_order_id: orderId! }),
      ]);

      for (const r of [progress, matrix, clients]) {
        if (r.error) throw r.error;
      }

      return {
        progress: (progress.data ?? []).map((r) => ({
          lineId: r.line_id,
          position: r.line_position,
          description: r.description,
          itemName: r.item_name,
          kod: r.kod,
          sizeText: r.size_text,
          colorText: r.color_text,
          plannedDona: r.planned_dona,
          plannedKg: r.planned_kg == null ? null : Number(r.planned_kg),
          readyDona: Number(r.ready_dona),
          defectDona: Number(r.defect_dona),
          shippedDona: Number(r.shipped_dona),
          shippedKg: Number(r.shipped_kg),
          remainingDona: Number(r.remaining_dona),
        })),
        cells: (matrix.data ?? []).map((r) => ({
          lineId: r.line_id,
          stageId: r.stage_id,
          stageName: r.stage_name,
          stagePosition: r.stage_position,
          isFinal: r.is_final,
          qtyIn: r.qty_in == null ? null : Number(r.qty_in),
          qtyOut: r.qty_out == null ? null : Number(r.qty_out),
          defectQty: r.defect_qty == null ? null : Number(r.defect_qty),
          kg: r.kg == null ? null : Number(r.kg),
          entryCount: Number(r.entry_count),
          lastOccurredAt: r.last_occurred_at,
        })),
        clients: (clients.data ?? []).map((r) => ({
          counterpartyId: r.counterparty_id,
          counterpartyName: r.counterparty_name,
          shipmentCount: Number(r.shipment_count),
          shippedDona: Number(r.shipped_dona),
          shippedKg: Number(r.shipped_kg),
          lastShippedAt: r.last_shipped_at,
        })),
      };
    },
  });

  useEffect(() => {
    if (!orgId || !orderId) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-detail', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-lines', orderId] });
    };

    const channel = supabase
      .channel(`sklad-order:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sklad_stage_entries',
          filter: `org_id=eq.${orgId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sklad_order_lines',
          filter: `order_id=eq.${orderId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sklad_shipments', filter: `org_id=eq.${orgId}` },
        invalidate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, orgId, orderId, queryClient]);

  return query;
}

// ---------------------------------------------------------------------
// Stage entries
// ---------------------------------------------------------------------

export function useSkladStageEntries(
  supabase: SupabaseClient<Database>,
  lineId: string | undefined,
  stageId: string | undefined,
) {
  return useQuery({
    queryKey: ['sklad-stage-entries', lineId, stageId],
    enabled: !!lineId && !!stageId,
    queryFn: async (): Promise<SkladStageEntry[]> => {
      const { data, error } = await supabase.rpc('list_sklad_stage_entries', {
        p_order_line_id: lineId!,
        p_stage_id: stageId!,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        qtyIn: r.qty_in,
        qtyOut: r.qty_out,
        defectQty: r.defect_qty,
        kg: r.kg == null ? null : Number(r.kg),
        executorName: r.executor_name,
        occurredAt: r.occurred_at,
        note: r.note,
        createdByName: r.created_by_name,
        createdAt: r.created_at,
      }));
    },
  });
}

export function useRecordStageEntry(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      orgId: string;
      orderId: string;
      lineId: string;
      stageId: string;
      qtyIn?: number | null;
      qtyOut?: number | null;
      defectQty?: number | null;
      kg?: number | null;
      executorName?: string | null;
      occurredAt?: string | null;
      note?: string | null;
    }) => {
      const { error } = await supabase.from('sklad_stage_entries').insert({
        org_id: input.orgId,
        order_line_id: input.lineId,
        stage_id: input.stageId,
        qty_in: input.qtyIn ?? null,
        qty_out: input.qtyOut ?? null,
        defect_qty: input.defectQty ?? null,
        kg: input.kg ?? null,
        executor_name: input.executorName ?? null,
        occurred_at: input.occurredAt ?? undefined,
        note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { orderId, lineId, stageId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-stage-entries', lineId, stageId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-detail', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-summary'] });
    },
  });
}

// ---------------------------------------------------------------------
// Shipping
// ---------------------------------------------------------------------

export interface ShipmentLineInput {
  orderLineId?: string | null;
  batchId?: string | null;
  dona: number;
  kg?: number | null;
}

/**
 * Records a despatch and its allocation across the order's rows.
 *
 * When a line names a warehouse batch, the stock movement is recorded against
 * it in the same action — otherwise the shipment and the stock ledger would
 * disagree from the moment the truck left.
 */
export function useCreateShipment(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      orgId: string;
      orderId?: string | null;
      counterpartyId?: string | null;
      managerId?: string | null;
      documentNo?: string | null;
      shippedAt?: string | null;
      note?: string | null;
      lines: ShipmentLineInput[];
    }) => {
      const lines = input.lines.filter((l) => l.dona > 0);
      if (!lines.length) throw new Error('empty-shipment');

      const { data: shipment, error } = await supabase
        .from('sklad_shipments')
        .insert({
          org_id: input.orgId,
          order_id: input.orderId ?? null,
          counterparty_id: input.counterpartyId ?? null,
          manager_id: input.managerId ?? null,
          document_no: input.documentNo ?? null,
          shipped_at: input.shippedAt ?? undefined,
          note: input.note ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: linesError } = await supabase.from('sklad_shipment_lines').insert(
        lines.map((l) => ({
          org_id: input.orgId,
          shipment_id: shipment.id,
          order_line_id: l.orderLineId ?? null,
          batch_id: l.batchId ?? null,
          dona: l.dona,
          kg: l.kg ?? null,
        })),
      );
      if (linesError) throw linesError;

      for (const line of lines) {
        if (!line.batchId) continue;
        const { error: movementError } = await supabase.rpc('record_sklad_movement', {
          p_batch_id: line.batchId,
          p_kind: 'chiqim',
          p_dona: line.dona,
          p_kg: line.kg ?? null,
          p_occurred_at: input.shippedAt ?? null,
          p_counterparty_id: input.counterpartyId ?? null,
          p_order_id: input.orderId ?? null,
          p_note: input.documentNo ?? null,
        });
        if (movementError) throw movementError;
      }

      return shipment.id;
    },
    onSuccess: (_data, { orgId, orderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-detail', orderId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-shipments', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-batch-page', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-summary', orgId] });
      void queryClient.invalidateQueries({ queryKey: ['sklad-stock', orgId] });
    },
  });
}

// ---------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------

export function useSkladOrderSummary(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  filters: { status?: SkladOrderStatus | ''; counterpartyId?: string; managerId?: string } = {},
) {
  return useQuery({
    queryKey: ['sklad-order-summary', orgId, filters],
    enabled: !!orgId,
    queryFn: async (): Promise<SkladOrderSummary[]> => {
      const { data, error } = await supabase.rpc('sklad_order_summary', {
        target_org_id: orgId!,
        p_status: filters.status ? filters.status : null,
        p_counterparty_id: filters.counterpartyId || null,
        p_manager_id: filters.managerId || null,
        p_limit: 200,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        orderId: r.order_id,
        orderNo: r.order_no,
        orderName: r.order_name,
        status: r.status,
        deadline: r.deadline,
        counterpartyId: r.counterparty_id,
        counterpartyName: r.counterparty_name,
        managerName: r.manager_name,
        lineCount: Number(r.line_count),
        plannedDona: Number(r.planned_dona),
        readyDona: Number(r.ready_dona),
        shippedDona: Number(r.shipped_dona),
        remainingDona: Number(r.remaining_dona),
        currentStage: r.current_stage,
        createdAt: r.created_at,
      }));
    },
  });
}

export function useSkladStageLoad(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  range: { from?: string; to?: string } = {},
) {
  return useQuery({
    queryKey: ['sklad-stage-load', orgId, range.from ?? null, range.to ?? null],
    enabled: !!orgId,
    queryFn: async (): Promise<SkladStageLoad[]> => {
      const { data, error } = await supabase.rpc('sklad_stage_load', {
        target_org_id: orgId!,
        p_from: range.from || null,
        p_to: range.to || null,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        stageId: r.stage_id,
        stageName: r.stage_name,
        stagePosition: r.stage_position,
        entryCount: Number(r.entry_count),
        qtyOut: Number(r.qty_out),
        defectQty: Number(r.defect_qty),
        kg: Number(r.kg),
      }));
    },
  });
}

// ---------------------------------------------------------------------
// Despatch
// ---------------------------------------------------------------------

/** Every batch with something left on it, for the despatch grid to pick from. */
export function useIssuableBatches(
  supabase: SupabaseClient<Database>,
  orgId: string | undefined,
  search = '',
) {
  return useQuery({
    queryKey: ['sklad-issuable', orgId, search],
    enabled: !!orgId,
    queryFn: async (): Promise<SkladIssuableBatch[]> => {
      const { data, error } = await supabase.rpc('sklad_issuable_batches', {
        target_org_id: orgId!,
        p_search: search.trim() || null,
        p_limit: 300,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        batchId: r.batch_id,
        itemId: r.item_id,
        kod: r.kod,
        itemName: r.item_name,
        productType: r.product_type,
        widthCm: r.width_cm == null ? null : Number(r.width_cm),
        lengthCm: r.length_cm == null ? null : Number(r.length_cm),
        colorName: r.color_name,
        sortName: r.sort_name,
        qoldiqDona: Number(r.qoldiq_dona),
        pieceWeightKg: r.piece_weight_kg == null ? null : Number(r.piece_weight_kg),
        orderId: r.order_id,
        orderNo: r.order_no,
        omborgaKirganSana: r.omborga_kirgan_sana,
      }));
    },
  });
}

/**
 * Sends a whole despatch in one call.
 *
 * The counterpart of useReceiveSkladRows: one document, several batches, one
 * transaction. Every line goes through the same stock rules as a single
 * movement does, so a line that would overdraw a batch aborts the despatch
 * rather than leaving half a truck recorded.
 */
export function useIssueSkladRows(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      orgId: string;
      rows: SkladIssueRow[];
      counterpartyId?: string | null;
      orderId?: string | null;
      managerId?: string | null;
      documentNo?: string | null;
      shippedAt?: string | null;
      note?: string | null;
      /** When the despatch answers a scanned invoice: the client, the order and
       * the document number then come off the paper rather than the desk. */
      invoiceId?: string | null;
    }): Promise<string> => {
      const { data, error } = await supabase.rpc('sklad_issue_rows', {
        target_org_id: input.orgId,
        p_rows: input.rows,
        p_counterparty_id: input.counterpartyId ?? null,
        p_order_id: input.orderId ?? null,
        p_manager_id: input.managerId ?? null,
        p_document_no: input.documentNo ?? null,
        p_shipped_at: input.shippedAt ?? null,
        p_note: input.note ?? null,
        p_invoice_id: input.invoiceId ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { orgId }) => {
      for (const key of [
        'sklad-batch-page',
        'sklad-batches',
        'sklad-issuable',
        'sklad-invoices',
        'sklad-stock',
        'sklad-order-summary',
        'sklad-shipments',
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key, orgId] });
      }
      void queryClient.invalidateQueries({ queryKey: ['sklad-order-detail'] });
    },
  });
}

// ---------------------------------------------------------------------
// Receiving
// ---------------------------------------------------------------------

/**
 * Saves a whole typed-in delivery in one call.
 *
 * The rows go across as the storekeeper typed them — strings, blanks and all —
 * and the database creates the reference values, finds or creates the product
 * card and books the batch, in one transaction. Half an invoice landing
 * because the twentieth row failed is the failure this avoids.
 */
export function useReceiveSkladRows(supabase: SupabaseClient<Database>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      orgId: string;
      rows: SkladReceiveRow[];
      orderId?: string | null;
      receivedAt?: string | null;
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('sklad_receive_rows', {
        target_org_id: input.orgId,
        p_rows: input.rows,
        p_order_id: input.orderId ?? null,
        p_received_at: input.receivedAt ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { orgId }) => {
      for (const key of [
        'sklad-batch-page',
        'sklad-batches',
        'sklad-items',
        'sklad-lookups',
        'sklad-stock',
        'sklad-order-summary',
      ]) {
        void queryClient.invalidateQueries({ queryKey: [key, orgId] });
      }
    },
  });
}
