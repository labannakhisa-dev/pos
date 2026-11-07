import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnvError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Missing Supabase configuration. The app cannot connect to the database. Please check your project setup.'
    : null;

export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);
