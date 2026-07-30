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

  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

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
        contentContainerStyle={styles.listContent}
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
                {currentBalance ? formatMoney(currentBalance.balance) : '0'} so'm
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

            <View style={styles.actionsRow}>
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
          const tone = dueTone(item.dueDate, today);
          const quantities = [
            item.quantityKg != null ? `${formatMoney(item.quantityKg)} kg` : null,
            item.quantityDona != null ? `${formatMoney(item.quantityDona)} dona` : null,
            item.quantityKg == null && item.quantityDona == null && item.quantity != null
              ? `${formatMoney(item.quantity)} ${item.unit ?? ''}`.trim()
              : null,
          ].filter(Boolean);

          return (
            <View style={styles.txRow}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowDate}>{formatDate(item.occurredAt)}</Text>
                <Text style={styles.rowDesc} numberOfLines={2}>
                  {item.description || item.categoryName || '—'}
                </Text>
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
                  ]}
                >
                  {kind === 'chiqim' ? '−' : '+'}
                  {formatMoney(item.debitAmount)}
                </Text>
                <Text style={styles.kindLabel}>
                  {kind === 'kirim' ? 'Kirim' : kind === 'chiqim' ? 'Chiqim' : ''}
                </Text>
              </View>
            </View>
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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  listContent: { padding: 16, paddingBottom: 96 },
  offlineBanner: {
    color: '#92400e',
    backgroundColor: '#fef3c7',
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
    borderColor: '#e2e8f0',
  },
  balanceLabel: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  balanceValue: { fontSize: 26, fontWeight: '800', marginTop: 4 },
  balanceSide: { marginTop: 2, color: '#64748b', fontSize: 13 },
  balanceHint: { marginTop: 6, color: '#b45309', fontSize: 12 },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingVertical: 10,
  },
  actionBtnTelegram: { backgroundColor: '#e8f2fb', borderColor: '#bcdcf5' },
  actionBtnDisabled: { opacity: 0.5 },
  actionIcon: { fontSize: 14, color: '#334155' },
  actionText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  actionTextTelegram: { color: '#1d4ed8' },
  kirimText: { color: '#047857' },
  chiqimText: { color: '#be123c' },
  pendingBlock: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pendingTitle: { fontWeight: '700', color: '#92400e', fontSize: 13 },
  retryLink: { color: '#1d4ed8', fontWeight: '600', fontSize: 13 },
  pendingError: { color: '#be123c', marginTop: 6, fontSize: 12 },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
  },
  pendingRowError: { color: '#be123c', fontSize: 11, marginTop: 2 },
  pendingAmount: { fontWeight: '700', color: '#92400e' },
  rejectedBlock: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  rejectedTitle: { fontWeight: '700', color: '#be123c', fontSize: 13 },
  rejectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#fecdd3',
  },
  rejectedAmount: { fontWeight: '700', color: '#be123c' },
  discardLink: { color: '#1d4ed8', fontWeight: '600', fontSize: 12, marginTop: 2 },
  sectionTitle: { fontWeight: '700', color: '#334155', marginBottom: 6, fontSize: 15 },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  rowLeft: { flex: 1, paddingRight: 10 },
  rowRight: { alignItems: 'flex-end', justifyContent: 'center' },
  rowDate: { color: '#94a3b8', fontSize: 12 },
  rowDesc: { color: '#0f172a', fontWeight: '600', marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, alignItems: 'center' },
  metaText: { color: '#64748b', fontSize: 12 },
  dueBadge: {
    fontSize: 11,
    color: '#475569',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  dueDanger: { color: '#fff', backgroundColor: '#e11d48' },
  dueWarning: { color: '#92400e', backgroundColor: '#fde68a' },
  rowAmount: { fontWeight: '800', fontSize: 15 },
  kindLabel: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 24 },
  fab: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
