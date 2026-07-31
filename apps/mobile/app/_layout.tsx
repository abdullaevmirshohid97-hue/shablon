import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../src/lib/supabase';
import { initLocalDb } from '../src/lib/db/localDb';
import { SignInScreen } from '../src/components/SignInScreen';

const queryClient = new QueryClient();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    void initLocalDb().then(() => setDbReady(true));

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!dbReady || !authReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FAFAFA',
        }}
      >
        <ActivityIndicator size="large" color="#18181B" />
      </View>
    );
  }

  // Auth gate: without a session the navigator is never mounted, so no
  // screen (and no RLS-protected query) is reachable while signed out.
  if (!session) {
    return (
      <SafeAreaProvider>
        <SignInScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerTitleAlign: 'center' }}>
          <Stack.Screen name="index" options={{ title: 'Mijozlar' }} />
          <Stack.Screen name="counterparty/[id]/index" options={{ title: 'Jurnal' }} />
          <Stack.Screen name="counterparty/[id]/new" options={{ title: 'Yozuv kiritish' }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
