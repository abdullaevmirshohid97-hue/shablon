import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { enqueueTransaction } from '../../../src/lib/db/sync';
import { loadCategoriesWithKind, type MobileCategory } from '../../../src/lib/data/categories';
import { useSyncQueue } from '../../../src/hooks/useSyncQueue';
import { useOrgRole } from '../../../src/hooks/useOrgRole';
import { todayIso } from '../../../src/lib/format';

type EntryKind = 'kirim' | 'chiqim';
type DueChoice = 'none' | '7' | '14' | '30' | 'custom';

/**
 * "12 500,5" / "12500.5" -> 12500.5; returns null for empty input and NaN
 * for anything that isn't a number, so callers can tell the cases apart.
 */
function parseDecimal(text: string): number | null {
  const normalized = text.replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;
  return Number(normalized);
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function TransactionEntryScreen() {
  const {
    id: counterpartyId,
    orgId,
    name,
  } = useLocalSearchParams<{
    id: string;
    orgId: string;
    name: string;
  }>();
  const router = useRouter();
  const { runSync } = useSyncQueue();
  const { canWrite, isLoading: roleLoading } = useOrgRole();

  const [categories, setCategories] = useState<MobileCategory[]>([]);
  const [kind, setKind] = useState<EntryKind>('kirim');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [source, setSource] = useState<'fabrika' | 'shaxsiy'>('fabrika');
  const [kg, setKg] = useState('');
  const [dona, setDona] = useState('');
  const [amount, setAmount] = useState('');
  const [dueChoice, setDueChoice] = useState<DueChoice>('none');
  const [customDue, setCustomDue] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadCategoriesWithKind(orgId).then(setCategories);
  }, [orgId]);

  const matchingCategories = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind],
  );
  const selectedCategory =
    matchingCategories.find((c) => c.id === categoryId) ?? matchingCategories[0];

  function validate(): {
    amountValue: number;
    kgValue?: number;
    donaValue?: number;
    dueDate?: string;
  } | null {
    if (!selectedCategory) {
      Alert.alert(
        'Diqqat',
        `${kind === 'kirim' ? 'Kirim' : 'Chiqim'} turi uchun kategoriya topilmadi. Avval admin panelda kategoriya sozlang.`,
      );
      return null;
    }

    const amountValue = parseDecimal(amount);
    if (
      amountValue === null ||
      Number.isNaN(amountValue) ||
      !Number.isFinite(amountValue) ||
      amountValue <= 0
    ) {
      Alert.alert('Diqqat', "Summani to'g'ri kiriting (faqat musbat raqam)");
      return null;
    }

    const kgValue = parseDecimal(kg);
    if (kgValue !== null && (Number.isNaN(kgValue) || kgValue <= 0)) {
      Alert.alert('Diqqat', "Kg qiymatini to'g'ri kiriting");
      return null;
    }

    const donaValue = parseDecimal(dona);
    if (donaValue !== null && (Number.isNaN(donaValue) || donaValue <= 0)) {
      Alert.alert('Diqqat', "Dona qiymatini to'g'ri kiriting");
      return null;
    }

    let dueDate: string | undefined;
    if (kind === 'chiqim' && dueChoice !== 'none') {
      if (dueChoice === 'custom') {
        const value = customDue.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(value).getTime())) {
          Alert.alert(
            'Diqqat',
            "Srok sanasini YYYY-MM-DD ko'rinishida kiriting (masalan 2026-08-01)",
          );
          return null;
        }
        dueDate = value;
      } else {
        dueDate = addDaysIso(Number(dueChoice));
      }
    }

    return {
      amountValue,
      kgValue: kgValue ?? undefined,
      donaValue: donaValue ?? undefined,
      dueDate,
    };
  }

  async function handleSubmit() {
    const validated = validate();
    if (!validated) return;

    setSubmitting(true);
    try {
      await enqueueTransaction({
        orgId,
        counterpartyId,
        categoryId: selectedCategory!.id,
        occurredAt: new Date().toISOString(),
        dueDate: validated.dueDate,
        description: description.trim() || undefined,
        quantityKg: validated.kgValue,
        quantityDona: validated.donaValue,
        amount: validated.amountValue,
        currency: 'UZS',
        source,
        clientLocalId: Crypto.randomUUID(),
      });
      void runSync();
      Alert.alert(
        'Saqlandi',
        "Yozuv navbatga qo'shildi va ulanish bo'lganda avtomatik yuboriladi",
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } finally {
      setSubmitting(false);
    }
  }

  // The ledger screen already hides the entry button for managers; this
  // closes the route itself, which a deep link or a stale back-stack could
  // still reach. Nothing is queued that the server would only refuse later.
  if (!roleLoading && !canWrite) {
    return (
      <View style={[styles.container, styles.deniedBox]}>
        <Stack.Screen options={{ title: name || 'Yozuv kiritish' }} />
        <Text style={styles.deniedTitle}>Faqat ko&apos;rish huquqi</Text>
        <Text style={styles.deniedText}>
          Yozuv kiritish administrator huquqini talab qiladi. Siz jurnalni ko&apos;rishingiz va
          eksport qilishingiz mumkin.
        </Text>
        <Pressable style={styles.deniedButton} onPress={() => router.back()}>
          <Text style={styles.deniedButtonText}>Orqaga</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: name ? `${name} — yozuv` : 'Yozuv kiritish' }} />

      <View style={styles.kindRow}>
        {(['kirim', 'chiqim'] as const).map((k) => (
          <Pressable
            key={k}
            style={[
              styles.kindButton,
              kind === k && (k === 'kirim' ? styles.kindKirimActive : styles.kindChiqimActive),
            ]}
            onPress={() => {
              setKind(k);
              setCategoryId(null);
            }}
          >
            <Text style={kind === k ? styles.kindTextActive : styles.kindText}>
              {k === 'kirim' ? 'Kirim' : 'Chiqim'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Kategoriya</Text>
      {matchingCategories.length === 0 ? (
        <Text style={styles.hint}>
          Bu tur uchun kategoriya yo'q. Admin panel → Sozlamalar bo'limida kategoriya qo'shing.
        </Text>
      ) : (
        <View style={styles.chipRow}>
          {matchingCategories.map((c) => (
            <Pressable
              key={c.id}
              style={[styles.chip, selectedCategory?.id === c.id && styles.chipSelected]}
              onPress={() => setCategoryId(c.id)}
            >
              <Text
                style={selectedCategory?.id === c.id ? styles.chipTextSelected : styles.chipText}
              >
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.label}>Manba</Text>
      <View style={styles.chipRow}>
        {(['fabrika', 'shaxsiy'] as const).map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, source === s && styles.chipSelected]}
            onPress={() => setSource(s)}
          >
            <Text style={source === s ? styles.chipTextSelected : styles.chipText}>
              {s === 'fabrika' ? 'Fabrika' : 'Shaxsiy'}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.twoCol}>
        <View style={styles.col}>
          <Text style={styles.label}>Kg</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={kg}
            onChangeText={setKg}
            placeholder="0"
            placeholderTextColor="#94a3b8"
          />
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Dona</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={dona}
            onChangeText={setDona}
            placeholder="0"
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>

      <Text style={styles.label}>Summa (so'm) *</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        placeholder="0"
        placeholderTextColor="#94a3b8"
      />

      {kind === 'chiqim' && (
        <>
          <Text style={styles.label}>Srok (to'lov muddati)</Text>
          <View style={styles.chipRow}>
            {(
              [
                ['none', "Yo'q"],
                ['7', '1 hafta'],
                ['14', '2 hafta'],
                ['30', '1 oy'],
                ['custom', 'Sana...'],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                style={[styles.chip, dueChoice === value && styles.chipSelected]}
                onPress={() => setDueChoice(value)}
              >
                <Text style={dueChoice === value ? styles.chipTextSelected : styles.chipText}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {dueChoice === 'custom' && (
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              value={customDue}
              onChangeText={setCustomDue}
              placeholder={`${todayIso()} (YYYY-MM-DD)`}
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
            />
          )}
        </>
      )}

      <Text style={styles.label}>Izoh</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholder="Ixtiyoriy"
        placeholderTextColor="#94a3b8"
      />

      <Pressable
        style={[styles.submitButton, submitting && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitButtonText}>{submitting ? 'Saqlanmoqda...' : 'Saqlash'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  deniedBox: { padding: 24, justifyContent: 'center', alignItems: 'center', gap: 10 },
  deniedTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  deniedText: { color: '#64748b', textAlign: 'center', fontSize: 14, lineHeight: 20 },
  deniedButton: {
    marginTop: 8,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  deniedButtonText: { color: '#fff', fontWeight: '700' },
  kindRow: { flexDirection: 'row', gap: 8 },
  kindButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  kindKirimActive: { backgroundColor: '#047857', borderColor: '#047857' },
  kindChiqimActive: { backgroundColor: '#be123c', borderColor: '#be123c' },
  kindText: { color: '#334155', fontWeight: '600' },
  kindTextActive: { color: '#fff', fontWeight: '700' },
  label: { marginTop: 14, marginBottom: 4, fontWeight: '600', color: '#334155' },
  hint: {
    color: '#92400e',
    backgroundColor: '#fef3c7',
    padding: 10,
    borderRadius: 8,
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#0f172a',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  chipSelected: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  chipText: { color: '#334155' },
  chipTextSelected: { color: '#fff' },
  twoCol: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  submitButton: {
    marginTop: 24,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
