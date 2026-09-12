import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env["SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!url || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required on the server. " +
      "Never expose the service role key to the client.",
  );
}

/**
 * Server-only Supabase client using the service role key.
 * Bypasses RLS — only use for trusted server-side operations
 * (verifying JWTs, admin actions, Edge-Function-equivalent work).
 * Never import this file from client/browser code.
 */
export const supabaseAdmin: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
