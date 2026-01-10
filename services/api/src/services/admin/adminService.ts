/**
 * Admin Service - Service principal pour le dashboard admin
 * Agrège les données de monitoring (queue, crons, métriques)
 */

import { getJob, getJobsByStatus, getFailedJobsForRetry, type ProcessingJob, type JobStatus } from './queueService';
import { getCronStatus, getAllCrons, type CronJob } from './cronService';
import { createAdminClient } from '../../utils/supabase/admin';
import { logger } from '../../utils/logger';

const adminClient = createAdminClient();

export interface AdminDashboardMetrics {
  queue: {
    pending: number;
    processing: number;
    completed_today: number;
    failed: number;
    failed_retryable: number;
  };
  crons: {
    total: number;
    active: number;
    inactive: number;
    running: number;
    last_24h_success: number;
    last_24h_failure: number;
  };
  recent_jobs: ProcessingJob[];
  recent_errors: Array<{
    job_id: string;
    filename: string;
    error: string;
    retry_count: number;
    created_at: string;
  }>;
  cron_health: CronJob[];
}

/**
 * Récupère les métriques du dashboard admin
 */
export async function getDashboardMetrics(): Promise<AdminDashboardMetrics> {
  try {
    const log = logger.child({ operation: 'getDashboardMetrics' });
    log.info('Fetching dashboard metrics');

    // Récupérer les jobs par statut
    const [pending, processing, completed, failed, failedRetryable] = await Promise.all([
      getJobsByStatus('PENDING', 1000),
      getJobsByStatus('PROCESSING', 1000),
      getJobsByStatus('COMPLETED', 1000),
      getJobsByStatus('FAILED', 1000),
      getFailedJobsForRetry(1000),
    ]);

    // Filtrer les jobs complétés aujourd'hui
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const completedToday = completed.filter(
      job => job.completed_at && new Date(job.completed_at) >= today
    );

    // Récupérer tous les crons
    const allCrons = await getAllCrons(true);
    const activeCrons = allCrons.filter(cron => cron.is_active);
    const inactiveCrons = allCrons.filter(cron => !cron.is_active);
    const runningCrons = allCrons.filter(cron => cron.last_status === 'RUNNING');

    // Filtrer les crons des 24 dernières heures
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);
    const last24hSuccess = allCrons.filter(
      cron => cron.last_success_at && new Date(cron.last_success_at) >= last24h
    );
    const last24hFailure = allCrons.filter(
      cron => cron.last_status === 'FAILED' && cron.last_run_at && new Date(cron.last_run_at) >= last24h
    );

    // Récupérer les jobs récents (100 derniers)
    const { data: recentJobsData, error: recentJobsError } = await adminClient
      .from('file_processing_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (recentJobsError) throw recentJobsError;

    // Récupérer les erreurs récentes
    const recentErrors = failed
      .filter(job => job.error_log)
      .slice(0, 50)
      .map(job => ({
        job_id: job.id,
        filename: job.filename,
        error: job.error_log || 'Unknown error',
        retry_count: job.retry_count,
        created_at: job.created_at,
      }));

    const metrics: AdminDashboardMetrics = {
      queue: {
        pending: pending.length,
        processing: processing.length,
        completed_today: completedToday.length,
        failed: failed.length,
        failed_retryable: failedRetryable.length,
      },
      crons: {
        total: allCrons.length,
        active: activeCrons.length,
        inactive: inactiveCrons.length,
        running: runningCrons.length,
        last_24h_success: last24hSuccess.length,
        last_24h_failure: last24hFailure.length,
      },
      recent_jobs: (recentJobsData || []) as ProcessingJob[],
      recent_errors: recentErrors,
      cron_health: allCrons,
    };

    log.info('Dashboard metrics fetched', {
      queue_pending: metrics.queue.pending,
      queue_processing: metrics.queue.processing,
      crons_active: metrics.crons.active,
    });

    return metrics;
  } catch (error: any) {
    logger.error('Error getting dashboard metrics:', error);
    throw error;
  }
}

/**
 * Récupère les jobs en échec qui n'ont pas encore atteint max_retries
 */
export async function getPendingRetries(limit: number = 100): Promise<ProcessingJob[]> {
  return await getFailedJobsForRetry(limit);
}

/**
 * Récupère les fichiers non parsés (status FAILED ou PENDING depuis plus de X minutes)
 */
export async function getUnparsedFiles(minutesThreshold: number = 60): Promise<ProcessingJob[]> {
  try {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() - minutesThreshold);

    const { data, error } = await adminClient
      .from('file_processing_queue')
      .select('*')
      .in('status', ['PENDING', 'PROCESSING', 'FAILED'])
      .lt('created_at', threshold.toISOString())
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;

    return (data || []) as ProcessingJob[];
  } catch (error: any) {
    logger.error('Error getting unparsed files:', error);
    throw error;
  }
}

/**
 * Calcule le délai avant le prochain retry (basé sur retry_count)
 */
export function calculateRetryDelay(retryCount: number): number {
  // Exponential backoff: 5min, 15min, 30min, 60min
  const delays = [300, 900, 1800, 3600]; // en secondes
  return delays[Math.min(retryCount, delays.length - 1)];
}
