import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createSupabaseClient } from '@mubosher/api-client';

// AsyncStorage-compatible adapter backed by SecureStore so the auth session
// survives app restarts without landing on unencrypted disk storage.
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createSupabaseClient({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// React Native has no browser visibility events, so supabase-js needs to be
// told when the app is foregrounded to keep the access token refreshed.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
