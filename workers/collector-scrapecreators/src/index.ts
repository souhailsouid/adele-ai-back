/**
 * Lambda pour collecter les données ScrapeCreators (Trump, Twitter, Reddit)
 * Déclenché par EventBridge (cron: toutes les 5 minutes)
 */

import { EventBridgeEvent } from "aws-lambda";
import { supabase } from "./supabase";
import { PutEventsCommand, EventBridgeClient } from "@aws-sdk/client-eventbridge";

const eventBridge = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "";
const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || "";

export const handler = async (event: EventBridgeEvent<"Scheduled Event", any>) => {
  console.log("ScrapeCreators Collector triggered");

  if (!SCRAPECREATORS_API_KEY) {
    console.log("ScrapeCreators API key not configured, skipping");
    return { statusCode: 200, body: JSON.stringify({ message: "API key not configured" }) };
  }

  try {
    // Collecter Trump/Truth Social
    await collectTrumpPosts();
    
    // Collecter Twitter (si disponible dans l'API)
    // await collectTwitter();
    
    // Collecter Reddit (si disponible)
    // await collectReddit();

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error: any) {
    console.error("ScrapeCreators Collector error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function collectTrumpPosts() {
  // Appeler l'API ScrapeCreators pour Trump/Truth Social
  // Note: Adapter selon la vraie API ScrapeCreators
  const response = await fetch("https://api.scrapecreators.com/v1/trump/posts", {
    headers: {
      "Authorization": `Bearer ${SCRAPECREATORS_API_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`ScrapeCreators API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Traiter les posts
  if (data.posts) {
    for (const post of data.posts) {
      // Vérifier si déjà collecté
      const { data: existing } = await supabase
        .from("signals")
        .select("id")
        .eq("source", "scrapecreators")
        .eq("raw_data->>post_id", post.id)
        .single();

      if (existing) continue;

      // Créer signal
      await createSignal({
        source: "scrapecreators",
        type: "trump",
        raw_data: {
          post_id: post.id,
          text: post.text,
          url: post.url,
          timestamp: post.timestamp,
        },
      });
    }
  }
}

async function createSignal(signalData: {
  source: string;
  type: string;
  raw_data: any;
}) {
  const { data: signal, error } = await supabase
    .from("signals")
    .insert({
      source: signalData.source,
      type: signalData.type,
      timestamp: new Date().toISOString(),
      raw_data: signalData.raw_data,
      processing_status: "pending",
    })
    .select()
    .single();

  if (error) throw error;

  // Publier événement pour traitement IA
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: "adel.signals",
      DetailType: "New Signal",
      Detail: JSON.stringify({
        signal_id: signal.id,
      }),
      EventBusName: EVENT_BUS_NAME,
    }],
  }));

  return signal;
}

