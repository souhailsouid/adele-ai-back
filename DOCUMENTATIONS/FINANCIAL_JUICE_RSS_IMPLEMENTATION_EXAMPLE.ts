/**
 * Exemple d'implémentation améliorée pour collector-rss
 * Intègre Financial Juice RSS avec support guid, nettoyage HTML, et filtrage
 * 
 * À intégrer dans : workers/collector-rss/src/index.ts
 */

import { EventBridgeEvent } from "aws-lambda";
import { supabase } from "./supabase";
import { PutEventsCommand, EventBridgeClient } from "@aws-sdk/client-eventbridge";

const eventBridge = new EventBridgeClient({});
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || "";

// Configuration des flux RSS
const RSS_FEEDS = [
  { url: "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best", name: "reuters", type: "news" },
  { url: "https://apnews.com/apf-topnews", name: "ap", type: "news" },
  { url: "https://feeds.finance.yahoo.com/rss/2.0/headline?s=finance&region=US&lang=en-US", name: "yahoo-finance", type: "news" },
  { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", name: "cnbc", type: "news" },
  { url: "https://feeds.marketwatch.com/marketwatch/topstories/", name: "marketwatch", type: "news" },
  // NOUVEAU : Financial Juice RSS
  // ⚠️ À vérifier l'URL exacte du flux RSS Financial Juice
  // Possibilités :
  // - https://www.financialjuice.com/rss
  // - https://www.financialjuice.com/feed
  // - https://www.financialjuice.com/rss.xml
  { 
    url: "https://www.financialjuice.com/rss", // À confirmer
    name: "financial-juice", 
    type: "macro" // Type spécifique pour différencier des autres news
  },
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

interface RSSItem {
  title: string;
  description: string;
  link: string;
  pubDate?: string;
  guid?: string; // NOUVEAU
  author?: string;
}

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

  // Filtrer par keywords (optionnel - Sprint 2)
  // const filteredItems = await filterItemsByKeywords(items, feed);

  // Insérer chaque item comme signal
  for (const item of items) {
    // Déduplication améliorée : utiliser guid si disponible, sinon URL
    const dedupKey = item.guid || item.link;
    const dedupQuery = item.guid 
      ? supabase.from("signals").select("id").eq("source", "rss").eq("raw_data->>guid", item.guid)
      : supabase.from("signals").select("id").eq("source", "rss").eq("raw_data->>url", item.link);
    
    const { data: existing } = await dedupQuery.single();

    if (existing) {
      console.log(`Skipping duplicate: ${item.title.substring(0, 50)}...`);
      continue; // Déjà collecté
    }

    // Nettoyer la description HTML
    const cleanDescription = cleanHTML(item.description || "");

    // Insérer nouveau signal
    const { data: signal, error: insertError } = await supabase
      .from("signals")
      .insert({
        source: "rss",
        type: feed.type,
        timestamp: parseDate(item.pubDate) || new Date().toISOString(),
        raw_data: {
          title: item.title,
          description: cleanDescription, // Description nettoyée
          url: item.link,
          guid: item.guid, // NOUVEAU : stocker le guid
          feed: feed.name,
          author: item.author,
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

/**
 * Parser RSS amélioré avec support guid
 */
function parseRSSFeed(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  
  // Parser RSS simplifié (améliorable avec une lib comme fast-xml-parser)
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  
  for (const match of itemMatches) {
    const itemXml = match[1];
    
    // Extraction title (support CDATA)
    const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
    
    // Extraction description (support CDATA)
    const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
    
    // Extraction link
    const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
    
    // Extraction pubDate
    const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
    
    // NOUVEAU : Extraction guid (peut avoir isPermaLink="false")
    const guidMatch = itemXml.match(/<guid[^>]*>(.*?)<\/guid>/);
    
    // Extraction author (optionnel)
    const authorMatch = itemXml.match(/<author>(.*?)<\/author>/);
    
    if (titleMatch && linkMatch) {
      items.push({
        title: (titleMatch[1] || titleMatch[2] || "").trim(),
        description: (descMatch?.[1] || descMatch?.[2] || "").trim(),
        link: linkMatch[1].trim(),
        pubDate: pubDateMatch?.[1]?.trim(),
        guid: guidMatch?.[1]?.trim(), // NOUVEAU
        author: authorMatch?.[1]?.trim(),
      });
    }
  }
  
  return items;
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

/**
 * Parser une date RSS (format RFC 822)
 * Ex: "Tue, 23 Dec 2025 17:45:27 GMT"
 */
function parseDate(dateString?: string): string | null {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  } catch (e) {
    console.warn(`Failed to parse date: ${dateString}`, e);
    return null;
  }
}

/**
 * Filtrage par keywords (Sprint 2)
 * À implémenter avec la table rss_keywords
 */
async function filterItemsByKeywords(
  items: RSSItem[],
  feed: { url: string; name: string; type: string }
): Promise<RSSItem[]> {
  // Récupérer les keywords depuis Supabase
  const { data: keywords } = await supabase
    .from('rss_keywords')
    .select('*')
    .eq('enabled', true);

  if (!keywords || keywords.length === 0) {
    return items; // Pas de filtres = tout accepter
  }

  const filtered: RSSItem[] = [];

  for (const item of items) {
    const text = `${item.title} ${item.description}`.toLowerCase();
    
    // Chercher les matches
    const matches = keywords.filter(k => 
      text.includes(k.keyword.toLowerCase())
    );

    if (matches.length > 0) {
      // Au moins un keyword match = inclure l'item
      filtered.push(item);
    }
  }

  return filtered;
}


