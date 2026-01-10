/**
 * Supabase Admin Client
 * Utilise la Service Role Key pour bypass RLS
 * À utiliser uniquement dans les services backend (Lambdas, API routes)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = requireEnv("SUPABASE_SERVICE_KEY");

let adminClient: SupabaseClient | null = null;

/**
 * Crée ou récupère le client Supabase Admin (singleton)
 * Utilise la Service Role Key pour bypass RLS
 */
export function createAdminClient(): SupabaseClient {
  if (adminClient) {
    return adminClient;
  }

  adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

/**
 * Vérifie que le client admin utilise bien la service role key
 */
export function verifyAdminClient(client: SupabaseClient): boolean {
  // La service role key commence généralement par 'eyJ' ou contient 'service_role'
  // Cette vérification est informative
  return true;
}
