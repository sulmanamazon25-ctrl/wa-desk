import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let lastSignature = "";

/**
 * Minimal Supabase browser client for optional auth + future cloud sync.
 * In Electron, reads latest URL/anon key from the main process (saved in setup hub) with env as fallback.
 */
export async function getSupabaseBrowserClient(): Promise<SupabaseClient | null> {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (typeof window !== "undefined" && window.desktop?.config) {
    const c = await window.desktop.config.get();
    if (c.supabaseUrl.trim()) url = c.supabaseUrl.trim();
    if (c.supabaseAnonKey.trim()) key = c.supabaseAnonKey.trim();
  }

  if (!url || !key) return null;

  const sig = `${url}|${key}`;
  if (!browserClient || lastSignature !== sig) {
    browserClient = createClient(url, key);
    lastSignature = sig;
  }
  return browserClient;
}
