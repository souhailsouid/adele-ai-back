/**
 * Script de test pour déboguer la détection d'accumulation
 * Compare la logique du diagnostic avec celle du service
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://nmynjtrppwhiwlxfdzdh.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_KEY requis");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const fundId = 32;

async function testDetection() {
  console.log(`\n🔍 Test de détection d'accumulation pour fund ${fundId}\n`);
  
  // Récupérer les 8 derniers filings
  const { data: filings, error: filingsError } = await supabase
    .from("fund_filings")
    .select("id, filing_date")
    .eq("fund_id", fundId)
    .eq("status", "PARSED")
    .order("filing_date", { ascending: false })
    .limit(8);
  
  if (filingsError || !filings || filings.length === 0) {
    console.error("❌ Erreur:", filingsError);
    return;
  }
  
  console.log(`✅ ${filings.length} filings trouvés\n`);
  
  const filingIds = filings.map(f => f.id);
  
  // Récupérer les diffs pour LULULEMON spécifiquement
  // Note: Ne pas trier par filing_new.filing_date (relation) - Supabase ne le supporte pas
  const { data: lululemonDiffs, error: diffsError } = await supabase
    .from("fund_holdings_diff")
    .select(`
      id,
      ticker,
      action,
      diff_shares,
      diff_value,
      filing_id_new,
      filing_id_old,
      filing_new:fund_filings!filing_id_new(filing_date)
    `)
    .eq("fund_id", fundId)
    .in("filing_id_new", filingIds)
    .ilike("ticker", "LULULEMON%");
  
  if (diffsError) {
    console.error("❌ Erreur:", diffsError);
    return;
  }
  
  console.log(`✅ ${lululemonDiffs?.length || 0} diffs LULULEMON trouvés\n`);
  
  if (!lululemonDiffs || lululemonDiffs.length === 0) {
    console.log("❌ Aucun diff LULULEMON trouvé");
    return;
  }
  
  // Analyser la structure
  console.log("📋 Structure des diffs LULULEMON:\n");
  for (const diff of lululemonDiffs) {
    console.log(`  Ticker: "${diff.ticker}"`);
    console.log(`  Action: ${diff.action}`);
    console.log(`  Diff value: ${diff.diff_value}`);
    console.log(`  Filing ID new: ${diff.filing_id_new}`);
    console.log(`  Filing new structure:`, JSON.stringify(diff.filing_new, null, 2));
    
    // Extraire filing_date comme dans le service
    let filingDate = '';
    if ((diff.filing_new as any)?.filing_date) {
      filingDate = (diff.filing_new as any).filing_date;
    } else {
      const filing = filings.find(f => f.id === diff.filing_id_new);
      filingDate = filing?.filing_date || '';
    }
    
    console.log(`  Filing date extraite: "${filingDate}"`);
    console.log(`  Is accumulation: ${(diff.action === 'new' || diff.action === 'increase') && diff.diff_value > 0}`);
    console.log('');
  }
  
  // Tester la logique de détection
  console.log("🔍 Test de la logique de détection:\n");
  
  const tickerKey = "LULULEMON";
  const diffsList = lululemonDiffs.map(diff => {
    let filingDate = '';
    if ((diff.filing_new as any)?.filing_date) {
      filingDate = (diff.filing_new as any).filing_date;
    } else {
      const filing = filings.find(f => f.id === diff.filing_id_new);
      filingDate = filing?.filing_date || '';
    }
    
    return {
      filing_date: filingDate,
      action: diff.action,
      diff_value: diff.diff_value || 0,
    };
  });
  
  // Trier par date décroissante
  diffsList.sort((a, b) => new Date(b.filing_date).getTime() - new Date(a.filing_date).getTime());
  
  console.log(`  Diffs triés (${diffsList.length}):`);
  for (const d of diffsList) {
    console.log(`    ${d.filing_date} | ${d.action} | $${(d.diff_value / 1000).toFixed(0)}K`);
  }
  
  // Détecter accumulation
  let accumulatingStreak = 0;
  let totalAdded = 0;
  let lastFilingDate: string | null = null;
  
  for (let i = 0; i < diffsList.length; i++) {
    const diff = diffsList[i];
    const isAccumulation = (diff.action === 'new' || diff.action === 'increase') && diff.diff_value > 0;
    
    console.log(`\n  Itération ${i}:`);
    console.log(`    Date: ${diff.filing_date}`);
    console.log(`    Action: ${diff.action}, Value: ${diff.diff_value}`);
    console.log(`    Is accumulation: ${isAccumulation}`);
    console.log(`    Last filing date: ${lastFilingDate || 'null'}`);
    
    // Vérifier gap temporel
    if (lastFilingDate && i > 0) {
      const monthsDiff = (new Date(lastFilingDate).getTime() - new Date(diff.filing_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
      console.log(`    Gap: ${monthsDiff.toFixed(2)} mois`);
      if (monthsDiff > 5) {
        console.log(`    ⚠️  Gap > 5 mois, séquence brisée`);
        break;
      }
    }
    
    if (isAccumulation) {
      accumulatingStreak++;
      totalAdded += Math.abs(diff.diff_value);
      lastFilingDate = diff.filing_date;
      console.log(`    ✅ Accumulation détectée! Streak: ${accumulatingStreak}`);
    } else if (diff.action === 'exit' || (diff.action === 'decrease' && diff.diff_value < 0)) {
      console.log(`    ❌ Vente détectée, séquence brisée`);
      break;
    } else {
      lastFilingDate = diff.filing_date;
      console.log(`    ⏭️  Action non-déterminée, continue`);
    }
  }
  
  console.log(`\n📊 Résultat:\n`);
  console.log(`  Accumulating streak: ${accumulatingStreak}`);
  console.log(`  Total added: $${(totalAdded / 1000).toFixed(0)}K`);
  console.log(`  >= 2 trimestres: ${accumulatingStreak >= 2 ? '✅ OUI' : '❌ NON'}`);
  
  if (accumulatingStreak >= 2) {
    console.log(`\n✅ LULULEMON devrait être détecté comme accumulation (${accumulatingStreak}Q)\n`);
  } else {
    console.log(`\n❌ LULULEMON n'est pas détecté (seulement ${accumulatingStreak}Q)\n`);
  }
}

testDetection().catch(console.error);
