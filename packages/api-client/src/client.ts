import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from './database.types';

export interface CreateSupabaseClientOptions {
  url: string;
  anonKey: string;
  /** Platform-specific auth storage (localStorage on web, expo-secure-store adapter on mobile). */
  auth?: SupabaseClientOptions<'public'>['auth'];
}

export function createSupabaseClient({
  url,
  anonKey,
  auth,
}: CreateSupabaseClientOptions): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      ...auth,
    },
  });
}

export type { Database } from './database.types';
