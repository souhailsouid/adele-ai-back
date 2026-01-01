/**
 * Service de Convergence et Risque de Liquidation
 * 
 * Transforme les listes d'alertes (Flow) et de Dark Pools en indicateurs de prix uniques.
 * 
 * ⚠️ IMPORTANT : Ce service fait UNIQUEMENT des calculs mathématiques (moyennes pondérées).
 * Il n'utilise PAS d'IA/OpenAI - c'est du calcul pur basé sur les données Unusual Whales.
 * 
 * Calculs effectués :
 * 1. Support Dark Pool (Pondéré) : Prix moyen où les institutions ont accumulé
 *    Formule: Support = Σ(Prix × Volume) / Σ(Volume)
 * 2. Objectif d'Expiration (Moyenne des Strikes) : Prix de règlement attendu basé sur les options
 *    Formule: Target = Σ(Strike × Premium) / Σ(Premium)
 * 3. Score de Risque de Liquidation : Comparaison prix actuel vs support
 *    Basé sur la distance en pourcentage (LOW/MEDIUM/HIGH)
 * 
 * Sources de données : UNIQUEMENT Unusual Whales API (pas FMP)
 * - Dark Pool Trades : pour le support pondéré
 * - Options Flow Alerts : pour l'objectif d'expiration
 * - Stock State : pour le prix actuel
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as uw from '../unusual-whales';
import type {
  WhaleAnalysis,
  WhaleAnalysisRequest,
  WhaleAnalysisResponse,
} from '../types/convergence-risk';

export class ConvergenceRiskService {
  /**
   * Analyser la convergence et le risque de liquidation pour un ticker
   */
  async analyzeWhaleConvergence(
    request: WhaleAnalysisRequest
  ): Promise<WhaleAnalysisResponse> {
    return handleError(async () => {
      const log = logger.child({ operation: 'analyzeWhaleConvergence', ticker: request.ticker });
      const ticker = request.ticker.toUpperCase();

      log.info('Starting whale convergence analysis', { ticker });

      // 1. Récupérer le prix actuel
      const currentPrice = await this.getCurrentPrice(ticker);
      if (currentPrice === 0) {
        throw new Error(`Unable to fetch current price for ${ticker}`);
      }

      log.info('Current price fetched', { ticker, currentPrice });

      // 2. Calculer le Support Dark Pool (pondéré)
      const whaleSupport = await this.calculateWhaleSupport(
        ticker,
        request.darkPoolLimit || 100
      );

      // 3. Calculer l'Objectif d'Expiration (moyenne des strikes pondérée par premium)
      const targetStrikeResult = await this.calculateTargetStrike(
        ticker,
        request.optionsLimit || 200,
        request.minPremium || 50000,
        request.expiryFilter
      );
      const targetStrike = targetStrikeResult.strike;
      const expiryVolume = targetStrikeResult.volume;
      const expiryDate = targetStrikeResult.expiryDate;

      // 4. Calculer le Score de Risque de Liquidation
      const liquidationRisk = this.calculateLiquidationRisk(
        currentPrice,
        whaleSupport,
        request.liquidationThreshold || 0.005 // 0.5% par défaut
      );

      // 5. Déterminer si les baleines sont en profit
      const isWhaleInProfit = whaleSupport > 0 && currentPrice > whaleSupport;

      const priceDistanceFromSupport = whaleSupport > 0
        ? ((currentPrice - whaleSupport) / whaleSupport) * 100
        : null;
      const priceDistanceFromTarget = targetStrike > 0
        ? ((currentPrice - targetStrike) / targetStrike) * 100
        : null;

      // 6. Générer l'interprétation dynamique (règles déterministes, pas d'IA)
      const interpretation = this.generateInterpretation({
        ticker,
        currentPrice,
        whaleSupport,
        targetStrike,
        liquidationRisk,
        isWhaleInProfit,
        priceDistanceFromSupport,
        priceDistanceFromTarget,
        expiryVolume,
        expiryDate,
      });

      const analysis: WhaleAnalysis = {
        ticker,
        currentPrice,
        whaleSupport,
        targetStrike,
        liquidationRisk,
        isWhaleInProfit,
        priceDistanceFromSupport,
        priceDistanceFromTarget,
        interpretation,
      };

      log.info('Whale convergence analysis complete', {
        ticker,
        currentPrice,
        whaleSupport,
        targetStrike,
        liquidationRisk,
        isWhaleInProfit,
      });

      return {
        success: true,
        analysis,
        timestamp: new Date().toISOString(),
      };
    }, 'Analyze whale convergence');
  }

  /**
   * Récupérer le prix actuel du ticker
   * Utilise UNIQUEMENT les APIs Unusual Whales (pas FMP)
   * Ordre de priorité : Stock State -> Dark Pool -> Options Flow
   */
  private async getCurrentPrice(ticker: string): Promise<number> {
    const log = logger.child({ operation: 'getCurrentPrice', ticker });

    // 1. Source principale : Stock State de Unusual Whales (prix actuel)
    try {
      const stockStateResponse = await uw.getUWStockState(ticker);
      if (stockStateResponse.success && stockStateResponse.data) {
        // Utiliser le prix de clôture ou le dernier prix disponible
        const price = this.parseNumber(stockStateResponse.data.close || stockStateResponse.data.prev_close);
        if (price !== null && price > 0) {
          log.info('Price fetched from Stock State (UW)', { price, source: 'stock-state' });
          return price;
        }
      }
    } catch (error) {
      log.warn('Stock State (UW) failed, trying fallback', { error });
    }

    // 2. Fallback : Extraire le prix depuis les Dark Pool trades (dernier prix)
    try {
      const darkPoolResponse = await uw.getUWDarkPoolTrades(ticker, { limit: 10 });
      if (darkPoolResponse.success && darkPoolResponse.data && darkPoolResponse.data.length > 0) {
        // Prendre le prix du trade le plus récent
        const latestTrade = darkPoolResponse.data
          .filter((trade) => !trade.canceled)
          .sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime())[0];

        if (latestTrade) {
          const price = this.parseNumber(latestTrade.price);
          if (price !== null && price > 0) {
            log.info('Price fetched from Dark Pool (UW)', { price, source: 'dark-pool' });
            return price;
          }
        }
      }
    } catch (error) {
      log.warn('Dark Pool (UW) fallback failed', { error });
    }

    // 3. Fallback : Extraire le prix depuis les Options Flow (underlying_price)
    try {
      const flowAlertsResponse = await uw.getUWOptionTradeFlowAlerts({
        ticker_symbol: ticker,
        limit: 10,
      });

      if (flowAlertsResponse.success && flowAlertsResponse.data && flowAlertsResponse.data.length > 0) {
        // Prendre le underlying_price le plus récent
        const latestAlert = flowAlertsResponse.data
          .filter((alert) => alert.underlying_price)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        if (latestAlert) {
          const price = this.parseNumber(latestAlert.underlying_price);
          if (price !== null && price > 0) {
            log.info('Price fetched from Options Flow (UW)', { price, source: 'options-flow' });
            return price;
          }
        }
      }
    } catch (error) {
      log.warn('Options Flow (UW) fallback failed', { error });
    }

    log.error('All Unusual Whales price sources failed', { ticker });
    return 0;
  }

  /**
   * Calculer le Support Dark Pool (pondéré par volume)
   * Formule: Support = Σ(Prix × Volume) / Σ(Volume)
   */
  private async calculateWhaleSupport(
    ticker: string,
    limit: number = 100
  ): Promise<number> {
    const log = logger.child({ operation: 'calculateWhaleSupport', ticker, limit });

    try {
      // Récupérer les 100 dernières transactions Dark Pool
      const darkPoolResponse = await uw.getUWDarkPoolTrades(ticker, { limit });

      if (!darkPoolResponse.success || !darkPoolResponse.data || darkPoolResponse.data.length === 0) {
        log.warn('No dark pool data available', { ticker });
        return 0;
      }

      const trades = darkPoolResponse.data;

      // Filtrer les trades annulés
      const validTrades = trades.filter((trade) => !trade.canceled);

      if (validTrades.length === 0) {
        log.warn('No valid dark pool trades after filtering', { ticker });
        return 0;
      }

      // Calculer la moyenne pondérée
      let totalPriceVolume = 0;
      let totalVolume = 0;

      for (const trade of validTrades) {
        const price = this.parseNumber(trade.price);
        const size = trade.size || 0; // Utiliser size comme volume

        if (price !== null && price > 0 && size > 0) {
          totalPriceVolume += price * size;
          totalVolume += size;
        }
      }

      if (totalVolume === 0) {
        log.warn('Total volume is 0, cannot calculate weighted average', { ticker });
        return 0;
      }

      const support = totalPriceVolume / totalVolume;

      log.info('Whale support calculated', {
        ticker,
        support,
        tradesCount: validTrades.length,
        totalVolume,
      });

      return support;
    } catch (error) {
      log.error('Error calculating whale support', { ticker, error });
      return 0;
    }
  }

  /**
   * Calculer l'Objectif d'Expiration (moyenne des strikes pondérée par premium)
   * Filtre par date d'expiration si fournie, sinon utilise la plus proche
   * Retourne aussi le volume total et la date d'expiration utilisée
   */
  private async calculateTargetStrike(
    ticker: string,
    limit: number = 200,
    minPremium: number = 50000,
    expiryFilter?: string // Format: "YYYY-MM-DD" ou "tomorrow" ou "next_week"
  ): Promise<{
    strike: number;
    volume: number; // Volume total en dollars (premium total)
    expiryDate: string | null; // Date d'expiration analysée
  }> {
    const log = logger.child({
      operation: 'calculateTargetStrike',
      ticker,
      limit,
      minPremium,
      expiryFilter,
    });

    try {
      // Récupérer les flow alerts (options)
      const flowAlertsResponse = await uw.getUWOptionTradeFlowAlerts({
        ticker_symbol: ticker,
        limit,
        min_premium: minPremium,
      });

      if (!flowAlertsResponse.success || !flowAlertsResponse.data || flowAlertsResponse.data.length === 0) {
        log.warn('No flow alerts data available', { ticker });
        return { strike: 0, volume: 0, expiryDate: null };
      }

      const alerts = flowAlertsResponse.data;

      // Filtrer par date d'expiration si fournie
      let filteredAlerts = alerts;
      let selectedExpiryDate: string | null = null;
      
      if (expiryFilter) {
        const targetExpiry = this.resolveExpiryDate(expiryFilter);
        if (targetExpiry) {
          filteredAlerts = alerts.filter((alert) => {
            const alertExpiry = new Date(alert.expiry);
            return alertExpiry.toISOString().split('T')[0] === targetExpiry;
          });
          selectedExpiryDate = targetExpiry;
        }
      } else {
        // Si pas de filtre, utiliser la date d'expiration la plus proche
        const sortedByExpiry = [...alerts].sort((a, b) => {
          const dateA = new Date(a.expiry).getTime();
          const dateB = new Date(b.expiry).getTime();
          return dateA - dateB;
        });

        if (sortedByExpiry.length > 0) {
          const nearestExpiry = sortedByExpiry[0].expiry;
          filteredAlerts = alerts.filter((alert) => alert.expiry === nearestExpiry);
          selectedExpiryDate = new Date(nearestExpiry).toISOString().split('T')[0];
          log.info('Using nearest expiry', { ticker, nearestExpiry, count: filteredAlerts.length });
        }
      }

      if (filteredAlerts.length === 0) {
        log.warn('No alerts after expiry filtering', { ticker, expiryFilter });
        return { strike: 0, volume: 0, expiryDate: null };
      }

      // Calculer la moyenne pondérée par premium et le volume total
      let totalStrikePremium = 0;
      let totalPremium = 0;

      for (const alert of filteredAlerts) {
        const strike = this.parseNumber(alert.strike);
        const premium = this.parseNumber(alert.total_premium) || 0;

        if (strike !== null && strike > 0 && premium > 0) {
          totalStrikePremium += strike * premium;
          totalPremium += premium;
        }
      }

      if (totalPremium === 0) {
        log.warn('Total premium is 0, cannot calculate weighted average', { ticker });
        return { strike: 0, volume: 0, expiryDate: selectedExpiryDate };
      }

      const targetStrike = totalStrikePremium / totalPremium;
      const volumeInMillions = totalPremium / 1_000_000; // Convertir en millions

      log.info('Target strike calculated', {
        ticker,
        targetStrike,
        alertsCount: filteredAlerts.length,
        totalPremium,
        volumeInMillions,
        expiryDate: selectedExpiryDate,
        expiryFilter,
      });

      return {
        strike: targetStrike,
        volume: totalPremium, // Volume total en dollars
        expiryDate: selectedExpiryDate,
      };
    } catch (error) {
      log.error('Error calculating target strike', { ticker, error });
      return { strike: 0, volume: 0, expiryDate: null };
    }
  }

  /**
   * Calculer le Score de Risque de Liquidation
   * Compare le prix actuel avec le support Dark Pool
   */
  private calculateLiquidationRisk(
    currentPrice: number,
    whaleSupport: number,
    threshold: number = 0.005 // 0.5% par défaut
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (whaleSupport === 0 || currentPrice === 0) {
      return 'LOW'; // Pas de données suffisantes
    }

    const distance = Math.abs(currentPrice - whaleSupport) / whaleSupport;

    if (distance <= threshold) {
      // Prix très proche du support (< 0.5%) => RISQUE ÉLEVÉ
      return 'HIGH';
    } else if (distance <= threshold * 2) {
      // Prix proche du support (< 1%) => RISQUE MOYEN
      return 'MEDIUM';
    } else {
      // Prix éloigné du support (> 1%) => RISQUE FAIBLE
      return 'LOW';
    }
  }

  /**
   * Générer une interprétation dynamique basée sur des règles déterministes
   * Pas d'IA - uniquement des règles de trading professionnelles
   */
  private generateInterpretation(params: {
    ticker: string;
    currentPrice: number;
    whaleSupport: number;
    targetStrike: number;
    liquidationRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    isWhaleInProfit: boolean;
    priceDistanceFromSupport: number | null;
    priceDistanceFromTarget: number | null;
    expiryVolume: number; // Volume total en dollars pour l'expiration analysée
    expiryDate: string | null; // Date d'expiration analysée
  }): WhaleAnalysis['interpretation'] {
    const {
      ticker,
      currentPrice,
      whaleSupport,
      targetStrike,
      liquidationRisk,
      isWhaleInProfit,
      priceDistanceFromSupport,
      priceDistanceFromTarget,
      expiryVolume,
      expiryDate,
    } = params;

    const keyPoints: string[] = [];
    const scenarios: Array<{ label: string; probability: 'low' | 'medium' | 'high'; conditions: string }> = [];
    let recommendation: 'monitor' | 'caution' | 'opportunity' | 'neutral' = 'neutral';
    let summaryParts: string[] = [];

    // Analyser la convergence prix/support
    if (priceDistanceFromSupport !== null) {
      const absDistance = Math.abs(priceDistanceFromSupport);
      
      if (absDistance < 0.5) {
        keyPoints.push(`Prix actuel très proche du support Dark Pool (${absDistance.toFixed(2)}%) - Zone de convergence critique`);
        summaryParts.push(`Le prix de ${ticker} converge avec le support institutionnel à $${whaleSupport.toFixed(2)}.`);
        
        if (liquidationRisk === 'HIGH') {
          keyPoints.push('Risque de liquidation élevé si le prix passe sous le support');
          scenarios.push({
            label: 'Liquidation en cascade',
            probability: 'high',
            conditions: 'Si le prix passe sous $' + whaleSupport.toFixed(2) + ', risque de liquidations forcées des positions institutionnelles',
          });
          recommendation = 'caution';
        }
      } else if (absDistance < 2) {
        keyPoints.push(`Prix dans une zone de convergence modérée (${absDistance.toFixed(2)}% du support)`);
        summaryParts.push(`Le prix se situe à ${absDistance.toFixed(2)}% du support institutionnel.`);
        recommendation = 'monitor';
      } else {
        keyPoints.push(`Prix éloigné du support (${absDistance.toFixed(2)}%) - Pas de convergence immédiate`);
        summaryParts.push(`Le prix est à ${absDistance.toFixed(2)}% du support institutionnel.`);
      }
    }

    // Analyser la position vs objectif
    if (priceDistanceFromTarget !== null) {
      // Ajouter l'information sur le volume concentré sur l'expiration
      if (expiryVolume > 0 && expiryDate) {
        const volumeInMillions = expiryVolume / 1_000_000;
        const formattedDate = this.formatExpiryDate(expiryDate);
        keyPoints.push(`Volume de $${volumeInMillions.toFixed(2)} millions concentré sur l'expiration du ${formattedDate}.`);
      }

      if (priceDistanceFromTarget < -2) {
        // Prix significativement sous l'objectif
        keyPoints.push(`Prix actuel à ${Math.abs(priceDistanceFromTarget).toFixed(2)}% sous l'objectif d'expiration ($${targetStrike.toFixed(2)})`);
        summaryParts.push(`L'objectif d'expiration suggère un potentiel haussier vers $${targetStrike.toFixed(2)}.`);
        scenarios.push({
          label: 'Rally vers l\'objectif',
          probability: 'medium',
          conditions: `Si le momentum se maintient, le prix pourrait viser $${targetStrike.toFixed(2)} d'ici l'expiration`,
        });
        if (recommendation === 'neutral') {
          recommendation = 'opportunity';
        }
      } else if (priceDistanceFromTarget > 2) {
        // Prix significativement au-dessus de l'objectif
        keyPoints.push(`Prix actuel à ${priceDistanceFromTarget.toFixed(2)}% au-dessus de l'objectif d'expiration`);
        summaryParts.push(`Le prix dépasse déjà l'objectif d'expiration, possible sur-extension.`);
        scenarios.push({
          label: 'Correction vers l\'objectif',
          probability: 'medium',
          conditions: `Le prix pourrait se replier vers $${targetStrike.toFixed(2)} si les positions se prennent profit`,
        });
        recommendation = 'caution';
      } else {
        // Prix proche de l'objectif
        keyPoints.push(`Prix aligné avec l'objectif d'expiration (écart: ${Math.abs(priceDistanceFromTarget).toFixed(2)}%)`);
        summaryParts.push(`Le prix est aligné avec l'objectif d'expiration à $${targetStrike.toFixed(2)}.`);
      }
    }

    // Analyser le profit des baleines
    if (isWhaleInProfit) {
      keyPoints.push('Les positions institutionnelles sont en profit');
      if (liquidationRisk === 'HIGH') {
        keyPoints.push('⚠️ Risque de prise de profit si le prix baisse légèrement');
        scenarios.push({
          label: 'Prise de profit institutionnelle',
          probability: 'high',
          conditions: 'Les institutions pourraient prendre profit si le prix passe sous le support, amplifiant la baisse',
        });
      }
    } else {
      keyPoints.push('Les positions institutionnelles sont en perte');
      if (liquidationRisk === 'HIGH') {
        keyPoints.push('⚠️ Risque de liquidation forcée si le prix continue de baisser');
        scenarios.push({
          label: 'Liquidation forcée',
          probability: 'high',
          conditions: 'Si le prix reste sous le support, les institutions pourraient être forcées de liquider, créant une pression vendeuse',
        });
      }
    }

    // Analyser le risque de liquidation
    if (liquidationRisk === 'HIGH') {
      summaryParts.push('⚠️ Risque de liquidation élevé détecté.');
      if (!keyPoints.some(p => p.includes('Risque de liquidation'))) {
        keyPoints.unshift('⚠️ Zone de risque de liquidation élevé');
      }
    } else if (liquidationRisk === 'MEDIUM') {
      summaryParts.push('Risque de liquidation modéré.');
      keyPoints.push('Zone de vigilance modérée');
    } else {
      summaryParts.push('Risque de liquidation faible.');
    }

    // Générer le résumé final
    let summary = summaryParts.join(' ');
    if (summaryParts.length === 0) {
      summary = `Analyse de convergence pour ${ticker}: Prix actuel $${currentPrice.toFixed(2)}, Support Dark Pool $${whaleSupport.toFixed(2)}, Objectif $${targetStrike.toFixed(2)}.`;
    }

    // Ajuster la recommandation finale selon le contexte
    if (liquidationRisk === 'HIGH' && !isWhaleInProfit) {
      recommendation = 'caution';
    } else if (liquidationRisk === 'LOW' && priceDistanceFromTarget !== null && priceDistanceFromTarget < -3) {
      recommendation = 'opportunity';
    } else if (liquidationRisk === 'HIGH' && isWhaleInProfit) {
      recommendation = 'monitor';
    }

    return {
      summary,
      keyPoints,
      scenarios,
      recommendation,
    };
  }

  /**
   * Formater une date d'expiration pour l'affichage (ex: "16 janvier 2026")
   */
  private formatExpiryDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      const months = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
      ];
      const day = date.getDate();
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    } catch (error) {
      return dateString; // Retourner la date brute si erreur de parsing
    }
  }

  /**
   * Résoudre une date d'expiration depuis un filtre textuel
   */
  private resolveExpiryDate(filter: string): string | null {
    if (filter === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }

    if (filter === 'next_week') {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek.toISOString().split('T')[0];
    }

    // Vérifier si c'est une date valide (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(filter)) {
      return filter;
    }

    return null;
  }

  /**
   * Parser un nombre depuis une valeur potentiellement string
   */
  private parseNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? null : parsed;
  }
}

