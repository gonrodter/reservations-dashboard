import "server-only";
import { createClient } from "@supabase/supabase-js";
import { DataError } from "@/lib/errors";

/**
 * Supabase client for Auth administration. The secret key bypasses RLS, so this
 * module must only be imported by authenticated server-side admin code.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new DataError(
      "La administración de Supabase Auth no está configurada. Añade SUPABASE_SECRET_KEY."
    );
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
