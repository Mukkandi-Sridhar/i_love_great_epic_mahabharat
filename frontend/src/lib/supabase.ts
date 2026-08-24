import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client.
 *
 * This uses the **publishable/anon** key, which is safe to ship: it is subject
 * to Row Level Security, so it can only ever read and write what the policies
 * in supabase/migrations allow for the signed-in user. The service-role key is
 * server-side only and must never appear in this bundle.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured && import.meta.env.DEV) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
      "Supabase features are disabled."
  );
}

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Needed so the OAuth redirect back from the provider is picked up.
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Current access token, or null when signed out.
 *
 * Reads from the cached session and lets the client refresh it when expired,
 * so callers never attach a stale token to a backend request.
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
};
