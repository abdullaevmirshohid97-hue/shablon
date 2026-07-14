import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { getLocalDb } from '../src/lib/db/localDb';

interface CounterpartyRow {
  id: string;
  org_id: string;
  name: string;
  categories: string[];
}

export default function CounterpartyListScreen() {
  const router = useRouter();
  const [counterparties, setCounterparties] = useState<CounterpartyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadCounterparties();
  }, []);

  async function loadCounterparties() {
    setLoading(true);
    const { data, error } = await supabase
      .from('counterparties')
      .select('id, org_id, name, categories')
      .order('name');

    if (!error && data) {
      setCounterparties(data);
      const db = await getLocalDb();
      for (const c of data) {
        await db.runAsync(
          `INSERT OR REPLACE INTO cached_counterparties (id, org_id, name, categories) VALUES (?, ?, ?, ?)`,
          [c.id, c.org_id, c.name, JSON.stringify(c.categories)],
        );
      }
    } else {
      // Offline: fall back to the local cache.
      const db = await getLocalDb();
      const cached = await db.getAllAsync<{ id: string; org_id: string; name: string; categories: string }>(
        'SELECT * FROM cached_counterparties ORDER BY name',
      );
      setCounterparties(
        cached.map((c) => ({ ...c, categories: JSON.parse(c.categories) as string[] })),
      );
    }
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      {loading && <Text style={styles.muted}>Yuklanmoqda...</Text>}
      <FlatList
        data={counterparties}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push({ pathname: '/counterparty/[id]', params: { id: item.id, orgId: item.org_id, name: item.name } })
            }
          >
            <Text style={styles.rowTitle}>{item.name}</Text>
            {item.categories?.length ? (
              <Text style={styles.muted}>{item.categories.join(', ')}</Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.muted}>Kontragentlar topilmadi</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  muted: { color: '#64748b', marginTop: 2 },
});
