import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { getLocalDb } from '../src/lib/db/localDb';
import { useSyncQueue } from '../src/hooks/useSyncQueue';
import { Sidebar, ALL_MODULES } from '../src/components/Sidebar';
import { loadModules, type MobileModule } from '../src/lib/data/modules';
import { clearCachedOrgRole } from '../src/lib/data/orgRole';
import { useOrgRole } from '../src/hooks/useOrgRole';

interface CounterpartyRow {
  id: string;
  org_id: string;
  name: string;
  phone: string | null;
  categories: string[];
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

export default function CounterpartyListScreen() {
  const router = useRouter();
  const { pendingCount, failedCount, lastError, isSyncing, runSync } = useSyncQueue();
  const { canWrite, isLoading: roleLoading } = useOrgRole();
  const [counterparties, setCounterparties] = useState<CounterpartyRow[]>([]);
  const [modules, setModules] = useState<MobileModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>(ALL_MODULES);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');

  const loadCounterparties = useCallback(async () => {
    const { data, error } = await supabase
      .from('counterparties')
      .select('id, org_id, name, phone, categories')
      .order('name');

    if (!error && data) {
      setOffline(false);
      setCounterparties(data);
      const db = await getLocalDb();
      for (const c of data) {
        await db.runAsync(
          `INSERT OR REPLACE INTO cached_counterparties (id, org_id, name, categories) VALUES (?, ?, ?, ?)`,
          [c.id, c.org_id, c.name, JSON.stringify(c.categories)],
        );
      }
    } else {
      setOffline(true);
      const db = await getLocalDb();
      const cached = await db.getAllAsync<{
        id: string;
        org_id: string;
        name: string;
        categories: string;
      }>('SELECT * FROM cached_counterparties ORDER BY name');
      setCounterparties(
        cached.map((c) => ({
          ...c,
          phone: null,
          categories: JSON.parse(c.categories) as string[],
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCounterparties();
    void loadModules().then(setModules);
    void supabase
      .from('organizations')
      .select('name')
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]?.name) setOrgName(data[0].name);
      });
    void supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? ''));
  }, [loadCounterparties]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadCounterparties(), loadModules().then(setModules), runSync()]);
    setRefreshing(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return counterparties.filter((c) => {
      const moduleOk =
        selectedModule === ALL_MODULES || (c.categories ?? []).includes(selectedModule);
      const searchOk = !q || c.name.toLowerCase().includes(q);
      return moduleOk && searchOk;
    });
  }, [counterparties, search, selectedModule]);

  const title = selectedModule === ALL_MODULES ? 'Mijozlar' : selectedModule;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title,
          headerLeft: () => (
            <Pressable onPress={() => setSidebarOpen(true)} hitSlop={12} style={styles.hamburger}>
              <View style={styles.bar} />
              <View style={styles.bar} />
              <View style={styles.bar} />
            </Pressable>
          ),
        }}
      />

      <Sidebar
        visible={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        modules={modules}
        selected={selectedModule}
        onSelect={setSelectedModule}
        orgName={orgName}
        userEmail={userEmail}
        onSignOut={() => {
          setSidebarOpen(false);
          // Drop the cached role first: on a shared phone the next person to
          // sign in must not inherit the previous user's write permission.
          void clearCachedOrgRole().then(() => supabase.auth.signOut());
        }}
      />

      {!roleLoading && !canWrite && (
        <Text style={styles.readOnlyBanner}>
          Faqat ko&apos;rish rejimi — jurnallarni ko&apos;rish va eksport qilish mumkin
        </Text>
      )}

      {offline && (
        <Text style={styles.offlineBanner}>Oflayn rejim — saqlangan ro'yxat ko'rsatilmoqda</Text>
      )}

      {pendingCount > 0 && (
        <Pressable style={styles.syncBadge} onPress={() => void runSync()}>
          <Text style={styles.syncBadgeText}>
            {isSyncing
              ? 'Sinxronlanmoqda...'
              : `${pendingCount} ta yozuv yuborilishi kutilmoqda — bosib qayta yuboring`}
          </Text>
          {failedCount > 0 && lastError && (
            <Text style={styles.syncErrorText} numberOfLines={2}>
              Xatolik: {lastError}
            </Text>
          )}
        </Pressable>
      )}

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder="Qidirish..."
        placeholderTextColor="#94a3b8"
        autoCorrect={false}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({
                pathname: '/counterparty/[id]',
                params: {
                  id: item.id,
                  orgId: item.org_id,
                  name: item.name,
                  phone: item.phone ?? '',
                },
              })
            }
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(item.name)}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.muted} numberOfLines={1}>
                {[item.phone, item.categories?.join(', ')].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              {search || selectedModule !== ALL_MODULES
                ? 'Hech narsa topilmadi'
                : 'Kontragentlar topilmadi'}
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#f8fafc' },
  hamburger: { paddingHorizontal: 4, paddingVertical: 6, gap: 3 },
  bar: { width: 20, height: 2, borderRadius: 2, backgroundColor: '#0f172a' },
  offlineBanner: {
    color: '#92400e',
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 13,
  },
  syncBadge: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  readOnlyBanner: {
    color: '#475569',
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 13,
  },
  syncBadgeText: { color: '#92400e', fontSize: 13, fontWeight: '600' },
  syncErrorText: { color: '#be123c', fontSize: 12, marginTop: 4 },
  search: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#fff',
    marginBottom: 10,
    fontSize: 15,
    color: '#0f172a',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { color: '#3730a3', fontWeight: '700' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  muted: { color: '#64748b', marginTop: 2, fontSize: 13 },
  chevron: { color: '#cbd5e1', fontSize: 22, marginLeft: 6 },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 24 },
});
