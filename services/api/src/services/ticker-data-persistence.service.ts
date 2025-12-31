/**
 * Service de persistance des données ticker dans Supabase
 * Vérifie la fraîcheur des données et les met à jour si nécessaire
 */

import { supabase } from '../supabase';
import { logger } from '../utils/logger';

export interface TickerDataOptions {
  ticker: string;
  maxAgeHours?: number; // Âge maximum des données avant refresh (défaut: 1h pour options flow, 24h pour dark pool/short interest)
}

export interface OptionsFlowData {
  ticker: string;
  date?: string; // Date de trading (ISO format: YYYY-MM-DD)
  expiry?: string;
  call_volume?: number;
  put_volume?: number;
  call_premium?: number | string;
  put_premium?: number | string;
  data: any; // Données brutes complètes
}

export interface DarkPoolData {
  ticker: string;
  date?: string; // Date du trade
  executed_at?: string; // Timestamp ISO
  volume?: number;
  size?: number;
  price?: number;
  institution?: string;
  market_center?: string;
  data: any; // Données brutes complètes
}

export interface ShortInterestData {
  ticker: string;
  short_interest?: number | null;
  float?: number | null;
  short_interest_ratio?: number | null;
  days_to_cover?: number | null;
  data_date?: string; // Date des données (ISO format: YYYY-MM-DD)
  data: any; // Données brutes complètes
}

export class TickerDataPersistenceService {
  /**
   * Récupérer ou créer les données d'options flow
   * Vérifie la fraîcheur basée sur la date des données
   */
  async getOrFetchOptionsFlow(
    ticker: string,
    fetchFn: () => Promise<any[]>,
    maxAgeHours: number = 1 // Options flow change rapidement, 1h max
  ): Promise<{ data: any[]; fromCache: boolean; dataDate?: string }> {
    const upperTicker = ticker.toUpperCase();
    
    try {
      // 0. Nettoyer les marqueurs vides expirés (> 15 min) pour forcer un refetch
      const fifteenMinutesAgo = new Date();
      fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
      await supabase
        .from('options_flow')
        .delete()
        .eq('ticker', upperTicker)
        .eq('is_empty_marker', true)
        .lt('cached_at', fifteenMinutesAgo.toISOString());

      // 1. Vérifier si des données fraîches existent
      const { data: cached, error } = await supabase
        .from('options_flow')
        .select('*')
        .eq('ticker', upperTicker)
        .gt('expires_at', new Date().toISOString())
        .order('data_date', { ascending: false, nullsLast: true })
        .order('cached_at', { ascending: false })
        .limit(100); // Limiter pour performance

      if (error) {
        logger.warn('Error checking options_flow cache', { ticker, error });
      }

      // 2. Vérifier la fraîcheur basée sur data_date ou cached_at
      if (cached && cached.length > 0) {
        const latest = cached[0];
        const dataDate = latest.data_date ? new Date(latest.data_date) : null;
        const cachedAt = new Date(latest.cached_at);
        const now = new Date();
        
        // Utiliser data_date si disponible, sinon cached_at
        const referenceDate = dataDate || cachedAt;
        const ageHours = (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60);
        
        // Vérifier si c'est un marqueur vide
        const isEmptyMarker = latest.is_empty_marker === true || latest.data?.empty === true || (latest.call_volume === 0 && latest.put_volume === 0 && latest.volume === 0);
        
        // Pour les marqueurs vides, utiliser un TTL beaucoup plus court (15 min pour options flow)
        // car les options flow changent très rapidement et les marqueurs vides peuvent être obsolètes
        const emptyMarkerMaxAge = 0.25; // 15 minutes pour les marqueurs vides d'options flow
        const effectiveMaxAge = isEmptyMarker ? emptyMarkerMaxAge : maxAgeHours;
        
        if (ageHours < effectiveMaxAge) {
          if (isEmptyMarker) {
            logger.info('Using cached empty options_flow marker', {
              ticker,
              ageHours: ageHours.toFixed(2),
              maxAgeHours: effectiveMaxAge,
            });
            return { data: [], fromCache: true, dataDate: latest.data_date || latest.cached_at };
          }
          
          logger.info('Using cached options_flow data', {
            ticker,
            count: cached.length,
            dataDate: latest.data_date,
            ageHours: ageHours.toFixed(2),
          });
          
          // Extraire les données depuis le JSONB ou les colonnes
          const flowData = cached
            .filter((item) => !item.data?.empty) // Exclure les marqueurs vides
            .map((item) => ({
              ...item.data,
              ticker: item.ticker,
              date: item.date || item.data_date,
              expiry: item.expiry,
              call_volume: item.call_volume || item.data?.call_volume,
              put_volume: item.put_volume || item.data?.put_volume,
              call_premium: item.call_premium || item.data?.call_premium,
              put_premium: item.put_premium || item.data?.put_premium,
            }));
          
          return {
            data: flowData,
            fromCache: true,
            dataDate: latest.data_date || latest.cached_at,
          };
        }
      }

      // 3. Données obsolètes ou inexistantes : fetch depuis l'API
      logger.info('Fetching fresh options_flow data', { ticker });
      const freshData = await fetchFn();
      
      // Stocker même si vide pour éviter de refetch inutilement (avec un TTL plus court)
      if (!freshData || freshData.length === 0) {
        logger.warn('No options_flow data returned from API, storing empty marker', { ticker });
        
        // Stocker un marqueur "vide" avec un TTL très court (15 min pour options flow)
        // car les options flow changent très rapidement
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 15); // TTL: 15 min pour les données vides d'options flow
        
        const emptyMarker = {
          ticker: upperTicker,
          date: null,
          data_date: null,
          expiry: null,
          call_volume: 0,
          put_volume: 0,
          call_premium: null,
          put_premium: null,
          type: null,
          strike: null,
          total_premium: null,
          premium: null,
          volume: 0,
          open_interest: null,
          created_at: null,
          data: { empty: true, fetched_at: new Date().toISOString() }, // Marqueur vide
          cached_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          is_empty_marker: true, // Marqueur de données vides
        };
        
        // Pour les marqueurs vides, on utilise ticker comme clé unique
        // On supprime d'abord les anciens marqueurs vides pour ce ticker
        await supabase
          .from('options_flow')
          .delete()
          .eq('ticker', upperTicker)
          .eq('is_empty_marker', true);
        
        const { error: insertError } = await supabase
          .from('options_flow')
          .insert(emptyMarker);
        
        if (insertError) {
          logger.error('Error storing empty options_flow marker', { ticker, error: insertError });
        }
        
        return { data: [], fromCache: false };
      }

      // 4. Stocker les nouvelles données
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // TTL: 24h

      const recordsToInsert = freshData.map((item: any) => {
        // S'assurer que le ticker dans les données correspond au ticker demandé
        const itemTicker = (item.ticker || '').toUpperCase();
        const finalTicker = itemTicker === upperTicker ? upperTicker : upperTicker; // Toujours utiliser le ticker demandé
        
        // Extraire la date correctement
        // FlowPerExpiry a un champ 'date' (date de trading), pas 'data_date'
        const itemDate = item.date || item.data_date || null;
        const dataDateStr = itemDate ? new Date(itemDate).toISOString().split('T')[0] : null;
        
        // FlowPerExpiry est agrégé par expiry, donc :
        // - Pas de 'type' individuel (CALL/PUT), mais call_volume/put_volume séparés
        // - Pas de 'strike' individuel, mais agrégé par expiry
        // - 'volume' total = call_volume + put_volume
        const callVolume = typeof item.call_volume === 'number' ? item.call_volume : null;
        const putVolume = typeof item.put_volume === 'number' ? item.put_volume : null;
        const totalVolume = callVolume && putVolume ? callVolume + putVolume : (item.volume || null);
        
        // Premiums peuvent être des strings dans FlowPerExpiry
        const callPremium = item.call_premium ? (typeof item.call_premium === 'string' ? parseFloat(item.call_premium) : item.call_premium) : null;
        const putPremium = item.put_premium ? (typeof item.put_premium === 'string' ? parseFloat(item.put_premium) : item.put_premium) : null;
        const totalPremium = callPremium && putPremium ? callPremium + putPremium : (item.total_premium || item.premium || null);
        
        return {
          ticker: finalTicker, // Toujours utiliser le ticker demandé, pas celui des données
          date: itemDate ? new Date(itemDate).toISOString().split('T')[0] : null,
          data_date: dataDateStr, // Utiliser la même date pour data_date
          expiry: item.expiry || null,
          call_volume: callVolume,
          put_volume: putVolume,
          call_premium: callPremium,
          put_premium: putPremium,
          type: item.type || null, // Peut être null pour FlowPerExpiry (agrégé)
          strike: item.strike ? parseFloat(String(item.strike)) : null, // Peut être null pour FlowPerExpiry (agrégé)
          total_premium: totalPremium,
          premium: item.premium || null,
          volume: totalVolume,
          open_interest: item.open_interest || null,
          created_at: item.created_at || null,
          data: { ...item, ticker: finalTicker }, // S'assurer que le ticker dans data est correct
          cached_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          is_empty_marker: false,
        };
      });
      
      logger.info('Preparing to store options_flow data', {
        ticker: upperTicker,
        count: recordsToInsert.length,
        sampleDataDate: recordsToInsert[0]?.data_date,
        sampleTicker: recordsToInsert[0]?.ticker,
      });

      // Supprimer les anciens marqueurs vides avant d'insérer les nouvelles données
      await supabase
        .from('options_flow')
        .delete()
        .eq('ticker', upperTicker)
        .eq('is_empty_marker', true);

      // Supprimer les anciennes données expirées pour ce ticker pour éviter l'accumulation
      // et garantir que les nouvelles données sont visibles
      const { error: deleteError } = await supabase
        .from('options_flow')
        .delete()
        .eq('ticker', upperTicker)
        .lt('expires_at', new Date().toISOString());

      if (deleteError) {
        logger.warn('Error deleting expired options_flow data', { ticker, error: deleteError });
      }

      // Insérer les nouvelles données
      // Note: La table n'a pas de contrainte unique explicite, donc on utilise insert simple
      // On a supprimé les anciennes données expirées, donc pas de risque de doublons majeurs
      const { data: insertedData, error: insertError } = await supabase
        .from('options_flow')
        .insert(recordsToInsert)
        .select();

      if (insertError) {
        logger.error('Error storing options_flow data', { 
          ticker, 
          error: insertError,
          errorCode: insertError.code,
          errorMessage: insertError.message,
          sampleRecord: recordsToInsert[0]
        });
      } else {
        logger.info('Stored options_flow data', { 
          ticker, 
          count: recordsToInsert.length,
          insertedCount: insertedData?.length || 0,
          sampleDataDate: recordsToInsert[0]?.data_date,
          sampleExpiry: recordsToInsert[0]?.expiry,
          sampleStrike: recordsToInsert[0]?.strike,
          sampleType: recordsToInsert[0]?.type,
        });
      }

      return {
        data: freshData,
        fromCache: false,
        dataDate: freshData[0]?.date || new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('Error in getOrFetchOptionsFlow', { ticker, error });
      // En cas d'erreur, essayer de fetch directement
      try {
        const freshData = await fetchFn();
        return { data: freshData || [], fromCache: false };
      } catch (fetchError) {
        logger.error('Error fetching options_flow as fallback', { ticker, error: fetchError });
        return { data: [], fromCache: false };
      }
    }
  }

  /**
   * Récupérer ou créer les données de dark pool
   */
  async getOrFetchDarkPool(
    ticker: string,
    fetchFn: () => Promise<any[]>,
    maxAgeHours: number = 24 // Dark pool change moins fréquemment
  ): Promise<{ data: any[]; fromCache: boolean; dataDate?: string }> {
    const upperTicker = ticker.toUpperCase();
    
    try {
      // 1. Vérifier si des données fraîches existent
      const { data: cached, error } = await supabase
        .from('dark_pool_trades')
        .select('*')
        .eq('ticker', upperTicker)
        .gt('expires_at', new Date().toISOString())
        .order('data_date', { ascending: false, nullsLast: true })
        .order('executed_at', { ascending: false, nullsLast: true })
        .order('cached_at', { ascending: false })
        .limit(100);

      if (error) {
        logger.warn('Error checking dark_pool_trades cache', { ticker, error });
      }

      // 2. Vérifier la fraîcheur
      if (cached && cached.length > 0) {
        const latest = cached[0];
        const dataDate = latest.data_date ? new Date(latest.data_date) : null;
        const executedAt = latest.executed_at ? new Date(latest.executed_at) : null;
        const cachedAt = new Date(latest.cached_at);
        const now = new Date();
        
        // Utiliser data_date > executed_at > cached_at
        const referenceDate = dataDate || executedAt || cachedAt;
        const ageHours = (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60);
        
        // Vérifier si c'est un marqueur vide
        const isEmptyMarker = latest.is_empty_marker === true || latest.data?.empty === true || (latest.volume === 0 && latest.size === 0);
        
        // Pour les marqueurs vides, utiliser un TTL plus court (1h max) même si maxAgeHours est plus grand
        const effectiveMaxAge = isEmptyMarker ? Math.min(maxAgeHours, 1) : maxAgeHours;
        
        if (ageHours < effectiveMaxAge) {
          if (isEmptyMarker) {
            logger.info('Using cached empty dark_pool_trades marker', {
              ticker,
              ageHours: ageHours.toFixed(2),
              maxAgeHours: effectiveMaxAge,
            });
            return { data: [], fromCache: true, dataDate: latest.data_date || latest.executed_at || latest.cached_at };
          }
          
          logger.info('Using cached dark_pool_trades data', {
            ticker,
            count: cached.length,
            dataDate: latest.data_date,
            ageHours: ageHours.toFixed(2),
          });
          
          const tradesData = cached
            .filter((item) => !item.data?.empty) // Exclure les marqueurs vides
            .map((item) => ({
              ...item.data,
              ticker: item.ticker,
              date: item.date || item.data_date,
              executed_at: item.executed_at,
              volume: item.volume || item.size,
              size: item.size || item.volume,
              price: item.price ? parseFloat(String(item.price)) : null,
              institution: item.institution,
              market_center: item.market_center,
            }));
          
          return {
            data: tradesData,
            fromCache: true,
            dataDate: latest.data_date || latest.executed_at || latest.cached_at,
          };
        }
      }

      // 3. Fetch depuis l'API
      logger.info('Fetching fresh dark_pool_trades data', { ticker });
      const freshData = await fetchFn();
      
      // Stocker même si vide pour éviter de refetch inutilement
      if (!freshData || freshData.length === 0) {
        logger.warn('No dark_pool_trades data returned from API, storing empty marker', { ticker });
        
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // TTL: 1h pour les données vides
        
        const emptyMarker = {
          ticker: upperTicker,
          date: new Date().toISOString().split('T')[0],
          data_date: new Date().toISOString().split('T')[0],
          executed_at: null,
          volume: 0,
          size: 0,
          price: null,
          value: null,
          institution: null,
          market_center: null,
          data: { empty: true, fetched_at: new Date().toISOString() },
          cached_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          is_empty_marker: true, // Marqueur de données vides
        };
        
        // Pour les marqueurs vides, on supprime d'abord les anciens marqueurs
        await supabase
          .from('dark_pool_trades')
          .delete()
          .eq('ticker', upperTicker)
          .eq('is_empty_marker', true);
        
        const { error: insertError } = await supabase
          .from('dark_pool_trades')
          .insert(emptyMarker);
        
        if (insertError) {
          logger.error('Error storing empty dark_pool_trades marker', { ticker, error: insertError });
        }
        
        return { data: [], fromCache: false };
      }

      // 4. Stocker les nouvelles données
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const recordsToInsert = freshData.map((item: any) => {
        // S'assurer que le ticker dans les données correspond au ticker demandé
        const itemTicker = (item.ticker || '').toUpperCase();
        const finalTicker = itemTicker === upperTicker ? upperTicker : upperTicker; // Toujours utiliser le ticker demandé
        
        // Extraire la date depuis executed_at ou date
        const executedAt = item.executed_at || item.date;
        const tradeDate = executedAt 
          ? new Date(executedAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];
        
        return {
          ticker: finalTicker, // Toujours utiliser le ticker demandé
          date: tradeDate,
          data_date: tradeDate,
          executed_at: executedAt || null,
          volume: item.volume || item.size || null,
          size: item.size || item.volume || null,
          price: item.price ? parseFloat(String(item.price)) : null,
          value: item.value || (item.price && item.size ? parseFloat(String(item.premium)) : null),
          institution: item.institution || item.name || null,
          market_center: item.market_center || null,
          data: { ...item, ticker: finalTicker }, // S'assurer que le ticker dans data est correct
          cached_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          is_empty_marker: false,
        };
      });
      
      logger.info('Preparing to store dark_pool_trades data', {
        ticker: upperTicker,
        count: recordsToInsert.length,
        sampleDataDate: recordsToInsert[0]?.data_date,
        sampleTicker: recordsToInsert[0]?.ticker,
      });

      // Supprimer les anciens marqueurs vides avant d'insérer les nouvelles données
      await supabase
        .from('dark_pool_trades')
        .delete()
        .eq('ticker', upperTicker)
        .eq('is_empty_marker', true);

      // Insérer les nouvelles données
      const { error: insertError } = await supabase
        .from('dark_pool_trades')
        .insert(recordsToInsert);

      if (insertError) {
        logger.error('Error storing dark_pool_trades data', { ticker, error: insertError });
      } else {
        logger.info('Stored dark_pool_trades data', { ticker, count: recordsToInsert.length });
      }

      return {
        data: freshData,
        fromCache: false,
        dataDate: freshData[0]?.executed_at || freshData[0]?.date || new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('Error in getOrFetchDarkPool', { ticker, error });
      try {
        const freshData = await fetchFn();
        return { data: freshData || [], fromCache: false };
      } catch (fetchError) {
        logger.error('Error fetching dark_pool_trades as fallback', { ticker, error: fetchError });
        return { data: [], fromCache: false };
      }
    }
  }

  /**
   * Récupérer ou créer les données de short interest
   */
  async getOrFetchShortInterest(
    ticker: string,
    fetchFn: () => Promise<any>,
    maxAgeHours: number = 24 // Short interest change quotidiennement
  ): Promise<{ data: any; fromCache: boolean; dataDate?: string }> {
    const upperTicker = ticker.toUpperCase();
    
    try {
      // 1. Vérifier si des données fraîches existent
      const { data: cached, error } = await supabase
        .from('short_interest')
        .select('*')
        .eq('ticker', upperTicker)
        .gt('expires_at', new Date().toISOString())
        .order('data_date', { ascending: false, nullsLast: true })
        .order('cached_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        logger.warn('Error checking short_interest cache', { ticker, error });
      }

      // 2. Vérifier la fraîcheur
      if (cached) {
        const dataDate = cached.data_date ? new Date(cached.data_date) : null;
        const cachedAt = new Date(cached.cached_at);
        const now = new Date();
        
        const referenceDate = dataDate || cachedAt;
        const ageHours = (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60);
        
        // Vérifier si c'est un marqueur vide
        const isEmptyMarker = cached.is_empty_marker === true || cached.data?.empty === true || (cached.short_interest === null && cached.float === null);
        
        // Pour les marqueurs vides, utiliser un TTL plus court (1h max) même si maxAgeHours est plus grand
        const effectiveMaxAge = isEmptyMarker ? Math.min(maxAgeHours, 1) : maxAgeHours;
        
        if (ageHours < effectiveMaxAge) {
          if (isEmptyMarker) {
            logger.info('Using cached empty short_interest marker', {
              ticker,
              ageHours: ageHours.toFixed(2),
              maxAgeHours: effectiveMaxAge,
            });
            return { data: null, fromCache: true, dataDate: cached.data_date || cached.cached_at };
          }
          
          logger.info('Using cached short_interest data', {
            ticker,
            dataDate: cached.data_date,
            ageHours: ageHours.toFixed(2),
          });
          
          return {
            data: {
              ...cached.data,
              ticker: cached.ticker,
              short_interest: cached.short_interest,
              float: cached.float,
              short_interest_ratio: cached.short_interest_ratio,
              days_to_cover: cached.days_to_cover,
            },
            fromCache: true,
            dataDate: cached.data_date || cached.cached_at,
          };
        }
      }

      // 3. Fetch depuis l'API
      logger.info('Fetching fresh short_interest data', { ticker });
      const freshData = await fetchFn();
      
      // Stocker même si null pour éviter de refetch inutilement
      if (!freshData) {
        logger.warn('No short_interest data returned from API, storing empty marker', { ticker });
        
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // TTL: 1h pour les données vides
        
        const emptyMarker = {
          ticker: upperTicker,
          short_interest: null,
          float: null,
          short_interest_ratio: null,
          days_to_cover: null,
          data_date: new Date().toISOString().split('T')[0],
          data: { empty: true, fetched_at: new Date().toISOString() },
          cached_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          is_empty_marker: true, // Marqueur de données vides
        };
        
        // Pour les marqueurs vides, on utilise la contrainte unique ticker,data_date
        const { error: insertError } = await supabase
          .from('short_interest')
          .upsert(emptyMarker, {
            onConflict: 'ticker,data_date',
          });
        
        if (insertError) {
          logger.error('Error storing empty short_interest marker', { ticker, error: insertError });
        }
        
        return { data: null, fromCache: false };
      }

      // 4. Stocker les nouvelles données
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Extraire la date des données si disponible
      const dataDate = freshData.date || freshData.data_date || null;
      const dataDateStr = dataDate ? new Date(dataDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]; // Utiliser aujourd'hui si pas de date

      const recordToInsert = {
        ticker: upperTicker,
        short_interest: freshData.short_interest || null,
        float: freshData.float || null,
        short_interest_ratio: freshData.short_interest_ratio || freshData.ratio || null,
        days_to_cover: freshData.days_to_cover || null,
        data_date: dataDateStr,
        data: { ...freshData, ticker: upperTicker }, // S'assurer que le ticker dans data est correct
        cached_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        is_empty_marker: false,
      };
      
      logger.info('Preparing to store short_interest data', {
        ticker: upperTicker,
        dataDate: dataDateStr,
        hasShortInterest: !!recordToInsert.short_interest,
        hasFloat: !!recordToInsert.float,
      });

      const { error: insertError } = await supabase
        .from('short_interest')
        .upsert(recordToInsert, {
          onConflict: 'ticker,data_date',
        });

      if (insertError) {
        logger.error('Error storing short_interest data', { ticker, error: insertError });
      } else {
        logger.info('Stored short_interest data', { ticker, dataDate: dataDateStr });
      }

      return {
        data: freshData,
        fromCache: false,
        dataDate: dataDateStr || new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('Error in getOrFetchShortInterest', { ticker, error });
      try {
        const freshData = await fetchFn();
        return { data: freshData || null, fromCache: false };
      } catch (fetchError) {
        logger.error('Error fetching short_interest as fallback', { ticker, error: fetchError });
        return { data: null, fromCache: false };
      }
    }
  }
}

