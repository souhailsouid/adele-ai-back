/**
 * Script pour trouver un Form 4 PGIM directement depuis la SEC Atom feed
 */

import fetch from 'node-fetch';

const SEC_ATOM_FEED_URL = 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&count=1000&output=atom';
const USER_AGENT = 'Mozilla/5.0 (compatible; PersonamyBot/1.0)';

interface AtomEntry {
  title: string;
  link: string;
  updated: string;
  summary: string;
  category?: string;
}

async function findPGIMInSECFeed() {
  console.log('🔍 Recherche de Form 4 PGIM dans la SEC Atom feed...\n');
  
  try {
    const response = await fetch(SEC_ATOM_FEED_URL, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const xml = await response.text();
    
    // Parser le feed Atom
    const entries: AtomEntry[] = [];
    const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi);
    
    for (const match of entryMatches) {
      const entryXml = match[1];
      
      const titleMatch = entryXml.match(/<title[^>]*>([^<]+)<\/title>/i);
      const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"[^>]*>/i);
      const updatedMatch = entryXml.match(/<updated[^>]*>([^<]+)<\/updated>/i);
      const summaryMatch = entryXml.match(/<summary[^>]*>([^<]+)<\/summary>/i);
      const categoryMatch = entryXml.match(/<category[^>]*term="([^"]+)"[^>]*>/i);
      
      const title = titleMatch ? titleMatch[1].trim() : '';
      const link = linkMatch ? linkMatch[1] : '';
      const updated = updatedMatch ? updatedMatch[1].trim() : '';
      const summary = summaryMatch ? summaryMatch[1].trim() : '';
      const category = categoryMatch ? categoryMatch[1] : '';
      
      // Filtrer les Form 4 uniquement
      if (category === '4' || title.includes('4 -')) {
        entries.push({ title, link, updated, summary, category });
      }
    }
    
    console.log(`✅ ${entries.length} Form 4 trouvés dans le feed\n`);
    
    // Chercher PGIM dans les résultats
    const pgimEntries = entries.filter(entry => 
      entry.title.toLowerCase().includes('pgim') ||
      entry.summary.toLowerCase().includes('pgim') ||
      entry.link.toLowerCase().includes('pgim')
    );
    
    if (pgimEntries.length === 0) {
      console.log('❌ Aucun Form 4 PGIM trouvé dans les 100 derniers filings\n');
      console.log('💡 Essayez de chercher manuellement:');
      console.log('   https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&count=1000&output=atom');
      return;
    }
    
    console.log(`🎯 ${pgimEntries.length} Form 4 PGIM trouvé(s):\n`);
    
    pgimEntries.forEach((entry, i) => {
      console.log(`--- Form 4 ${i + 1} ---`);
      console.log(`Title: ${entry.title}`);
      console.log(`Updated: ${entry.updated}`);
      console.log(`Link: ${entry.link}`);
      
      // Extraire accession_number et CIK du link
      const accessionMatch = entry.link.match(/accession_number=([^&]+)/);
      const cikMatch = entry.link.match(/cik=([^&]+)/);
      
      const accessionNumber = accessionMatch ? accessionMatch[1] : null;
      const cik = cikMatch ? cikMatch[1].padStart(10, '0') : null;
      
      console.log(`Accession: ${accessionNumber || 'NON TROUVÉ'}`);
      console.log(`CIK: ${cik || 'NON TROUVÉ'}`);
      console.log('');
    });
    
    // Utiliser le premier pour le debug
    if (pgimEntries.length > 0) {
      const first = pgimEntries[0];
      const accessionMatch = first.link.match(/accession_number=([^&]+)/);
      const cikMatch = first.link.match(/cik=([^&]+)/);
      
      const accessionNumber = accessionMatch ? accessionMatch[1] : null;
      const cik = cikMatch ? cikMatch[1].padStart(10, '0') : '0001759669';
      
      if (accessionNumber) {
        console.log('💡 Pour analyser le Form 4 XML:');
        console.log(`   npx tsx scripts/debug_pgim_form4.ts ${accessionNumber} ${cik}`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
  }
}

findPGIMInSECFeed();
