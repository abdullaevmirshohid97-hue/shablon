'use client';

import { useEffect, useState } from 'react';
import {
  useSkladItems,
  useSkladOrders,
  useCreateSkladOrder,
  useCreateSkladBatch,
  useUpdateSkladBatch,
  useSkladBatchPrice,
  useUpsertSkladBatchPrice,
  useCounterparties,
} from '@mubosher/api-client';
import type { SkladBatch, SkladBatchStatus } from '@mubosher/shared';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

const ALL_STATUSES: SkladBatchStatus[] = [
  'tayyor',
  'qadoqlanmoqda',
  'omborda',
  'rezerv',
  'jonatildi',
  'qaytarildi',
  'brak',
];

const textareaClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-shadow focus:border-brand-500';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BatchForm({
  orgId,
  isOrgAdmin,
  batch,
  onClose,
}: {
  orgId: string;
  isOrgAdmin: boolean;
  batch?: SkladBatch | null;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [supabase] = useState(() => createSupabaseBrowserClient());

  const { data: items } = useSkladItems(supabase, orgId);
  const { data: orders } = useSkladOrders(supabase, orgId);
  const { data: counterparties } = useCounterparties(supabase, orgId);
  const { data: existingPrice } = useSkladBatchPrice(supabase, batch?.id);
  const [roster, setRoster] = useState<
    { user_id: string; full_name: string | null; email: string | null }[]
  >([]);

  const createBatch = useCreateSkladBatch(supabase);
  const updateBatch = useUpdateSkladBatch(supabase);
  const createOrder = useCreateSkladOrder(supabase);
  const upsertPrice = useUpsertSkladBatchPrice(supabase);

  useEffect(() => {
    supabase.rpc('list_org_roster', { target_org_id: orgId }).then(({ data }) => {
      setRoster(data ?? []);
    });
  }, [supabase, orgId]);

  const [itemId, setItemId] = useState(batch?.itemId ?? '');
  const [orderId, setOrderId] = useState(batch?.orderId ?? '');
  const [newOrderMode, setNewOrderMode] = useState(false);
  const [newOrderNo, setNewOrderNo] = useState('');
  const [newOrderName, setNewOrderName] = useState('');
  const [newOrderCounterpartyId, setNewOrderCounterpartyId] = useState('');

  const [brutto, setBrutto] = useState(batch?.bruttoKg != null ? String(batch.bruttoKg) : '');
  const [netto, setNetto] = useState(batch?.nettoKg != null ? String(batch.nettoKg) : '');
  const [dona, setDona] = useState(batch?.donaSoni != null ? String(batch.donaSoni) : '');
  const [nabor, setNabor] = useState(batch?.naborSoni != null ? String(batch.naborSoni) : '');
  const [pallet, setPallet] = useState(batch?.palletSoni != null ? String(batch.palletSoni) : '');
  const [qoldiq, setQoldiq] = useState(batch?.qoldiqDona != null ? String(batch.qoldiqDona) : '');

  const [producedAt, setProducedAt] = useState(batch?.ishlabChiqarilganSana ?? '');
  const [receivedAt, setReceivedAt] = useState(batch?.omborgaKirganSana ?? todayIso());
  const [status, setStatus] = useState<SkladBatchStatus>(batch?.status ?? 'omborda');

  const [qcCheckedBy, setQcCheckedBy] = useState(batch?.qcCheckedBy ?? '');
  const [qcCheckedAt, setQcCheckedAt] = useState(batch?.qcCheckedAt ?? '');
  const [defectType, setDefectType] = useState(batch?.defectType ?? '');
  const [defectQty, setDefectQty] = useState(
    batch?.defectQty != null ? String(batch.defectQty) : '',
  );
  const [notes, setNotes] = useState(batch?.notes ?? '');

  const [locationSector, setLocationSector] = useState(batch?.locationSector ?? '');
  const [locationRow, setLocationRow] = useState(batch?.locationRow ?? '');
  const [locationRack, setLocationRack] = useState(batch?.locationRack ?? '');
  const [locationShelf, setLocationShelf] = useState(batch?.locationShelf ?? '');

  const [pricePerKg, setPricePerKg] = useState('');
  const [pricePerPiece, setPricePerPiece] = useState('');
  const [pricePerSet, setPricePerSet] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('');
  const [profitPercent, setProfitPercent] = useState('');
  const [profitAmount, setProfitAmount] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!existingPrice) return;
    setPricePerKg(existingPrice.pricePerKg != null ? String(existingPrice.pricePerKg) : '');
    setPricePerPiece(
      existingPrice.pricePerPiece != null ? String(existingPrice.pricePerPiece) : '',
    );
    setPricePerSet(existingPrice.pricePerSet != null ? String(existingPrice.pricePerSet) : '');
    setTotalAmount(existingPrice.totalAmount != null ? String(existingPrice.totalAmount) : '');
    setPurchaseCost(existingPrice.purchaseCost != null ? String(existingPrice.purchaseCost) : '');
    setProfitPercent(
      existingPrice.profitPercent != null ? String(existingPrice.profitPercent) : '',
    );
    setProfitAmount(existingPrice.profitAmount != null ? String(existingPrice.profitAmount) : '');
  }, [existingPrice]);

  const bruttoNum = brutto ? Number(brutto) : null;
  const nettoNum = netto ? Number(netto) : null;
  const donaNum = dona ? Number(dona) : null;
  const taraPreview =
    bruttoNum != null && nettoNum != null ? (bruttoNum - nettoNum).toFixed(3) : null;
  const pieceWeightPreview = nettoNum != null && donaNum ? (nettoNum / donaNum).toFixed(4) : null;

  const saving = createBatch.isPending || updateBatch.isPending || upsertPrice.isPending;

  async function handleAddOrder() {
    const created = await createOrder.mutateAsync({
      orgId,
      orderNo: newOrderNo || null,
      orderName: newOrderName || null,
      counterpartyId: newOrderCounterpartyId || null,
    });
    setOrderId(created.id);
    setNewOrderMode(false);
    setNewOrderNo('');
    setNewOrderName('');
    setNewOrderCounterpartyId('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const input = {
      orgId,
      itemId,
      orderId: orderId || null,
      bruttoKg: bruttoNum,
      nettoKg: nettoNum,
      donaSoni: donaNum,
      naborSoni: nabor ? Number(nabor) : null,
      palletSoni: pallet ? Number(pallet) : null,
      qoldiqDona: qoldiq ? Number(qoldiq) : !batch && donaNum ? donaNum : null,
      ishlabChiqarilganSana: producedAt || null,
      omborgaKirganSana: receivedAt || undefined,
      status,
      qcCheckedBy: qcCheckedBy || null,
      qcCheckedAt: qcCheckedAt || null,
      defectType: defectType || null,
      defectQty: defectQty ? Number(defectQty) : null,
      notes: notes || null,
      locationSector: locationSector || null,
      locationRow: locationRow || null,
      locationRack: locationRack || null,
      locationShelf: locationShelf || null,
    };

    try {
      let batchId: string;
      if (batch) {
        await updateBatch.mutateAsync({ batchId: batch.id, ...input });
        batchId = batch.id;
      } else {
        batchId = await createBatch.mutateAsync(input);
      }

      const hasPriceInput = [
        pricePerKg,
        pricePerPiece,
        pricePerSet,
        totalAmount,
        purchaseCost,
        profitPercent,
        profitAmount,
      ].some((v) => v !== '');

      if (isOrgAdmin && hasPriceInput) {
        await upsertPrice.mutateAsync({
          orgId,
          batchId,
          pricePerKg: pricePerKg ? Number(pricePerKg) : null,
          pricePerPiece: pricePerPiece ? Number(pricePerPiece) : null,
          pricePerSet: pricePerSet ? Number(pricePerSet) : null,
          totalAmount: totalAmount ? Number(totalAmount) : null,
          purchaseCost: purchaseCost ? Number(purchaseCost) : null,
          profitPercent: profitPercent ? Number(profitPercent) : null,
          profitAmount: profitAmount ? Number(profitAmount) : null,
        });
      }

      onClose();
    } catch (err) {
      setErrorMessage((err as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-popover">
        <h2 className="mb-4 text-base font-semibold text-slate-900">{t('sklad.batch.title')}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>{t('sklad.batch.itemLabel')}</Label>
            <Select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
              <option value="" disabled>
                —
              </option>
              {(items ?? []).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.artikul ? `${i.artikul} — ${i.name}` : i.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <Label>{t('sklad.batch.bruttoLabel')}</Label>
              <Input
                type="number"
                step="0.001"
                value={brutto}
                onChange={(e) => setBrutto(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('sklad.batch.nettoLabel')}</Label>
              <Input
                type="number"
                step="0.001"
                value={netto}
                onChange={(e) => setNetto(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('sklad.batch.taraLabel')}</Label>
              <Input type="text" disabled value={taraPreview ?? ''} className="bg-slate-50" />
            </div>
            <div>
              <Label>{t('sklad.batch.pieceWeightLabel')}</Label>
              <Input
                type="text"
                disabled
                value={pieceWeightPreview ?? ''}
                className="bg-slate-50"
              />
            </div>
            <div>
              <Label>{t('sklad.batch.donaLabel')}</Label>
              <Input type="number" value={dona} onChange={(e) => setDona(e.target.value)} />
            </div>
            <div>
              <Label>{t('sklad.batch.naborLabel')}</Label>
              <Input type="number" value={nabor} onChange={(e) => setNabor(e.target.value)} />
            </div>
            <div>
              <Label>{t('sklad.batch.palletLabel')}</Label>
              <Input type="number" value={pallet} onChange={(e) => setPallet(e.target.value)} />
            </div>
            <div>
              <Label>{t('sklad.batch.qoldiqLabel')}</Label>
              <Input type="number" value={qoldiq} onChange={(e) => setQoldiq(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>{t('sklad.batch.orderLabel')}</Label>
            {newOrderMode ? (
              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="text"
                    placeholder={t('sklad.batch.orderNoLabel')}
                    value={newOrderNo}
                    onChange={(e) => setNewOrderNo(e.target.value)}
                  />
                  <Input
                    type="text"
                    placeholder={t('sklad.batch.orderNameLabel')}
                    value={newOrderName}
                    onChange={(e) => setNewOrderName(e.target.value)}
                  />
                </div>
                <Select
                  value={newOrderCounterpartyId}
                  onChange={(e) => setNewOrderCounterpartyId(e.target.value)}
                >
                  <option value="">{t('sklad.batch.customerLabel')}</option>
                  {(counterparties ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={createOrder.isPending}
                    onClick={() => void handleAddOrder()}
                  >
                    {t('sklad.item.save')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setNewOrderMode(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Select
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="flex-1"
                >
                  <option value="">—</option>
                  {(orders ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNo ?? o.orderName ?? o.id}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewOrderMode(true)}
                >
                  {t('sklad.batch.newOrder')}
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('sklad.batch.producedAtLabel')}</Label>
              <Input
                type="date"
                value={producedAt}
                onChange={(e) => setProducedAt(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('sklad.batch.receivedAtLabel')}</Label>
              <Input
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('sklad.batch.statusLabel')}</Label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as SkladBatchStatus)}
              >
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`sklad.status.${s}`)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('sklad.batch.qcTitle')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('sklad.batch.qcCheckedByLabel')}</Label>
                <Select value={qcCheckedBy} onChange={(e) => setQcCheckedBy(e.target.value)}>
                  <option value="">—</option>
                  {roster.map((r) => (
                    <option key={r.user_id} value={r.user_id}>
                      {r.full_name ?? r.email}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{t('sklad.batch.qcCheckedAtLabel')}</Label>
                <Input
                  type="date"
                  value={qcCheckedAt}
                  onChange={(e) => setQcCheckedAt(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('sklad.batch.defectTypeLabel')}</Label>
                <Input
                  type="text"
                  value={defectType}
                  onChange={(e) => setDefectType(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('sklad.batch.defectQtyLabel')}</Label>
                <Input
                  type="number"
                  value={defectQty}
                  onChange={(e) => setDefectQty(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <Label>{t('sklad.batch.notesLabel')}</Label>
              <textarea
                className={textareaClass}
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('sklad.batch.locationTitle')}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label>{t('sklad.batch.locationSectorLabel')}</Label>
                <Input
                  type="text"
                  value={locationSector}
                  onChange={(e) => setLocationSector(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('sklad.batch.locationRowLabel')}</Label>
                <Input
                  type="text"
                  value={locationRow}
                  onChange={(e) => setLocationRow(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('sklad.batch.locationRackLabel')}</Label>
                <Input
                  type="text"
                  value={locationRack}
                  onChange={(e) => setLocationRack(e.target.value)}
                />
              </div>
              <div>
                <Label>{t('sklad.batch.locationShelfLabel')}</Label>
                <Input
                  type="text"
                  value={locationShelf}
                  onChange={(e) => setLocationShelf(e.target.value)}
                />
              </div>
            </div>
          </div>

          {isOrgAdmin && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                {t('sklad.price.title')}
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <Label>{t('sklad.price.pricePerKgLabel')}</Label>
                  <Input
                    type="number"
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('sklad.price.pricePerPieceLabel')}</Label>
                  <Input
                    type="number"
                    value={pricePerPiece}
                    onChange={(e) => setPricePerPiece(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('sklad.price.pricePerSetLabel')}</Label>
                  <Input
                    type="number"
                    value={pricePerSet}
                    onChange={(e) => setPricePerSet(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('sklad.price.totalAmountLabel')}</Label>
                  <Input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('sklad.price.purchaseCostLabel')}</Label>
                  <Input
                    type="number"
                    value={purchaseCost}
                    onChange={(e) => setPurchaseCost(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('sklad.price.profitPercentLabel')}</Label>
                  <Input
                    type="number"
                    value={profitPercent}
                    onChange={(e) => setProfitPercent(e.target.value)}
                  />
                </div>
                <div>
                  <Label>{t('sklad.price.profitAmountLabel')}</Label>
                  <Input
                    type="number"
                    value={profitAmount}
                    onChange={(e) => setProfitAmount(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {errorMessage && <p className="text-sm text-rose-600">{errorMessage}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={saving || !itemId}>
              {saving ? t('sklad.batch.saving') : t('sklad.batch.save')}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
