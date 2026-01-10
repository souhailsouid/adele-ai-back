/**
 * Queue Service - Gestion de la file de traitement
 * Utilise le client Supabase Admin pour bypass RLS
 */

import { createAdminClient } from "../../utils/supabase/admin";
import { logger } from "../../utils/logger";

const adminClient = createAdminClient();

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type DocType = '13F' | '10K' | '10Q' | 'RSS' | 'OTHER';

export interface JobMetrics {
  rows_parsed?: number;
  holdings_count?: number;
  validation_errors?: number;
  [key: string]: any;
}

export interface ProcessingJob {
  id: string;
  filename: string;
  status: JobStatus;
  doc_type: DocType | null;
  filing_id: number | null;
  fund_id: number | null;
  retry_count: number;
  max_retries: number;
  error_log: string | null;
  metrics: JobMetrics | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Initialise un nouveau job dans la file
 * @param filename - Nom du fichier ou identifiant
 * @param docType - Type de document
 * @param options - Options supplémentaires (filing_id, fund_id, max_retries)
 * @returns ID du job créé
 */
export async function initJob(
  filename: string,
  docType: DocType,
  options?: {
    filing_id?: number;
    fund_id?: number;
    max_retries?: number;
  }
): Promise<string> {
  try {
    const log = logger.child({ operation: 'initJob', filename, docType });
    log.info('Initializing job');

    const { data, error } = await adminClient
      .from('file_processing_queue')
      .insert({
        filename,
        status: 'PENDING',
        doc_type: docType,
        filing_id: options?.filing_id || null,
        fund_id: options?.fund_id || null,
        retry_count: 0,
        max_retries: options?.max_retries || 3,
        error_log: null,
        metrics: null,
        started_at: null,
        completed_at: null,
      })
      .select('id')
      .single();

    if (error) throw error;

    log.info(`Job initialized: ${data.id}`);
    return data.id;
  } catch (error: any) {
    logger.error(`Error initializing job for ${filename}:`, error);
    throw error;
  }
}

/**
 * Marque un job comme démarré (en traitement)
 * @param jobId - ID du job
 */
export async function startJob(jobId: string): Promise<void> {
  try {
    const log = logger.child({ operation: 'startJob', jobId });
    log.info('Starting job');

    const { error } = await adminClient
      .from('file_processing_queue')
      .update({
        status: 'PROCESSING',
        started_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) throw error;

    log.info(`Job started: ${jobId}`);
  } catch (error: any) {
    logger.error(`Error starting job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Marque un job comme terminé avec succès
 * @param jobId - ID du job
 * @param metrics - Métriques de validation (optionnel)
 */
export async function completeJob(
  jobId: string,
  metrics?: JobMetrics
): Promise<void> {
  try {
    const log = logger.child({ operation: 'completeJob', jobId, metrics });
    log.info('Completing job');

    const updateData: any = {
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
    };

    if (metrics) {
      updateData.metrics = metrics;
    }

    const { error } = await adminClient
      .from('file_processing_queue')
      .update(updateData)
      .eq('id', jobId);

    if (error) throw error;

    log.info(`Job completed: ${jobId}`);
  } catch (error: any) {
    logger.error(`Error completing job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Marque un job comme échoué et incrémente le retry_count
 * @param jobId - ID du job
 * @param error - Erreur rencontrée
 * @param retryDelay - Délai avant retry en secondes (optionnel)
 * @returns true si le job peut être retenté, false si max_retries atteint
 */
export async function failJob(
  jobId: string,
  error: Error | string,
  retryDelay?: number
): Promise<boolean> {
  try {
    const log = logger.child({ operation: 'failJob', jobId });
    log.error('Failing job', { error: error instanceof Error ? error.message : error });

    // Récupérer le job actuel pour vérifier retry_count
    const { data: job, error: fetchError } = await adminClient
      .from('file_processing_queue')
      .select('retry_count, max_retries')
      .eq('id', jobId)
      .single();

    if (fetchError) throw fetchError;
    if (!job) throw new Error(`Job ${jobId} not found`);

    const newRetryCount = (job.retry_count || 0) + 1;
    const canRetry = newRetryCount < (job.max_retries || 3);

    const errorMessage = error instanceof Error
      ? `[ERROR] ${new Date().toISOString()}: ${error.message}\nStack: ${error.stack || 'N/A'}`
      : `[ERROR] ${new Date().toISOString()}: ${error}`;

    const updateData: any = {
      status: canRetry ? 'FAILED' : 'FAILED', // Toujours FAILED, mais retry_count indique si retry possible
      retry_count: newRetryCount,
      completed_at: new Date().toISOString(),
      error_log: errorMessage,
    };

    // Si on peut retenter, on peut ajouter un next_retry_at (nécessiterait une colonne supplémentaire)
    // Pour l'instant, on laisse SQS/EventBridge gérer les retries

    const { error: updateError } = await adminClient
      .from('file_processing_queue')
      .update(updateData)
      .eq('id', jobId);

    if (updateError) throw updateError;

    log.info(`Job failed: ${jobId}, retry_count: ${newRetryCount}, can_retry: ${canRetry}`);
    return canRetry;
  } catch (error: any) {
    logger.error(`Error failing job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Récupère un job par son ID
 * @param jobId - ID du job
 */
export async function getJob(jobId: string): Promise<ProcessingJob | null> {
  try {
    const { data, error } = await adminClient
      .from('file_processing_queue')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data as ProcessingJob;
  } catch (error: any) {
    logger.error(`Error getting job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Récupère les jobs par statut
 * @param status - Statut des jobs
 * @param limit - Nombre maximum de jobs à retourner
 */
export async function getJobsByStatus(
  status: JobStatus,
  limit: number = 100
): Promise<ProcessingJob[]> {
  try {
    const { data, error } = await adminClient
      .from('file_processing_queue')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []) as ProcessingJob[];
  } catch (error: any) {
    logger.error(`Error getting jobs by status ${status}:`, error);
    throw error;
  }
}

/**
 * Récupère les jobs en échec pouvant être retentés
 * @param limit - Nombre maximum de jobs à retourner
 */
export async function getFailedJobsForRetry(limit: number = 100): Promise<ProcessingJob[]> {
  try {
    // Récupérer tous les jobs FAILED et filtrer côté application (Supabase ne supporte pas les comparaisons de colonnes)
    const { data, error } = await adminClient
      .from('file_processing_queue')
      .select('*')
      .eq('status', 'FAILED')
      .order('updated_at', { ascending: false })
      .limit(limit * 2); // Récupérer plus pour filtrer après

    if (error) throw error;

    // Filtrer les jobs qui peuvent être retentés (retry_count < max_retries)
    const retryableJobs = (data || []).filter(
      (job: any) => (job.retry_count || 0) < (job.max_retries || 3)
    ) as ProcessingJob[];

    return retryableJobs.slice(0, limit);
  } catch (error: any) {
    logger.error('Error getting failed jobs for retry:', error);
    throw error;
  }
}
