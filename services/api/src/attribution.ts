/**
 * Module Attribution - Interface publique
 * Expose toutes les fonctions d'attribution d'entités
 */

import { AttributionService } from './services/attribution.service';
import { logger } from './utils/logger';
import type {
  FlowAttributionRequest,
  FlowAttributionResponse,
  InstitutionAttributionRequest,
  InstitutionAttributionResponse,
  DominantEntitiesResponse,
  ClustersResponse,
} from './types/attribution';

// Instance singleton du service
const attributionService = new AttributionService();

// ========== Attribution de Flow ==========

export async function attributeFlowToEntities(
  request: FlowAttributionRequest
): Promise<FlowAttributionResponse> {
  const log = logger.child({ function: 'attributeFlowToEntities' });
  log.info('Attributing flow to entities');
  try {
    return await attributionService.attributeFlowToEntities(request);
  } catch (error) {
    log.error('Failed to attribute flow', error);
    throw error;
  }
}

// ========== Attribution d'Influence Institutionnelle ==========

export async function attributeInstitutionInfluence(
  request: InstitutionAttributionRequest
): Promise<InstitutionAttributionResponse> {
  const log = logger.child({ function: 'attributeInstitutionInfluence' });
  log.info('Calculating institution influence');
  try {
    return await attributionService.attributeInstitutionInfluence(request);
  } catch (error) {
    log.error('Failed to calculate institution influence', error);
    throw error;
  }
}

// ========== Entités Dominantes ==========

export async function findDominantEntities(
  ticker: string
): Promise<DominantEntitiesResponse> {
  const log = logger.child({ function: 'findDominantEntities', ticker });
  log.info('Finding dominant entities');
  try {
    return await attributionService.findDominantEntities(ticker);
  } catch (error) {
    log.error('Failed to find dominant entities', error);
    throw error;
  }
}

// ========== Clustering Institutionnel ==========

export async function clusterInstitutions(
  sector?: string
): Promise<ClustersResponse> {
  const log = logger.child({ function: 'clusterInstitutions', sector });
  log.info('Clustering institutions');
  try {
    return await attributionService.clusterInstitutions(sector);
  } catch (error) {
    log.error('Failed to cluster institutions', error);
    throw error;
  }
}








