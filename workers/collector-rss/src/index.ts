/**
 * Lambda pour collecter les flux RSS (Reuters, AP, Yahoo Finance)
 * Déclenché par EventBridge (cron: toutes les 15 minutes)
 */

import { EventBridgeEvent } from "aws-lambda";
import { supabase } from "./supabase";
import { PutEventsCommand, EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { extractStructuredData } from "./data-extractor";

const eventBridge = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "";

// Helper function pour détecter la plateforme depuis l'URL
function detectPlatform(url: string, feedName?: string, category?: string): 'youtube' | 'twitter' | 'truth-social' | 'rss' {
  if (url.includes('youtube.com/feeds/videos.xml')) {
    return 'youtube';
  }
  // Truth Social (Trump)
  if (url.includes('trumpstruth.org') || category === 'trump-truth-social') {
    return 'truth-social';
  }
  // Twitter/X
  if (url.includes('x.com') || url.includes('twitter.com')) {
    return 'twitter';
  }
  // Les feeds RSS via rss.app qui pointent vers Twitter/X
  // Détectés par le nom du feed (personalities, social avec "twitter", ou contient "twitter")
  if (url.includes('rss.app') && (
    feedName?.includes('twitter') || 
    category?.includes('twitter') ||
    feedName === 'personalities' ||
    (feedName === 'social' && category !== 'trump-truth-social')
  )) {
    return 'twitter';
  }
  return 'rss';
}

// Helper function pour transformer un objet de catégories en array plat
function flattenFeeds(
  feedsByCategory: Record<string, string[]>,
  baseName: string,
  baseType: string,
  platformOverride?: 'youtube' | 'twitter' | 'truth-social' | 'rss'
): Array<{ url: string; name: string; type: string; platform: 'youtube' | 'twitter' | 'truth-social' | 'rss' }> {
  const result: Array<{ url: string; name: string; type: string; platform: 'youtube' | 'twitter' | 'truth-social' | 'rss' }> = [];
  
  for (const [category, urls] of Object.entries(feedsByCategory)) {
    for (const url of urls) {
      const platform = platformOverride || detectPlatform(url, baseName, category);
      result.push({
        url,
        name: baseName,
        type: `${baseType}-${category}`,
        platform,
      });
    }
  }
  
  return result;
}

// Investing.com RSS feeds
const investingFeeds = flattenFeeds(
  {
    "market-overview-technical": ["https://fr.investing.com/rss/market_overview_Technical.rss"],
    "market-overview-fundamental": ["https://fr.investing.com/rss/market_overview_Fundamental.rss"],
    "market-overview-opinion": ["https://fr.investing.com/rss/market_overview_Opinion.rss"],
    "market-overview-ideas": ["https://fr.investing.com/rss/market_overview_investing_ideas.rss"],
    "news-356": ["https://fr.investing.com/rss/news_356.rss"],
    "news-1064": ["https://fr.investing.com/rss/news_1064.rss"],
    "news-1063": ["https://fr.investing.com/rss/news_1063.rss"],
    "news-301": ["https://fr.investing.com/rss/news_301.rss"],
    "news-1062": ["https://fr.investing.com/rss/news_1062.rss"],
    "news-285": ["https://fr.investing.com/rss/news_285.rss"],
    "news-25": ["https://fr.investing.com/rss/news_25.rss"],
    "news-95": ["https://fr.investing.com/rss/news_95.rss"],
    "news-11": ["https://fr.investing.com/rss/news_11.rss"],
    "news-14": ["https://fr.investing.com/rss/news_14.rss"],
    "news-287": ["https://fr.investing.com/rss/news_287.rss"],
    "news-357": ["https://fr.investing.com/rss/news_357.rss"],
    "news-1061": ["https://fr.investing.com/rss/news_1061.rss"],
    "news-1065": ["https://fr.investing.com/rss/news_1065.rss"],
  },
  "investing",
  "news"
);

// Barchart RSS feeds
const barchartFeeds = flattenFeeds(
  {
    "commodities": ["https://www.barchart.com/news/rss/commodities"],
    "commodities-grain": ["https://www.barchart.com/news/rss/commodities/grain"],
    "commodities-energy": ["https://www.barchart.com/news/rss/commodities/energy"],
    "commodities-livestock": ["https://www.barchart.com/news/rss/commodities/livestock"],
    "commodities-metals": ["https://www.barchart.com/news/rss/commodities/metals"],
    "commodities-softs": ["https://www.barchart.com/news/rss/commodities/softs"],
    "financials": ["https://www.barchart.com/news/rss/financials"],
    "financials-crypto": ["https://www.barchart.com/news/rss/financials/crypto"],
    "financials-stock-market": ["http://barchart.com/news/rss/financials/stock-market"],
    "financials-fx": ["https://www.barchart.com/news/rss/financials/fx"],
    "financials-options-news": ["https://www.barchart.com/news/rss/financials/options-news"],
    "financials-interest-rates": ["https://www.barchart.com/news/rss/financials/interest-rates"],
  },
  "barchart",
  "commodities"
);

// 🔴 BREAKING NEWS / ACTUALITÉ GLOBALE (haute priorité)
// Reuters feeds
const reutersFeeds = flattenFeeds(
  {
    "youtube": ["https://www.youtube.com/feeds/videos.xml?channel_id=UChqUTb7kYRX8-EiaN3XFrSQ"],
  },
  "reuters",
  "breaking-news",
  "youtube"
);

// Bloomberg feeds
const bloombergFeeds = flattenFeeds(
  {
    "youtube": ["https://www.youtube.com/feeds/videos.xml?channel_id=UCIALMKvObZNtJ6AmdCLP7Lg"],
    "main": ["https://rss.app/feed/9tI7t33DqzGNReOh"],
    "asia": ["https://rss.app/feeds/5FXpLHZk8F5bVA9u.xml"],
    "business": ["https://rss.app/feeds/uBH1hTaHLOnbrTM8.xml"],
  },
  "bloomberg",
  "breaking-news"
);

// 🏦 PRESSE FINANCIÈRE & ANALYSE PROFONDE
const financialPressFeeds = flattenFeeds(
  {
    "financial-times": ["https://www.ft.com/rss/home/international"],
    "wsj-markets": ["https://feeds.a.dj.com/rss/RSSMarketsMain.xml"],
    "wsj-world": ["https://feeds.a.dj.com/rss/RSSWorldNews.xml"],
  },
  "financial-press",
  "analysis"
);

// 📊 MARCHÉS / TRADING / INVESTISSEMENT
const tradingFeeds = flattenFeeds(
  {
    "zerohedge": ["https://feeds.feedburner.com/zerohedge/feed"],
    "benzinga": ["https://rss.app/feeds/3bXt36o83LvEh9Xi.xml"],
    "gurufocus": ["https://rss.app/feeds/fKI0hyT44w1BoBjS.xml"],
  },
  "trading",
  "markets"
);

// 🧠 PERSONNALITÉS & INVESTISSEURS (X/Twitter via RSS)
const personalitiesFeeds = flattenFeeds(
  {
    "elon-musk": ["https://rss.app/feeds/MM1Ft6p47CrWRLv7.xml"],
    "bill-ackman": ["https://rss.app/feeds/wRnvS6NoWO3U1Vht.xml"],
    "carl-icahn": ["https://rss.app/feeds/gOdIsDhsyuMp8k12.xml"],
    "cathie-wood": ["https://rss.app/feeds/mv4INhZLqWWprxKU.xml"],
    "michael-saylor": ["https://rss.app/feeds/WPjfJUIqLwBph8YJ.xml"],
  },
  "personalities",
  "social",
  "twitter"
);

// 🏛️ INSTITUTIONS & MACRO
const institutionsFeeds = flattenFeeds(
  {
    "federal-reserve": ["https://rss.app/feeds/SsYbZTdshv5Q8zAs.xml"],
    "bloomberg-asia": ["https://rss.app/feeds/Y92j5UrFW17y4TaE.xml"],
  },
  "institutions",
  "macro"
);

// 🧠 REAL VISION / ANALYSE MACRO
const realVisionFeeds = flattenFeeds(
  {
    "youtube": ["https://www.youtube.com/feeds/videos.xml?channel_id=UCGXWKlq1Oxr3ddEtmKhAkPg"],
  },
  "real-vision",
  "macro",
  "youtube"
);

// 🌍 RÉSEAUX SOCIAUX (ARCHIVÉS VIA RSS)
const socialFeeds = flattenFeeds(
  {
    "bloomberg-twitter": ["https://rss.app/feeds/Y92j5UrFW17y4TaE.xml"],
    "trump-truth-social": ["https://trumpstruth.org/feed"],
    "reuters-twitter": ["https://rss.app/feeds/l2evN2IEPuMBrjGc.xml"],
  },
  "social",
  "social"
);

const RSS_FEEDS = [
  ...investingFeeds,
  ...barchartFeeds,
  { url: "https://www.financialjuice.com/feed.ashx?xy=rss", name: "financial-juice", type: "macro", platform: "rss" as const },
  // 🔴 BREAKING NEWS / ACTUALITÉ GLOBALE
  ...reutersFeeds,
  ...bloombergFeeds,
  { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", name: "cnbc", type: "breaking-news", platform: "rss" as const },
  // 🏦 PRESSE FINANCIÈRE & ANALYSE PROFONDE
  ...financialPressFeeds,
  // 📊 MARCHÉS / TRADING / INVESTISSEMENT
  ...tradingFeeds,
  // 🧠 PERSONNALITÉS & INVESTISSEURS (Twitter/X)
  ...personalitiesFeeds,
  // 🏛️ INSTITUTIONS & MACRO
  ...institutionsFeeds,
  // 🧠 REAL VISION / ANALYSE MACRO
  ...realVisionFeeds,
  // 🌍 RÉSEAUX SOCIAUX (Twitter/X + Truth Social)
  ...socialFeeds,
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

async function collectRSSFeed(feed: { url: string; name: string; type: string; platform: 'youtube' | 'twitter' | 'truth-social' | 'rss' }) {
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
    // Déduplication améliorée : utiliser guid si disponible, sinon URL
    let existing = null;
    if (item.guid) {
      const { data } = await supabase
        .from("signals")
        .select("id")
        .eq("source", "rss")
        .eq("raw_data->>guid", item.guid)
        .maybeSingle();
      existing = data;
    }
    
    // Fallback sur URL si pas de guid
    if (!existing && item.link) {
      const { data } = await supabase
        .from("signals")
        .select("id")
        .eq("source", "rss")
        .eq("raw_data->>url", item.link)
        .maybeSingle();
      existing = data;
    }

    if (existing) {
      continue; // Déjà collecté
    }

    // Nettoyer la description HTML si nécessaire
    const cleanDescription = cleanHTML(item.description || "");
    // Extraire les données structurées (valeurs, prévisions, surprises)
    const extractedData = extractStructuredData(item.title, cleanDescription);
    // Insérer nouveau signal
    const { data: signal, error: insertError } = await supabase
      .from("signals")
      .insert({
        source: "rss",
        type: feed.type,
        timestamp: new Date(item.pubDate || Date.now()).toISOString(),
        raw_data: {
          title: item.title,
          description: cleanDescription,
          url: item.link,
          guid: item.guid, // Stocker le guid pour déduplication future
          feed: feed.name,
          platform: feed.platform, // NOUVEAU : Plateforme (youtube, twitter, rss)
          author: item.author,
          // NOUVEAU : Données structurées extraites
          extracted_data: extractedData || null,
        },
        processing_status: "pending",
      })
      .select()
      .single();
    if (insertError) {
      console.error(`Error inserting signal from ${feed.name}:`, insertError);
      console.error(`Error details:`, {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });
      continue;
    }
    if (!signal) {
      console.error(`No signal returned from insert for ${feed.name}`);
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
    console.log('step 8 from collectRSSFeed');
    console.log(`Signal created and event published: ${signal.id}`);
  }
}

/**
 * Décoder les entités HTML (&#x2019; → ', &amp; → &, etc.)
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  
  return text
    .replace(/&#x2019;/g, "'")  // Apostrophe courbe
    .replace(/&#x2018;/g, "'")  // Apostrophe ouvrante
    .replace(/&#x201C;/g, '"')  // Guillemet ouvrant
    .replace(/&#x201D;/g, '"')  // Guillemet fermant
    .replace(/&#x2026;/g, '...') // Points de suspension
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Nettoyer le HTML des descriptions
 * Convertit les listes HTML en texte lisible
 */
function cleanHTML(html: string): string {
  if (!html) return "";

  return html
    // Convertir les listes en texte
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    // Convertir les breaks en newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<br>/gi, '\n')
    // Retirer les divs mais garder le contenu
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    // Retirer les balises strong/em mais garder le contenu
    .replace(/<strong[^>]*>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<em[^>]*>/gi, '')
    .replace(/<\/em>/gi, '')
    // Retirer toutes les autres balises HTML
    .replace(/<[^>]+>/g, '')
    // Décoder les entités HTML
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Nettoyer les espaces multiples
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate?: string;
  guid?: string;
  author?: string;
}

function parseRSSFeed(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  
  // Parser RSS simplifié
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  
  for (const match of itemMatches) {
    const itemXml = match[1];
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    // NOUVEAU : Extraction guid (peut avoir isPermaLink="false")
    const guidMatch = itemXml.match(/<guid[^>]*>(.*?)<\/guid>/);
    // Extraction author (optionnel)
    const authorMatch = itemXml.match(/<author>(.*?)<\/author>/);
    
    if (titleMatch && linkMatch) {
      items.push({
        title: decodeHtmlEntities(titleMatch[1] || titleMatch[2] || ""),
        description: decodeHtmlEntities(descMatch?.[1] || descMatch?.[2] || ""),
        link: linkMatch[1].trim(),
        pubDate: pubDateMatch?.[1]?.trim(),
        guid: guidMatch?.[1]?.trim(), // NOUVEAU
        author: authorMatch?.[1]?.trim(),
      });
    }
  }
  
  return items;
}

