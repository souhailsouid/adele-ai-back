/**
 * Script de test pour le form4-company-collector
 * Teste la collecte pour quelques entreprises seulement
 */

import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const USER_AGENT = "ADEL AI (contact@adel.ai)";

interface MonitoredEntity {
  ticker: string;
  company_cik: string;
  insider_name?: string;
  insider_cik?: string;
  sector: string;
}

// Charger seulement les 5 premières entreprises pour le test
const monitoredEntitiesPath = path.join(__dirname, '../workers/form4-company-collector/src/monitored-entities.json');
const allEntities: MonitoredEntity[] = JSON.parse(fs.readFileSync(monitoredEntitiesPath, 'utf-8'));
const testEntities = allEntities.slice(0, 5); // Tester avec 5 entreprises

async function fetchCompanyAtomFeed(companyCik: string): Promise<any[]> {
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${companyCik}&type=4&count=40&output=atom`;
  
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`SEC feed error: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  
  // Parser simple pour compter les entrées
  const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
  const entries: any[] = [];
  
  for (const match of entryMatches) {
    const entryXml = match[1];
    const categoryMatch = entryXml.match(/<category[^>]*term="([^"]*)"[^>]*>/);
    const category = categoryMatch?.[1];
    
    if (category === "4") {
      const linkMatch = entryXml.match(/<link[^>]*href="([^"]*)"[^>]*>/);
      const updatedMatch = entryXml.match(/<updated>(.*?)<\/updated>/);
      
      if (linkMatch) {
        const linkStr = linkMatch[1].trim();
        const indexMatch = linkStr.match(/(\d{10}-\d{2}-\d{6})-index\.htm/);
        const accessionNumber = indexMatch?.[1];
        
        entries.push({
          accessionNumber,
          updated: updatedMatch?.[1]?.trim() || '',
        });
      }
    }
  }
  
  return entries;
}

async function testCollector() {
  console.log('🧪 Test du form4-company-collector\n');
  console.log(`📊 Test avec ${testEntities.length} entreprises (sur ${allEntities.length} total)\n`);

  const now = new Date();
  const timeWindowEnd = new Date(now);
  const timeWindowStart = new Date(now);
  timeWindowStart.setUTCHours(timeWindowStart.getUTCHours() - 2);

  console.log(`⏰ Fenêtre temporelle: ${timeWindowStart.toISOString()} à ${timeWindowEnd.toISOString()}\n`);

  let totalFound = 0;
  let totalInWindow = 0;

  for (const entity of testEntities) {
    try {
      console.log(`[${entity.ticker}] CIK: ${entity.company_cik}`);
      
      const entries = await fetchCompanyAtomFeed(entity.company_cik);
      console.log(`  📥 ${entries.length} Form 4 trouvés dans le flux`);
      
      const inWindow = entries.filter(entry => {
        if (!entry.updated) return false;
        const entryDate = new Date(entry.updated);
        return entryDate >= timeWindowStart && entryDate < timeWindowEnd;
      });
      
      console.log(`  ✅ ${inWindow.length} dans la fenêtre temporelle`);
      
      if (inWindow.length > 0) {
        console.log(`  📋 Accession numbers:`);
        inWindow.forEach(entry => {
          console.log(`     - ${entry.accessionNumber}`);
        });
      }
      
      totalFound += entries.length;
      totalInWindow += inWindow.length;
      
      console.log('');
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error: any) {
      console.error(`  ❌ Erreur: ${error.message}\n`);
    }
  }

  console.log('='.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(60));
  console.log(`Entreprises testées: ${testEntities.length}`);
  console.log(`Form 4 totaux trouvés: ${totalFound}`);
  console.log(`Form 4 dans la fenêtre: ${totalInWindow}`);
  console.log('='.repeat(60));
  
  if (totalInWindow > 0) {
    console.log(`\n✅ Le collector trouverait ${totalInWindow} Form 4 à publier dans SQS`);
  } else {
    console.log(`\n⚠️  Aucun Form 4 dans la fenêtre temporelle (normal si pas d'activité récente)`);
  }
}

testCollector().catch(console.error);
