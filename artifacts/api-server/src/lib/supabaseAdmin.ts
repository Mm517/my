import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env["SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

export const isSupabaseAdminConfigured = Boolean(url && serviceRoleKey);

const unavailableClient = new Proxy({} as SupabaseClient, {
  get() {
    throw new Error(
      "Supabase server credentials are not configured for this environment.",
    );
  },
});

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS — only use for trusted server-side operations
 * (verifying JWTs, admin actions, Edge-Function-equivalent work).
 * Never import this file from client/browser code.
 */
export const supabaseAdmin: SupabaseClient = isSupabaseAdminConfigured
  ? createClient(url!, serviceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : unavailableClient;
