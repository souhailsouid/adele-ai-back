/**
 * Service de filtrage des "Top Signals" - Insider Transactions Premium
 * 
 * Filtre les transactions selon les critères "Golden Filter":
 * - Code P (Purchase) uniquement
 * - Montant > 50 000$
 * - Priorité aux CEO, CFO, Director
 */

// Import lazy pour éviter de charger parquetjs si non nécessaire (routes read-only)

export interface TopInsiderSignal {
  id: number;
  company_id: number;
  filing_id: number;
  insider_name: string;
  insider_cik?: string;
  insider_title?: string;
  relation?: string;
  transaction_type: string;
  shares: number;
  price_per_share: number;
  total_value: number;
  transaction_date: string;
  signal_score: number; // Score de qualité (1-10)
  created_at: string;
}

/**
 * Critères "Golden Filter" pour les Top Signals
 */
const GOLDEN_FILTER = {
  MIN_VALUE: 50000, // 50 000$ minimum
  TRANSACTION_TYPES: ['purchase'], // Code P uniquement
  PRIORITY_TITLES: [
    'ceo',
    'chief executive officer',
    'cfo',
    'chief financial officer',
    'director',
    'president',
    'chairman',
    'chair',
    'coo',
    'chief operating officer',
  ],
};

/**
 * Calculer le score de qualité d'un signal (1-10)
 */
function calculateSignalScore(transaction: {
  total_value: number;
  relation?: string;
  insider_title?: string;
}): number {
  let score = 5; // Score de base

  // Bonus pour les titres prioritaires
  const title = (transaction.relation || transaction.insider_title || '').toLowerCase();
  if (GOLDEN_FILTER.PRIORITY_TITLES.some(priority => title.includes(priority))) {
    score += 3; // +3 pour CEO/CFO/Director
  }

  // Bonus pour les montants élevés
  if (transaction.total_value >= 1000000) {
    score += 2; // +2 pour > 1M$
  } else if (transaction.total_value >= 500000) {
    score += 1; // +1 pour > 500k$
  }

  // Limiter à 10
  return Math.min(10, score);
}

/**
 * Filtrer les transactions pour ne garder que les "Top Signals"
 */
export function filterTopSignals(
  transactions: Array<{
    company_id: number;
    filing_id: number;
    insider_name: string;
    insider_cik?: string;
    insider_title?: string;
    relation?: string;
    transaction_type: string;
    shares: number;
    price_per_share: number;
    total_value: number;
    transaction_date: string;
  }>
): TopInsiderSignal[] {
  const topSignals: TopInsiderSignal[] = [];

  for (const transaction of transactions) {
    // 1. Vérifier le type de transaction (Purchase uniquement)
    if (!GOLDEN_FILTER.TRANSACTION_TYPES.includes(transaction.transaction_type.toLowerCase())) {
      continue;
    }

    // 2. Vérifier le montant minimum (50k$)
    if (transaction.total_value < GOLDEN_FILTER.MIN_VALUE) {
      continue;
    }

    // 3. Calculer le score
    const signalScore = calculateSignalScore(transaction);

    // 4. Créer le signal
    const signal: TopInsiderSignal = {
      id: Date.now() + Math.random(), // ID temporaire (sera généré par Athena)
      company_id: transaction.company_id,
      filing_id: transaction.filing_id,
      insider_name: transaction.insider_name,
      insider_cik: transaction.insider_cik,
      insider_title: transaction.insider_title,
      relation: transaction.relation,
      transaction_type: transaction.transaction_type,
      shares: transaction.shares,
      price_per_share: transaction.price_per_share,
      total_value: transaction.total_value,
      transaction_date: transaction.transaction_date,
      signal_score: signalScore,
      created_at: new Date().toISOString(),
    };

    topSignals.push(signal);
  }

  return topSignals;
}

/**
 * Insérer les Top Signals dans S3
 */
export async function insertTopSignals(signals: TopInsiderSignal[]): Promise<void> {
  if (signals.length === 0) {
    return;
  }

  console.log(`[Top Signals] Inserting ${signals.length} top signals to S3...`);

  const toInsert = signals.map(signal => ({
    company_id: signal.company_id,
    filing_id: signal.filing_id,
    insider_name: signal.insider_name,
    insider_cik: signal.insider_cik,
    insider_title: signal.insider_title,
    relation: signal.relation,
    transaction_type: signal.transaction_type,
    shares: signal.shares,
    price_per_share: signal.price_per_share,
    total_value: signal.total_value,
    transaction_date: signal.transaction_date,
    signal_score: signal.signal_score,
    created_at: signal.created_at,
  }));

  try {
    // Import lazy pour éviter de charger parquetjs si non nécessaire
    const { insertRowsS3 } = await import('../athena/write');
    const result = await insertRowsS3('top_insider_signals', toInsert);
    console.log(`[Top Signals] ✅ Successfully wrote ${signals.length} top signals to S3: ${result.s3Key}`);
  } catch (error: any) {
    console.error(`[Top Signals] ❌ Error writing to S3:`, error.message);
    throw error;
  }
}
