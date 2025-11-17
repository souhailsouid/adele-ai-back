import { supabase } from "./supabase";
import { z } from "zod";

const SignalInput = z.object({
  source: z.enum(["scrapecreators", "coinglass", "rss", "sec_8k", "sec_13f"]),
  type: z.enum(["trump", "social", "funding", "oi", "liquidation", "news", "corporate", "institutional"]),
  raw_data: z.record(z.any()).optional(),
});

export async function createSignal(body: unknown) {
  const input = SignalInput.parse(body);
  
  const { data, error } = await supabase
    .from("signals")
    .insert({
      source: input.source,
      type: input.type,
      timestamp: new Date().toISOString(),
      raw_data: input.raw_data || {},
      processing_status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getSignals(filters?: {
  source?: string;
  type?: string;
  limit?: number;
  offset?: number;
  min_importance?: number;
}) {
  let query = supabase
    .from("signals")
    .select("*")
    .order("timestamp", { ascending: false });

  if (filters?.source) {
    query = query.eq("source", filters.source);
  }
  if (filters?.type) {
    query = query.eq("type", filters.type);
  }
  if (filters?.min_importance) {
    query = query.gte("importance_score", filters.min_importance);
  }

  query = query.limit(filters?.limit || 100);
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getSignal(id: string) {
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function searchSignals(query: string, limit: number = 20) {
  // Full-text search PostgreSQL avec to_tsvector
  // Note: Supabase PostgREST ne supporte pas directement textSearch sur les index GIN
  // On utilise une recherche dans summary avec ilike pour l'instant
  // Pour une vraie full-text search, utiliser une fonction PostgreSQL custom
  
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .or(`summary.ilike.%${query}%,raw_data.ilike.%${query}%`)
    .order("importance_score", { ascending: false, nullsFirst: false })
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

