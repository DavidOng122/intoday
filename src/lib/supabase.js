import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));

export const supabaseConfigError = isSupabaseConfigured
  ? null
  : `Supabase is not correctly configured. 
     URL: ${supabaseUrl ? 'Present' : 'Missing'}
     Key: ${supabaseAnonKey ? 'Present' : 'Missing'}
     Please check your .env.local file.`;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
