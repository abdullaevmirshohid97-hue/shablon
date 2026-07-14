import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { supabase } from '../../src/lib/supabase';
import { getLocalDb } from '../../src/lib/db/localDb';
import { enqueueTransaction } from '../../src/lib/db/sync';
import { useSyncQueue } from '../../src/hooks/useSyncQueue';

interface CategoryRow {
  id: string;
  org_id: string;
  name: string;
  unit: string | null;
}

export default function TransactionEntryScreen() {
  const { id: counterpartyId, orgId, name } = useLocalSearchParams<{
    id: string;
    orgId: string;
    name: string;
  }>();
  const { pendingCount, isSyncing, runSync } = useSyncQueue();

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadCategories();
  }, [orgId]);

  async function loadCategories() {
    const { data, error } = await supabase
      .from('transaction_categories')
      .select('id, org_id, name, unit')
      .eq('org_id', orgId);

    if (!error && data) {
      setCategories(data);
      const db = await getLocalDb();
      for (const c of data) {
        await db.runAsync(
          'INSERT OR REPLACE INTO cached_categories (id, org_id, name, unit) VALUES (?, ?, ?, ?)',
          [c.id, c.org_id, c.name, c.unit],
        );
      }
    } else {
      const db = await getLocalDb();
      const cached = await db.getAllAsync<CategoryRow>(
        'SELECT * FROM cached_categories WHERE org_id = ?',
        [orgId],
      );
      setCategories(cached);
    }
  }

  const selectedCategory = categories.find((c) => c.id === categoryId);

  async function handleSubmit() {
    if (!categoryId || !amount) {
      Alert.alert('Diqqat', 'Kategoriya va summani kiriting');
      return;
    }

    setSubmitting(true);
    try {
      await enqueueTransaction({
        orgId,
        counterpartyId,
        categoryId,
        occurredAt: new Date().toISOString(),
        description: description || undefined,
        quantity: quantity ? Number(quantity) : undefined,
        unit: selectedCategory?.unit ?? undefined,
        amount: Number(amount),
        currency: 'UZS',
        clientLocalId: Crypto.randomUUID(),
      });
      setQuantity('');
      setAmount('');
      setDescription('');
      Alert.alert('Saqlandi', 'Yozuv navbatga qo‘shildi va ulanish bo‘lganda avtomatik yuboriladi');
      void runSync();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{name}</Text>
      {pendingCount > 0 && (
        <Text style={styles.badge}>
          {isSyncing ? 'Sinxronlanmoqda...' : `${pendingCount} ta yozuv yuborilishi kutilmoqda`}
        </Text>
      )}

      <Text style={styles.label}>Kategoriya</Text>
      <View style={styles.chipRow}>
        {categories.map((c) => (
          <Pressable
            key={c.id}
            style={[styles.chip, categoryId === c.id && styles.chipSelected]}
            onPress={() => setCategoryId(c.id)}
          >
            <Text style={categoryId === c.id ? styles.chipTextSelected : styles.chipText}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </View>

      {selectedCategory?.unit && (
        <>
          <Text style={styles.label}>Miqdor ({selectedCategory.unit})</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
          />
        </>
      )}

      <Text style={styles.label}>Summa</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} />

      <Text style={styles.label}>Izoh</Text>
      <TextInput style={styles.input} value={description} onChangeText={setDescription} />

      <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.submitButtonText}>{submitting ? 'Saqlanmoqda...' : 'Saqlash'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  badge: { color: '#b45309', backgroundColor: '#fef3c7', padding: 8, borderRadius: 8, marginBottom: 12 },
  label: { marginTop: 12, marginBottom: 4, fontWeight: '600', color: '#334155' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { color: '#334155' },
  chipTextSelected: { color: '#fff' },
  submitButton: { marginTop: 20, backgroundColor: '#0f172a', borderRadius: 8, padding: 14, alignItems: 'center' },
  submitButtonText: { color: '#fff', fontWeight: '600' },
});
