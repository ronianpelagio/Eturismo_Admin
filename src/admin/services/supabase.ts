import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  'https://crcrgkskhoruqcbssvaw.supabase.co';

const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyY3Jna3NraG9ydXFjYnNzdmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjgxNzQsImV4cCI6MjA5Mjk0NDE3NH0.SbgnbogBFjtuUbI7zp0bz65L7YA4oiEpCBs10syHJY0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: typeof window !== 'undefined',
    detectSessionInUrl: typeof window !== 'undefined',
  },
});
const SUPABASE_SERVICE_ROLE_KEY =
  (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined) ||
  // Replace with your actual service role key from Supabase dashboard
  // WARNING: Never expose this in client-side code in production!
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyY3Jna3NraG9ydXFjYnNzdmF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM2ODE3NCwiZXhwIjoyMDkyOTQ0MTc0fQ.snk5B_f795mOxey3EsXFu0wu5egrD2n8LofJWkkikgU';

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});