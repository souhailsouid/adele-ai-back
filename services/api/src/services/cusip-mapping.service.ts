/**
 * Service de mapping CUSIP → Ticker
 * 
 * Utilise OpenFIGI API pour convertir les CUSIP en Tickers
 * Avec cache local sur S3/Athena pour éviter les appels API répétés
 * 
 * Architecture Extreme Budget: S3 + Athena (pas de Supabase)
 */

import { executeAthenaQuery } from '../athena/query';
import { findRowByColumnInS3Parquet } from '../athena/s3-direct-read';
import { insertRowS3 } from '../athena/write';

const OPENFIGI_API_URL = 'https://api.openfigi.com/v3/mapping';
const USER_AGENT = 'ADEL AI (contact@adel.ai)';

export interface CusipMapping {
  cusip: string;
  ticker: string;
  company_name?: string;
  isin?: string;
}

/**
 * Mapper un CUSIP vers un Ticker
 * 
 * 1. Cherche dans les holdings existants (fund_holdings) - source la plus fiable
 * 2. Vérifie le cache local (cusip_ticker_mapping)
 * 3. Si non trouvé, appelle OpenFIGI API
 * 4. Met en cache le résultat sur S3
 */
export async function mapCusipToTicker(cusip: string): Promise<string | null> {
  if (!cusip || cusip.length < 8) {
    return null;
  }

  // Normaliser le CUSIP (enlever espaces, mettre en majuscules)
  const normalizedCusip = cusip.trim().toUpperCase();

  // 1. Chercher dans les holdings existants (source la plus fiable, extraite des 13F)
  try {
    const { executeAthenaQuery } = await import('../athena/query');
    const holdingsQuery = `
      SELECT DISTINCT ticker
      FROM fund_holdings
      WHERE cusip = '${normalizedCusip.replace(/'/g, "''")}'
        AND ticker IS NOT NULL
        AND ticker != ''
      LIMIT 1
    `;
    
    const holdingsResult = await executeAthenaQuery(holdingsQuery);
    if (holdingsResult && holdingsResult.length > 0) {
      const ticker = holdingsResult[0].ticker || holdingsResult[0][0];
      if (ticker) {
        console.log(`[CUSIP Holdings] ${normalizedCusip} → ${ticker} (from existing holdings)`);
        
        // Mettre en cache pour les prochaines fois
        try {
          await insertRowS3('cusip_ticker_mapping', {
            cusip: normalizedCusip,
            ticker: ticker,
            source: 'holdings',
            last_verified_at: new Date().toISOString(),
          });
        } catch (cacheError: any) {
          // Ignorer les erreurs de cache (peut-être déjà existant)
          console.warn(`[CUSIP Cache] Could not cache mapping: ${cacheError.message}`);
        }
        
        return ticker;
      }
    }
  } catch (error: any) {
    console.warn(`[CUSIP Holdings] Error checking holdings: ${error.message}`);
  }

  // 2. Vérifier le cache local (S3 direct read pour lookup rapide)
  try {
    const cached = await findRowByColumnInS3Parquet<{ ticker: string; company_name?: string }>(
      'cusip_ticker_mapping',
      'cusip',
      normalizedCusip
    );

    if (cached && cached.ticker) {
      console.log(`[CUSIP Cache Hit] ${normalizedCusip} → ${cached.ticker}`);
      return cached.ticker;
    }
  } catch (error: any) {
    console.warn(`[CUSIP Cache] Error reading cache: ${error.message}`);
  }

  // 3. Appeler OpenFIGI API
  try {
    const mapping = await fetchOpenFigiMapping(normalizedCusip);
    
    if (mapping && mapping.ticker) {
      // 4. Mettre en cache sur S3
      await insertRowS3('cusip_ticker_mapping', {
        cusip: normalizedCusip,
        ticker: mapping.ticker,
        company_name: mapping.company_name,
        isin: mapping.isin,
        source: 'openfigi',
        last_verified_at: new Date().toISOString(),
      });

      console.log(`[CUSIP API] ${normalizedCusip} → ${mapping.ticker}`);
      return mapping.ticker;
    }
  } catch (error: any) {
    console.error(`[CUSIP Error] Failed to map ${normalizedCusip}:`, error.message);
  }

  return null;
}

/**
 * Mapper plusieurs CUSIPs en batch (plus efficace)
 */
export async function mapCusipsToTickers(cusips: string[]): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  const normalizedCusips = cusips.map(c => c.trim().toUpperCase()).filter(c => c.length >= 8);

  if (normalizedCusips.length === 0) {
    return mapping;
  }

  // 1. Chercher dans les holdings existants (source la plus fiable)
  try {
    const cusipList = normalizedCusips.map(c => `'${c.replace(/'/g, "''")}'`).join(', ');
    const holdingsQuery = `
      SELECT DISTINCT cusip, ticker
      FROM fund_holdings
      WHERE cusip IN (${cusipList})
        AND ticker IS NOT NULL
        AND ticker != ''
    `;
    
    const holdingsResult = await executeAthenaQuery(holdingsQuery);
    const holdingsMap = new Map<string, string>();
    
    if (holdingsResult && holdingsResult.length > 0) {
      for (const row of holdingsResult) {
        const cusip = row.cusip || row[0];
        const ticker = row.ticker || row[1];
        if (cusip && ticker) {
          holdingsMap.set(cusip, ticker);
          mapping.set(cusip, ticker);
        }
      }
    }

    // Mettre en cache les mappings trouvés dans les holdings
    if (holdingsMap.size > 0) {
      const { insertRowsS3 } = await import('../athena/write');
      const toCache = Array.from(holdingsMap.entries()).map(([cusip, ticker]) => ({
        cusip,
        ticker,
        source: 'holdings',
        last_verified_at: new Date().toISOString(),
      }));
      try {
        await insertRowsS3('cusip_ticker_mapping', toCache);
      } catch (cacheError: any) {
        console.warn(`[CUSIP Batch] Could not cache holdings mappings: ${cacheError.message}`);
      }
    }

    // Identifier les CUSIPs non trouvés dans les holdings
    const uncachedCusips: string[] = [];
    for (const cusip of normalizedCusips) {
      if (!holdingsMap.has(cusip)) {
        uncachedCusips.push(cusip);
      }
    }

    // 2. Vérifier le cache local pour les CUSIPs restants (via Athena)
    const cachedMap = new Map<string, string>();
    if (uncachedCusips.length > 0) {
      const cusipListCache = uncachedCusips.map(c => `'${c.replace(/'/g, "''")}'`).join(', ');
      const cacheQuery = `
        SELECT cusip, ticker
        FROM cusip_ticker_mapping
        WHERE cusip IN (${cusipListCache})
      `;
      
      try {
        const cached = await executeAthenaQuery(cacheQuery);
        
        if (cached && cached.length > 0) {
          for (const row of cached) {
            const cusip = row.cusip || row[0];
            const ticker = row.ticker || row[1];
            if (cusip && ticker) {
              cachedMap.set(cusip, ticker);
              mapping.set(cusip, ticker);
            }
          }
        }
      } catch (error: any) {
        console.warn(`[CUSIP Batch] Error reading cache: ${error.message}`);
      }
    }

    // Identifier les CUSIPs vraiment non en cache
    const finalUncachedCusips: string[] = [];
    for (const cusip of uncachedCusips) {
      if (!cachedMap.has(cusip)) {
        finalUncachedCusips.push(cusip);
      }
    }

    // 3. Appeler OpenFIGI API pour les CUSIPs vraiment non en cache (batch)
    if (finalUncachedCusips.length > 0) {
      try {
        const apiMappings = await fetchOpenFigiMappingsBatch(finalUncachedCusips);
        
        // 3. Mettre en cache les nouveaux mappings sur S3
        const { insertRowsS3 } = await import('../athena/write');
        const toInsert = apiMappings
          .filter(m => m.ticker)
          .map(m => ({
            cusip: m.cusip,
            ticker: m.ticker!,
            company_name: m.company_name,
            isin: m.isin,
            source: 'openfigi',
            last_verified_at: new Date().toISOString(),
          }));

        if (toInsert.length > 0) {
          await insertRowsS3('cusip_ticker_mapping', toInsert);

          for (const m of apiMappings) {
            if (m.ticker) {
              mapping.set(m.cusip, m.ticker);
            }
          }
        }
      } catch (error: any) {
        console.error(`[CUSIP Batch Error]:`, error.message);
      }
    }
  } catch (error: any) {
    console.warn(`[CUSIP Batch] Error reading cache, falling back to API: ${error.message}`);
    // Fallback: appeler l'API pour tous les CUSIPs
    const apiMappings = await fetchOpenFigiMappingsBatch(normalizedCusips);
    for (const m of apiMappings) {
      if (m.ticker) {
        mapping.set(m.cusip, m.ticker);
      }
    }
  }

  return mapping;
}

/**
 * Appeler OpenFIGI API pour un seul CUSIP
 */
async function fetchOpenFigiMapping(cusip: string): Promise<CusipMapping | null> {
  const response = await fetch(OPENFIGI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify([
      {
        idType: 'ID_CUSIP',
        idValue: cusip,
      },
    ]),
  });

  if (!response.ok) {
    throw new Error(`OpenFIGI API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (Array.isArray(data) && data.length > 0 && data[0].data && data[0].data.length > 0) {
    const result = data[0].data[0];
    return {
      cusip,
      ticker: result.ticker || null,
      company_name: result.name,
      isin: result.exchCode ? `${result.exchCode}-${result.ticker}` : undefined,
    };
  }

  return null;
}

/**
 * Appeler OpenFIGI API pour plusieurs CUSIPs (batch)
 * OpenFIGI accepte jusqu'à 100 requêtes par batch
 */
async function fetchOpenFigiMappingsBatch(cusips: string[]): Promise<CusipMapping[]> {
  const BATCH_SIZE = 100;
  const results: CusipMapping[] = [];

  // Traiter par batch de 100
  for (let i = 0; i < cusips.length; i += BATCH_SIZE) {
    const batch = cusips.slice(i, i + BATCH_SIZE);
    
    const requests = batch.map(cusip => ({
      idType: 'ID_CUSIP',
      idValue: cusip,
    }));

    try {
      const response = await fetch(OPENFIGI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify(requests),
      });

      if (!response.ok) {
        console.error(`OpenFIGI batch error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      if (Array.isArray(data)) {
        for (let j = 0; j < data.length && j < batch.length; j++) {
          const item = data[j];
          if (item.data && item.data.length > 0) {
            const result = item.data[0];
            results.push({
              cusip: batch[j],
              ticker: result.ticker || null,
              company_name: result.name,
              isin: result.exchCode ? `${result.exchCode}-${result.ticker}` : undefined,
            });
          }
        }
      }

      // Rate limiting: attendre 200ms entre chaque batch
      if (i + BATCH_SIZE < cusips.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error: any) {
      console.error(`[CUSIP Batch] Error for batch starting at ${i}:`, error.message);
    }
  }

  return results;
}

/**
 * Mapper un CUSIP avec fallback sur SEC EDGAR si OpenFIGI échoue
 * 
 * Note: Cette fonction peut être utilisée comme fallback si OpenFIGI
 * ne retourne pas de résultat. Elle nécessite de parser les données SEC.
 */
export async function mapCusipToTickerWithFallback(cusip: string): Promise<string | null> {
  // Essayer OpenFIGI d'abord
  const ticker = await mapCusipToTicker(cusip);
  if (ticker) {
    return ticker;
  }

  // TODO: Implémenter fallback SEC EDGAR si nécessaire
  // Cela nécessiterait de chercher dans les filings 13F pour trouver
  // le ticker associé au CUSIP
  
  return null;
}
