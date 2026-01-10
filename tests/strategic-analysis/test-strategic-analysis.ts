/**
 * Script de validation des données d'analyse stratégique
 * Vérifie la pertinence et la fiabilité des données retournées par /funds/{id}/diffs/strategic
 */

/**
 * Script de validation des données d'analyse stratégique
 * Vérifie la pertinence et la fiabilité des données retournées par /funds/{id}/diffs/strategic
 * 
 * Usage: npx tsx tests/strategic-analysis/test-strategic-analysis.ts
 */

const API_BASE_URL = 'https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod';
// Token mis à jour (à mettre à jour si expiré)
const ACCESS_TOKEN = 'eyJraWQiOiIwekpSMTVhYjBqSk0xdnJmaFBSa0NveGJBaHhnXC9HblhkeU56Y09iRkRyND0iLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiI1MTI5ODBiZS0wMGQxLTcwZmYtNTQ3Zi0zYTA3YzkyMzA3ODIiLCJpc3MiOiJodHRwczpcL1wvY29nbml0by1pZHAuZXUtd2VzdC0zLmFtYXpvbmF3cy5jb21cL2V1LXdlc3QtM19GUURtaHhWMTQiLCJjbGllbnRfaWQiOiJwa3A0aTgyam50dHRoajJjYmlsdHVkZ3ZhIiwib3JpZ2luX2p0aSI6IjUyYmQ1MzI4LTVlODktNDMzZi04MTEzLTE0NjZkZjNjMmQ0ZSIsImV2ZW50X2lkIjoiZmIxYmJlNWMtZWRhOC00YTkxLThhNDEtMTAxZjRhZDE2Y2EwIiwidG9rZW5fdXNlIjoiYWNjZXNzIiwic2NvcGUiOiJhd3MuY29nbml0by5zaWduaW4udXNlci5hZG1pbiIsImF1dGhfdGltZSI6MTc2ODA0ODIyMSwiZXhwIjoxNzY4MDUxODIxLCJpYXQiOjE3NjgwNDgyMjEsImp0aSI6Ijk2ZGQyZTYzLTQ0NDItNGEyMC04MDIwLTFkOTQ1YmEwYzRlMiIsInVzZXJuYW1lIjoiNTEyOTgwYmUtMDBkMS03MGZmLTU0N2YtM2EwN2M5MjMwNzgyIn0.OXXerYc_91Is3-mNdzEl2x7qPM2fw-udiExgeNIkJAlcUIYf1hMUIHgCnKawm1GSUK0I3RtXDCv7HnghlCiYDUXkQJM51xkUN5u9WVw08zIZ4W3A7tnJmH2NZG2roq_S-JtGyX0Pv6Ra_4jTGP2s8ZlxsL1RHPjSIvXX3X7AyCHMq1oVKg8EnOHLTjkbiYV4W-ecS3jrEab0q5iwN-nKgEJdzOJP8c4TTvc4GQJNCIToyaj6Gq0mXFl0x4QVwN8uE7dhVQRGW5ydfDx7c54cXsRBC7GWOtJ98sv3jLMVMSxep_EP1l6sVaPiuSLCYPQzB00BUj4XsGmybV1FFnYe1A';

interface StrategicDiff {
  id: number;
  ticker: string;
  action: 'new' | 'exit' | 'increase' | 'decrease';
  diff_shares: number;
  diff_value: number;
  diff_pct_shares: number | null;
  portfolio_impact_pct: number;
  portfolio_weight_old: number | null;
  portfolio_weight_new: number | null;
  conviction_level: 'high' | 'medium' | 'low' | 'noise';
  is_exit: boolean;
  is_strong_conviction: boolean;
  filing_id_new: number;
  filing_id_old: number | null;
  filing_date_new: string;
  filing_date_old: string | null;
  sector: string | null;
  trend_quarters?: number;
  trend_direction?: 'accumulating' | 'distributing' | 'stable';
  is_accumulating?: boolean;
  is_distributing?: boolean;
}

interface StrategicAnalysis {
  fund_id: number;
  fund_name: string;
  filing_date_new: string;
  filing_date_old: string | null;
  summary: {
    portfolio_value_latest_filing: number; // Valeur en milliers USD
    total_changes_value: number;
    net_inflow: number; // Argent frais injecté (new + increase)
    net_outflow: number; // Argent retiré (exit + decrease)
    strong_conviction_count: number;
    exits_count: number;
    new_positions_count: number;
    sector_rotation_detected: boolean;
  };
  strong_conviction_movements: StrategicDiff[];
  medium_conviction_movements: StrategicDiff[];
  low_conviction_movements: StrategicDiff[];
  noise_filtered_out: number;
  sector_flows: Array<{
    sector: string;
    inflow: number;
    outflow: number;
    net_flow: number;
    net_flow_pct: number;
    ticker_count: number;
    top_movements: Array<{
      ticker: string;
      action: string;
      value: number;
      impact_pct: number;
    }>;
  }>;
  sector_flows_filtered?: Array<{
    sector: string;
    inflow: number;
    outflow: number;
    net_flow: number;
    net_flow_pct: number;
    ticker_count: number;
    top_movements: Array<{
      ticker: string;
      action: string;
      value: number;
      impact_pct: number;
    }>;
  }>; // Nouvelle fonctionnalité: exclut "Unknown"
  has_only_unknown_sectors?: boolean; // Nouvelle fonctionnalité: flag si tous Unknown
  exits: StrategicDiff[];
  trims: StrategicDiff[];
  new_positions: StrategicDiff[];
  all_movements?: StrategicDiff[]; // Nouvelle fonctionnalité: liste fusionnée et triée (strong + medium + optionnellement low)
  trends?: {
    accumulating_positions: Array<{
      ticker: string;
      quarters: number;
      total_added: number;
      avg_impact_per_quarter: number;
      is_strong_accumulation?: boolean;
    }>;
    distributing_positions: Array<{
      ticker: string;
      quarters: number;
      total_reduced: number;
      avg_impact_per_quarter: number;
      is_strong_distribution?: boolean;
    }>;
  };
}

const errors: string[] = [];
const warnings: string[] = [];
const success: string[] = [];

function logError(msg: string) {
  errors.push(msg);
  console.error(`❌ ${msg}`);
}

function logWarning(msg: string) {
  warnings.push(msg);
  console.warn(`⚠️  ${msg}`);
}

function logSuccess(msg: string) {
  success.push(msg);
  console.log(`✅ ${msg}`);
}

/**
 * Teste la cohérence du Portfolio Impact
 */
function validatePortfolioImpact(diff: StrategicDiff, totalPortfolioValue: number) {
  const expectedImpact = totalPortfolioValue > 0 
    ? (Math.abs(diff.diff_value) / totalPortfolioValue * 100) 
    : 0;
  const actualImpact = diff.portfolio_impact_pct;
  const tolerance = 0.01; // Tolérance de 0.01%
  
  if (Math.abs(expectedImpact - actualImpact) > tolerance) {
    logError(
      `Ticker ${diff.ticker}: Portfolio Impact incorrect. ` +
      `Attendu: ${expectedImpact.toFixed(4)}%, ` +
      `Reçu: ${actualImpact.toFixed(4)}%`
    );
    return false;
  }
  return true;
}

/**
 * Teste la cohérence de la classification de conviction
 */
function validateConvictionLevel(diff: StrategicDiff) {
  const impact = diff.portfolio_impact_pct;
  const isNew = diff.action === 'new';
  const isExit = diff.action === 'exit';
  
  let expectedLevel: 'high' | 'medium' | 'low' | 'noise';
  
  // Les nouvelles positions > 3% sont toujours "high conviction"
  if (isNew && impact >= 3) {
    expectedLevel = 'high';
  } else if (isExit) {
    expectedLevel = 'high';
  } else if (impact >= 5) {
    expectedLevel = 'high';
  } else if (impact >= 1) {
    expectedLevel = 'medium';
  } else if (impact >= 0.5) {
    expectedLevel = 'low';
  } else {
    expectedLevel = 'noise';
  }
  
  // Les accumulations sur 3+ trimestres sont toujours "high conviction"
  if (diff.is_accumulating && diff.trend_quarters && diff.trend_quarters >= 3) {
    expectedLevel = 'high';
  }
  
  if (diff.conviction_level !== expectedLevel) {
    logWarning(
      `Ticker ${diff.ticker}: Conviction level inattendu. ` +
      `Attendu: ${expectedLevel}, Reçu: ${diff.conviction_level} ` +
      `(Impact: ${impact.toFixed(2)}%, Action: ${diff.action}, Accumulation: ${diff.is_accumulating})`
    );
    return false;
  }
  return true;
}

/**
 * Teste la cohérence des flags is_exit et is_strong_conviction
 */
function validateFlags(diff: StrategicDiff) {
  const isExitFlag = diff.action === 'exit';
  if (diff.is_exit !== isExitFlag) {
    logError(
      `Ticker ${diff.ticker}: is_exit incorrect. ` +
      `Attendu: ${isExitFlag}, Reçu: ${diff.is_exit}`
    );
    return false;
  }
  
  const isStrongConvictionExpected = 
    diff.conviction_level === 'high' || 
    (diff.action === 'new' && diff.portfolio_impact_pct >= 3);
  
  if (diff.is_strong_conviction !== isStrongConvictionExpected) {
    logWarning(
      `Ticker ${diff.ticker}: is_strong_conviction inattendu. ` +
      `Attendu: ${isStrongConvictionExpected}, Reçu: ${diff.is_strong_conviction}`
    );
    return false;
  }
  return true;
}

/**
 * Teste la cohérence des tendances multi-trimestres
 */
function validateTrends(diff: StrategicDiff) {
  // Valider les accumulations sur 2+ trimestres (signal pertinent)
  if (diff.is_accumulating && diff.trend_quarters && diff.trend_quarters >= 2) {
    if (!diff.trend_direction || diff.trend_direction !== 'accumulating') {
      logError(
        `Ticker ${diff.ticker}: trend_direction incorrect pour accumulation. ` +
        `Attendu: 'accumulating', Reçu: ${diff.trend_direction}`
      );
      return false;
    }
    logSuccess(
      `✅ Accumulation détectée: ${diff.ticker} accumulé sur ${diff.trend_quarters} trimestres consécutifs ${diff.trend_quarters >= 3 ? '⭐ (Signal très fort)' : '✓ (Signal pertinent)'}`
    );
  }
  
  // Valider les distributions sur 2+ trimestres (signal pertinent)
  if (diff.is_distributing && diff.trend_quarters && diff.trend_quarters >= 2) {
    if (!diff.trend_direction || diff.trend_direction !== 'distributing') {
      logError(
        `Ticker ${diff.ticker}: trend_direction incorrect pour distribution. ` +
        `Attendu: 'distributing', Reçu: ${diff.trend_direction}`
      );
      return false;
    }
  }
  
  // Vérifier que is_accumulating et is_distributing ne sont pas true en même temps
  if (diff.is_accumulating && diff.is_distributing) {
    logError(
      `Ticker ${diff.ticker}: is_accumulating et is_distributing ne peuvent pas être true simultanément`
    );
    return false;
  }
  
  return true;
}

/**
 * Teste la cohérence du résumé
 */
function validateSummary(analysis: StrategicAnalysis) {
  const strongConvictionCount = analysis.strong_conviction_movements.length;
  const exitsCount = analysis.exits.length;
  const newPositionsCount = analysis.new_positions.length;
  
  if (analysis.summary.strong_conviction_count !== strongConvictionCount) {
    logError(
      `Summary: strong_conviction_count incorrect. ` +
      `Attendu: ${strongConvictionCount}, Reçu: ${analysis.summary.strong_conviction_count}`
    );
    return false;
  }
  
  if (analysis.summary.exits_count !== exitsCount) {
    logError(
      `Summary: exits_count incorrect. ` +
      `Attendu: ${exitsCount}, Reçu: ${analysis.summary.exits_count}`
    );
    return false;
  }
  
  if (analysis.summary.new_positions_count !== newPositionsCount) {
    logError(
      `Summary: new_positions_count incorrect. ` +
      `Attendu: ${newPositionsCount}, Reçu: ${analysis.summary.new_positions_count}`
    );
    return false;
  }
  
  // Vérifier que le total_changes_value est cohérent
  const allDiffs = [
    ...analysis.strong_conviction_movements,
    ...analysis.medium_conviction_movements,
    ...analysis.low_conviction_movements,
  ];
  const calculatedTotalChanges = allDiffs.reduce(
    (sum, d) => sum + Math.abs(d.diff_value),
    0
  );
  const tolerance = 1000; // Tolérance de $1000
  
  if (Math.abs(analysis.summary.total_changes_value - calculatedTotalChanges) > tolerance) {
    logWarning(
      `Summary: total_changes_value légèrement différent. ` +
      `Attendu: ${calculatedTotalChanges}, Reçu: ${analysis.summary.total_changes_value} ` +
      `(Diff: ${Math.abs(analysis.summary.total_changes_value - calculatedTotalChanges)})`
    );
  }
  
  return true;
}

/**
 * Teste la cohérence des flux sectoriels
 */
function validateSectorFlows(analysis: StrategicAnalysis) {
  const allDiffs = [
    ...analysis.strong_conviction_movements,
    ...analysis.medium_conviction_movements,
    ...analysis.low_conviction_movements,
  ];
  
  // Grouper par secteur
  const sectorMap = new Map<string, { inflow: number; outflow: number }>();
  
  for (const diff of allDiffs) {
    const sector = diff.sector || 'Unknown';
    if (!sectorMap.has(sector)) {
      sectorMap.set(sector, { inflow: 0, outflow: 0 });
    }
    
    const sectorData = sectorMap.get(sector)!;
    if (diff.action === 'new' || diff.action === 'increase') {
      sectorData.inflow += Math.abs(diff.diff_value);
    } else if (diff.action === 'exit' || diff.action === 'decrease') {
      sectorData.outflow += Math.abs(diff.diff_value);
    }
  }
  
  // Comparer avec les flux sectoriels retournés
  for (const flow of analysis.sector_flows) {
    const calculatedInflow = sectorMap.get(flow.sector)?.inflow || 0;
    const calculatedOutflow = sectorMap.get(flow.sector)?.outflow || 0;
    const calculatedNetFlow = calculatedInflow - calculatedOutflow;
    
    const tolerance = 1000; // Tolérance de $1000
    
    if (Math.abs(flow.inflow - calculatedInflow) > tolerance) {
      logWarning(
        `Secteur ${flow.sector}: inflow différent. ` +
        `Attendu: ${calculatedInflow}, Reçu: ${flow.inflow}`
      );
    }
    
    if (Math.abs(flow.outflow - calculatedOutflow) > tolerance) {
      logWarning(
        `Secteur ${flow.sector}: outflow différent. ` +
        `Attendu: ${calculatedOutflow}, Reçu: ${flow.outflow}`
      );
    }
    
    if (Math.abs(flow.net_flow - calculatedNetFlow) > tolerance) {
      logWarning(
        `Secteur ${flow.sector}: net_flow différent. ` +
        `Attendu: ${calculatedNetFlow}, Reçu: ${flow.net_flow}`
      );
    }
  }
  
  return true;
}

/**
 * Teste la cohérence des tendances avec les diffs
 */
function validateTrendsConsistency(analysis: StrategicAnalysis) {
  if (!analysis.trends) {
    logWarning('Aucune donnée de tendances disponible (nécessite 3+ filings historiques)');
    return true;
  }
  
  // Vérifier que les tickers avec accumulation sont bien marqués dans les diffs
  for (const accumulatingTrend of analysis.trends.accumulating_positions) {
    const ticker = accumulatingTrend.ticker;
    const diffWithTrend = [
      ...analysis.strong_conviction_movements,
      ...analysis.medium_conviction_movements,
      ...analysis.low_conviction_movements,
    ].find(d => d.ticker.toUpperCase().trim() === ticker.toUpperCase().trim());
    
    if (diffWithTrend) {
      if (!diffWithTrend.is_accumulating || !diffWithTrend.trend_quarters) {
        logError(
          `Ticker ${ticker}: Trouvé dans trends.accumulating_positions mais ` +
          `is_accumulating=false dans les diffs. ` +
          `Expected: is_accumulating=true, trend_quarters=${accumulatingTrend.quarters}`
        );
      } else if (diffWithTrend.trend_quarters !== accumulatingTrend.quarters) {
        logWarning(
          `Ticker ${ticker}: Nombre de trimestres différent entre trends et diff. ` +
          `Trends: ${accumulatingTrend.quarters}, Diff: ${diffWithTrend.trend_quarters}`
        );
      }
    }
  }
  
  return true;
}

/**
 * Teste la pertinence des données
 */
function validateRelevance(analysis: StrategicAnalysis) {
  // Vérifier que les strong_conviction_movements sont bien triés par priorité (accumulation d'abord, puis impact)
  let lastWasAccumulating = true;
  let lastImpact = Infinity;
  
  for (const diff of analysis.strong_conviction_movements) {
    const isAccumulating = diff.is_accumulating && diff.trend_quarters && diff.trend_quarters >= 3;
    
    if (lastWasAccumulating && !isAccumulating) {
      lastWasAccumulating = false;
      lastImpact = diff.portfolio_impact_pct;
    } else if (!lastWasAccumulating && isAccumulating) {
      logWarning(
        `Strong conviction movements: Les accumulations devraient être en premier. ` +
        `Ticker ${diff.ticker} (accumulation) devrait être avant les autres positions.`
      );
    }
    
    if (!isAccumulating && diff.portfolio_impact_pct > lastImpact) {
      logWarning(
        `Strong conviction movements: Ordre de tri incorrect. ` +
        `Ticker ${diff.ticker} (${diff.portfolio_impact_pct.toFixed(2)}%) ` +
        `devrait être après les positions avec impact plus élevé.`
      );
    }
    
    lastImpact = diff.portfolio_impact_pct;
  }
  
    // Vérifier que les positions avec accumulation sont bien dans les mouvements stratégiques (strong ou medium)
    const accumulatingPositionsInStrong = analysis.strong_conviction_movements.filter(
      d => d.is_accumulating && d.trend_quarters && d.trend_quarters >= 2
    ).length;
    const accumulatingPositionsInMedium = analysis.medium_conviction_movements.filter(
      d => d.is_accumulating && d.trend_quarters && d.trend_quarters >= 2
    ).length;
    const totalAccumulatingInMovements = accumulatingPositionsInStrong + accumulatingPositionsInMedium;
    
    if (analysis.trends && totalAccumulatingInMovements < analysis.trends.accumulating_positions.length) {
      logWarning(
        `Certaines positions avec accumulation ne sont pas dans strong_conviction_movements ou medium_conviction_movements. ` +
        `Attendu: ${analysis.trends.accumulating_positions.length}, ` +
        `Trouvé: ${totalAccumulatingInMovements} (${accumulatingPositionsInStrong} strong + ${accumulatingPositionsInMedium} medium)`
      );
    } else if (analysis.trends && analysis.trends.accumulating_positions.length > 0) {
      logSuccess(
        `✅ Toutes les accumulations (${analysis.trends.accumulating_positions.length}) sont présentes dans les mouvements stratégiques ` +
        `(${accumulatingPositionsInStrong} strong + ${accumulatingPositionsInMedium} medium)`
      );
    }
  
  return true;
}

/**
 * Test principal
 */
async function testStrategicAnalysis(fundId: number) {
  console.log(`\n🔍 Test de l'analyse stratégique pour le fund ${fundId}\n`);
  
  // Test 1: Vérifier que /diffs retourne des données
  console.log(`📍 Test 1: Vérifier que /funds/${fundId}/diffs retourne des données\n`);
  
  try {
    const diffsResponse = await fetch(
      `${API_BASE_URL}/funds/${fundId}/diffs?limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!diffsResponse.ok) {
      const errorText = await diffsResponse.text();
      logError(`Erreur HTTP ${diffsResponse.status} sur /diffs: ${errorText}`);
      return;
    }
    
    const rawDiffs = await diffsResponse.json();
    
    if (Array.isArray(rawDiffs)) {
      logSuccess(`✅ /diffs retourne ${rawDiffs.length} diffs bruts`);
      if (rawDiffs.length > 0) {
        console.log(`   Exemple: ${rawDiffs[0].ticker} - ${rawDiffs[0].action} (${rawDiffs[0].diff_value})`);
      } else {
        logWarning('⚠️  /diffs retourne un array vide. Pas de données disponibles pour l\'analyse stratégique.');
        return;
      }
    } else {
      logWarning('⚠️  /diffs ne retourne pas un array. Structure inattendue.');
    }
  } catch (error: any) {
    logError(`Erreur lors du test /diffs: ${error.message}`);
    return;
  }
  
  // Test 2: Tester /diffs/strategic avec limit=10 d'abord (comme /diffs)
  console.log(`\n📍 Test 2: Vérifier que /funds/${fundId}/diffs/strategic retourne une StrategicAnalysis\n`);
  
  try {
    // Essayer d'abord avec limit=10 (comme /diffs qui fonctionne)
    const response = await fetch(
      `${API_BASE_URL}/funds/${fundId}/diffs/strategic?noise_threshold=0.5&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      logError(`Erreur HTTP ${response.status} sur /diffs/strategic: ${errorText}`);
      return;
    }
    
    const data = await response.json();
    
    // Debug: Afficher la structure de la réponse
    console.log('📦 Structure de la réponse /diffs/strategic:');
    if (Array.isArray(data)) {
      console.log(`   Type: Array (${data.length} éléments)`);
      if (data.length > 0) {
        console.log(`   Premier élément:`, JSON.stringify(data[0], null, 2).slice(0, 300));
      }
    } else if (typeof data === 'object' && data !== null) {
      console.log(`   Type: Object`);
      console.log(`   Clés:`, Object.keys(data).join(', '));
      console.log(`   Aperçu:`, JSON.stringify(data, null, 2).slice(0, 500));
    } else {
      console.log(`   Type: ${typeof data}`);
      console.log(`   Valeur:`, data);
    }
    console.log('\n');
    
    // Gérer le cas où la réponse est un array (diffs bruts)
    if (Array.isArray(data)) {
      if (data.length === 0) {
        logError('La route /diffs/strategic retourne un array vide');
        logError('Cela signifie que getFundDiffs() retourne un array vide');
        logError('Vérifiez que le fund a des diffs calculés dans fund_holdings_diff');
        return;
      } else {
        logError(`La route /diffs/strategic retourne un array de ${data.length} diffs bruts au lieu d'une StrategicAnalysis`);
        logError('La fonction analyzeFundDiffsStrategically() n\'est peut-être pas appelée correctement');
        return;
      }
    }
    
    const analysis: StrategicAnalysis = data;
    
    if (!analysis || !analysis.summary) {
      logError('Réponse invalide: structure StrategicAnalysis manquante');
      logError(`Structure reçue: ${JSON.stringify(Object.keys(data || {}))}`);
      return;
    }
    
    logSuccess(`✅ Réponse reçue pour fund ${analysis.fund_id} (${analysis.fund_name || 'Unknown'})`);
    
    // Debug: Vérifier la structure de la réponse
    console.log('\n🔍 DEBUG: Structure de analysis.summary:');
    console.log(JSON.stringify(analysis.summary, null, 2));
    
    // Les valeurs sont stockées en milliers USD, donc pour afficher en millions: diviser par 1000
    const portfolioValue = analysis.summary.portfolio_value_latest_filing ?? analysis.summary['total_portfolio_value'] ?? 0;
    if (portfolioValue === 0 || isNaN(portfolioValue)) {
      logError(`❌ Portfolio total est 0 ou undefined. Vérifier que le calcul fonctionne correctement.`);
      logError(`   portfolio_value_latest_filing: ${analysis.summary.portfolio_value_latest_filing}`);
      logError(`   total_portfolio_value (legacy): ${(analysis.summary as any)['total_portfolio_value']}`);
    } else {
      const portfolioValueInMillions = portfolioValue / 1000;
      logSuccess(`✅ Portfolio total (filing le plus récent): $${portfolioValueInMillions.toFixed(2)}M (${portfolioValue}K USD)`);
    }
    logSuccess(`✅ Strong conviction: ${analysis.summary.strong_conviction_count} mouvements`);
    logSuccess(`✅ Exits: ${analysis.summary.exits_count}`);
    logSuccess(`✅ Nouvelles positions: ${analysis.summary.new_positions_count}`);
    
    if (analysis.trends) {
      logSuccess(`✅ Accumulations détectées: ${analysis.trends.accumulating_positions.length}`);
      logSuccess(`✅ Distributions détectées: ${analysis.trends.distributing_positions.length}`);
    }
    
    console.log('\n📊 Validation des données...\n');
    
    // Valider le résumé
    validateSummary(analysis);
    
    // Valider chaque diff
    const allDiffs = [
      ...analysis.strong_conviction_movements,
      ...analysis.medium_conviction_movements,
      ...analysis.low_conviction_movements,
    ];
    
    logSuccess(`✅ Validation de ${allDiffs.length} diffs...`);
    
    for (const diff of allDiffs) {
      validatePortfolioImpact(diff, analysis.summary.portfolio_value_latest_filing);
      validateConvictionLevel(diff);
      validateFlags(diff);
      validateTrends(diff);
    }
    
    // Valider les flux sectoriels
    validateSectorFlows(analysis);
    
    // Valider la cohérence des tendances
    validateTrendsConsistency(analysis);
    
    // Valider la pertinence
    validateRelevance(analysis);
    
    // ========== VALIDATION DES NOUVELLES FONCTIONNALITÉS ==========
    console.log('\n' + '='.repeat(80));
    console.log('🔍 VALIDATION DES NOUVELLES FONCTIONNALITÉS');
    console.log('='.repeat(80) + '\n');

    // 1. Vérifier que all_movements existe et est bien trié
    if (!analysis.all_movements || !Array.isArray(analysis.all_movements)) {
      logError("❌ all_movements n'existe pas ou n'est pas un tableau");
    } else {
      logSuccess(`✅ all_movements existe: ${analysis.all_movements.length} mouvements`);
      
      // Vérifier que all_movements contient bien strong + medium (et optionnellement low)
      const expectedMinCount = analysis.strong_conviction_movements.length + analysis.medium_conviction_movements.length;
      const expectedMaxCount = expectedMinCount + analysis.low_conviction_movements.length;
      
      if (analysis.all_movements.length < expectedMinCount || analysis.all_movements.length > expectedMaxCount) {
        logWarning(`⚠️  all_movements.length (${analysis.all_movements.length}) devrait être entre ${expectedMinCount} et ${expectedMaxCount}`);
      } else {
        logSuccess(`✅ all_movements contient bien strong + medium: ${analysis.all_movements.length} mouvements`);
      }

      // Vérifier le tri par priorité (accumulations 3+ > 2+ > impact)
      let sortingValid = true;
      let sortingErrors = 0;
      for (let i = 0; i < Math.min(analysis.all_movements.length - 1, 20); i++) {
        const current = analysis.all_movements[i];
        const next = analysis.all_movements[i + 1];
        
        const currentIsStrongAcc = current.is_accumulating && current.trend_quarters && current.trend_quarters >= 3;
        const nextIsStrongAcc = next.is_accumulating && next.trend_quarters && next.trend_quarters >= 3;
        const currentIsAcc = current.is_accumulating && current.trend_quarters && current.trend_quarters >= 2;
        const nextIsAcc = next.is_accumulating && next.trend_quarters && next.trend_quarters >= 2;

        // Si current est une accumulation 3+ et next non, c'est correct
        if (currentIsStrongAcc && !nextIsStrongAcc) continue;
        
        // Si les deux sont des accumulations 3+, vérifier que current a >= trimestres que next
        if (currentIsStrongAcc && nextIsStrongAcc) {
          if ((current.trend_quarters || 0) < (next.trend_quarters || 0)) {
            if (sortingErrors < 3) {
              logError(`❌ Tri incorrect: accumulation 3+ avec moins de trimestres (${current.ticker}: ${current.trend_quarters}Q) avant une avec plus (${next.ticker}: ${next.trend_quarters}Q)`);
            }
            sortingValid = false;
            sortingErrors++;
          }
          continue;
        }

        // Si current est une accumulation 2+ et next non (et pas 3+), c'est correct
        if (currentIsAcc && !nextIsStrongAcc && !nextIsAcc) continue;

        // Si les deux sont des accumulations 2+ (mais pas 3+), vérifier les trimestres
        if (currentIsAcc && nextIsAcc && !currentIsStrongAcc && !nextIsStrongAcc) {
          if ((current.trend_quarters || 0) < (next.trend_quarters || 0)) {
            if (sortingErrors < 3) {
              logWarning(`⚠️  Tri: accumulation 2+ avec moins de trimestres (${current.ticker}: ${current.trend_quarters}Q) avant une avec plus (${next.ticker}: ${next.trend_quarters}Q)`);
            }
            sortingErrors++;
          }
          continue;
        }
      }

      if (sortingValid && sortingErrors === 0) {
        logSuccess("✅ Tri par priorité validé: accumulations 3+ > 2+ > impact décroissant");
      } else if (sortingErrors > 0) {
        logWarning(`⚠️  ${sortingErrors} problème(s) de tri détecté(s) (voir ci-dessus)`);
      }
    }

    // 2. Vérifier sector_flows_filtered
    if (!analysis.sector_flows_filtered || !Array.isArray(analysis.sector_flows_filtered)) {
      logError("❌ sector_flows_filtered n'existe pas ou n'est pas un tableau");
    } else {
      logSuccess(`✅ sector_flows_filtered existe: ${analysis.sector_flows_filtered.length} secteurs filtrés`);
      
      // Vérifier que sector_flows_filtered exclut bien "Unknown"
      const hasUnknownInFiltered = analysis.sector_flows_filtered.some(sf => sf.sector === 'Unknown' || !sf.sector);
      if (hasUnknownInFiltered) {
        logError("❌ sector_flows_filtered contient des secteurs 'Unknown' ou null");
      } else {
        logSuccess("✅ sector_flows_filtered exclut bien les secteurs 'Unknown'");
      }
    }

    // 3. Vérifier has_only_unknown_sectors
    if (typeof analysis.has_only_unknown_sectors !== 'boolean') {
      logError("❌ has_only_unknown_sectors n'existe pas ou n'est pas un boolean");
    } else {
      // Vérifier la cohérence: si tous les secteurs sont Unknown, has_only_unknown_sectors doit être true
      const allSectorsAreUnknown = analysis.sector_flows.length > 0 && 
                                    analysis.sector_flows.every(sf => !sf.sector || sf.sector === 'Unknown');
      
      if (allSectorsAreUnknown && !analysis.has_only_unknown_sectors) {
        logError("❌ Incohérence: tous les secteurs sont Unknown mais has_only_unknown_sectors = false");
      } else if (!allSectorsAreUnknown && analysis.has_only_unknown_sectors) {
        logWarning("⚠️  Incohérence: has_only_unknown_sectors = true mais il existe des secteurs non-Unknown");
      } else {
        logSuccess(`✅ has_only_unknown_sectors = ${analysis.has_only_unknown_sectors} (cohérent avec les données)`);
      }
    }

    // 4. Tester avec include_low_conviction=true
    console.log('\n📋 Test avec include_low_conviction=true...\n');
    try {
      const responseWithLow = await fetch(
        `${API_BASE_URL}/funds/${fundId}/diffs/strategic?limit=500&include_low_conviction=true`,
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!responseWithLow.ok) {
        throw new Error(`HTTP ${responseWithLow.status}: ${responseWithLow.statusText}`);
      }

      const analysisWithLow: StrategicAnalysis = await responseWithLow.json();

      if (!analysisWithLow.all_movements) {
        logError("❌ all_movements n'existe pas avec include_low_conviction=true");
      } else {
        const expectedCountWithLow = analysisWithLow.strong_conviction_movements.length + 
                                      analysisWithLow.medium_conviction_movements.length + 
                                      analysisWithLow.low_conviction_movements.length;

        if (analysisWithLow.all_movements.length === expectedCountWithLow) {
          logSuccess(`✅ Avec include_low_conviction=true: all_movements contient ${expectedCountWithLow} mouvements (strong + medium + low)`);
        } else {
          logWarning(`⚠️  Avec include_low_conviction=true: all_movements.length (${analysisWithLow.all_movements.length}) != attendu (${expectedCountWithLow})`);
        }

        // Vérifier que sans include_low_conviction, on a moins de mouvements
        if (analysis.all_movements && analysis.all_movements.length < analysisWithLow.all_movements.length) {
          logSuccess(`✅ Sans include_low_conviction: ${analysis.all_movements.length} mouvements < avec include_low_conviction: ${analysisWithLow.all_movements.length}`);
        }
      }

    } catch (error: any) {
      logWarning(`⚠️  Erreur lors du test avec include_low_conviction: ${error.message}`);
    }

    // 5. Afficher un résumé des top mouvements
    if (analysis.all_movements && analysis.all_movements.length > 0) {
      console.log('\n📊 TOP 5 MOUVEMENTS (all_movements, déjà triés):\n');
      analysis.all_movements.slice(0, 5).forEach((diff, idx) => {
        const accumulationInfo = diff.is_accumulating && diff.trend_quarters 
          ? `🔥 Accumulation ${diff.trend_quarters}Q` 
          : '';
        console.log(`  ${idx + 1}. ${diff.ticker.padEnd(15)} | ${diff.portfolio_impact_pct.toFixed(2)}% ${accumulationInfo}`);
      });
    }

    // Vérifier pourquoi aucune accumulation n'est détectée
    console.log('\n🔍 Diagnostic des tendances multi-trimestres:\n');
    
    // Récupérer les filings parsés pour vérifier combien il y en a
    try {
      const filingsResponse = await fetch(
        `${API_BASE_URL}/funds/${fundId}/filings?form_type=13F-HR`,
        {
          headers: {
            'Authorization': `Bearer ${ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (filingsResponse.ok) {
        const filings = await filingsResponse.json();
        const parsedFilings = Array.isArray(filings) ? filings.filter((f: any) => f.status === 'PARSED') : [];
        console.log(`  📊 Filings parsés trouvés: ${parsedFilings.length}`);
        if (parsedFilings.length > 0) {
          console.log(`     Plus récent: ${parsedFilings[0].filing_date} (ID: ${parsedFilings[0].id})`);
          if (parsedFilings.length > 1) {
            console.log(`     Plus ancien: ${parsedFilings[parsedFilings.length - 1].filing_date} (ID: ${parsedFilings[parsedFilings.length - 1].id})`);
          }
          console.log(`     Filings analysés pour tendances: ${Math.min(8, parsedFilings.length)} (les 8 derniers)`);
        }
      }
    } catch (error: any) {
      logWarning(`Impossible de récupérer les filings: ${error.message}`);
    }
    
    if (analysis.trends && (analysis.trends.accumulating_positions.length > 0 || analysis.trends.distributing_positions.length > 0)) {
      console.log(`\n  ✅ Tendances détectées:`);
      console.log(`     - Accumulations: ${analysis.trends.accumulating_positions.length}`);
      console.log(`     - Distributions: ${analysis.trends.distributing_positions.length}`);
      
      if (analysis.trends.accumulating_positions.length > 0) {
        console.log('\n  📈 Positions avec Accumulation (2+ trimestres):\n');
        for (const pos of analysis.trends.accumulating_positions.slice(0, 10)) {
          const signalLabel = pos.is_strong_accumulation ? '🔥 Signal très fort (3+Q)' : '✓ Signal pertinent (2Q)';
          console.log(
            `    ✅ ${pos.ticker.padEnd(12)} | ${pos.quarters}Q | ${signalLabel} | ` +
            `Total ajouté: $${(pos.total_added / 1e6).toFixed(2)}M | ` +
            `Moyenne/trimestre: $${(pos.avg_impact_per_quarter / 1e6).toFixed(2)}M`
          );
        }
      }
    } else {
      console.log('\n  ℹ️  Aucune tendance multi-trimestres détectée');
      console.log('  📋 Raisons possibles:');
      console.log('     - Moins de 2 filings parsés consécutifs pour ce fund');
      console.log('     - Pas de séquence d\'achat continue sur 2+ trimestres consécutifs');
      console.log('     - Écarts > 5 mois entre les filings (séquence brisée)');
      console.log('     - Les diffs ne montrent pas d\'accumulation continue (mélange d\'achats et de ventes)');
      console.log('     - Les diffs calculés ne sont pas encore dans fund_holdings_diff');
      console.log('\n  💡 Note: La détection nécessite une séquence continue d\'achat (new/increase)');
      console.log('     sur 2+ trimestres consécutifs (signal pertinent), 3+ = signal très fort.');
    }
    
    // Afficher les positions avec accumulation dans les diffs actuels
    console.log('\n🎯 Positions avec Accumulation dans les diffs actuels:\n');
    const accumulatingPositions = allDiffs.filter(
      d => d.is_accumulating && d.trend_quarters && d.trend_quarters >= 2
    );
    
    if (accumulatingPositions.length > 0) {
      for (const pos of accumulatingPositions.slice(0, 10)) {
        const signalLabel = pos.trend_quarters && pos.trend_quarters >= 3 ? '🔥 Signal très fort' : '✓ Signal pertinent';
        const category = analysis.strong_conviction_movements.includes(pos) ? '(Strong)' : 
                         analysis.medium_conviction_movements.includes(pos) ? '(Medium)' : 
                         '(Low)';
        console.log(
          `  ✅ ${pos.ticker.padEnd(12)} | ${pos.trend_quarters}Q | ${signalLabel} ${category} | ` +
          `Impact: ${pos.portfolio_impact_pct.toFixed(2)}% | ` +
          `Valeur: $${(Math.abs(pos.diff_value) / 1e6).toFixed(2)}M`
        );
      }
    } else {
      console.log('  ℹ️  Aucune accumulation sur 2+ trimestres dans les diffs actuels (signal pertinent)');
    }
    
    // Résumé final
    console.log('\n' + '='.repeat(80));
    console.log('📋 RÉSUMÉ DE VALIDATION\n');
    console.log(`✅ Succès: ${success.length}`);
    console.log(`⚠️  Avertissements: ${warnings.length}`);
    console.log(`❌ Erreurs: ${errors.length}`);
    console.log('='.repeat(80));
    
    if (errors.length > 0) {
      console.log('\n❌ ERREURS DÉTECTÉES:\n');
      errors.forEach((err, i) => console.log(`${i + 1}. ${err}`));
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  AVERTISSEMENTS:\n');
      warnings.slice(0, 20).forEach((warn, i) => console.log(`${i + 1}. ${warn}`));
      if (warnings.length > 20) {
        console.log(`\n... et ${warnings.length - 20} avertissements supplémentaires`);
      }
    }
    
    if (errors.length === 0 && warnings.length === 0) {
      console.log('\n🎉 Toutes les validations sont passées avec succès!');
    } else if (errors.length === 0) {
      console.log('\n✅ Aucune erreur critique, mais quelques avertissements à vérifier.');
    } else {
      console.log('\n❌ Des erreurs critiques ont été détectées. Veuillez les corriger.');
    }
    
  } catch (error: any) {
    logError(`Erreur lors du test: ${error.message}`);
    console.error(error);
  }
}

// Exécuter le test
const fundId = 32; // Fund ID à tester
testStrategicAnalysis(fundId);
