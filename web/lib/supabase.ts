import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  browserClient ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // The callback page exchanges PKCE codes explicitly with exchangeCodeForSession.
      // Disable URL auto-detection to prevent a second exchange of the same one-time code.
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return browserClient;
}
