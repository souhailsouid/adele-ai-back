/**
 * Cron Service - Gestion des crons récurrents
 * Utilise le client Supabase Admin pour bypass RLS
 */

import { createAdminClient } from "../../utils/supabase/admin";
import { logger } from "../../utils/logger";

const adminClient = createAdminClient();

export type CronStatus = 'SUCCESS' | 'FAILED' | 'RUNNING';

export interface CronJob {
  id: string;
  is_active: boolean;
  last_status: CronStatus | null;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  run_count: number;
  success_count: number;
  failure_count: number;
  schedule_expression: string | null;
  next_run_at: string | null;
  avg_duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Récupère le statut d'un cron
 * @param cronId - ID du cron (e.g., 'collector-sec-watcher')
 */
export async function getCronStatus(cronId: string): Promise<CronJob | null> {
  try {
    const { data, error } = await adminClient
      .from('cron_registry')
      .select('*')
      .eq('id', cronId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data as CronJob;
  } catch (error: any) {
    logger.error(`Error getting cron status for ${cronId}:`, error);
    throw error;
  }
}

/**
 * Met à jour le statut d'un cron
 * @param cronId - ID du cron
 * @param updates - Mises à jour (last_status, last_run_at, last_error, etc.)
 */
export async function updateCronStatus(
  cronId: string,
  updates: {
    last_status?: CronStatus;
    last_run_at?: string;
    last_success_at?: string;
    last_error?: string | null;
    run_count?: number;
    success_count?: number;
    failure_count?: number;
    schedule_expression?: string;
    next_run_at?: string;
    avg_duration_ms?: number;
  }
): Promise<void> {
  try {
    const log = logger.child({ operation: 'updateCronStatus', cronId, updates });
    log.info('Updating cron status');

    // Si le cron n'existe pas, le créer
    const existing = await getCronStatus(cronId);
    if (!existing) {
      const { error: insertError } = await adminClient
        .from('cron_registry')
        .insert({
          id: cronId,
          is_active: true,
          ...updates,
        });

      if (insertError) throw insertError;
      log.info(`Cron ${cronId} created`);
      return;
    }

    // Mettre à jour les compteurs de manière atomique si nécessaire
    // On a déjà récupéré existing plus haut, utiliser cette valeur
    const updateData: any = { ...updates };

    // Calculer les nouveaux compteurs si nécessaire
    if (updates.run_count !== undefined || updates.success_count !== undefined || updates.failure_count !== undefined) {
      if (existing) {
        if (updates.run_count !== undefined) {
          updateData.run_count = (existing.run_count || 0) + updates.run_count;
        }
        if (updates.success_count !== undefined) {
          updateData.success_count = (existing.success_count || 0) + updates.success_count;
        }
        if (updates.failure_count !== undefined) {
          updateData.failure_count = (existing.failure_count || 0) + updates.failure_count;
        }
      }
    }

    const { error } = await adminClient
      .from('cron_registry')
      .update(updateData)
      .eq('id', cronId);

    if (error) throw error;

    log.info(`Cron ${cronId} updated`);
  } catch (error: any) {
    logger.error(`Error updating cron status for ${cronId}:`, error);
    throw error;
  }
}

/**
 * Active ou désactive un cron
 * @param cronId - ID du cron
 * @param isActive - Actif ou non
 */
export async function setCronActive(cronId: string, isActive: boolean): Promise<void> {
  try {
    const log = logger.child({ operation: 'setCronActive', cronId, isActive });
    log.info(`${isActive ? 'Activating' : 'Deactivating'} cron`);

    const { error } = await adminClient
      .from('cron_registry')
      .update({ is_active: isActive })
      .eq('id', cronId);

    if (error) throw error;

    log.info(`Cron ${cronId} ${isActive ? 'activated' : 'deactivated'}`);
  } catch (error: any) {
    logger.error(`Error setting cron active for ${cronId}:`, error);
    throw error;
  }
}

/**
 * Enregistre le début d'exécution d'un cron
 * @param cronId - ID du cron
 * @param startTime - Timestamp de début (optionnel, utilise now() par défaut)
 */
export async function logCronStart(cronId: string, startTime?: Date): Promise<void> {
  const now = startTime || new Date();
  await updateCronStatus(cronId, {
    last_status: 'RUNNING',
    last_run_at: now.toISOString(),
  });
}

/**
 * Enregistre la fin d'exécution d'un cron (succès)
 * @param cronId - ID du cron
 * @param durationMs - Durée d'exécution en millisecondes
 */
export async function logCronSuccess(cronId: string, durationMs?: number): Promise<void> {
  const now = new Date();

  // Calculer la moyenne de durée si durationMs est fourni
  let avgDurationMs: number | undefined = undefined;
  if (durationMs !== undefined) {
    const existing = await getCronStatus(cronId);
    if (existing && existing.avg_duration_ms) {
      // Moyenne pondérée (simple moyenne pour l'instant)
      avgDurationMs = Math.round((existing.avg_duration_ms + durationMs) / 2);
    } else {
      avgDurationMs = durationMs;
    }
  }

  await updateCronStatus(cronId, {
    last_status: 'SUCCESS',
    last_success_at: now.toISOString(),
    last_error: null,
    run_count: 1,
    success_count: 1,
    avg_duration_ms: avgDurationMs,
  });
}

/**
 * Enregistre la fin d'exécution d'un cron (échec)
 * @param cronId - ID du cron
 * @param error - Erreur rencontrée
 * @param durationMs - Durée d'exécution en millisecondes (optionnel)
 */
export async function logCronFailure(
  cronId: string,
  error: Error | string,
  durationMs?: number
): Promise<void> {
  const now = new Date();
  const errorMessage = error instanceof Error ? error.message : error;

  // Calculer la moyenne de durée si durationMs est fourni
  let avgDurationMs: number | undefined = undefined;
  if (durationMs !== undefined) {
    const existing = await getCronStatus(cronId);
    if (existing && existing.avg_duration_ms) {
      avgDurationMs = Math.round((existing.avg_duration_ms + durationMs) / 2);
    } else {
      avgDurationMs = durationMs;
    }
  }

  await updateCronStatus(cronId, {
    last_status: 'FAILED',
    last_error: errorMessage,
    run_count: 1,
    failure_count: 1,
    avg_duration_ms: avgDurationMs,
  });
}

/**
 * Récupère tous les crons
 * @param includeInactive - Inclure les crons inactifs (défaut: true)
 */
export async function getAllCrons(includeInactive: boolean = true): Promise<CronJob[]> {
  try {
    let query = adminClient
      .from('cron_registry')
      .select('*')
      .order('last_run_at', { ascending: false, nullsFirst: false });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []) as CronJob[];
  } catch (error: any) {
    logger.error('Error getting all crons:', error);
    throw error;
  }
}
