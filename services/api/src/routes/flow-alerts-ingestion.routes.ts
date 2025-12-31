/**
 * Routes d'ingestion pour les flow alerts
 * Couche A : Collecte rapide, idempotente
 * 
 * Objectif: ingérer les flow alerts depuis l'API Unusual Whales option-trades/flow-alerts
 * et les stocker dans la table flow_alerts pour une lecture rapide lors de l'analyse
 * 
 * Cette route réutilise la même logique que GET /unusual-whales/option-trades/flow-alerts
 * et ajoute simplement l'injection dans la table flow_alerts
 */

import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { logger } from '../utils/logger';
import { supabase } from '../supabase';
import * as uw from '../unusual-whales';
import type { FlowAlert } from '../types/unusual-whales/option-trade';
import type { OptionTradeFlowAlertsQueryParams } from '../types/unusual-whales/option-trade';

function getQueryParam(event: APIGatewayProxyEventV2, key: string): string | undefined {
  return event.queryStringParameters?.[key];
}

/**
 * Parse les query parameters de la même manière que la route GET /unusual-whales/option-trades/flow-alerts
 */
function parseFlowAlertsParams(event: APIGatewayProxyEventV2): OptionTradeFlowAlertsQueryParams {
  const params: OptionTradeFlowAlertsQueryParams = {};
  
  if (event.queryStringParameters) {
    // Parse limit
    if (event.queryStringParameters.limit) {
      const limit = parseInt(event.queryStringParameters.limit, 10);
      if (!isNaN(limit) && limit >= 1 && limit <= 200) {
        params.limit = limit;
      }
    }
    // Parse ticker_symbol (depuis 'ticker' dans notre route)
    if (event.queryStringParameters.ticker) {
      params.ticker_symbol = event.queryStringParameters.ticker.toUpperCase();
    }
    // Parse min_premium
    if (event.queryStringParameters.min_premium) {
      const minPremium = parseFloat(event.queryStringParameters.min_premium);
      if (!isNaN(minPremium)) {
        params.min_premium = minPremium;
      }
    }
    // Parse max_premium
    if (event.queryStringParameters.max_premium) {
      const maxPremium = parseFloat(event.queryStringParameters.max_premium);
      if (!isNaN(maxPremium)) {
        params.max_premium = maxPremium;
      }
    }
    // Parse boolean flags
    if (event.queryStringParameters.is_call !== undefined) {
      params.is_call = event.queryStringParameters.is_call === 'true';
    }
    if (event.queryStringParameters.is_put !== undefined) {
      params.is_put = event.queryStringParameters.is_put === 'true';
    }
    if (event.queryStringParameters.is_sweep !== undefined) {
      params.is_sweep = event.queryStringParameters.is_sweep === 'true';
    }
    if (event.queryStringParameters.is_floor !== undefined) {
      params.is_floor = event.queryStringParameters.is_floor === 'true';
    }
    if (event.queryStringParameters.is_otm !== undefined) {
      params.is_otm = event.queryStringParameters.is_otm === 'true';
    }
    if (event.queryStringParameters.all_opening !== undefined) {
      params.all_opening = event.queryStringParameters.all_opening === 'true';
    }
    // Parse date filters
    if (event.queryStringParameters.newer_than) {
      params.newer_than = event.queryStringParameters.newer_than;
    }
    if (event.queryStringParameters.older_than) {
      params.older_than = event.queryStringParameters.older_than;
    }
  }
  
  return params;
}

export const flowAlertsIngestionRoutes = [
  /**
   * POST /ingest/flow-alerts
   * Ingérer les flow alerts depuis l'API Unusual Whales et les stocker dans flow_alerts
   * 
   * Cette route réutilise exactement la même logique que GET /unusual-whales/option-trades/flow-alerts
   * et ajoute simplement l'injection dans la table flow_alerts
   * 
   * Query params: Identiques à GET /unusual-whales/option-trades/flow-alerts
   * - ticker (requis): Symbole du ticker (mappé vers ticker_symbol pour l'API UW)
   * - limit (optionnel): Nombre maximum de flow alerts (1-200, défaut: 50)
   * - min_premium (optionnel): Prime minimum en USD
   * - max_premium (optionnel): Prime maximum en USD
   * - is_call (optionnel): Inclure les calls (true/false)
   * - is_put (optionnel): Inclure les puts (true/false)
   * - is_sweep (optionnel): Inclure les sweeps (true/false)
   * - is_floor (optionnel): Inclure les floor trades (true/false)
   * - is_otm (optionnel): Inclure uniquement OTM (true/false)
   * - all_opening (optionnel): Toutes les transactions sont d'ouverture (true/false)
   * - newer_than (optionnel): Date/heure minimum (Unix timestamp ou ISO date)
   * - older_than (optionnel): Date/heure maximum (Unix timestamp ou ISO date)
   */
  {
    method: 'POST',
    path: '/ingest/flow-alerts',
    handler: async (event: APIGatewayProxyEventV2) => {
      const ticker = getQueryParam(event, 'ticker');
      if (!ticker) {
        throw new Error('Missing required parameter: ticker');
      }

      const upperTicker = ticker.toUpperCase();
      const log = logger.child({ operation: 'ingestFlowAlerts', ticker: upperTicker });

      log.info('Starting flow alerts ingestion');

      // 1. Parser les paramètres de la même manière que la route GET originale
      const params = parseFlowAlertsParams(event);
      
      // S'assurer que ticker_symbol est défini (depuis le paramètre 'ticker')
      params.ticker_symbol = upperTicker;
      
      // Valeurs par défaut si non spécifiées
      if (!params.limit) {
        params.limit = 50;
      }

      log.info('Calling UW API with params', { params });

      // 2. Appeler l'API Unusual Whales (même fonction que la route GET)
      const flowAlertsResponse = await uw.getUWOptionTradeFlowAlerts(params);

      if (!flowAlertsResponse.success) {
        throw new Error(`Failed to fetch flow alerts: ${flowAlertsResponse.error || 'Unknown error'}`);
      }

      // Vérifier que data existe et est un tableau
      if (!flowAlertsResponse.data) {
        log.warn('No data in flow alerts response', { response: flowAlertsResponse });
        return {
          success: true,
          ticker: upperTicker,
          module: 'flow_alerts',
          count: 0,
          message: 'No flow alerts data returned from API',
          timestamp: new Date().toISOString(),
        };
      }

      // Le service devrait maintenant toujours retourner un tableau dans data
      if (!Array.isArray(flowAlertsResponse.data)) {
        log.error('Flow alerts data is not an array', {
          dataType: typeof flowAlertsResponse.data,
          isArray: Array.isArray(flowAlertsResponse.data),
          data: flowAlertsResponse.data,
        });
        throw new Error(
          `Invalid response format: expected array, got ${typeof flowAlertsResponse.data}. Response: ${JSON.stringify(flowAlertsResponse.data).substring(0, 200)}`
        );
      }

      const flowAlerts: FlowAlert[] = flowAlertsResponse.data;
      log.info('Fetched flow alerts from API', { count: flowAlerts.length });

      if (flowAlerts.length === 0) {
        return {
          success: true,
          ticker: upperTicker,
          module: 'flow_alerts',
          count: 0,
          message: 'No flow alerts found for this ticker with the specified filters',
          timestamp: new Date().toISOString(),
        };
      }

      // 2. Transformer les flow alerts en format pour la DB
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes TTL
      const dataDate = now.toISOString().split('T')[0];

      const records = flowAlerts.map((alert: FlowAlert) => {
        // Parser les valeurs numériques
        const parseNumber = (value: any): number | null => {
          if (value === null || value === undefined) return null;
          if (typeof value === 'number') return value;
          const parsed = parseFloat(String(value));
          return isNaN(parsed) ? null : parsed;
        };

        const parseInteger = (value: any): number | null => {
          if (value === null || value === undefined) return null;
          if (typeof value === 'number') return Math.round(value);
          const parsed = parseInt(String(value), 10);
          return isNaN(parsed) ? null : parsed;
        };

        // Parser la date d'expiration
        let expiryDate: Date | null = null;
        try {
          expiryDate = new Date(alert.expiry);
        } catch (e) {
          log.warn('Invalid expiry date', { expiry: alert.expiry, alert });
        }

        // Parser created_at (requis pour la contrainte unique)
        let createdAt: Date = now; // Fallback sur maintenant si absent
        try {
          if (alert.created_at) {
            const parsedDate = new Date(alert.created_at);
            if (!isNaN(parsedDate.getTime())) {
              createdAt = parsedDate;
            }
          }
        } catch (e) {
          log.warn('Invalid created_at, using current time', { created_at: alert.created_at, alert });
        }

        // Extraire l'ID unique de l'API UW depuis les données brutes
        // L'ID UW est l'identifiant unique de chaque flow alert (UUID)
        const uwId = alert.id || null;

        return {
          ticker: upperTicker,
          uw_id: uwId, // ID unique de l'API UW pour éviter les doublons
          alert_rule: alert.alert_rule || null,
          type: alert.type,
          strike: String(alert.strike),
          expiry: expiryDate ? expiryDate.toISOString().split('T')[0] : alert.expiry,
          option_chain: alert.option_chain || null,
          total_premium: parseNumber(alert.total_premium),
          total_size: parseInteger(alert.total_size),
          trade_count: parseInteger(alert.trade_count),
          volume: parseInteger(alert.volume),
          open_interest: parseInteger(alert.open_interest),
          volume_oi_ratio: parseNumber(alert.volume_oi_ratio),
          underlying_price: parseNumber(alert.underlying_price),
          total_ask_side_prem: parseNumber(alert.total_ask_side_prem),
          total_bid_side_prem: parseNumber(alert.total_bid_side_prem),
          price: parseNumber(alert.price),
          all_opening_trades: alert.all_opening_trades || false,
          has_floor: alert.has_floor || false,
          has_sweep: alert.has_sweep || false,
          has_multileg: alert.has_multileg || false,
          has_singleleg: alert.has_singleleg !== false, // Default true
          expiry_count: alert.expiry_count || 1,
          issue_type: alert.issue_type || null,
          created_at: createdAt.toISOString(),
          data: alert, // Données brutes complètes
          data_date: dataDate,
          expires_at: expiresAt.toISOString(),
        };
      });

      // 3. Dédupliquer les records avant l'upsert
      // La contrainte unique est (ticker, option_chain, created_at)
      // option_chain identifie déjà le contrat de manière unique
      const uniqueRecords = new Map<string, typeof records[0]>();
      for (const record of records) {
        // Vérifier que option_chain est présent (requis pour la contrainte unique)
        if (!record.option_chain) {
          log.warn('Flow alert missing option_chain, skipping', { record });
          continue;
        }
        
        const key = `${record.ticker}|${record.option_chain}|${record.created_at}`;
        if (!uniqueRecords.has(key)) {
          uniqueRecords.set(key, record);
        } else {
          log.debug('Duplicate flow alert skipped', { key, uw_id: record.uw_id, option_chain: record.option_chain });
        }
      }
      const deduplicatedRecords = Array.from(uniqueRecords.values());
      log.info('Deduplicated flow alerts', { 
        original: records.length, 
        deduplicated: deduplicatedRecords.length,
        with_uw_id: deduplicatedRecords.filter(r => r.uw_id).length
      });

      if (deduplicatedRecords.length === 0) {
        return {
          success: true,
          ticker: upperTicker,
          module: 'flow_alerts',
          count: 0,
          message: 'No valid flow alerts to store (missing option_chain)',
          timestamp: new Date().toISOString(),
        };
      }

      // 4. Upsert dans flow_alerts
      // Contrainte unique : (ticker, option_chain, created_at)
      const { error: upsertError } = await supabase
        .from('flow_alerts')
        .upsert(deduplicatedRecords, {
          onConflict: 'ticker,option_chain,created_at',
          ignoreDuplicates: false,
        })
        .select();

      if (upsertError) {
        log.error('Failed to upsert flow alerts', { error: upsertError });
        throw new Error(`Failed to store flow alerts: ${upsertError.message}`);
      }

      log.info('Stored flow alerts in database', { count: deduplicatedRecords.length });

      // 5. Mettre à jour ticker_data_modules
      const { error: moduleError } = await supabase
        .from('ticker_data_modules')
        .upsert(
          {
            ticker: upperTicker,
            module_id: 'flow_alerts',
            status: 'ready',
            fetched_at: now.toISOString(),
            data_date: dataDate,
            expires_at: expiresAt.toISOString(),
            metadata: {
              count: deduplicatedRecords.length,
              call_count: deduplicatedRecords.filter((r) => r.type === 'call').length,
              put_count: deduplicatedRecords.filter((r) => r.type === 'put').length,
              ingested_at: now.toISOString(),
            },
          },
          { onConflict: 'ticker,module_id' }
        );

      if (moduleError) {
        log.warn('Failed to update ticker_data_modules', { error: moduleError });
        // Non-fatal, continue
      }

      return {
        success: true,
        ticker: upperTicker,
        module: 'flow_alerts',
        count: records.length,
        state: {
          ticker: upperTicker,
          module_id: 'flow_alerts',
          status: 'ready',
          fetched_at: now.toISOString(),
          data_date: dataDate,
          expires_at: expiresAt.toISOString(),
          metadata: {
            count: deduplicatedRecords.length,
            call_count: deduplicatedRecords.filter((r) => r.type === 'call').length,
            put_count: deduplicatedRecords.filter((r) => r.type === 'put').length,
          },
        },
        timestamp: now.toISOString(),
      };
    },
  },
];

