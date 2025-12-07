/**
 * Module Combined Analysis - Interface publique
 * Expose toutes les fonctions d'analyse combinée FMP + UW
 */

import { CombinedAnalysisService } from './services/combined-analysis.service';
import { EarningsPredictionService } from './services/earnings-prediction.service';
import { MultiCriteriaScreenerService } from './services/multi-criteria-screener.service';
import { RiskAnalysisService } from './services/risk-analysis.service';
import { InstitutionTrackingService } from './services/institution-tracking.service';
import { SectorAnalysisService } from './services/sector-analysis.service';
import { logger } from './utils/logger';
import type { ScreeningCriteria } from './types/combined-analysis';

// Instances singleton des services
const combinedAnalysisService = new CombinedAnalysisService();
const earningsPredictionService = new EarningsPredictionService();
const multiCriteriaScreenerService = new MultiCriteriaScreenerService();
const riskAnalysisService = new RiskAnalysisService();
const institutionTrackingService = new InstitutionTrackingService();
const sectorAnalysisService = new SectorAnalysisService();

// ========== Analyse Complète ==========

export async function getCompleteAnalysis(ticker: string) {
  const log = logger.child({ ticker, function: 'getCompleteAnalysis' });
  log.info('Getting complete analysis');
  try {
    return await combinedAnalysisService.getCompleteAnalysis(ticker);
  } catch (error) {
    log.error('Failed to get complete analysis', error);
    throw error;
  }
}

// ========== Détection de Divergences ==========

export async function getDivergenceAnalysis(ticker: string) {
  const log = logger.child({ ticker, function: 'getDivergenceAnalysis' });
  log.info('Getting divergence analysis');
  try {
    return await combinedAnalysisService.getDivergenceAnalysis(ticker);
  } catch (error) {
    log.error('Failed to get divergence analysis', error);
    throw error;
  }
}

// ========== Valuation Complète ==========

export async function getComprehensiveValuation(ticker: string) {
  const log = logger.child({ ticker, function: 'getComprehensiveValuation' });
  log.info('Getting comprehensive valuation');
  try {
    return await combinedAnalysisService.getComprehensiveValuation(ticker);
  } catch (error) {
    log.error('Failed to get comprehensive valuation', error);
    throw error;
  }
}

// ========== Prédiction d'Earnings ==========

export async function getEarningsPrediction(ticker: string, earningsDate?: string) {
  const log = logger.child({ ticker, function: 'getEarningsPrediction' });
  log.info('Getting earnings prediction');
  try {
    return await earningsPredictionService.predictEarningsSurprise(ticker, earningsDate);
  } catch (error) {
    log.error('Failed to get earnings prediction', error);
    throw error;
  }
}

// ========== Screening Multi-Critères ==========

export async function screenMultiCriteria(criteria: ScreeningCriteria) {
  const log = logger.child({ function: 'screenMultiCriteria' });
  log.info('Screening with multi-criteria');
  try {
    return await multiCriteriaScreenerService.screenTickers(criteria);
  } catch (error) {
    log.error('Failed to screen with multi-criteria', error);
    throw error;
  }
}

// ========== Analyse de Risque ==========

export async function getRiskAnalysis(ticker: string) {
  const log = logger.child({ ticker, function: 'getRiskAnalysis' });
  log.info('Getting risk analysis');
  try {
    return await riskAnalysisService.analyzeRisk(ticker);
  } catch (error) {
    log.error('Failed to get risk analysis', error);
    throw error;
  }
}

// ========== Tracking d'Institutions ==========

export async function trackInstitution(institutionName: string) {
  const log = logger.child({ institutionName, function: 'trackInstitution' });
  log.info('Tracking institution');
  try {
    return await institutionTrackingService.trackInstitution(institutionName);
  } catch (error) {
    log.error('Failed to track institution', error);
    throw error;
  }
}

// ========== Analyse de Secteur ==========

export async function analyzeSector(sector: string) {
  const log = logger.child({ sector, function: 'analyzeSector' });
  log.info('Analyzing sector');
  try {
    return await sectorAnalysisService.analyzeSector(sector);
  } catch (error) {
    log.error('Failed to analyze sector', error);
    throw error;
  }
}

