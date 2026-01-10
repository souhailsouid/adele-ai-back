/**
 * Script pour calculer automatiquement les diffs pour tous les filings parsés
 * Version JavaScript (exécutable directement avec Node.js)
 * 
 * Usage:
 *   node scripts/calculate-all-diffs.js
 * 
 * Ou avec variables d'environnement:
 *   BASE_URL=https://... ACCESS_TOKEN=... node scripts/calculate-all-diffs.js
 */

const { createClient } = require("@supabase/supabase-js");

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

/**
 * Appel API pour calculer les diffs
 */
async function calculateDiff(fundId, filingId) {
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
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

/**
 * Récupère tous les funds
 */
async function getAllFunds() {
  const { data, error } = await supabase
    .from("funds")
    .select("id, name, cik")
    .order("id", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Récupère les filings parsés pour un fund
 */
async function getParsedFilings(fundId) {
  const { data, error } = await supabase
    .from("fund_filings")
    .select("id, fund_id, filing_date, form_type, status")
    .eq("fund_id", fundId)
    .eq("status", "PARSED")
    .order("filing_date", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Vérifie si des diffs existent déjà pour un filing
 */
async function hasDiffsForFiling(filingId) {
  const { data, error } = await supabase
    .from("fund_holdings_diff")
    .select("id")
    .eq("filing_id_new", filingId)
    .limit(1);

  if (error) throw error;
  return (data?.length || 0) > 0;
}

/**
 * Vérifie si un filing a des holdings
 */
async function hasHoldings(filingId) {
  const { data, error } = await supabase
    .from("fund_holdings")
    .select("id")
    .eq("filing_id", filingId)
    .eq("type", "stock")
    .limit(1);

  if (error) throw error;
  return (data?.length || 0) > 0;
}

/**
 * Calcule les diffs pour un fund
 */
async function calculateDiffsForFund(fund) {
  console.log(`\n📊 Fund ${fund.id}: ${fund.name} (CIK: ${fund.cik})`);

  const filings = await getParsedFilings(fund.id);

  if (filings.length === 0) {
    console.log(`   ⚠️  Aucun filing parsé trouvé`);
    return { processed: 0, skipped: 0, errors: 0 };
  }

  console.log(`   📄 ${filings.length} filing(s) parsé(s) trouvé(s)`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const filing of filings) {
    try {
      const hasHoldingsData = await hasHoldings(filing.id);
      if (!hasHoldingsData) {
        console.log(`   ⏭️  Filing ${filing.id} (${filing.filing_date}) : Pas de holdings, skip`);
        skipped++;
        continue;
      }

      const hasDiffs = await hasDiffsForFiling(filing.id);
      if (hasDiffs) {
        console.log(`   ✅ Filing ${filing.id} (${filing.filing_date}) : Diffs déjà calculés, skip`);
        skipped++;
        continue;
      }

      console.log(`   🔄 Calcul des diffs pour filing ${filing.id} (${filing.filing_date}, ${filing.form_type})...`);
      
      if (!ACCESS_TOKEN) {
        console.log(`   ⚠️  ACCESS_TOKEN non fourni, impossible d'utiliser l'API`);
        console.log(`   💡 Utilise le script TypeScript avec import direct du service`);
        skipped++;
        continue;
      }

      const result = await calculateDiff(fund.id, filing.id);
      console.log(`   ✅ ${result.total_changes} changements détectés (${result.new_positions} new, ${result.exits} exits)`);

      processed++;
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
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
  console.log("🚀 Calcul automatique des diffs pour tous les filings parsés\n");
  console.log(`📡 Supabase: ${SUPABASE_URL}`);
  console.log(`🌐 API: ${BASE_URL}`);
  console.log(`🔑 Token: ${ACCESS_TOKEN ? "✅ Fourni" : "❌ Non fourni"}\n`);

  try {
    const funds = await getAllFunds();
    console.log(`📋 ${funds.length} fund(s) trouvé(s)\n`);

    if (funds.length === 0) {
      console.log("⚠️  Aucun fund trouvé. Créez d'abord des funds avec le script init-all-funds.js");
      process.exit(0);
    }

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const fund of funds) {
      const result = await calculateDiffsForFund(fund);
      totalProcessed += result.processed;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 RÉSUMÉ");
    console.log("=".repeat(60));
    console.log(`✅ Diffs calculés: ${totalProcessed}`);
    console.log(`⏭️  Skippés: ${totalSkipped}`);
    console.log(`❌ Erreurs: ${totalErrors}`);
    console.log("=".repeat(60));

    if (totalProcessed > 0) {
      console.log("\n✨ Les diffs ont été calculés avec succès !");
      console.log("💡 Tu peux maintenant utiliser GET /funds/changes pour voir les changements");
    }

  } catch (error) {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  }
}

main();
