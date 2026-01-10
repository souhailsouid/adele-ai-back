/**
 * Lambda pour re-parser automatiquement les filings en échec
 * Déclenché par EventBridge lorsqu'un nouveau filing est détecté (événement "Filings Discovered")
 * 
 * Vérifie les filings avec status FAILED ou DISCOVERED depuis trop longtemps
 * et re-déclenche le parsing via EventBridge
 * 
 * Se déclenche uniquement lorsque le collector-sec-watcher découvre de nouveaux filings,
 * pas selon un cron régulier (évite de consommer de la concurrence Lambda inutilement)
 */

import { EventBridgeEvent } from "aws-lambda";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { supabase } from "./supabase";

const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "adel-ai-dev-signals";
// AWS_REGION est automatiquement disponible dans Lambda, pas besoin de le définir
const eventBridge = new EventBridgeClient({});

// Configuration
const MAX_RETRIES = 3; // Nombre maximum de tentatives de parsing
const DISCOVERED_TIMEOUT_MINUTES = 30; // Si DISCOVERED depuis plus de 30 min, re-parser
const FAILED_RETRY_DELAY_MINUTES = 15; // Re-parser les FAILED après 15 min
const BATCH_SIZE = 20; // Limiter le nombre de filings traités par exécution (évite de surcharger EventBridge)
// ⚠️ IMPORTANT : Délai de 3s entre chaque événement pour éviter de déclencher trop de parsers simultanément
// Avec 20 filings par batch et 3s entre chaque = ~6.7 minutes par batch complet
// Cela évite de saturer les Lambdas et de causer du throttling sur l'API
const DELAY_BETWEEN_EVENTS_MS = 3000; // 3 secondes entre chaque événement

interface Filing {
  id: number;
  fund_id: number;
  cik: string | null;
  accession_number: string;
  form_type: string;
  filing_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * Construire l'URL du filing depuis l'accession number et le CIK
 */
function buildFilingUrl(cik: string, accessionNumber: string): string {
  const accessionNoDashes = accessionNumber.replace(/-/g, "");
  const cikClean = cik.replace(/^0+/, "") || "0";
  return `https://www.sec.gov/Archives/edgar/data/${cikClean}/${accessionNoDashes}/${accessionNumber}-index.htm`;
}

/**
 * Re-déclencher le parsing d'un filing via EventBridge
 */
async function retryParsing(filing: Filing, fundCik: string): Promise<boolean> {
  try {
    const filingUrl = buildFilingUrl(fundCik, filing.accession_number);
    
    const event = {
      Source: "adel.signals",
      DetailType: "13F Discovered",
      Detail: JSON.stringify({
        fund_id: filing.fund_id,
        filing_id: filing.id,
        cik: fundCik,
        accession_number: filing.accession_number,
        filing_url: filingUrl,
      }),
      EventBusName: EVENT_BUS_NAME,
    };

    await eventBridge.send(new PutEventsCommand({
      Entries: [event],
    }));

    console.log(`✅ Re-published event for filing ${filing.accession_number} (ID: ${filing.id})`);
    return true;
  } catch (error) {
    console.error(`❌ Error re-publishing event for filing ${filing.id}:`, error);
    return false;
  }
}

/**
 * Handler principal
 */
export const handler = async (event: EventBridgeEvent<"Filings Discovered", any>) => {
  console.log("🔄 Filing Retry Handler triggered (new filings discovered)");
  console.log("Event detail:", JSON.stringify(event.detail, null, 2));

  try {
    // 1. Récupérer les filings FAILED (à re-parser après un délai)
    const failedCutoff = new Date();
    failedCutoff.setMinutes(failedCutoff.getMinutes() - FAILED_RETRY_DELAY_MINUTES);

    const { data: failedFilings, error: failedError } = await supabase
      .from("fund_filings")
      .select("*")
      .eq("status", "FAILED")
      .lt("updated_at", failedCutoff.toISOString())
      .not("cik", "is", null)
      .limit(BATCH_SIZE); // Limiter pour éviter de surcharger EventBridge et les parsers

    if (failedError) {
      console.error("Error fetching failed filings:", failedError);
    }

    // 2. Récupérer les filings DISCOVERED depuis trop longtemps (peut-être bloqués)
    const discoveredCutoff = new Date();
    discoveredCutoff.setMinutes(discoveredCutoff.getMinutes() - DISCOVERED_TIMEOUT_MINUTES);

    const { data: discoveredFilings, error: discoveredError } = await supabase
      .from("fund_filings")
      .select("*")
      .eq("status", "DISCOVERED")
      .lt("created_at", discoveredCutoff.toISOString())
      .not("cik", "is", null)
      .limit(BATCH_SIZE); // Limiter pour éviter de surcharger EventBridge et les parsers

    if (discoveredError) {
      console.error("Error fetching discovered filings:", discoveredError);
    }

    const allFilings = [
      ...(failedFilings || []),
      ...(discoveredFilings || []),
    ] as Filing[];

    console.log(`📊 Found ${allFilings.length} filings to retry:`);
    console.log(`   - FAILED: ${failedFilings?.length || 0}`);
    console.log(`   - DISCOVERED (timeout): ${discoveredFilings?.length || 0}`);

    if (allFilings.length === 0) {
      console.log("✅ No filings to retry");
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "No filings to retry",
          retried: 0,
        }),
      };
    }

    // 3. Re-parser chaque filing
    let successCount = 0;
    let errorCount = 0;

    for (const filing of allFilings) {
      // Utiliser le CIK du filing directement (peut être un CIK secondaire)
      const fundCik = filing.cik;
      
      if (!fundCik) {
        console.warn(`⚠️  Filing ${filing.id} has no CIK, skipping`);
        errorCount++;
        continue;
      }

      // Vérifier le nombre de tentatives (via updated_at)
      // Si le filing a été mis à jour récemment plusieurs fois, c'est peut-être un problème récurrent
      const updatedAt = new Date(filing.updated_at);
      const now = new Date();
      const minutesSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
      
      // Si le filing a été mis à jour récemment mais est toujours FAILED, 
      // c'est qu'il a déjà été re-parsé récemment
      if (filing.status === "FAILED" && minutesSinceUpdate < FAILED_RETRY_DELAY_MINUTES) {
        console.log(`⏭️  Filing ${filing.id} was recently updated, skipping`);
        continue;
      }

      const success = await retryParsing(filing, fundCik);
      
      if (success) {
        successCount++;
        
        // Remettre le statut à DISCOVERED pour indiquer qu'on a re-déclenché le parsing
        await supabase
          .from("fund_filings")
          .update({ 
            status: "DISCOVERED",
            updated_at: new Date().toISOString(),
          })
          .eq("id", filing.id);
      } else {
        errorCount++;
      }

      // Délai entre chaque événement pour éviter de déclencher trop de parsers simultanément
      // Avec 3s entre chaque événement = max ~20 filings/minute, ce qui évite de saturer
      // les Lambdas et de causer du throttling sur l'API
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EVENTS_MS));
    }

    console.log(`✅ Retry completed: ${successCount} success, ${errorCount} errors`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Filing retry completed",
        retried: successCount,
        errors: errorCount,
        total: allFilings.length,
      }),
    };
  } catch (error) {
    console.error("❌ Error in filing retry handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
};
