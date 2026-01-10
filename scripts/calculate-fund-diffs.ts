/**
 * Script pour calculer les différences pour un fund spécifique
 * 
 * Usage:
 *   npx tsx scripts/calculate-fund-diffs.ts <fund_id>
 * 
 * Ou avec variables d'environnement:
 *   BASE_URL=https://... ACCESS_TOKEN=... npx tsx scripts/calculate-fund-diffs.ts 32
 */

import { createClient } from "@supabase/supabase-js";

// Configuration depuis les variables d'environnement
const SUPABASE_URL = process.env.SUPABASE_URL || "https://nmynjtrppwhiwlxfdzdh.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";
const BASE_URL = process.env.BASE_URL || "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_KEY ou SUPABASE_ANON_KEY requis");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface Filing {
  id: number;
  fund_id: number;
  filing_date: string;
  form_type: string;
  status: string;
}

/**
 * Appel API pour calculer les diffs
 */
async function calculateDiff(fundId: number, filingId: number): Promise<any> {
  const url = `${BASE_URL}/funds/${fundId}/filings/${filingId}/calculate-diff`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  return await response.json();
}

/**
 * Récupère tous les filings parsés pour un fund
 */
async function getParsedFilings(fundId: number): Promise<Filing[]> {
  const { data, error } = await supabase
    .from("fund_filings")
    .select("id, fund_id, filing_date, form_type, status")
    .eq("fund_id", fundId)
    .eq("status", "PARSED")
    .order("filing_date", { ascending: true }); // Ordre chronologique pour calculer les diffs

  if (error) throw error;
  return data || [];
}

/**
 * Vérifie si un filing a des holdings
 */
async function hasHoldings(filingId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from("fund_holdings")
    .select("id")
    .eq("filing_id", filingId)
    .limit(1);

  if (error) throw error;
  return (data?.length || 0) > 0;
}

/**
 * Vérifie si des diffs existent déjà pour un filing
 */
async function hasDiffsForFiling(filingId: number): Promise<boolean> {
  const { data, error } = await supabase
    .from("fund_holdings_diff")
    .select("id")
    .eq("filing_id_new", filingId)
    .limit(1);

  if (error) throw error;
  return (data?.length || 0) > 0;
}

/**
 * Calcule les diffs pour un fund
 */
async function calculateDiffsForFund(fundId: number): Promise<{ processed: number; skipped: number; errors: number }> {
  console.log(`\n📊 Fund ${fundId}`);

  const filings = await getParsedFilings(fundId);

  if (filings.length === 0) {
    console.log(`   ⚠️  Aucun filing parsé trouvé`);
    return { processed: 0, skipped: 0, errors: 0 };
  }

  console.log(`   📄 ${filings.length} filing(s) parsé(s) trouvé(s)`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // Traiter chaque filing dans l'ordre chronologique
  for (const filing of filings) {
    try {
      // Vérifier si le filing a des holdings
      const hasHoldingsData = await hasHoldings(filing.id);
      if (!hasHoldingsData) {
        console.log(`   ⏭️  Filing ${filing.id} (${filing.filing_date}) : Pas de holdings, skip`);
        skipped++;
        continue;
      }

      // Vérifier si des diffs existent déjà
      const hasDiffs = await hasDiffsForFiling(filing.id);
      if (hasDiffs) {
        console.log(`   ✅ Filing ${filing.id} (${filing.filing_date}) : Diffs déjà calculés, skip`);
        skipped++;
        continue;
      }

      // Calculer les diffs
      console.log(`   🔄 Calcul des diffs pour filing ${filing.id} (${filing.filing_date}, ${filing.form_type})...`);
      
      if (!ACCESS_TOKEN) {
        console.log(`   ⚠️  ACCESS_TOKEN non fourni, impossible d'utiliser l'API`);
        console.log(`   💡 Utilise le script calculate-all-diffs.ts avec import direct du service`);
        skipped++;
        continue;
      }

      const result = await calculateDiff(fundId, filing.id);
      console.log(`   ✅ ${result.total_changes} changements détectés (${result.new_positions} new, ${result.exits} exits, ${result.increases} increases, ${result.decreases} decreases)`);

      processed++;
      await new Promise(resolve => setTimeout(resolve, 500)); // Pause pour éviter la surcharge

    } catch (error: any) {
      console.error(`   ❌ Erreur pour filing ${filing.id}:`, error.message);
      errors++;
    }
  }

  return { processed, skipped, errors };
}

/**
 * Fonction principale
 */
async function main() {
  const fundId = process.argv[2];
  
  if (!fundId) {
    console.error("❌ Usage: npx tsx scripts/calculate-fund-diffs.ts <fund_id>");
    console.error("   Exemple: npx tsx scripts/calculate-fund-diffs.ts 32");
    process.exit(1);
  }

  const fundIdNum = parseInt(fundId);
  if (isNaN(fundIdNum)) {
    console.error(`❌ Fund ID invalide: ${fundId}`);
    process.exit(1);
  }

  console.log("🚀 Calcul des différences pour un fund spécifique\n");
  console.log(`📋 Fund ID: ${fundIdNum}`);
  if (ACCESS_TOKEN) {
    console.log(`🔑 Token: ${ACCESS_TOKEN.substring(0, 10)}...`);
  } else {
    console.log(`⚠️  ACCESS_TOKEN non fourni`);
  }
  console.log(`🌐 API: ${BASE_URL}\n`);

  try {
    const result = await calculateDiffsForFund(fundIdNum);
    
    console.log(`\n✅ Résumé:`);
    console.log(`   📊 Processés: ${result.processed}`);
    console.log(`   ⏭️  Ignorés: ${result.skipped}`);
    console.log(`   ❌ Erreurs: ${result.errors}`);
    
    if (result.processed > 0) {
      console.log(`\n💡 Les différences ont été calculées. Vous pouvez maintenant appeler:`);
      console.log(`   GET ${BASE_URL}/funds/${fundIdNum}/changes?min_change_pct=10&days=30`);
    }
  } catch (error: any) {
    console.error("\n❌ Erreur fatale:", error.message);
    process.exit(1);
  }
}

main();
