/**
 * Lambda pour collecter les flux RSS (Reuters, AP, Yahoo Finance)
 * Déclenché par EventBridge (cron: toutes les 15 minutes)
 */

import { EventBridgeEvent } from "aws-lambda";
import { supabase } from "./supabase";
import { PutEventsCommand, EventBridgeClient } from "@aws-sdk/client-eventbridge";

const eventBridge = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "";

const RSS_FEEDS = [
  { url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best", name: "reuters", type: "news" },
  { url: "https://apnews.com/apf-topnews", name: "ap", type: "news" },
  { url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=finance&region=US&lang=en-US", name: "yahoo-finance", type: "news" },
  { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", name: "cnbc", type: "news" },
  { url: "https://feeds.marketwatch.com/marketwatch/topstories/", name: "marketwatch", type: "news" },
];

export const handler = async (event: EventBridgeEvent<"Scheduled Event", any>) => {
  console.log("RSS Collector triggered");

  try {
    for (const feed of RSS_FEEDS) {
      try {
        await collectRSSFeed(feed);
      } catch (error: any) {
        console.error(`Error collecting ${feed.name}:`, error);
        // Continue avec les autres feeds
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error: any) {
    console.error("RSS Collector error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function collectRSSFeed(feed: { url: string; name: string; type: string }) {
  console.log(`Fetching RSS feed: ${feed.name}`);

  const response = await fetch(feed.url, {
    headers: {
      "User-Agent": "ADEL AI (contact@adel.ai)",
    },
  });

  if (!response.ok) {
    throw new Error(`RSS fetch error: ${response.status}`);
  }

  const xml = await response.text();
  const items = parseRSSFeed(xml);

  console.log(`Found ${items.length} items in ${feed.name}`);

  // Insérer chaque item comme signal
  for (const item of items) {
    // Vérifier si déjà existant (par URL ou titre)
    const { data: existing } = await supabase
      .from("signals")
      .select("id")
      .eq("source", "rss")
      .eq("raw_data->>url", item.link)
      .single();

    if (existing) {
      continue; // Déjà collecté
    }

    // Insérer nouveau signal
    const { data: signal, error: insertError } = await supabase
      .from("signals")
      .insert({
        source: "rss",
        type: feed.type,
        timestamp: new Date(item.pubDate || Date.now()).toISOString(),
        raw_data: {
          title: item.title,
          description: item.description,
          url: item.link,
          feed: feed.name,
        },
        processing_status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error(`Error inserting signal from ${feed.name}:`, insertError);
      continue;
    }

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

    console.log(`Signal created and event published: ${signal.id}`);
  }
}

function parseRSSFeed(xml: string): Array<{ title: string; description: string; link: string; pubDate?: string }> {
  const items: Array<{ title: string; description: string; link: string; pubDate?: string }> = [];
  
  // Parser RSS simplifié
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  
  for (const match of itemMatches) {
    const itemXml = match[1];
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    
    if (titleMatch && linkMatch) {
      items.push({
        title: titleMatch[1] || titleMatch[2] || "",
        description: descMatch?.[1] || descMatch?.[2] || "",
        link: linkMatch[1],
        pubDate: pubDateMatch?.[1],
      });
    }
  }
  
  return items;
}

