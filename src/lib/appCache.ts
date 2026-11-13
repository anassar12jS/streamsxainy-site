import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared Supabase client + public `app_cache` table helpers.
 *
 * The cache table is a dumb key→JSON store with expiry, used to share
 * expensive lookups (YouTube videoIds, durations, search results) across
 * visitors and survive refreshes. No auth required — anon key only.
 *
 * Requires the `app_cache` table (see supabase/schema.sql).
 */

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

export const isAppCacheConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let client: SupabaseClient | null = null;
if (isAppCacheConfigured) {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Read a cached JSON value. Returns null on miss, expiry, or any error. */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('app_cache')
      .select('value, expires_at')
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return null;
    if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;
    return data.value as T;
  } catch {
    return null;
  }
}

/** Fire-and-forget cache write. Never throws, never blocks callers. */
export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  if (!client) return;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  void Promise.resolve(
    client.from('app_cache').upsert({ key, value, expires_at: expiresAt })
  ).then(() => {}).catch(() => {});
}
