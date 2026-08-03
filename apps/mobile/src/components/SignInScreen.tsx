import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';

/**
 * Email+password sign-in. Rendered by the root layout instead of the
 * navigator whenever there is no Supabase session, so no screen is ever
 * reachable unauthenticated.
 */
export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignIn() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage('Email va parolni kiriting');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        setErrorMessage(
          error.message === 'Invalid login credentials'
            ? "Email yoki parol noto'g'ri"
            : error.message,
        );
      }
      // Success needs no navigation: the root layout listens to
      // onAuthStateChange and swaps this screen for the app stack.
    } catch {
      setErrorMessage("Serverga ulanib bo'lmadi. Internetni tekshiring.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>M</Text>
        </View>
        <Text style={styles.title}>idaa finance</Text>
        <Text style={styles.subtitle}>Tizimga kirish</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="email@company.uz"
          placeholderTextColor="#8A8A93"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!submitting}
        />

        <Text style={styles.label}>Parol</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Parol"
          placeholderTextColor="#8A8A93"
          secureTextEntry
          textContentType="password"
          editable={!submitting}
          onSubmitEditing={handleSignIn}
        />

        {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

        <Pressable
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>{submitting ? 'Kirilmoqda...' : 'Kirish'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#FAFAFA' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  logo: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  title: { marginTop: 10, textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#000000' },
  subtitle: { marginTop: 2, marginBottom: 16, textAlign: 'center', color: '#5C5C64' },
  label: { marginTop: 10, marginBottom: 4, fontWeight: '600', color: '#2A2A30' },
  input: {
    borderWidth: 1,
    borderColor: '#D8D8DC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#000000',
  },
  error: { marginTop: 10, color: '#A33A3A' },
  button: {
    marginTop: 16,
    backgroundColor: '#000000',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
