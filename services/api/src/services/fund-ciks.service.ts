/**
 * Service de gestion des CIK multiples pour un même fund
 * Permet de lier plusieurs entités légales (CIK) à un même fund
 */

import { supabase } from "../supabase";

export interface FundCik {
  id: number;
  fund_id: number;
  cik: string;
  entity_name: string | null;
  is_primary: boolean;
  created_at: string;
}

/**
 * Récupère tous les CIK d'un fund
 */
export async function getFundCiks(fundId: number): Promise<FundCik[]> {
  const { data, error } = await supabase
    .from("fund_ciks")
    .select("*")
    .eq("fund_id", fundId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Ajoute un CIK supplémentaire à un fund
 */
export async function addFundCik(
  fundId: number,
  cik: string,
  entityName?: string
): Promise<FundCik> {
  // Vérifier que le fund existe
  const { data: fund, error: fundError } = await supabase
    .from("funds")
    .select("id, name")
    .eq("id", fundId)
    .single();

  if (fundError || !fund) {
    throw new Error(`Fund ${fundId} not found`);
  }

  // Vérifier que le CIK n'est pas déjà associé à un autre fund
  const { data: existing, error: existingError } = await supabase
    .from("fund_ciks")
    .select("fund_id")
    .eq("cik", cik)
    .single();

  if (!existingError && existing && existing.fund_id !== fundId) {
    throw new Error(`CIK ${cik} is already associated with fund ${existing.fund_id}`);
  }

  // Vérifier si ce CIK est déjà associé à ce fund
  const { data: alreadyExists, error: checkError } = await supabase
    .from("fund_ciks")
    .select("id")
    .eq("fund_id", fundId)
    .eq("cik", cik)
    .single();

  if (!checkError && alreadyExists) {
    throw new Error(`CIK ${cik} is already associated with fund ${fundId}`);
  }

  // Ajouter le CIK
  const { data: fundCik, error: insertError } = await supabase
    .from("fund_ciks")
    .insert({
      fund_id: fundId,
      cik: cik,
      entity_name: entityName || null,
      is_primary: false, // Seul le CIK dans funds.cik est primary
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return fundCik;
}

/**
 * Supprime un CIK d'un fund
 */
export async function removeFundCik(fundId: number, cik: string): Promise<void> {
  // Ne pas permettre de supprimer le CIK primary
  const { data: fundCik, error: checkError } = await supabase
    .from("fund_ciks")
    .select("is_primary")
    .eq("fund_id", fundId)
    .eq("cik", cik)
    .single();

  if (checkError) {
    throw new Error(`CIK ${cik} not found for fund ${fundId}`);
  }

  if (fundCik.is_primary) {
    throw new Error("Cannot remove primary CIK. Update the fund's main CIK instead.");
  }

  const { error: deleteError } = await supabase
    .from("fund_ciks")
    .delete()
    .eq("fund_id", fundId)
    .eq("cik", cik);

  if (deleteError) throw deleteError;
}

/**
 * Récupère tous les CIK d'un fund (y compris le primary)
 */
export async function getAllFundCiks(fundId: number): Promise<string[]> {
  const { data: fund, error: fundError } = await supabase
    .from("funds")
    .select("cik")
    .eq("id", fundId)
    .single();

  if (fundError || !fund) {
    throw new Error(`Fund ${fundId} not found`);
  }

  const additionalCiks = await getFundCiks(fundId);
  const allCiks = [fund.cik, ...additionalCiks.map((fc) => fc.cik)];

  // Dédupliquer
  return Array.from(new Set(allCiks));
}
