/**
 * Validation robuste des données des APIs externes (UW, FMP)
 * Approche en 4 couches : types, validation runtime, sanity checks, observabilité
 */

import { z } from 'zod';
import { logger } from './logger';

// ========== Types d'état des sources ==========

export type SourceStatus = 'ok' | 'timeout' | 'error' | 'invalid_shape' | 'invalid_data';

// ========== Schémas Zod pour FlowPerExpiry (RecentFlow) ==========

const FlowPerExpirySchema = z.object({
  ticker: z.string().min(1),
  date: z.string(), // ISO date
  expiry: z.string(), // ISO date
  call_volume: z.number().int().nonnegative(),
  put_volume: z.number().int().nonnegative(),
  call_premium: z.string(),
  put_premium: z.string(),
  call_trades: z.number().int().nonnegative(),
  put_trades: z.number().int().nonnegative(),
  call_otm_volume: z.number().int().nonnegative().optional(),
  put_otm_volume: z.number().int().nonnegative().optional(),
  call_volume_ask_side: z.number().int().nonnegative().optional(),
  call_volume_bid_side: z.number().int().nonnegative().optional(),
  put_volume_ask_side: z.number().int().nonnegative().optional(),
  put_volume_bid_side: z.number().int().nonnegative().optional(),
});

export const RecentFlowsSchema = z.array(FlowPerExpirySchema);

// ========== Schémas Zod pour Short Interest ==========

const ShortInterestSchema = z.object({
  ticker: z.string().min(1),
  short_interest: z.number().nonnegative().nullable().optional(),
  float: z.number().positive().nullable().optional(),
  short_interest_ratio: z.number().nonnegative().nullable().optional(),
  days_to_cover: z.number().nonnegative().nullable().optional(),
  settlement_date: z.string().nullable().optional(),
});

// ========== Schémas Zod pour Dark Pool ==========

const DarkPoolTradeSchema = z.object({
  ticker: z.string().min(1).optional(),
  volume: z.number().nonnegative().nullable().optional(),
  size: z.number().nonnegative().nullable().optional(),
  price: z.number().positive().nullable().optional(),
  timestamp: z.string().or(z.number()).nullable().optional(),
});

export const DarkPoolTradesSchema = z.array(DarkPoolTradeSchema);

// ========== Schémas Zod pour Insiders ==========

const InsiderTransactionSchema = z.object({
  ticker: z.string().min(1).optional(),
  transaction_type: z.enum(['BUY', 'SELL', 'A', 'D']).nullable().optional(),
  acquisitionOrDisposition: z.enum(['A', 'D']).nullable().optional(),
  shares: z.number().nonnegative().nullable().optional(),
  price: z.number().positive().nullable().optional(),
  transaction_date: z.string().nullable().optional(),
});

export const InsiderTransactionsSchema = z.array(InsiderTransactionSchema);

// ========== Schémas Zod pour Quote (FMP) ==========

const QuoteSchema = z.object({
  symbol: z.string().min(1).optional(),
  price: z.number().positive(),
  change: z.number(),
  changePercent: z.number(),
  volume: z.number().int().nonnegative(),
  previousClose: z.number().positive().optional(),
  open: z.number().positive().optional(),
  high: z.number().positive().optional(),
  low: z.number().positive().optional(),
  marketCap: z.number().nonnegative().optional(),
  timestamp: z.string().optional(),
});

// ========== Helpers de validation avec sanity checks ==========

/**
 * Vérifier que les données sont récentes (max 72h)
 */
function isRecentEnough(timestamp: string | number | null | undefined): boolean {
  if (!timestamp) return false;
  
  const ts = typeof timestamp === 'number' 
    ? timestamp 
    : Date.parse(String(timestamp));
    
  if (Number.isNaN(ts)) return false;
  
  const MAX_AGE_HOURS = 72;
  const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
  return ageHours <= MAX_AGE_HOURS;
}

/**
 * Valider et nettoyer les RecentFlows
 */
export function validateRecentFlows(
  rawData: any,
  expectedTicker: string,
  source: string = 'UW'
): { data: any[] | null; status: SourceStatus } {
  if (!rawData || !Array.isArray(rawData)) {
    return { data: null, status: 'error' };
  }

  // Validation Zod
  const parsed = RecentFlowsSchema.safeParse(rawData);
  if (!parsed.success) {
    logger.warn('Invalid RecentFlows shape', {
      source,
      ticker: expectedTicker,
      issues: parsed.error.issues,
    });
    return { data: null, status: 'invalid_shape' };
  }

  // Sanity checks métier
  let validated = parsed.data;

  // 1. Filtrer par ticker
  validated = validated.filter((f) => 
    f.ticker?.toUpperCase() === expectedTicker.toUpperCase()
  );

  // 2. Filtrer par date (garder seulement les données récentes)
  validated = validated.filter((f) => {
    if (!f.date) return false;
    return isRecentEnough(f.date);
  });

  // 3. Vérifier les valeurs numériques cohérentes
  validated = validated.filter((f) => {
    // Volume total doit être >= 0
    if (f.call_volume < 0 || f.put_volume < 0) return false;
    // Au moins un volume > 0 pour être utile
    if (f.call_volume === 0 && f.put_volume === 0) return false;
    return true;
  });

  if (validated.length === 0) {
    logger.warn('No valid RecentFlows after sanity checks', {
      source,
      ticker: expectedTicker,
      original_count: rawData.length,
    });
    return { data: null, status: 'invalid_data' };
  }

  return { data: validated, status: 'ok' };
}

/**
 * Valider et nettoyer les Short Interest
 */
export function validateShortInterest(
  rawData: any,
  expectedTicker: string,
  source: string = 'UW'
): { data: any | null; status: SourceStatus } {
  if (!rawData) {
    return { data: null, status: 'error' };
  }

  // Validation Zod
  const parsed = ShortInterestSchema.safeParse(rawData);
  if (!parsed.success) {
    logger.warn('Invalid ShortInterest shape', {
      source,
      ticker: expectedTicker,
      issues: parsed.error.issues,
    });
    return { data: null, status: 'invalid_shape' };
  }

  // Sanity checks métier
  const validated = parsed.data;

  // 1. Vérifier le ticker
  if (validated.ticker?.toUpperCase() !== expectedTicker.toUpperCase()) {
    logger.warn('ShortInterest ticker mismatch', {
      source,
      expected: expectedTicker,
      received: validated.ticker,
    });
    return { data: null, status: 'invalid_data' };
  }

  // 2. Vérifier les valeurs numériques cohérentes
  if (validated.short_interest !== null && validated.short_interest < 0) {
    return { data: null, status: 'invalid_data' };
  }
  if (validated.float !== null && validated.float <= 0) {
    return { data: null, status: 'invalid_data' };
  }
  if (validated.short_interest_ratio !== null && validated.short_interest_ratio < 0) {
    return { data: null, status: 'invalid_data' };
  }

  return { data: validated, status: 'ok' };
}

/**
 * Valider et nettoyer les Dark Pool Trades
 */
export function validateDarkPoolTrades(
  rawData: any,
  expectedTicker: string,
  source: string = 'UW'
): { data: any[] | null; status: SourceStatus } {
  if (!rawData || !Array.isArray(rawData)) {
    return { data: null, status: 'error' };
  }

  // Validation Zod
  const parsed = DarkPoolTradesSchema.safeParse(rawData);
  if (!parsed.success) {
    logger.warn('Invalid DarkPoolTrades shape', {
      source,
      ticker: expectedTicker,
      issues: parsed.error.issues,
    });
    return { data: null, status: 'invalid_shape' };
  }

  // Sanity checks métier
  let validated = parsed.data;

  // 1. Filtrer par ticker si présent
  if (validated.some((t) => t.ticker)) {
    validated = validated.filter((t) => 
      !t.ticker || t.ticker.toUpperCase() === expectedTicker.toUpperCase()
    );
  }

  // 2. Filtrer par date (garder seulement les données récentes)
  validated = validated.filter((t) => {
    if (!t.timestamp) return true; // Garder si pas de timestamp
    return isRecentEnough(t.timestamp);
  });

  // 3. Vérifier les valeurs numériques cohérentes
  validated = validated.filter((t) => {
    const volume = t.volume || t.size || 0;
    if (volume < 0) return false;
    if (t.price !== null && t.price !== undefined && t.price <= 0) return false;
    return true;
  });

  return { data: validated, status: 'ok' };
}

/**
 * Valider et nettoyer les Insider Transactions
 */
export function validateInsiderTransactions(
  rawData: any,
  expectedTicker: string,
  source: string = 'UW'
): { data: any[] | null; status: SourceStatus } {
  if (!rawData || !Array.isArray(rawData)) {
    return { data: null, status: 'error' };
  }

  // Validation Zod
  const parsed = InsiderTransactionsSchema.safeParse(rawData);
  if (!parsed.success) {
    logger.warn('Invalid InsiderTransactions shape', {
      source,
      ticker: expectedTicker,
      issues: parsed.error.issues,
    });
    return { data: null, status: 'invalid_shape' };
  }

  // Sanity checks métier
  let validated = parsed.data;

  // 1. Filtrer par ticker si présent
  if (validated.some((t) => t.ticker)) {
    validated = validated.filter((t) => 
      !t.ticker || t.ticker.toUpperCase() === expectedTicker.toUpperCase()
    );
  }

  // 2. Filtrer par date (garder seulement les données récentes)
  validated = validated.filter((t) => {
    if (!t.transaction_date) return true; // Garder si pas de date
    return isRecentEnough(t.transaction_date);
  });

  // 3. Vérifier les valeurs numériques cohérentes
  validated = validated.filter((t) => {
    if (t.shares !== null && t.shares !== undefined && t.shares < 0) return false;
    if (t.price !== null && t.price !== undefined && t.price <= 0) return false;
    return true;
  });

  return { data: validated, status: 'ok' };
}

/**
 * Valider et nettoyer le Quote (PRIX ACTUEL - CRITIQUE)
 */
export function validateQuote(
  rawData: any,
  expectedTicker: string,
  source: string = 'FMP'
): { data: any | null; status: SourceStatus } {
  if (!rawData) {
    return { data: null, status: 'error' };
  }

  // Validation Zod
  const parsed = QuoteSchema.safeParse(rawData);
  if (!parsed.success) {
    logger.warn('Invalid Quote shape', {
      source,
      ticker: expectedTicker,
      issues: parsed.error.issues,
    });
    return { data: null, status: 'invalid_shape' };
  }

  // Sanity checks métier (CRITIQUES pour le prix)
  const validated = parsed.data;

  // 1. Vérifier le ticker si présent
  if (validated.symbol && validated.symbol.toUpperCase() !== expectedTicker.toUpperCase()) {
    logger.warn('Quote ticker mismatch', {
      source,
      expected: expectedTicker,
      received: validated.symbol,
    });
    return { data: null, status: 'invalid_data' };
  }

  // 2. Vérifier que le prix est valide et positif (CRITIQUE)
  if (!validated.price || validated.price <= 0 || !Number.isFinite(validated.price)) {
    logger.error('Invalid price in Quote', {
      source,
      ticker: expectedTicker,
      price: validated.price,
    });
    return { data: null, status: 'invalid_data' };
  }

  // 3. Vérifier que changePercent est un nombre valide
  if (!Number.isFinite(validated.changePercent)) {
    logger.warn('Invalid changePercent in Quote', {
      source,
      ticker: expectedTicker,
      changePercent: validated.changePercent,
    });
    // On garde quand même mais on met changePercent à 0
    validated.changePercent = 0;
  }

  // 4. Vérifier que volume est valide
  if (validated.volume !== undefined && (!Number.isFinite(validated.volume) || validated.volume < 0)) {
    validated.volume = 0;
  }

  return { data: validated, status: 'ok' };
}

/**
 * Déterminer le statut d'une source depuis Promise.allSettled
 */
export function getSourceStatus(
  result: PromiseSettledResult<any>,
  validationStatus: SourceStatus
): SourceStatus {
  if (result.status === 'rejected') {
    return 'error';
  }
  if (result.status === 'fulfilled' && result.value === null) {
    return 'timeout';
  }
  if (result.status === 'fulfilled' && !result.value?.success) {
    return 'error';
  }
  // Le statut de validation (ok, invalid_shape, invalid_data) prend le dessus
  return validationStatus;
}

