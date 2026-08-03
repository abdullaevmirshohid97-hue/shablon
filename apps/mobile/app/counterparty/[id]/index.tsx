import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { computeRunningBalance, type LedgerTransaction } from '@mubosher/shared';
import { loadLedger } from '../../../src/lib/data/ledger';
import {
  discardPendingTransaction,
  getPendingForCounterparty,
  type PendingRow,
} from '../../../src/lib/db/sync';
import { useSyncQueue } from '../../../src/hooks/useSyncQueue';
import { useOrgRole } from '../../../src/hooks/useOrgRole';
import { useResponsive } from '../../../src/theme';
import { reverseTransaction } from '../../../src/lib/data/reversal';
import { loadCurrencies } from '../../../src/lib/data/currencies';
import { formatDate, formatMoney, todayIso } from '../../../src/lib/format';
import {
  exportPdf,
  exportExcel,
  exportCsv,
  shareInvoiceText,
  openTelegramChat,
} from '../../../src/lib/export';

type TxKind = 'kirim' | 'chiqim' | 'other';

function txKind(t: LedgerTransaction): TxKind {
  if (t.debitAccountType === 'receivable') return 'kirim';
  if (t.creditAccountType === 'receivable') return 'chiqim';
  return 'other';
}

function dueTone(dueDate: string | null | undefined, today: string): 'danger' | 'warning' | null {
  if (!dueDate) return null;
  if (dueDate < today) return 'danger';
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 7);
  return dueDate <= horizon.toISOString().slice(0, 10) ? 'warning' : null;
}

export default function CounterpartyLedgerScreen() {
  const {
    id: counterpartyId,
    orgId,
    name,
    phone,
  } = useLocalSearchParams<{
    id: string;
    orgId: string;
    name: string;
    phone: string;
  }>();
  const router = useRouter();
  const { pendingCount, failedCount, lastError, isSyncing, runSync } = useSyncQueue();
  const { canWrite } = useOrgRole();
  const { isTablet, gutter, maxContentWidth } = useResponsive();

  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState('UZS');

  const hasPhone = !!phone && phone.trim().length > 0;

  async function runAction(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      Alert.alert('Xatolik', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function onExportPress() {
    if (transactions.length === 0) {
      Alert.alert('Bo‘sh', 'Eksport qilish uchun yozuvlar yo‘q.');
      return;
    }
    Alert.alert('Eksport / ulashish', 'Formatni tanlang', [
      { text: 'PDF', onPress: () => void runAction(() => exportPdf(name, transactions)) },
      { text: 'Excel', onPress: () => void runAction(() => exportExcel(name, transactions)) },
      { text: 'CSV', onPress: () => void runAction(() => exportCsv(name, transactions)) },
      { text: 'Bekor qilish', style: 'cancel' },
    ]);
  }

  function onTelegramPress() {
    Alert.alert('Telegram', `${name}ga yuborish`, [
      {
        text: 'Faktura matnini yuborish',
        onPress: () => void runAction(() => shareInvoiceText(name, transactions)),
      },
      { text: 'PDF yuborish', onPress: () => void runAction(() => exportPdf(name, transactions)) },
      ...(hasPhone
        ? [{ text: 'Chatni ochish', onPress: () => void runAction(() => openTelegramChat(phone!)) }]
        : []),
      { text: 'Bekor qilish', style: 'cancel' as const },
    ]);
  }

  const load = useCallback(async () => {
    const [ledger, pending] = await Promise.all([
      loadLedger(orgId, counterpartyId),
      getPendingForCounterparty(counterpartyId),
    ]);
    setTransactions(ledger.transactions);
    setFromCache(ledger.fromCache);
    setPendingRows(pending);
    setLoading(false);
  }, [orgId, counterpartyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCurrencies(orgId).then(({ base }) => setBaseCurrency(base));
  }, [orgId]);

  // Reload when returning from the entry screen (new pending row) and after
  // every sync pass (pending row became a server row).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (!isSyncing) void load();
  }, [isSyncing, load]);

  async function handleRefresh() {
    setRefreshing(true);
    await runSync();
    await load();
    setRefreshing(false);
  }

  // Reversing is the only way to undo a posted entry — the server refuses a
  // delete outright. Mobile offers the same action the web ledger does, minus
  // the date picker: from a phone it is always "today, into the open month".
  function onRowPress(item: LedgerTransaction) {
    if (!canWrite || item.status === 'reversed' || item.status === 'reversal') return;

    Alert.alert(
      'Storno qilish',
      `${item.description || item.documentNo || 'Yozuv'} — ${formatMoney(item.debitAmount)} ${item.currency}\n\nYozuv o'chirilmaydi: uni bekor qiluvchi teskari yozuv qo'shiladi.`,
      [
        { text: 'Bekor qilish', style: 'cancel' },
        {
          text: 'Storno qilish',
          style: 'destructive',
          onPress: () =>
            void runAction(async () => {
              await reverseTransaction(item.id);
              await load();
            }),
        },
      ],
    );
  }

  async function handleDiscard(clientLocalId: string) {
    await discardPendingTransaction(clientLocalId);
    await load();
  }

  const balances = useMemo(() => computeRunningBalance(transactions), [transactions]);
  const currentBalance = balances[balances.length - 1];
  const today = todayIso();

  // A rejected row will never go through (the server refused it outright), so
  // it is shown apart from the queue rather than as "still sending".
  const queuedRows = useMemo(() => pendingRows.filter((p) => !p.rejected_at), [pendingRows]);
  const rejectedRows = useMemo(() => pendingRows.filter((p) => p.rejected_at), [pendingRows]);

  // Newest first for the list; computeRunningBalance needed them oldest-first.
  const listData = useMemo(() => [...transactions].reverse(), [transactions]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: name || 'Jurnal' }} />

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={[
          styles.listContent,
          { padding: gutter, paddingBottom: 96 },
          maxContentWidth
            ? { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' }
            : null,
        ]}
        ListHeaderComponent={
          <View>
            {fromCache && (
              <Text style={styles.offlineBanner}>
                Oflayn rejim — oxirgi saqlangan ma'lumotlar ko'rsatilmoqda
              </Text>
            )}

            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Joriy saldo</Text>
              <Text
                style={[
                  styles.balanceValue,
                  currentBalance?.side === 'credit' ? styles.chiqimText : styles.kirimText,
                ]}
              >
                {currentBalance ? formatMoney(currentBalance.balance) : '0'} {baseCurrency}
              </Text>
              {currentBalance && currentBalance.balance > 0 && (
                <Text style={styles.balanceSide}>
                  {currentBalance.side === 'debit' ? 'Bizga qarzdor' : 'Biz qarzdormiz'}
                </Text>
              )}
              {pendingCount > 0 && (
                <Text style={styles.balanceHint}>
                  Saldoga hali yuborilmagan {pendingCount} ta yozuv kirmagan
                </Text>
              )}
            </View>

            <View style={[styles.actionsRow, isTablet && styles.actionsRowWide]}>
              <Pressable
                style={[styles.actionBtn, busy && styles.actionBtnDisabled]}
                onPress={onExportPress}
                disabled={busy}
              >
                <Text style={styles.actionIcon}>⬇</Text>
                <Text style={styles.actionText}>Eksport</Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, busy && styles.actionBtnDisabled]}
                onPress={() => void runAction(() => exportPdf(name, transactions))}
                disabled={busy}
              >
                <Text style={styles.actionIcon}>↗</Text>
                <Text style={styles.actionText}>Ulashish</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.actionBtn,
                  styles.actionBtnTelegram,
                  busy && styles.actionBtnDisabled,
                ]}
                onPress={onTelegramPress}
                disabled={busy}
              >
                <Text style={[styles.actionIcon, styles.actionTextTelegram]}>✈</Text>
                <Text style={[styles.actionText, styles.actionTextTelegram]}>Telegram</Text>
              </Pressable>
            </View>

            {queuedRows.length > 0 && (
              <View style={styles.pendingBlock}>
                <View style={styles.pendingHeader}>
                  <Text style={styles.pendingTitle}>
                    {isSyncing
                      ? 'Sinxronlanmoqda...'
                      : `Yuborilishi kutilmoqda: ${queuedRows.length} ta`}
                  </Text>
                  <Pressable onPress={() => void handleRefresh()} disabled={isSyncing}>
                    <Text style={styles.retryLink}>Qayta yuborish</Text>
                  </Pressable>
                </View>
                {failedCount > 0 && lastError && (
                  <Text style={styles.pendingError}>Xatolik: {lastError}</Text>
                )}
                {queuedRows.map((p) => (
                  <View key={p.client_local_id} style={styles.pendingRow}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.rowDate}>{formatDate(p.occurred_at)}</Text>
                      {!!p.description && <Text style={styles.rowDesc}>{p.description}</Text>}
                      {!!p.last_error && (
                        <Text style={styles.pendingRowError} numberOfLines={2}>
                          {p.last_error}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.pendingAmount}>{formatMoney(p.amount)}</Text>
                  </View>
                ))}
              </View>
            )}

            {rejectedRows.length > 0 && (
              <View style={styles.rejectedBlock}>
                <Text style={styles.rejectedTitle}>Qabul qilinmadi: {rejectedRows.length} ta</Text>
                {rejectedRows.map((p) => (
                  <View key={p.client_local_id} style={styles.rejectedRow}>
                    <View style={styles.rowLeft}>
                      <Text style={styles.rowDate}>{formatDate(p.occurred_at)}</Text>
                      {!!p.description && <Text style={styles.rowDesc}>{p.description}</Text>}
                      {!!p.last_error && <Text style={styles.pendingRowError}>{p.last_error}</Text>}
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rejectedAmount}>{formatMoney(p.amount)}</Text>
                      <Pressable onPress={() => void handleDiscard(p.client_local_id)}>
                        <Text style={styles.discardLink}>O'chirish</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {listData.length > 0 && <Text style={styles.sectionTitle}>Tarix</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const kind = txKind(item);
          // A reversed entry is struck through and dimmed; the mirror that
          // cancelled it is tinted. Without this the phone showed a cancelled
          // entry as if it were still live — the balance said otherwise.
          const isReversed = item.status === 'reversed';
          const isReversal = item.status === 'reversal';
          const tone = dueTone(item.dueDate, today);
          const quantities = [
            item.quantityKg != null ? `${formatMoney(item.quantityKg)} kg` : null,
            item.quantityDona != null ? `${formatMoney(item.quantityDona)} dona` : null,
            item.quantityKg == null && item.quantityDona == null && item.quantity != null
              ? `${formatMoney(item.quantity)} ${item.unit ?? ''}`.trim()
              : null,
          ].filter(Boolean);

          return (
            <Pressable
              onPress={() => onRowPress(item)}
              disabled={!canWrite || isReversed || isReversal}
              style={[
                styles.txRow,
                isReversal && styles.txRowReversal,
                isReversed && styles.txRowReversed,
              ]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowDate}>{formatDate(item.occurredAt)}</Text>
                <Text
                  style={[styles.rowDesc, isReversed && styles.rowDescReversed]}
                  numberOfLines={2}
                >
                  {item.description || item.categoryName || '—'}
                </Text>
                {(isReversed || isReversal) && (
                  <Text style={isReversal ? styles.tagReversal : styles.tagReversed}>
                    {isReversal ? 'Storno' : 'Storno qilingan'}
                  </Text>
                )}
                <View style={styles.metaRow}>
                  {quantities.length > 0 && (
                    <Text style={styles.metaText}>{quantities.join(' · ')}</Text>
                  )}
                  <Text style={styles.metaText}>
                    {item.source === 'fabrika' ? 'Fabrika' : 'Shaxsiy'}
                  </Text>
                  {item.dueDate && (
                    <Text
                      style={[
                        styles.dueBadge,
                        tone === 'danger' && styles.dueDanger,
                        tone === 'warning' && styles.dueWarning,
                      ]}
                    >
                      Srok: {formatDate(item.dueDate)}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.rowRight}>
                <Text
                  style={[
                    styles.rowAmount,
                    kind === 'kirim' ? styles.kirimText : styles.chiqimText,
                    isReversed && styles.amountReversed,
                  ]}
                >
                  {kind === 'chiqim' ? '−' : '+'}
                  {formatMoney(item.debitAmount)}
                  {item.currency !== baseCurrency ? ` ${item.currency}` : ''}
                </Text>
                <Text style={styles.kindLabel}>
                  {kind === 'kirim' ? 'Kirim' : kind === 'chiqim' ? 'Chiqim' : ''}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading && pendingRows.length === 0 ? (
            <Text style={styles.empty}>Hozircha tranzaksiyalar yo'q</Text>
          ) : null
        }
      />

      {/* Managers read and export; only owner/admin may add an entry. */}
      {canWrite && (
        <Pressable
          style={styles.fab}
          onPress={() =>
            router.push({
              pathname: '/counterparty/[id]/new',
              params: { id: counterpartyId, orgId, name },
            })
          }
        >
          <Text style={styles.fabText}>+ Yangi yozuv</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  listContent: { padding: 16, paddingBottom: 96 },
  offlineBanner: {
    color: '#7C5514',
    backgroundColor: '#FBF7EF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 13,
  },
  balanceCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9E9EB',
  },
  balanceLabel: { color: '#5C5C64', fontSize: 13, fontWeight: '600' },
  balanceValue: { fontSize: 26, fontWeight: '800', marginTop: 4 },
  balanceSide: { marginTop: 2, color: '#5C5C64', fontSize: 13 },
  balanceHint: { marginTop: 6, color: '#7C5514', fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E9E9EB',
    borderRadius: 10,
    paddingVertical: 10,
  },
  actionBtnTelegram: { backgroundColor: '#e8f2fb', borderColor: '#bcdcf5' },
  actionBtnDisabled: { opacity: 0.5 },
  actionIcon: { fontSize: 14, color: '#2A2A30' },
  actionText: { fontSize: 13, fontWeight: '600', color: '#2A2A30' },
  actionTextTelegram: { color: '#000000' },
  kirimText: { color: '#2E7D48' },
  chiqimText: { color: '#A33A3A' },
  pendingBlock: {
    backgroundColor: '#FBF7EF',
    borderColor: '#E6D6B2',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pendingTitle: { fontWeight: '700', color: '#7C5514', fontSize: 13 },
  retryLink: { color: '#000000', fontWeight: '600', fontSize: 13 },
  pendingError: { color: '#A33A3A', marginTop: 6, fontSize: 12 },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E6D6B2',
  },
  pendingRowError: { color: '#A33A3A', fontSize: 11, marginTop: 2 },
  pendingAmount: { fontWeight: '700', color: '#7C5514' },
  rejectedBlock: {
    backgroundColor: '#FBF3F3',
    borderColor: '#EACCCC',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  rejectedTitle: { fontWeight: '700', color: '#A33A3A', fontSize: 13 },
  rejectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EACCCC',
  },
  rejectedAmount: { fontWeight: '700', color: '#A33A3A' },
  discardLink: { color: '#000000', fontWeight: '600', fontSize: 12, marginTop: 2 },
  sectionTitle: { fontWeight: '700', color: '#2A2A30', marginBottom: 6, fontSize: 15 },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9E9EB',
    padding: 12,
    marginBottom: 8,
  },
  rowLeft: { flex: 1, paddingRight: 10 },
  rowRight: { alignItems: 'flex-end', justifyContent: 'center' },
  rowDate: { color: '#8A8A93', fontSize: 12 },
  rowDesc: { color: '#000000', fontWeight: '600', marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, alignItems: 'center' },
  metaText: { color: '#5C5C64', fontSize: 12 },
  dueBadge: {
    fontSize: 11,
    color: '#2A2A30',
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  dueDanger: { color: '#fff', backgroundColor: '#A33A3A' },
  dueWarning: { color: '#7C5514', backgroundColor: '#E6D6B2' },
  rowAmount: { fontWeight: '800', fontSize: 15 },
  txRowReversal: { backgroundColor: '#FBF7EF', borderColor: '#E6D6B2' },
  txRowReversed: { opacity: 0.55 },
  rowDescReversed: { textDecorationLine: 'line-through' },
  amountReversed: { textDecorationLine: 'line-through' },
  tagReversed: {
    marginTop: 4,
    alignSelf: 'flex-start',
    fontSize: 11,
    color: '#5C5C64',
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E9E9EB',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  tagReversal: {
    marginTop: 4,
    alignSelf: 'flex-start',
    fontSize: 11,
    color: '#7C5514',
    backgroundColor: '#FBF7EF',
    borderWidth: 1,
    borderColor: '#E6D6B2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    overflow: 'hidden',
  },
  actionsRowWide: { maxWidth: 520, alignSelf: 'flex-start' },
  kindLabel: { color: '#8A8A93', fontSize: 11, marginTop: 2 },
  empty: { textAlign: 'center', color: '#5C5C64', marginTop: 24 },
  fab: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
