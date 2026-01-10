/**
 * Script pour forcer le parsing de tous les filings DISCOVERED ou FAILED
 * Usage: node scripts/force-parse-all-discovered.js [--status=DISCOVERED|FAILED|ALL] [--limit=100]
 * Exemple: node scripts/force-parse-all-discovered.js --status=DISCOVERED --limit=50
 */

const { createClient } = require("@supabase/supabase-js");
const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
const eventBusName = process.env.EVENT_BUS_NAME || "adel-ai-dev-signals";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const eventBridge = new EventBridgeClient({});

/**
 * Construit l'URL de la page index depuis l'accession number
 */
function buildFilingUrl(cik, accessionNumber) {
  const cikNumeric = cik.replace(/^0+/, "");
  const accessionWithoutDashes = accessionNumber.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cikNumeric}/${accessionWithoutDashes}/${accessionNumber}-index.htm`;
}

/**
 * Publie un événement EventBridge pour déclencher le parsing
 */
async function publishParsingEvent(filing, fundCik, filingUrl) {
  try {
    await eventBridge.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "adel.signals",
            DetailType: "13F Discovered",
            Detail: JSON.stringify({
              fund_id: filing.fund_id,
              filing_id: filing.id,
              cik: fundCik,
              accession_number: filing.accession_number,
              filing_url: filingUrl,
            }),
            EventBusName: eventBusName,
          },
        ],
      })
    );
    return true;
  } catch (error) {
    console.error(`   ❌ Erreur EventBridge: ${error.message}`);
    return false;
  }
}

async function forceParseAllDiscovered(options) {
  const status = options.status || "DISCOVERED";
  const limit = options.limit || 100;

  console.log(`\n🔍 Recherche des filings à parser...`);
  console.log(`   Status: ${status}`);
  console.log(`   Limit: ${limit}\n`);

  // Construire la requête selon le status
  let query = supabase
    .from("fund_filings")
    .select("id, fund_id, cik, accession_number, form_type, filing_date, status, raw_storage_path, created_at")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (status === "DISCOVERED") {
    query = query.eq("status", "DISCOVERED");
  } else if (status === "FAILED") {
    query = query.eq("status", "FAILED");
  } else if (status === "ALL") {
    query = query.in("status", ["DISCOVERED", "FAILED"]);
  }

  const { data: filings, error: filingsError } = await query;

  if (filingsError) {
    console.error(`❌ Erreur lors de la récupération des filings:`, filingsError);
    process.exit(1);
  }

  if (!filings || filings.length === 0) {
    console.log(`✅ Aucun filing trouvé avec le statut "${status}"`);
    return;
  }

  console.log(`📊 ${filings.length} filings trouvés\n`);

  // Récupérer les funds pour obtenir les CIK
  const fundIds = [...new Set(filings.map((f) => f.fund_id))];
  const { data: funds, error: fundsError } = await supabase
    .from("funds")
    .select("id, name, cik")
    .in("id", fundIds);

  if (fundsError || !funds) {
    console.error(`❌ Erreur lors de la récupération des funds:`, fundsError);
    process.exit(1);
  }

  const fundMap = new Map(funds.map((f) => [f.id, f]));

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Traiter chaque filing
  for (let i = 0; i < filings.length; i++) {
    const filing = filings[i];
    const fund = fundMap.get(filing.fund_id);

    if (!fund) {
      console.log(`⚠️  [${i + 1}/${filings.length}] Filing ${filing.id}: Fund ${filing.fund_id} non trouvé`);
      skippedCount++;
      continue;
    }

    // Déterminer le CIK à utiliser
    const cikToUse = filing.cik || fund.cik;

    if (!cikToUse) {
      console.log(`⚠️  [${i + 1}/${filings.length}] Filing ${filing.id}: CIK manquant`);
      skippedCount++;
      continue;
    }

    // Construire l'URL
    const filingUrl = filing.raw_storage_path || buildFilingUrl(cikToUse, filing.accession_number);

    // Mettre à jour le CIK et raw_storage_path si nécessaire
    const updates = {};
    if (!filing.cik) {
      updates.cik = cikToUse;
    }
    if (!filing.raw_storage_path) {
      updates.raw_storage_path = filingUrl;
    }
    if (filing.status !== "DISCOVERED") {
      updates.status = "DISCOVERED";
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("fund_filings")
        .update(updates)
        .eq("id", filing.id);

      if (updateError) {
        console.log(`⚠️  [${i + 1}/${filings.length}] Filing ${filing.id}: Erreur mise à jour - ${updateError.message}`);
        errorCount++;
        continue;
      }
    }

    // Publier l'événement
    const success = await publishParsingEvent(filing, cikToUse, filingUrl);

    if (success) {
      successCount++;
      console.log(`✅ [${i + 1}/${filings.length}] ${filing.accession_number} (${fund.name}) - Événement publié`);
    } else {
      errorCount++;
      console.log(`❌ [${i + 1}/${filings.length}] ${filing.accession_number} (${fund.name}) - Échec`);
    }

    // Délai entre chaque événement pour éviter de surcharger EventBridge
    if (i < filings.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`\n📊 Résumé:`);
  console.log(`   ✅ Succès: ${successCount}`);
  console.log(`   ❌ Erreurs: ${errorCount}`);
  console.log(`   ⏭️  Ignorés: ${skippedCount}`);
  console.log(`   📦 Total: ${filings.length}`);
  console.log(`\n⏳ Les parsers devraient se déclencher dans les prochaines minutes.`);
  console.log(`   Vérifiez les logs CloudWatch du parser-13f Lambda.`);
}

// Parse arguments
const args = process.argv.slice(2);
const options = {};

for (const arg of args) {
  if (arg.startsWith("--status=")) {
    const status = arg.split("=")[1];
    if (["DISCOVERED", "FAILED", "ALL"].includes(status)) {
      options.status = status;
    }
  } else if (arg.startsWith("--limit=")) {
    const limit = parseInt(arg.split("=")[1], 10);
    if (!isNaN(limit) && limit > 0) {
      options.limit = limit;
    }
  }
}

forceParseAllDiscovered(options)
  .then(() => {
    console.log("\n✅ Script terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur:", error);
    process.exit(1);
  });
