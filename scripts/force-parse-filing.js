/**
 * Script pour forcer le parsing d'un filing spécifique
 * Usage: node scripts/force-parse-filing.js <accession_number>
 * Exemple: node scripts/force-parse-filing.js 0000905148-24-003106
 */

const { createClient } = require("@supabase/supabase-js");
const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const eventBusName = process.env.EVENT_BUS_NAME || "adel-ai-dev-signals";

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const eventBridge = new EventBridgeClient({});

/**
 * Construit l'URL de la page index depuis l'accession number
 * Le parser va ensuite chercher le fichier XML depuis cette page
 */
function buildFilingUrl(cik, accessionNumber) {
  // Format: https://www.sec.gov/Archives/edgar/data/{cik}/{accession_number_without_dashes}/{accession_number}-index.htm
  const cikNumeric = cik.replace(/^0+/, ""); // Enlever les zéros en tête
  const accessionWithoutDashes = accessionNumber.replace(/-/g, "");
  return `https://www.sec.gov/Archives/edgar/data/${cikNumeric}/${accessionWithoutDashes}/${accessionNumber}-index.htm`;
}

async function forceParseFiling(accessionNumber) {
  console.log(`\n🔍 Recherche du filing: ${accessionNumber}\n`);

  // 1. Récupérer le filing
  const { data: filing, error: filingError } = await supabase
    .from("fund_filings")
    .select("id, fund_id, cik, accession_number, form_type, filing_date, status, raw_storage_path")
    .eq("accession_number", accessionNumber)
    .single();

  if (filingError || !filing) {
    console.error(`❌ Filing non trouvé: ${accessionNumber}`);
    console.error(filingError);
    process.exit(1);
  }

  console.log(`✅ Filing trouvé:`);
  console.log(`   ID: ${filing.id}`);
  console.log(`   Fund ID: ${filing.fund_id}`);
  console.log(`   CIK: ${filing.cik}`);
  console.log(`   Form Type: ${filing.form_type}`);
  console.log(`   Filing Date: ${filing.filing_date}`);
  console.log(`   Status: ${filing.status}`);
  console.log(`   Raw Storage Path: ${filing.raw_storage_path || "NULL"}`);

  // 2. Récupérer le fund pour obtenir le nom
  const { data: fund, error: fundError } = await supabase
    .from("funds")
    .select("id, name, cik")
    .eq("id", filing.fund_id)
    .single();

  if (fundError || !fund) {
    console.error(`❌ Fund non trouvé: ${filing.fund_id}`);
    process.exit(1);
  }

  console.log(`\n📊 Fund: ${fund.name} (CIK: ${fund.cik})`);

  // 3. Vérifier le CIK
  if (!filing.cik) {
    console.log(`\n⚠️  CIK manquant dans le filing. Utilisation du CIK du fund: ${fund.cik}`);
    // Mettre à jour le CIK
    const { error: updateError } = await supabase
      .from("fund_filings")
      .update({ cik: fund.cik })
      .eq("id", filing.id);

    if (updateError) {
      console.error(`❌ Erreur lors de la mise à jour du CIK:`, updateError);
      process.exit(1);
    }
    console.log(`✅ CIK mis à jour`);
  }

  const cikToUse = filing.cik || fund.cik;

  // 4. Construire l'URL de la page index
  const filingUrl = filing.raw_storage_path || buildFilingUrl(cikToUse, accessionNumber);
  console.log(`\n🔗 URL de la page index: ${filingUrl}`);

  // 5. Vérifier les holdings existants
  const { data: holdings, error: holdingsError } = await supabase
    .from("fund_holdings")
    .select("id")
    .eq("filing_id", filing.id)
    .limit(1);

  if (holdingsError) {
    console.error(`❌ Erreur lors de la vérification des holdings:`, holdingsError);
    process.exit(1);
  }

  if (holdings && holdings.length > 0) {
    console.log(`\n⚠️  Ce filing a déjà ${holdings.length} holdings.`);
    console.log(`   Forçage du re-parsing...`);
  } else {
    console.log(`\n✅ Aucun holding trouvé. Le parsing est nécessaire.`);
  }

  // 6. Mettre à jour le statut à DISCOVERED si nécessaire
  if (filing.status !== "DISCOVERED") {
    console.log(`\n🔄 Mise à jour du statut de "${filing.status}" à "DISCOVERED"...`);
    const { error: updateError } = await supabase
      .from("fund_filings")
      .update({ status: "DISCOVERED" })
      .eq("id", filing.id);

    if (updateError) {
      console.error(`❌ Erreur lors de la mise à jour du statut:`, updateError);
      process.exit(1);
    }
    console.log(`✅ Statut mis à jour`);
  }

  // 7. Mettre à jour raw_storage_path si nécessaire
  if (!filing.raw_storage_path) {
    console.log(`\n🔄 Mise à jour de raw_storage_path...`);
    const { error: updateError } = await supabase
      .from("fund_filings")
      .update({ raw_storage_path: filingUrl })
      .eq("id", filing.id);

    if (updateError) {
      console.error(`❌ Erreur lors de la mise à jour de raw_storage_path:`, updateError);
      process.exit(1);
    }
    console.log(`✅ raw_storage_path mis à jour`);
  }

  // 8. Publier l'événement EventBridge
  console.log(`\n📡 Publication de l'événement EventBridge...`);
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
              cik: cikToUse,
              accession_number: accessionNumber,
              filing_url: filingUrl,
            }),
            EventBusName: eventBusName,
          },
        ],
      })
    );

    console.log(`✅ Événement publié avec succès !`);
    console.log(`\n📋 Détails de l'événement:`);
    console.log(`   Source: adel.signals`);
    console.log(`   DetailType: 13F Discovered`);
    console.log(`   Fund ID: ${filing.fund_id}`);
    console.log(`   Filing ID: ${filing.id}`);
    console.log(`   CIK: ${cikToUse}`);
    console.log(`   Accession Number: ${accessionNumber}`);
    console.log(`   Filing URL: ${filingUrl}`);
    console.log(`\n⏳ Le parser devrait se déclencher dans quelques secondes.`);
    console.log(`   Vérifiez les logs CloudWatch du parser-13f Lambda.`);
  } catch (error) {
    console.error(`❌ Erreur lors de la publication de l'événement:`, error);
    process.exit(1);
  }
}

// Main
const accessionNumber = process.argv[2];

if (!accessionNumber) {
  console.error("❌ Usage: node scripts/force-parse-filing.js <accession_number>");
  console.error("   Exemple: node scripts/force-parse-filing.js 0000905148-24-003106");
  process.exit(1);
}

forceParseFiling(accessionNumber)
  .then(() => {
    console.log("\n✅ Script terminé avec succès");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur:", error);
    process.exit(1);
  });
