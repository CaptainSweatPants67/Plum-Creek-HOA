import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import publicConfig from "./supabase-public-config.json";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  // Publishable frontend defaults let the GitHub/Cloudflare build run without
  // a local .env file. Environment overrides support other deployments.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || publicConfig.url;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || publicConfig.publishableKey;
  if (!url || !key) return null;
  if (!key.startsWith("sb_publishable_")) {
    throw new Error("Configure a Supabase publishable key for the website.");
  }
  browserClient ??= createClient(url, key);
  return browserClient;
}
