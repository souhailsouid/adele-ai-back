/**
 * Script de diagnostic SQL pour identifier pourquoi aucune accumulation n'est détectée
 * 
 * Usage:
 *   npx tsx scripts/diagnose-accumulations.ts [fund_id]
 * 
 * Ou avec variables d'environnement:
 *   SUPABASE_URL=https://... SUPABASE_SERVICE_KEY=... npx tsx scripts/diagnose-accumulations.ts 32
 */

import { createClient } from "@supabase/supabase-js";

// Configuration depuis les variables d'environnement
const SUPABASE_URL = process.env.SUPABASE_URL || "https://nmynjtrppwhiwlxfdzdh.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "";

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_KEY ou SUPABASE_ANON_KEY requis");
  process.exit(1);
}

const fundId = parseInt(process.argv[2] || "32");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runDiagnostic() {
  console.log(`\n🔍 Diagnostic: Accumulations pour fund ${fundId} (Scion Asset Management)\n`);
  console.log("=" .repeat(80));

  // 1. Vérifier les filings parsés
  console.log("\n📍 1. Vérification des filings parsés\n");
  
  const { data: filings, error } = await supabase
  .from("fund_filings")
  .select("id, filing_date")
  .eq("fund_id", fundId)
  .eq("status", "PARSED")
  .order("filing_date", { ascending: false });

  if (error) {
    console.error("❌ Erreur:", error);
  return;
  }

  if (!filings || filings.length === 0) {
  console.log("❌ Aucun filing parsé trouvé pour ce fund");
  return;
  }

  console.log(`✅ ${filings.length} filings parsés trouvés`);
  console.log(`   Plus récent: ${filings[0].filing_date} (ID: ${filings[0].id})`);
  console.log(`   Plus ancien: ${filings[filings.length - 1].filing_date} (ID: ${filings[filings.length - 1].id})`);
  const daysSpan = Math.floor((new Date(filings[0].filing_date).getTime() - new Date(filings[filings.length - 1].filing_date).getTime()) / (1000 * 60 * 60 * 24));
  console.log(`   Période couverte: ${daysSpan} jours (${Math.round(daysSpan / 90)} trimestres)`);

  // 2. Lister les 8 derniers filings
  console.log("\n📍 2. Liste des 8 derniers filings parsés\n");
  const latestFilings = filings.slice(0, 8);
  console.log("   Filings analysés pour tendances (les 8 derniers):\n");
  for (let i = 0; i < latestFilings.length; i++) {
  const filing = latestFilings[i];
  const rank = i + 1;
  console.log(`   ${rank}. Filing ID: ${filing.id} | Date: ${filing.filing_date}`);
  }

  // 3. Vérifier les diffs calculés
  console.log("\n📍 3. Vérification des diffs calculés\n");
  const filingIds = latestFilings.map(f => f.id);
  const { data: diffs, error: diffsError } = await supabase
  .from("fund_holdings_diff")
  .select("id, ticker, action, diff_shares, diff_value, filing_id_new, filing_id_old")
  .eq("fund_id", fundId)
  .in("filing_id_new", filingIds);

  if (diffsError) {
  console.error("❌ Erreur:", diffsError);
  return;
  }

  console.log(`✅ ${diffs?.length || 0} diffs trouvés pour les 8 derniers filings`);
  const distinctTickers = new Set((diffs || []).map((d: any) => d.ticker?.toUpperCase().trim()).filter(Boolean));
  console.log(`✅ ${distinctTickers.size} tickers distincts impliqués`);

  // 4. Analyser les séquences d'achat pour chaque ticker
  console.log("\n📍 4. Analyse des séquences d'achat par ticker\n");
  
  // Grouper les diffs par ticker et ajouter les dates de filing
  const tickerDiffsMap = new Map<string, Array<{
    filing_date: string;
    action: string;
    diff_value: number;
    filing_id_new: number;
    filing_id_old: number | null;
  }>>();

  for (const diff of diffs || []) {
    const tickerKey = diff.ticker?.toUpperCase().trim();
    if (!tickerKey) continue;

    const filing = filings.find(f => f.id === diff.filing_id_new);
    if (!filing) continue;

    if (!tickerDiffsMap.has(tickerKey)) {
      tickerDiffsMap.set(tickerKey, []);
    }

    tickerDiffsMap.get(tickerKey)!.push({
      filing_date: filing.filing_date,
      action: diff.action,
      diff_value: diff.diff_value || 0,
      filing_id_new: diff.filing_id_new,
      filing_id_old: diff.filing_id_old,
    });
  }

  // Trier chaque liste par date décroissante
  for (const [ticker, diffsList] of tickerDiffsMap.entries()) {
    diffsList.sort((a, b) => new Date(b.filing_date).getTime() - new Date(a.filing_date).getTime());
  }

  // Afficher les top 10 tickers avec le plus de diffs
  const tickersSorted = Array.from(tickerDiffsMap.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  console.log("   Top 10 tickers avec le plus de mouvements:\n");
  for (const [ticker, diffsList] of tickersSorted) {
    console.log(`   ${ticker.padEnd(15)}: ${diffsList.length} mouvements`);
    const accumulations = diffsList.filter(d => 
      (d.action === 'new' || d.action === 'increase') && d.diff_value > 0
    );
    const sales = diffsList.filter(d => 
      d.action === 'exit' || (d.action === 'decrease' && d.diff_value < 0)
    );
    console.log(`     - Accumulations: ${accumulations.length} | Ventes: ${sales.length}`);
    
    if (accumulations.length >= 2) {
      console.log(`     - Séquence d'achat: ${accumulations.map(d => `${d.action} (${d.filing_date})`).join(' -> ')}`);
    }
  }

    // 5. Détecter les séquences d'accumulation potentielles
    console.log("\n📍 5. Détection des séquences d'accumulation potentielles (2+ trimestres - signal pertinent)\n");
  
  const accumulatingPositions: Array<{
    ticker: string;
    quarters: number;
    total_added: number;
    sequence: string;
    gaps: Array<number>;
  }> = [];

  for (const [ticker, diffsList] of tickerDiffsMap.entries()) {
    let accumulatingStreak = 0;
    let totalAdded = 0;
    let lastFilingDate: string | null = null;
    const gaps: number[] = [];
    const sequence: string[] = [];

    for (const diff of diffsList) {
      const isAccumulation = (diff.action === 'new' || diff.action === 'increase') && diff.diff_value > 0;
      const isSale = diff.action === 'exit' || (diff.action === 'decrease' && diff.diff_value < 0);

      // Vérifier l'écart temporel
      if (lastFilingDate) {
        const monthsDiff = (new Date(lastFilingDate).getTime() - new Date(diff.filing_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsDiff > 5) {
          gaps.push(monthsDiff);
          break; // Séquence brisée par un gap > 5 mois
        }
      }

      if (isAccumulation) {
        accumulatingStreak++;
        totalAdded += Math.abs(diff.diff_value);
        sequence.push(`${diff.action} (${diff.filing_date})`);
        lastFilingDate = diff.filing_date;
      } else if (isSale) {
        break; // Séquence brisée par une vente
      } else {
        lastFilingDate = diff.filing_date;
      }
    }

      // Détecter accumulations sur 2+ trimestres (signal pertinent)
      // 2 trimestres = signal pertinent, 3+ trimestres = signal très fort
      if (accumulatingStreak >= 2) {
        accumulatingPositions.push({
          ticker,
          quarters: accumulatingStreak,
          total_added: totalAdded,
          sequence: sequence.join(' -> '),
          gaps,
        });
      }
    }

    if (accumulatingPositions.length > 0) {
      console.log(`✅ ${accumulatingPositions.length} séquences d'accumulation détectées (2+ trimestres):\n`);
      for (const pos of accumulatingPositions.sort((a, b) => b.quarters - a.quarters)) {
        const strengthBadge = pos.quarters >= 3 ? "⭐ TRÈS FORT" : "✓ PERTINENT";
        console.log(`   ${pos.ticker.padEnd(15)}: ${pos.quarters}Q ${strengthBadge} | Total ajouté: $${(pos.total_added / 1000).toFixed(0)}K`);
        console.log(`     Séquence: ${pos.sequence}`);
        if (pos.gaps.length > 0) {
          console.log(`     ⚠️  Gaps détectés: ${pos.gaps.map(g => `${g.toFixed(1)} mois`).join(', ')}`);
        }
      }
    } else {
      console.log("❌ Aucune séquence d'accumulation de 2+ trimestres détectée\n");
    
    // Analyser pourquoi
    console.log("   🔍 Analyse des raisons:\n");
    
      // Compter les tickers avec 1 accumulation seulement (pas assez pour 2+)
      const singleQuarterTickers: string[] = [];
      for (const [ticker, diffsList] of tickerDiffsMap.entries()) {
        const accumulations = diffsList.filter(d => 
          (d.action === 'new' || d.action === 'increase') && d.diff_value > 0
        );
        if (accumulations.length === 1) {
          singleQuarterTickers.push(ticker);
        }
      }
      
      if (singleQuarterTickers.length > 0) {
        console.log(`   - ${singleQuarterTickers.length} tickers avec seulement 1 accumulation (pas assez pour 2+):`);
        console.log(`     ${singleQuarterTickers.slice(0, 5).join(', ')}${singleQuarterTickers.length > 5 ? '...' : ''}\n`);
      }

    // Compter les gaps temporels
    let gapsCount = 0;
    for (const [ticker, diffsList] of tickerDiffsMap.entries()) {
      for (let i = 1; i < diffsList.length; i++) {
        const monthsDiff = (new Date(diffsList[i - 1].filing_date).getTime() - new Date(diffsList[i].filing_date).getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsDiff > 5) {
          gapsCount++;
        }
      }
    }
    
    if (gapsCount > 0) {
      console.log(`   - ${gapsCount} gaps temporels > 5 mois détectés (séquences brisées)\n`);
    }
  }

  // 6. Exemple détaillé pour un ticker spécifique (ex: LULULEMON)
  console.log("\n📍 6. Exemple détaillé: LULULEMON\n");
  const lululemonDiffs = tickerDiffsMap.get("LULULEMON");
  if (lululemonDiffs && lululemonDiffs.length > 0) {
    console.log(`   ${lululemonDiffs.length} mouvements trouvés:\n`);
    for (const diff of lululemonDiffs) {
      const mouvementType = (diff.action === 'new' || diff.action === 'increase') && diff.diff_value > 0 
        ? '✅ ACHAT' 
        : diff.action === 'exit' || (diff.action === 'decrease' && diff.diff_value < 0)
        ? '❌ VENTE'
        : '⚠️  AUTRE';
      console.log(`   ${diff.filing_date} | ${mouvementType.padEnd(10)} | ${diff.action.padEnd(10)} | $${(diff.diff_value / 1000).toFixed(0)}K`);
    }
  } else {
    console.log("   ℹ️  Aucun mouvement trouvé pour LULULEMON dans les 8 derniers filings");
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Diagnostic terminé\n");
}

runDiagnostic().catch(console.error);
