/**
 * Service de tracking d'institutions
 * Combine FMP 13F + UW activity
 */

import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import * as fmp from '../fmp';
import * as uw from '../unusual-whales';
import type {
  InstitutionTracking,
  InstitutionTrackingResponse,
  InstitutionActivity,
  PositionChange,
  TopPosition,
  SectorExposure,
  InstitutionPerformance,
} from '../types/combined-analysis';

export class InstitutionTrackingService {
  /**
   * Track une institution : combine FMP 13F + UW activity
   */
  async trackInstitution(institutionName: string): Promise<InstitutionTrackingResponse> {
    return handleError(async () => {
      const log = logger.child({ institutionName, operation: 'trackInstitution' });
      log.info('Tracking institution');

      // Récupération des données UW (plus récentes)
      const [uwActivity, uwHoldings, uwSectors] = await Promise.allSettled([
        uw.getUWInstitutionActivity(institutionName, { limit: 100 }),
        uw.getUWInstitutionHoldings(institutionName, {}),
        uw.getUWInstitutionSectorExposure(institutionName),
      ]);

      log.info('UW institution data fetched', {
        activity: uwActivity.status,
        holdings: uwHoldings.status,
        sectors: uwSectors.status,
      });

      // Extraire les données
      const activity: InstitutionActivity[] = [];
      if (uwActivity.status === 'fulfilled' && uwActivity.value?.success && uwActivity.value.data) {
        const activities = Array.isArray(uwActivity.value.data) ? uwActivity.value.data : [];
        activity.push(...activities.slice(0, 50).map((a: any) => ({
          ticker: a.ticker || a.ticker_symbol || '',
          transactionType: this.determineTransactionType(a),
          shares: Math.abs(a.units_change || a.change || a.shares || 0),
          value: (Math.abs(a.units_change || a.change || a.shares || 0)) * (a.avg_price || a.close || a.price || 0),
          date: a.filing_date || a.report_date || a.date || a.transaction_date || '',
          price: a.avg_price || a.close || a.price || 0,
        })));
        log.info('Activity extracted', { count: activity.length });
      } else {
        log.warn('Activity data not available', {
          status: uwActivity.status,
          hasValue: uwActivity.status === 'fulfilled' && !!uwActivity.value,
          hasSuccess: uwActivity.status === 'fulfilled' && uwActivity.value?.success,
          hasData: uwActivity.status === 'fulfilled' && uwActivity.value?.success && !!uwActivity.value.data,
        });
      }

      // Extraire les holdings
      const holdings: any[] = [];
      if (uwHoldings.status === 'fulfilled' && uwHoldings.value?.success && uwHoldings.value.data) {
        const h = Array.isArray(uwHoldings.value.data) ? uwHoldings.value.data : [];
        holdings.push(...h);
        log.info('Holdings extracted', { count: holdings.length });
      } else {
        log.warn('Holdings data not available', {
          status: uwHoldings.status,
          hasValue: uwHoldings.status === 'fulfilled' && !!uwHoldings.value,
          hasSuccess: uwHoldings.status === 'fulfilled' && uwHoldings.value?.success,
          hasData: uwHoldings.status === 'fulfilled' && uwHoldings.value?.success && !!uwHoldings.value.data,
        });
      }

      // Détecter les changements de positions (simplifié)
      const positionChanges = this.detectPositionChanges(holdings, activity);

      // Top positions
      const topPositions: TopPosition[] = holdings
        .slice(0, 10)
        .map((h: any) => ({
          ticker: h.ticker || h.ticker_symbol || '',
          shares: h.shares || h.total_shares || 0,
          value: h.value || h.total_value || 0,
          percentage: h.percentage || h.percent_of_portfolio || 0,
          change: 0, // Simplifié - en réalité il faudrait comparer avec historique
        }))
        .sort((a, b) => b.value - a.value);

      // Exposition sectorielle
      const sectorExposure: SectorExposure[] = [];
      if (uwSectors.status === 'fulfilled' && uwSectors.value?.success && uwSectors.value.data) {
        const sectors = Array.isArray(uwSectors.value.data) ? uwSectors.value.data : [];
        sectorExposure.push(...sectors.map((s: any) => ({
          sector: s.sector || '',
          percentage: s.percentage || s.exposure || 0,
          value: s.value || 0,
        })));
        log.info('Sector exposure extracted', { count: sectorExposure.length });
      } else {
        log.warn('Sector exposure data not available', {
          status: uwSectors.status,
          hasValue: uwSectors.status === 'fulfilled' && !!uwSectors.value,
          hasSuccess: uwSectors.status === 'fulfilled' && uwSectors.value?.success,
          hasData: uwSectors.status === 'fulfilled' && uwSectors.value?.success && !!uwSectors.value.data,
        });
      }

      // Performance (simplifié)
      const performance: InstitutionPerformance = {
        period: '1Y',
        return: 0, // En réalité il faudrait calculer depuis les données historiques
        topPerformers: topPositions.slice(0, 5).map(p => p.ticker),
        underPerformers: [],
      };

      const tracking: InstitutionTracking = {
        institutionName,
        totalHoldings: holdings.length,
        recentActivity: activity.slice(0, 20),
        positionChanges,
        topPositions,
        sectorExposure,
        performance,
      };

      return {
        success: true,
        data: tracking,
        cached: false,
        timestamp: new Date().toISOString(),
      };
    }, `Track institution ${institutionName}`);
  }

  // ========== Méthodes privées ==========

  private determineTransactionType(activity: any): 'BUY' | 'SELL' {
    const unitsChange = activity.units_change || activity.change || activity.shares_change || 0;
    return unitsChange >= 0 ? 'BUY' : 'SELL';
  }

  private detectPositionChanges(holdings: any[], activity: InstitutionActivity[]): PositionChange[] {
    const changes: PositionChange[] = [];

    // Analyser l'activité récente pour détecter les changements
    const recentActivity = activity.filter(a => {
      const date = new Date(a.date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return date > thirtyDaysAgo;
    });

    // Grouper par ticker
    const byTicker = new Map<string, { buys: number; sells: number }>();
    
    for (const act of recentActivity) {
      if (!byTicker.has(act.ticker)) {
        byTicker.set(act.ticker, { buys: 0, sells: 0 });
      }
      const tickerData = byTicker.get(act.ticker)!;
      if (act.transactionType === 'BUY') {
        tickerData.buys += act.shares;
      } else {
        tickerData.sells += act.shares;
      }
    }

    // Créer les changements
    for (const [ticker, data] of byTicker.entries()) {
      const netChange = data.buys - data.sells;
      if (Math.abs(netChange) > 0) {
        const existingHolding = holdings.find(h => (h.ticker || h.ticker_symbol) === ticker);
        
        let type: PositionChange['type'];
        if (!existingHolding && data.buys > 0) {
          type = 'NEW';
        } else if (existingHolding && netChange > 0) {
          type = 'INCREASED';
        } else if (existingHolding && netChange < 0) {
          type = 'DECREASED';
        } else {
          continue;
        }

        changes.push({
          ticker,
          type,
          sharesChange: netChange,
          valueChange: netChange * (recentActivity.find(a => a.ticker === ticker)?.price || 0),
          date: recentActivity.find(a => a.ticker === ticker)?.date || new Date().toISOString(),
        });
      }
    }

    return changes;
  }
}

