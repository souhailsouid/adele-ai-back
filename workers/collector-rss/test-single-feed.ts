/**
 * Tester un seul flux RSS
 * Usage: npx tsx test-single-feed.ts reuters
 */

import { supabase } from './src/supabase';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger les variables d'environnement
const envPath = path.join("../../workers/collector-rss", '.env');
dotenv.config({ path: envPath });

// Helper function pour transformer un objet de catégories en array plat
function flattenFeeds(
  feedsByCategory: Record<string, string[]>,
  baseName: string,
  baseType: string
): Array<{ url: string; name: string; type: string }> {
  const result: Array<{ url: string; name: string; type: string }> = [];
  
  for (const [category, urls] of Object.entries(feedsByCategory)) {
    for (const url of urls) {
      result.push({
        url,
        name: baseName,
        type: `${baseType}-${category}`,
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

const allFeeds = [
  ...investingFeeds,
  ...barchartFeeds,
  { url: "https://www.financialjuice.com/feed.ashx?xy=rss", name: "financial-juice", type: "macro" },
];

// Créer un Record pour le test
const RSS_FEEDS: Record<string, { url: string; name: string; type: string }> = {};
allFeeds.forEach(feed => {
  RSS_FEEDS[feed.name] = feed;
  // Ajouter aussi par type pour faciliter les tests
  RSS_FEEDS[`${feed.name}-${feed.type}`] = feed;
});

async function testSingleFeed() {
  const feedName = process.argv[2] || 'reuters';
  let feed = RSS_FEEDS[feedName];

  // Si le feed n'est pas trouvé directement, chercher dans les feeds multiples
  if (!feed) {
    if (feedName === 'investing' || feedName.startsWith('investing')) {
      // Prendre le premier feed Investing disponible
      feed = investingFeeds[0];
      console.log(`ℹ️  Test du premier feed Investing (${feed.type})\n`);
    } else if (feedName === 'barchart' || feedName.startsWith('barchart')) {
      // Prendre le premier feed Barchart disponible
      feed = barchartFeeds[0];
      console.log(`ℹ️  Test du premier feed Barchart (${feed.type})\n`);
    }
  }

  if (!feed) {
    console.error(`❌ Feed "${feedName}" non trouvé\n`);
    console.log('📋 Feeds disponibles:');
    const uniqueFeeds = new Set<string>();
    Object.keys(RSS_FEEDS).forEach((key) => {
      const baseName = key.split('-')[0];
      uniqueFeeds.add(baseName);
    });
    Array.from(uniqueFeeds).sort().forEach((name) => {
      console.log(`   - ${name}`);
    });
    console.log('\n💡 Vous pouvez tester:');
    console.log('   - investing (teste le premier feed Investing)');
    console.log('   - barchart (teste le premier feed Barchart)');
    console.log('   - financial-juice');
    process.exit(1);
  }

  console.log(`🧪 Test du flux: ${feed.name}`);
  console.log(`📡 URL: ${feed.url}\n`);

  try {
    // 1. Récupérer le flux RSS
    console.log('⏳ Récupération du flux RSS...');
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'ADEL AI (contact@adel.ai)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    console.log(`✅ Flux récupéré (${xml.length} caractères)\n`);

    // 2. Parser le XML
    console.log('⏳ Parsing du XML...');
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    const items: Array<{
      title: string;
      description: string;
      link: string;
      pubDate?: string;
    }> = [];

    for (const match of itemMatches) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
      const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);

      if (titleMatch && linkMatch) {
        items.push({
          title: (titleMatch[1] || titleMatch[2] || '').trim(),
          description: (descMatch?.[1] || descMatch?.[2] || '').trim(),
          link: linkMatch[1].trim(),
          pubDate: pubDateMatch?.[1]?.trim(),
        });
      }
    }

    console.log(`✅ ${items.length} items trouvés\n`);

    if (items.length === 0) {
      console.warn('⚠️  Aucun item trouvé dans le flux RSS');
      console.log('💡 Vérifiez que l\'URL est correcte et que le flux contient des items.');
      return;
    }

    // 3. Afficher les 5 premiers items
    console.log('📋 Premiers items:');
    items.slice(0, 5).forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.title}`);
      console.log(`   🔗 URL: ${item.link}`);
      console.log(`   📅 Date: ${item.pubDate || 'N/A'}`);
      if (item.description) {
        const desc = item.description.length > 150 
          ? item.description.substring(0, 150) + '...' 
          : item.description;
        console.log(`   📝 Description: ${desc}`);
      }
    });

    // 4. Vérifier dans Supabase
    console.log('\n🔍 Vérification dans Supabase...');
    const { data: existing, error } = await supabase
      .from('signals')
      .select('id, created_at, raw_data')
      .eq('source', 'rss')
      .eq('raw_data->>feed', feed.name)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Erreur Supabase:', error);
    } else {
      console.log(`✅ ${existing?.length || 0} signaux trouvés dans Supabase pour "${feed.name}"`);
      if (existing && existing.length > 0) {
        console.log('\n📊 Derniers signaux en base:');
        existing.forEach((signal: any, i: number) => {
          console.log(`   ${i + 1}. ${signal.raw_data?.title || 'N/A'}`);
          console.log(`      Créé: ${new Date(signal.created_at).toLocaleString()}`);
        });
      } else {
        console.log('💡 Aucun signal trouvé. Le collector n\'a peut-être pas encore tourné.');
      }
    }

    // 5. Vérifier les doublons potentiels
    console.log('\n🔍 Vérification des doublons...');
    const firstItem = items[0];
    const { data: duplicates } = await supabase
      .from('signals')
      .select('id, created_at')
      .eq('source', 'rss')
      .eq('raw_data->>url', firstItem.link);

    if (duplicates && duplicates.length > 0) {
      console.log(`⚠️  ${duplicates.length} signal(s) existant(s) avec la même URL: ${firstItem.link.substring(0, 50)}...`);
      console.log('   ✅ La déduplication fonctionne !');
    } else {
      console.log('✅ Aucun doublon trouvé pour le premier item');
    }

    console.log('\n✅ Test terminé !');
  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    if (error.stack) {
      console.error('\n📋 Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testSingleFeed();

