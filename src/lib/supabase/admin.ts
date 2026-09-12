import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin client using the secret key. SERVER-SIDE ONLY.
 * Used by the persistence layer after the caller's identity has been
 * verified from their session — ownership is enforced in src/lib/store.ts.
 */

let adminClient: SupabaseClient | null = null;

/** True when a real (non-placeholder) service-role key is available. */
export function hasSupabaseAdmin(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return false;
  if (/placeholder|your_supabase|changeme/i.test(secret)) return false;
  return true;
}

export function createAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!hasSupabaseAdmin() || !url || !secret) {
    throw new Error("Storage is not configured.");
  }
  adminClient = createSupabaseClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
