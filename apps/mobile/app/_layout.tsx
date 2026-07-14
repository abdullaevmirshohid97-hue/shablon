import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initLocalDb } from '../src/lib/db/localDb';

const queryClient = new QueryClient();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    void initLocalDb().then(() => setDbReady(true));
  }, []);

  if (!dbReady) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerTitleAlign: 'center' }}>
          <Stack.Screen name="index" options={{ title: 'Kontragentlar' }} />
          <Stack.Screen name="counterparty/[id]" options={{ title: 'Tranzaksiya kiritish' }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
