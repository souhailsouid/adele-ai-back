/**
 * Service de calcul de différences entre filings 13F
 * Compare les holdings d'un nouveau filing avec le précédent
 */

import { supabase } from "../supabase";

export interface HoldingDiff {
  ticker: string;
  action: 'new' | 'exit' | 'increase' | 'decrease';
  shares_old: number | null;
  shares_new: number;
  diff_shares: number;
  diff_shares_pct: number | null;
  value_old: number | null;
  value_new: number;
  diff_value: number;
  diff_value_pct: number | null;
  filing_id_new: number;
  filing_id_old: number | null;
  filing_date_new: string;
  filing_date_old: string | null;
}

export interface FundDiffSummary {
  fund_id: number;
  fund_name: string;
  filing_id_new: number | null;
  filing_id_old: number | null;
  filing_date_new: string;
  filing_date_old: string | null;
  total_changes: number;
  new_positions: number;
  exits: number;
  increases: number;
  decreases: number;
  diffs: HoldingDiff[];
}

/**
 * Calcule les différences entre deux filings d'un même fund
 * Peut utiliser soit un filing_id, soit des dates spécifiques
 */
export async function calculateFundDiff(
  fundId: number,
  newFilingId?: number,
  options?: {
    from_date?: string;  // Date du filing de référence (ancien)
    to_date?: string;     // Date du filing à comparer (nouveau)
  }
): Promise<FundDiffSummary> {
  // 1. Récupérer le nouveau filing (soit par ID, soit par date)
  let newFiling: any = null;
  let actualNewFilingId: number | null = null;
  let actualNewFilingDate: string = '';

  if (options?.to_date) {
    // Trouver le filing le plus proche de to_date
    const { data: toFiling, error: toFilingError } = await supabase
      .from("fund_filings")
      .select("id, filing_date, fund_id, funds(name)")
      .eq("fund_id", fundId)
      .eq("status", "PARSED")
      .lte("filing_date", options.to_date)
      .order("filing_date", { ascending: false })
      .limit(1)
      .single();

    if (toFilingError || !toFiling) {
      throw new Error(`No filing found for date ${options.to_date}`);
    }

    newFiling = toFiling;
    actualNewFilingId = toFiling.id;
    actualNewFilingDate = toFiling.filing_date;
  } else if (newFilingId) {
    // Récupérer par ID
    const { data, error } = await supabase
      .from("fund_filings")
      .select("id, filing_date, fund_id, funds(name)")
      .eq("id", newFilingId)
      .single();

    if (error || !data) {
      throw new Error(`Filing ${newFilingId} not found`);
    }
    newFiling = data;
    actualNewFilingId = data.id;
    actualNewFilingDate = data.filing_date;
  } else {
    throw new Error("Either newFilingId or options.to_date must be provided");
  }

  const fundName = (newFiling?.funds as any)?.name || 'Unknown';

  // 3. Récupérer les holdings du nouveau filing
  const { data: newHoldings, error: newHoldingsError } = await supabase
    .from("fund_holdings")
    .select("ticker, shares, market_value")
    .eq("filing_id", actualNewFilingId)
    .eq("type", "stock"); // Seulement les actions, pas les options

  if (newHoldingsError) throw newHoldingsError;

  // 4. Trouver le filing précédent (le plus récent avant celui-ci)
  // Si from_date est fourni, utiliser cette date comme référence
  let previousFilingQuery = supabase
    .from("fund_filings")
    .select("id, filing_date")
    .eq("fund_id", fundId)
    .eq("status", "PARSED")
    .lt("filing_date", actualNewFilingDate)
    .order("filing_date", { ascending: false })
    .limit(1);

  if (options?.from_date) {
    // Trouver le filing le plus proche de from_date (mais avant to_date)
    previousFilingQuery = supabase
      .from("fund_filings")
      .select("id, filing_date")
      .eq("fund_id", fundId)
      .eq("status", "PARSED")
      .lte("filing_date", options.from_date)
      .lt("filing_date", actualNewFilingDate)
      .order("filing_date", { ascending: false })
      .limit(1);
  }

  const { data: previousFiling, error: prevFilingError } = await previousFilingQuery.single();

  let oldHoldings: Array<{ ticker: string; shares: number; market_value: number }> = [];
  let oldFilingId: number | null = null;
  let oldFilingDate: string | null = null;

  if (!prevFilingError && previousFiling) {
    oldFilingId = previousFiling.id;
    oldFilingDate = previousFiling.filing_date;

    const { data: holdings, error: holdingsError } = await supabase
      .from("fund_holdings")
      .select("ticker, shares, market_value")
      .eq("filing_id", oldFilingId)
      .eq("type", "stock");

    if (!holdingsError && holdings) {
      oldHoldings = holdings;
    }
  }

  // 4. Créer des maps pour faciliter la comparaison
  const oldHoldingsMap = new Map<string, { shares: number; market_value: number }>();
  for (const holding of oldHoldings) {
    if (holding.ticker) {
      oldHoldingsMap.set(holding.ticker, {
        shares: holding.shares || 0,
        market_value: holding.market_value || 0,
      });
    }
  }

  const newHoldingsMap = new Map<string, { shares: number; market_value: number }>();
  for (const holding of newHoldings) {
    if (holding.ticker) {
      newHoldingsMap.set(holding.ticker, {
        shares: holding.shares || 0,
        market_value: holding.market_value || 0,
      });
    }
  }

  // 5. Calculer les différences
  const diffs: HoldingDiff[] = [];
  const allTickers = new Set([
    ...oldHoldingsMap.keys(),
    ...newHoldingsMap.keys(),
  ]);

  for (const ticker of allTickers) {
    const oldHolding = oldHoldingsMap.get(ticker);
    const newHolding = newHoldingsMap.get(ticker);

    const sharesOld = oldHolding?.shares || null;
    const sharesNew = newHolding?.shares || 0;
    const valueOld = oldHolding?.market_value || null;
    const valueNew = newHolding?.market_value || 0;

    // Déterminer l'action
    let action: 'new' | 'exit' | 'increase' | 'decrease';
    if (!oldHolding && newHolding) {
      action = 'new';
    } else if (oldHolding && !newHolding) {
      action = 'exit';
    } else if (sharesNew > (sharesOld || 0)) {
      action = 'increase';
    } else {
      action = 'decrease';
    }

    const diffShares = sharesNew - (sharesOld || 0);
    const diffValue = valueNew - (valueOld || 0);
    const diffSharesPct = sharesOld ? ((diffShares / sharesOld) * 100) : null;
    const diffValuePct = valueOld ? ((diffValue / valueOld) * 100) : null;

    diffs.push({
      ticker,
      action,
      shares_old: sharesOld,
      shares_new: sharesNew,
      diff_shares: diffShares,
      diff_shares_pct: diffSharesPct,
      value_old: valueOld,
      value_new: valueNew,
      diff_value: diffValue,
      diff_value_pct: diffValuePct,
      filing_id_new: actualNewFilingId || 0,
      filing_id_old: oldFilingId,
      filing_date_new: actualNewFilingDate,
      filing_date_old: oldFilingDate,
    });
  }

  // 6. Compter les actions
  const newPositions = diffs.filter(d => d.action === 'new').length;
  const exits = diffs.filter(d => d.action === 'exit').length;
  const increases = diffs.filter(d => d.action === 'increase').length;
  const decreases = diffs.filter(d => d.action === 'decrease').length;

  // 7. Sauvegarder les différences en base
  if (diffs.length > 0) {
    const diffRecords = diffs.map(diff => ({
      fund_id: fundId,
      ticker: diff.ticker,
      filing_id_new: diff.filing_id_new,
      filing_id_old: diff.filing_id_old,
      diff_shares: diff.diff_shares,
      diff_value: diff.diff_value,
      diff_pct_shares: diff.diff_shares_pct,
      action: diff.action,
    }));

    // Supprimer les anciennes diffs pour ce filing (seulement si on utilise un filing_id)
    if (newFilingId && !options?.to_date && actualNewFilingId) {
      await supabase
        .from("fund_holdings_diff")
        .delete()
        .eq("filing_id_new", actualNewFilingId);
    }

    // Insérer les nouvelles diffs et récupérer les IDs
    const { data: insertedDiffs, error: insertError } = await supabase
      .from("fund_holdings_diff")
      .insert(diffRecords)
      .select("id, ticker, action, diff_shares, diff_pct_shares, filing_id_new");

    if (insertError) {
      console.error("Error saving diffs:", insertError);
      // Ne pas throw, on continue quand même
    } else if (insertedDiffs && insertedDiffs.length > 0 && actualNewFilingId) {
      // 8. Générer les notifications pour les utilisateurs qui suivent ce fund
      // (Asynchrone, non bloquant)
      generateNotificationsForDiffs(fundId, fundName, insertedDiffs, diffs)
        .catch(error => {
          console.error("Error generating notifications:", error);
          // Ne pas bloquer le processus principal
        });
      
      // 9. Détecter et notifier les accumulations multi-trimestres
      // (Asynchrone, non bloquant)
      generateAccumulationNotificationsForNewFiling(fundId, fundName, actualNewFilingId)
        .catch(error => {
          console.error("Error generating accumulation notifications:", error);
          // Ne pas bloquer le processus principal
        });
    }
  }

  return {
    fund_id: fundId,
    fund_name: fundName,
    filing_id_new: actualNewFilingId || null,
    filing_id_old: oldFilingId,
    filing_date_new: actualNewFilingDate,
    filing_date_old: oldFilingDate,
    total_changes: diffs.length,
    new_positions: newPositions,
    exits: exits,
    increases: increases,
    decreases: decreases,
    diffs: diffs.sort((a, b) => Math.abs(b.diff_shares) - Math.abs(a.diff_shares)),
  };
}

/**
 * Génère un message lisible pour une différence
 */
export function formatDiffMessage(diff: HoldingDiff | { ticker: string; action: string; diff_shares: number; diff_shares_pct: number | null; shares_old?: number | null }, fundName: string): string {
  const ticker = diff.ticker;
  const sharesFormatted = formatShares(Math.abs(diff.diff_shares));
  const pctFormatted = diff.diff_shares_pct
    ? ` (${diff.diff_shares_pct > 0 ? '+' : ''}${diff.diff_shares_pct.toFixed(1)}%)`
    : '';

  switch (diff.action) {
    case 'new':
      return `${fundName} a acheté ${sharesFormatted} actions ${ticker} (nouvelle position)`;
    case 'exit':
      return `${fundName} a vendu toutes ses actions ${ticker} (${formatShares(diff.shares_old || 0)} actions)`;
    case 'increase':
      return `${fundName} a acheté ${sharesFormatted} actions ${ticker}${pctFormatted}`;
    case 'decrease':
      return `${fundName} a vendu ${sharesFormatted} actions ${ticker}${pctFormatted}`;
    default:
      return `${fundName} a modifié sa position dans ${ticker}`;
  }
}

/**
 * Formate un nombre d'actions de manière lisible
 */
function formatShares(shares: number): string {
  if (shares >= 1000000) {
    return `${(shares / 1000000).toFixed(2)}M`;
  }
  if (shares >= 1000) {
    return `${(shares / 1000).toFixed(2)}K`;
  }
  return shares.toLocaleString();
}

/**
 * Génère les notifications pour tous les utilisateurs qui suivent ce fund
 * (Fonction asynchrone, non bloquante)
 */
async function generateNotificationsForDiffs(
  fundId: number,
  fundName: string,
  insertedDiffs: Array<{ id: number; ticker: string; action: string; diff_shares: number; diff_pct_shares: number | null; filing_id_new: number }>,
  diffs: HoldingDiff[]
): Promise<void> {
  try {
    // Récupérer tous les utilisateurs qui suivent ce fund
    const { data: users, error: usersError } = await supabase
      .from("user_fund_notifications")
      .select("user_id")
      .eq("fund_id", fundId);

    if (usersError || !users || users.length === 0) {
      return; // Pas d'utilisateurs à notifier
    }

    // Importer dynamiquement pour éviter les dépendances circulaires
    const { generateNotificationForDiff } = await import("./fund-notifications.service");

    // Créer un map pour associer les diffs aux insertedDiffs
    const diffMap = new Map<string, typeof insertedDiffs[0]>();
    for (const inserted of insertedDiffs) {
      diffMap.set(inserted.ticker, inserted);
    }

    // Générer une notification pour chaque utilisateur et chaque diff
    for (const user of users) {
      for (const diff of diffs) {
        const insertedDiff = diffMap.get(diff.ticker);
        if (!insertedDiff) continue;

        try {
          await generateNotificationForDiff(
            user.user_id,
            fundId,
            {
              ticker: diff.ticker,
              action: diff.action,
              diff_shares: diff.diff_shares,
              diff_shares_pct: diff.diff_shares_pct,
              filing_id_new: diff.filing_id_new,
              diff_id: insertedDiff.id,
            },
            fundName
          );
        } catch (error: any) {
          console.error(`Error generating notification for user ${user.user_id}, diff ${diff.ticker}:`, error);
          // Continue avec les autres notifications
        }
      }
    }
  } catch (error: any) {
    console.error("Error in generateNotificationsForDiffs:", error);
    // Ne pas throw, c'est non bloquant
  }
}

/**
 * Génère les notifications d'accumulation multi-trimestres pour un nouveau filing
 * Détecte les accumulations sur 2+ trimestres et notifie tous les utilisateurs qui suivent ce fund
 * (Fonction asynchrone, non bloquante)
 */
async function generateAccumulationNotificationsForNewFiling(
  fundId: number,
  fundName: string,
  newFilingId: number
): Promise<void> {
  try {
    // Importer dynamiquement pour éviter les dépendances circulaires
    const { analyzeFundDiffsStrategically } = await import("./fund-strategic-analysis.service");
    const { generateAccumulationNotification } = await import("./fund-notifications.service");

    // Récupérer les diffs pour ce filing
    const { data: rawDiffs } = await supabase
      .from("fund_holdings_diff")
      .select(`
        *,
        filing_new:fund_filings!filing_id_new(filing_date, form_type),
        filing_old:fund_filings!filing_id_old(filing_date, form_type)
      `)
      .eq("fund_id", fundId)
      .eq("filing_id_new", newFilingId);

    if (!rawDiffs || rawDiffs.length === 0) {
      return; // Pas de diffs pour ce filing
    }

    // Analyser stratégiquement pour détecter les accumulations
    const analysis = await analyzeFundDiffsStrategically(fundId, rawDiffs, 0.5);

    if (!analysis.trends || analysis.trends.accumulating_positions.length === 0) {
      return; // Pas d'accumulations détectées
    }

    // Récupérer tous les utilisateurs qui suivent ce fund
    const { data: users, error: usersError } = await supabase
      .from("user_fund_notifications")
      .select("user_id")
      .eq("fund_id", fundId);

    if (usersError || !users || users.length === 0) {
      return; // Pas d'utilisateurs à notifier
    }

    // Générer une notification pour chaque accumulation et chaque utilisateur
    for (const accumulation of analysis.trends.accumulating_positions) {
      // Vérifier si cette accumulation est présente dans le nouveau filing
      // (pour éviter de notifier pour des accumulations anciennes)
      const isInNewFiling = rawDiffs.some((d: any) => 
        d.ticker?.toUpperCase().trim() === accumulation.ticker.toUpperCase().trim() &&
        (d.action === 'new' || d.action === 'increase')
      );

      if (!isInNewFiling) {
        continue; // Cette accumulation n'est pas liée au nouveau filing
      }

      for (const user of users) {
        try {
          await generateAccumulationNotification(
            user.user_id,
            fundId,
            {
              ticker: accumulation.ticker,
              trend_quarters: accumulation.quarters,
              is_strong_accumulation: accumulation.is_strong_accumulation,
              total_added: accumulation.total_added,
              avg_impact_per_quarter: accumulation.avg_impact_per_quarter,
              filing_id_new: newFilingId,
            },
            fundName
          );
        } catch (error: any) {
          console.error(`Error generating accumulation notification for user ${user.user_id}, ticker ${accumulation.ticker}:`, error);
          // Continue avec les autres notifications
        }
      }
    }
  } catch (error: any) {
    console.error("Error in generateAccumulationNotificationsForNewFiling:", error);
    // Ne pas throw, c'est non bloquant
  }
}
