import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SINGLETON_KEY = '__memotask_supabase_client__';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in the deployment environment.';

const getSupabaseSingleton = () => {
  if (!isSupabaseConfigured) return null;

  const globalStore = globalThis;
  if (!globalStore[SUPABASE_SINGLETON_KEY]) {
    globalStore[SUPABASE_SINGLETON_KEY] = createClient(supabaseUrl, supabaseAnonKey);
  }
  return globalStore[SUPABASE_SINGLETON_KEY];
};

export const supabase = getSupabaseSingleton();
