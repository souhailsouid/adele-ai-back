/**
 * Validation robuste des données des APIs externes (UW, FMP)
 * 4 couches : Types, Validation runtime (Zod), Sanity checks, Observabilité
 */

import { z } from 'zod';
import { logger } from './logger';

// ========== Types de statut ==========

export type SourceStatus = 'ok' | 'timeout' | 'error' | 'invalid_shape' | 'invalid_data';

export interface ValidatedSource<T> {
  data: T | null;
  status: SourceStatus;
  error?: string;
  issues?: z.ZodIssue[];
}

// ========== Schémas Zod pour Unusual Whales ==========

/**
 * FlowPerExpiry / RecentFlow
 * GET /stock/{ticker}/flow-recent
 * Note: L'API UW peut retourner des structures variées, donc on rend les champs optionnels
 * et on fait une transformation/nettoyage après validation
 */
export const FlowPerExpirySchema = z.object({
  ticker: z.string().min(1).optional(), // Optionnel car peut être dans le contexte
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Optionnel car peut être dans le contexte
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // Optionnel car peut être dans le contexte
  call_volume: z.union([
    z.number().int().nonnegative(),
    z.string().transform((val) => {
      const num = parseFloat(val);
      return Number.isNaN(num) ? 0 : Math.max(0, Math.floor(num));
    }),
  ]).optional(),
  put_volume: z.union([
    z.number().int().nonnegative(),
    z.string().transform((val) => {
      const num = parseFloat(val);
      return Number.isNaN(num) ? 0 : Math.max(0, Math.floor(num));
    }),
  ]).optional(),
  call_premium: z.string().or(z.number()).optional(),
  put_premium: z.string().or(z.number()).optional(),
  call_trades: z.number().int().nonnegative().optional(),
  put_trades: z.number().int().nonnegative().optional(),
  call_otm_volume: z.number().int().nonnegative().optional(),
  put_otm_volume: z.number().int().nonnegative().optional(),
  call_otm_premium: z.string().or(z.number()).optional(),
  put_otm_premium: z.string().or(z.number()).optional(),
}).passthrough(); // Permettre des champs supplémentaires

export const RecentFlowsSchema = z.array(FlowPerExpirySchema);

/**
 * Dark Pool Trade
 * Note: L'API UW retourne price comme string, donc on accepte string et number
 */
export const DarkPoolTradeSchema = z.object({
  ticker: z.string().min(1).optional(),
  volume: z.number().int().nonnegative().optional(),
  size: z.number().int().nonnegative().optional(),
  price: z.union([
    z.number().positive(),
    z.string().transform((val) => {
      const num = parseFloat(val);
      return Number.isNaN(num) || num <= 0 ? null : num;
    }),
  ]).nullable().optional(),
  executed_at: z.string().optional(), // Alternative field name
  timestamp: z.string().or(z.number()).optional(),
  exchange: z.string().optional(),
  market_center: z.string().optional(),
  institution: z.string().optional(),
}).passthrough(); // Permettre des champs supplémentaires

export const DarkPoolTradesSchema = z.array(DarkPoolTradeSchema);

/**
 * Insider Transaction
 */
export const InsiderTransactionSchema = z.object({
  ticker: z.string().min(1).optional(),
  transaction_type: z.enum(['BUY', 'SELL', 'A', 'D']).optional(),
  acquisitionOrDisposition: z.enum(['A', 'D']).optional(),
  shares: z.number().int().nonnegative().optional(),
  price: z.number().positive().optional(),
  transaction_date: z.string().optional(),
  filing_date: z.string().optional(),
});

export const InsiderTransactionsSchema = z.array(InsiderTransactionSchema);

/**
 * Short Interest
 */
export const ShortInterestSchema = z.object({
  ticker: z.string().min(1).optional(),
  short_interest: z.number().nonnegative().nullable().optional(),
  float: z.number().positive().nullable().optional(),
  short_interest_ratio: z.number().nonnegative().nullable().optional(),
  days_to_cover: z.number().nonnegative().nullable().optional(),
  date: z.string().optional(),
});

/**
 * Institutional Ownership
 */
export const InstitutionalOwnershipSchema = z.object({
  ticker: z.string().min(1).optional(),
  name: z.string().optional(),
  institution_name: z.string().optional(),
  shares: z.number().int().nonnegative().optional(),
  units: z.number().int().nonnegative().optional(),
  units_change: z.number().int().optional(),
  shares_change: z.number().int().optional(),
  units_change_pct: z.number().optional(),
  percentage: z.number().nonnegative().max(100).optional(),
});

export const InstitutionalOwnershipSchemaArray = z.array(InstitutionalOwnershipSchema);

// ========== Schémas Zod pour FMP ==========

/**
 * Stock Quote (FMP)
 */
export const FMPStockQuoteSchema = z.object({
  symbol: z.string().min(1).optional(),
  price: z.number().positive().nullable().optional(),
  last: z.number().positive().nullable().optional(), // Alternative field name
  change: z.number().nullable().optional(),
  changePercent: z.number().nullable().optional(),
  change_percent: z.number().nullable().optional(), // Alternative field name
  volume: z.number().int().nonnegative().nullable().optional(),
  marketCap: z.number().nonnegative().nullable().optional(),
  timestamp: z.string().or(z.number()).optional(),
});

// ========== Sanity Checks ==========

/**
 * Vérifier que le ticker correspond
 */
export function validateTicker(data: any[], expectedTicker: string, fieldName: string = 'ticker'): any[] {
  if (!Array.isArray(data)) return [];
  
  return data.filter((item) => {
    const ticker = item?.[fieldName];
    if (!ticker) return true; // Si pas de ticker, on garde (peut être valide)
    return ticker.toUpperCase() === expectedTicker.toUpperCase();
  });
}

/**
 * Vérifier que les données ne sont pas trop anciennes
 */
export function validateDataAge(
  data: any[],
  maxAgeHours: number = 72,
  timestampField: string = 'date'
): any[] {
  if (!Array.isArray(data)) return [];
  
  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  
  return data.filter((item) => {
    const timestamp = item?.[timestampField];
    if (!timestamp) return true; // Si pas de timestamp, on garde
    
    let ts: number;
    if (typeof timestamp === 'number') {
      ts = timestamp;
    } else if (typeof timestamp === 'string') {
      ts = Date.parse(timestamp);
    } else {
      return true; // Format inconnu, on garde
    }
    
    if (Number.isNaN(ts)) return true; // Timestamp invalide, on garde
    
    const ageMs = now - ts;
    return ageMs <= maxAgeMs;
  });
}

/**
 * Vérifier les valeurs numériques (pas de NaN, valeurs aberrantes)
 */
export function validateNumericValues(data: any[]): any[] {
  if (!Array.isArray(data)) return [];
  
  return data.filter((item) => {
    // Vérifier qu'il n'y a pas de NaN dans les valeurs numériques
    for (const [key, value] of Object.entries(item)) {
      if (typeof value === 'number' && (Number.isNaN(value) || !Number.isFinite(value))) {
        return false; // Rejeter si NaN ou Infinity
      }
    }
      return true;
    });
}

/**
 * Vérifier le prix (doit être positif et raisonnable)
 */
export function validatePriceValue(price: number | null | undefined): number | null {
  if (price === null || price === undefined) return null;
  if (typeof price !== 'number') return null;
  if (Number.isNaN(price) || !Number.isFinite(price)) return null;
  if (price <= 0) return null;
  if (price > 1000000) return null; // Prix max raisonnable (1M$)
  return price;
}

// ========== Fonctions de validation complètes ==========

/**
 * Valider et nettoyer les Recent Flows
 */
export function validateRecentFlows(
  rawData: any,
  expectedTicker: string
): ValidatedSource<z.infer<typeof RecentFlowsSchema>> {
  try {
    // Si rawData n'est pas un array, essayer d'extraire data
    let dataToValidate = rawData;
    if (!Array.isArray(rawData)) {
      if (rawData?.data && Array.isArray(rawData.data)) {
        dataToValidate = rawData.data;
      } else {
        logger.warn('RecentFlows data is not an array', {
          ticker: expectedTicker,
          rawDataType: typeof rawData,
          rawDataKeys: rawData ? Object.keys(rawData) : [],
        });
        return {
          data: null,
          status: 'invalid_shape',
          error: 'RecentFlows data must be an array',
        };
      }
    }
    
    // 1. Validation Zod avec transformation
    const parsed = RecentFlowsSchema.array().safeParse(dataToValidate);
    
    if (!parsed.success) {
      logger.warn('Invalid RecentFlows shape', {
        ticker: expectedTicker,
        issues: parsed.error.issues.slice(0, 5), // Limiter les logs
        totalIssues: parsed.error.issues.length,
      });
      return {
        data: null,
        status: 'invalid_shape',
        error: 'Invalid data shape from UW API',
        issues: parsed.error.issues,
      };
    }
    
    // 2. Transformation et nettoyage
    let cleaned = parsed.data.map((item: any) => {
      // Ajouter le ticker si manquant (depuis le contexte)
      if (!item.ticker) {
        item.ticker = expectedTicker;
      }
      
      // Normaliser les volumes (s'assurer qu'ils sont des nombres)
      if (typeof item.call_volume === 'string') {
        item.call_volume = parseInt(item.call_volume, 10) || 0;
      }
      if (typeof item.put_volume === 'string') {
        item.put_volume = parseInt(item.put_volume, 10) || 0;
      }
      
      // S'assurer que les volumes sont >= 0
      item.call_volume = Math.max(0, item.call_volume || 0);
      item.put_volume = Math.max(0, item.put_volume || 0);
      
      return item;
    });
    
    // 3. Sanity checks
    // Vérifier le ticker
    cleaned = validateTicker(cleaned, expectedTicker, 'ticker');
    
    // Vérifier l'âge des données (max 72h)
    cleaned = validateDataAge(cleaned, 72, 'date');
    
    // Filtrer les items sans volume significatif
    cleaned = cleaned.filter((item: any) => {
      const totalVolume = (item.call_volume || 0) + (item.put_volume || 0);
      return totalVolume > 0; // Au moins un volume > 0
    });
    
    // Vérifier les valeurs numériques
    cleaned = validateNumericValues(cleaned);
    
    if (cleaned.length === 0) {
      logger.warn('No valid RecentFlows after cleaning', {
        ticker: expectedTicker,
        originalCount: dataToValidate.length,
      });
      return {
        data: null,
        status: 'invalid_data',
        error: 'No valid flows after cleaning',
      };
    }
    
    return {
      data: cleaned,
      status: 'ok',
    };
  } catch (error: any) {
    logger.error('Error validating RecentFlows', { error, ticker: expectedTicker });
    return {
      data: null,
      status: 'error',
      error: error.message,
    };
  }
}

/**
 * Valider et nettoyer les Dark Pool Trades
 */
export function validateDarkPoolTrades(
  rawData: any,
  expectedTicker: string
): ValidatedSource<z.infer<typeof DarkPoolTradesSchema>> {
  try {
    // Si rawData n'est pas un array, essayer d'extraire data
    let dataToValidate = rawData;
    if (!Array.isArray(rawData)) {
      if (rawData?.data && Array.isArray(rawData.data)) {
        dataToValidate = rawData.data;
      } else {
        logger.warn('DarkPoolTrades data is not an array', {
          ticker: expectedTicker,
          rawDataType: typeof rawData,
          rawDataKeys: rawData ? Object.keys(rawData) : [],
        });
        return {
          data: null,
          status: 'invalid_shape',
          error: 'DarkPoolTrades data must be an array',
        };
      }
    }
    
    // 1. Validation Zod avec transformation
    const parsed = DarkPoolTradesSchema.array().safeParse(dataToValidate);
    
    if (!parsed.success) {
      logger.warn('Invalid DarkPoolTrades shape', {
        ticker: expectedTicker,
        issues: parsed.error.issues.slice(0, 5), // Limiter les logs
        totalIssues: parsed.error.issues.length,
      });
      return {
        data: null,
        status: 'invalid_shape',
        error: 'Invalid data shape from UW API',
        issues: parsed.error.issues,
      };
    }
    
    // 2. Transformation et nettoyage
    let cleaned = parsed.data.map((item: any) => {
      // Ajouter le ticker si manquant
      if (!item.ticker) {
        item.ticker = expectedTicker;
      }
      
      // Convertir price de string en number si nécessaire
      if (item.price && typeof item.price === 'string') {
        const numPrice = parseFloat(item.price);
        if (!Number.isNaN(numPrice) && numPrice > 0) {
          item.price = numPrice;
        } else {
          item.price = null;
        }
      }
      
      // Normaliser volume et size
      if (typeof item.volume === 'string') {
        item.volume = parseInt(item.volume, 10) || 0;
      }
      if (typeof item.size === 'string') {
        item.size = parseInt(item.size, 10) || 0;
      }
      
      // Utiliser size si volume est manquant
      if (!item.volume && item.size) {
        item.volume = item.size;
      }
      
      return item;
    });
    
    // 3. Sanity checks
    cleaned = validateTicker(cleaned, expectedTicker, 'ticker');
    
    // Filtrer les trades sans prix valide ou volume
    cleaned = cleaned.filter((item: any) => {
      const hasPrice = item.price && item.price > 0;
      const hasVolume = (item.volume || item.size || 0) > 0;
      return hasPrice && hasVolume;
    });
    
    cleaned = validateNumericValues(cleaned);
    
    if (cleaned.length === 0) {
      logger.warn('No valid DarkPoolTrades after cleaning', {
        ticker: expectedTicker,
        originalCount: dataToValidate.length,
      });
      return {
        data: null,
        status: 'invalid_data',
        error: 'No valid trades after cleaning',
      };
    }
    
    return {
      data: cleaned,
      status: 'ok',
    };
  } catch (error: any) {
    logger.error('Error validating DarkPoolTrades', { error, ticker: expectedTicker });
    return {
      data: null,
      status: 'error',
      error: error.message,
    };
  }
}

/**
 * Valider et nettoyer les Insider Transactions
 */
export function validateInsiderTransactions(
  rawData: any,
  expectedTicker: string
): ValidatedSource<z.infer<typeof InsiderTransactionsSchema>> {
  try {
    // Si rawData est null ou undefined, retourner vide
    if (rawData === null || rawData === undefined) {
      return {
        data: [],
        status: 'ok',
      };
    }

    // Si rawData est un objet au lieu d'un tableau, essayer d'extraire un tableau
    let dataToValidate = rawData;
    if (!Array.isArray(rawData) && typeof rawData === 'object') {
      // Chercher des clés communes qui pourraient contenir un tableau
      if (rawData.data && Array.isArray(rawData.data)) {
        dataToValidate = rawData.data;
      } else if (rawData.transactions && Array.isArray(rawData.transactions)) {
        dataToValidate = rawData.transactions;
      } else if (rawData.results && Array.isArray(rawData.results)) {
        dataToValidate = rawData.results;
      } else {
        // Si c'est un objet unique, le convertir en tableau
        dataToValidate = [rawData];
      }
      logger.info('Converted InsiderTransactions from object to array', {
        ticker: expectedTicker,
        originalType: typeof rawData,
        convertedLength: Array.isArray(dataToValidate) ? dataToValidate.length : 1,
      });
    }

    const parsed = InsiderTransactionsSchema.safeParse(dataToValidate);
    
    if (!parsed.success) {
      logger.warn('Invalid InsiderTransactions shape', {
        ticker: expectedTicker,
        issues: parsed.error.issues,
        rawDataType: typeof rawData,
        isArray: Array.isArray(rawData),
      });
      return {
        data: [],
        status: 'invalid_shape',
        error: 'Invalid data shape from UW API',
        issues: parsed.error.issues,
      };
    }
    
    let cleaned = parsed.data;
    cleaned = validateTicker(cleaned, expectedTicker, 'ticker');
    cleaned = validateNumericValues(cleaned);
    
    return {
      data: cleaned,
      status: 'ok',
    };
  } catch (error: any) {
    logger.error('Error validating InsiderTransactions', { error, ticker: expectedTicker });
    return {
      data: [],
      status: 'error',
      error: error.message,
    };
  }
}

/**
 * Valider et nettoyer le Short Interest
 */
export function validateShortInterest(
  rawData: any,
  expectedTicker: string
): ValidatedSource<z.infer<typeof ShortInterestSchema>> {
  try {
    // Si rawData est null ou undefined, retourner null avec statut 'unavailable'
    if (rawData === null || rawData === undefined) {
      logger.info('ShortInterest data is null or undefined', { ticker: expectedTicker });
      return {
        data: null,
        status: 'ok', // 'ok' car c'est une valeur valide (pas de données disponibles)
      };
    }

    const parsed = ShortInterestSchema.safeParse(rawData);
    
    if (!parsed.success) {
      logger.warn('Invalid ShortInterest shape', {
        ticker: expectedTicker,
        issues: parsed.error.issues,
        rawDataType: typeof rawData,
      });
      return {
        data: null,
        status: 'invalid_shape',
        error: 'Invalid data shape from UW API',
        issues: parsed.error.issues,
      };
    }
    
    // Vérifier le ticker si présent
    if (parsed.data.ticker && parsed.data.ticker.toUpperCase() !== expectedTicker.toUpperCase()) {
      logger.warn('ShortInterest ticker mismatch', {
        expected: expectedTicker,
        received: parsed.data.ticker,
      });
      return {
        data: null,
        status: 'invalid_data',
        error: 'Ticker mismatch',
      };
    }

    // Vérifier les valeurs numériques
    const data = parsed.data;
    if (data.short_interest !== null && data.short_interest !== undefined) {
      if (Number.isNaN(data.short_interest) || data.short_interest < 0) {
        return {
          data: null,
          status: 'invalid_data',
          error: 'Invalid short_interest value',
        };
      }
    }
    
    if (data.float !== null && data.float !== undefined) {
      if (Number.isNaN(data.float) || data.float <= 0) {
        return {
          data: null,
          status: 'invalid_data',
          error: 'Invalid float value',
        };
      }
    }
    
    return {
      data: parsed.data,
      status: 'ok',
    };
  } catch (error: any) {
    logger.error('Error validating ShortInterest', { error, ticker: expectedTicker });
    return {
      data: null,
      status: 'error',
      error: error.message,
    };
  }
}

/**
 * Valider et nettoyer le Stock Quote (FMP)
 */
export function validateStockQuote(
  rawData: any,
  expectedTicker: string
): ValidatedSource<z.infer<typeof FMPStockQuoteSchema>> {
  try {
    const parsed = FMPStockQuoteSchema.safeParse(rawData);
    
    if (!parsed.success) {
      logger.warn('Invalid StockQuote shape', {
        ticker: expectedTicker,
        issues: parsed.error.issues,
      });
      return {
        data: null,
        status: 'invalid_shape',
        error: 'Invalid data shape from FMP API',
        issues: parsed.error.issues,
      };
    }
    
    // Vérifier le ticker si présent
    if (parsed.data.symbol && parsed.data.symbol.toUpperCase() !== expectedTicker.toUpperCase()) {
      logger.warn('StockQuote ticker mismatch', {
        expected: expectedTicker,
        received: parsed.data.symbol,
      });
      return {
        data: null,
        status: 'invalid_data',
        error: 'Ticker mismatch',
      };
    }
    
    // Valider le prix (CRITIQUE)
    const price = validatePriceValue(parsed.data.price || parsed.data.last);
    if (!price) {
      logger.warn('Invalid or missing price in StockQuote', {
        ticker: expectedTicker,
        rawPrice: parsed.data.price || parsed.data.last,
      });
      return {
        data: null,
        status: 'invalid_data',
        error: 'Invalid or missing price',
      };
    }
    
    // Normaliser le prix dans l'objet
    const normalizedData = {
      ...parsed.data,
      price: price,
      last: price, // S'assurer que les deux champs sont cohérents
    };
    
    return {
      data: normalizedData,
      status: 'ok',
    };
  } catch (error: any) {
    logger.error('Error validating StockQuote', { error, ticker: expectedTicker });
    return {
      data: null,
      status: 'error',
      error: error.message,
    };
  }
}

/**
 * Valider et nettoyer l'Institutional Ownership
 */
export function validateInstitutionalOwnership(
  rawData: any,
  expectedTicker: string
): ValidatedSource<z.infer<typeof InstitutionalOwnershipSchemaArray>> {
  try {
    // Si rawData est null ou undefined, retourner vide
    if (rawData === null || rawData === undefined) {
      return {
        data: [],
        status: 'ok',
      };
    }

    // Si rawData est un objet au lieu d'un tableau, essayer d'extraire un tableau
    let dataToValidate = rawData;
    if (!Array.isArray(rawData) && typeof rawData === 'object') {
      // Chercher des clés communes qui pourraient contenir un tableau
      if (rawData.data && Array.isArray(rawData.data)) {
        dataToValidate = rawData.data;
      } else if (rawData.holdings && Array.isArray(rawData.holdings)) {
        dataToValidate = rawData.holdings;
      } else if (rawData.results && Array.isArray(rawData.results)) {
        dataToValidate = rawData.results;
      } else if (rawData.ownership && Array.isArray(rawData.ownership)) {
        dataToValidate = rawData.ownership;
      } else {
        // Si c'est un objet unique, le convertir en tableau
        dataToValidate = [rawData];
      }
      logger.info('Converted InstitutionalOwnership from object to array', {
        ticker: expectedTicker,
        originalType: typeof rawData,
        convertedLength: Array.isArray(dataToValidate) ? dataToValidate.length : 1,
      });
    }

    const parsed = InstitutionalOwnershipSchemaArray.safeParse(dataToValidate);
    
    if (!parsed.success) {
      logger.warn('Invalid InstitutionalOwnership shape', {
        ticker: expectedTicker,
        issues: parsed.error.issues,
        rawDataType: typeof rawData,
        isArray: Array.isArray(rawData),
      });
      return {
        data: [],
        status: 'invalid_shape',
        error: 'Invalid data shape from UW API',
        issues: parsed.error.issues,
      };
    }
    
    let cleaned = parsed.data;
    cleaned = validateTicker(cleaned, expectedTicker, 'ticker');
    cleaned = validateNumericValues(cleaned);
    
    return {
      data: cleaned,
      status: 'ok',
    };
  } catch (error: any) {
    logger.error('Error validating InstitutionalOwnership', { error, ticker: expectedTicker });
    return {
      data: [],
      status: 'error',
      error: error.message,
    };
  }
}

/**
 * Déterminer le statut d'une source depuis Promise.allSettled
 */
export function determineSourceStatus<T>(
  result: PromiseSettledResult<{ success: boolean; data?: T } | null>
): { status: SourceStatus; data: T | null } {
  if (result.status === 'rejected') {
    return { status: 'error', data: null };
  }
  
  if (result.value === null) {
    return { status: 'timeout', data: null };
  }
  
  if (!result.value.success) {
    return { status: 'error', data: null };
  }
  
  if (!result.value.data) {
    return { status: 'error', data: null };
  }
  
  return { status: 'ok', data: result.value.data };
}

/**
 * Helper pour déterminer le statut depuis Promise.allSettled
 */
export function getSourceStatus(
  result: PromiseSettledResult<any>,
  defaultValue: any = null
): SourceStatus {
  if (result.status === 'rejected') {
    return 'error';
  }

  if (result.value === null || result.value === defaultValue) {
    return 'timeout';
  }

  if (!result.value.success) {
    return 'error';
  }

  return 'ok';
}

/**
 * Valider le prix (CRITIQUE - toujours requis)
 */
export function validatePrice(
  quoteResult: PromiseSettledResult<any>,
  expectedTicker: string
): {
  price_data: {
    current_price: number;
    price_change_pct: number | null;
    volume: number | null;
  } | null;
  status: SourceStatus;
} {
  const status = getSourceStatus(quoteResult);
  
  if (status !== 'ok') {
    logger.warn('Quote status not ok', { status, ticker: expectedTicker });
    return {
      price_data: null,
      status,
    };
  }
  
  let quoteData = quoteResult.value?.data;
  if (!quoteData) {
    logger.warn('Quote data is null/undefined', { ticker: expectedTicker });
    return {
      price_data: null,
      status: 'error',
    };
  }
  
  // FMP peut retourner un array avec un seul élément
  if (Array.isArray(quoteData)) {
    if (quoteData.length === 0) {
      logger.warn('Quote data is empty array', { ticker: expectedTicker });
      return {
        price_data: null,
        status: 'error',
      };
    }
    quoteData = quoteData[0]; // Prendre le premier élément
  }
  
  // Valider avec Zod
  const validated = validateStockQuote(quoteData, expectedTicker);
  
  if (validated.status !== 'ok' || !validated.data) {
    logger.warn('Quote validation failed', { 
      status: validated.status, 
      ticker: expectedTicker,
      error: validated.error,
      issues: validated.issues,
    });
    return {
      price_data: null,
      status: validated.status,
    };
  }
  
  const price = validated.data.price || validated.data.last;
  if (!price || price <= 0 || !Number.isFinite(price)) {
    logger.warn('Invalid price value', { 
      price, 
      ticker: expectedTicker,
      hasPrice: !!validated.data.price,
      hasLast: !!validated.data.last,
    });
    return {
      price_data: null,
      status: 'invalid_data',
    };
  }
  
  // Extraire changePercentage depuis le quoteData original (peut être dans un array)
  let changePercent = validated.data.changePercent || validated.data.change_percent || null;
  
  // Si changePercent est null, essayer de l'extraire depuis quoteData original
  if (changePercent === null && quoteData) {
    // FMP peut retourner changePercentage dans un array
    if (Array.isArray(quoteData) && quoteData.length > 0) {
      changePercent = quoteData[0].changePercentage || quoteData[0].change_percent || null;
    } else if (quoteData.changePercentage !== undefined) {
      changePercent = quoteData.changePercentage;
    } else if (quoteData.change_percent !== undefined) {
      changePercent = quoteData.change_percent;
    }
  }
  
  // Calculer changePercent depuis change et price si nécessaire
  if (changePercent === null && validated.data.change !== null && validated.data.change !== undefined && price) {
    changePercent = (validated.data.change / price) * 100;
  }
  
  return {
    price_data: {
      current_price: price,
      price_change_pct: changePercent,
      volume: validated.data.volume || null,
    },
    status: 'ok',
  };
}
