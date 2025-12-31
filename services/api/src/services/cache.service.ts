/**
 * Service de cache centralisé
 * Gère toutes les opérations de cache pour les données ticker
 */

import { supabase } from '../supabase';
import { logger } from '../utils/logger';
import { CacheError, safeExecute } from '../utils/errors';

export interface CacheOptions {
  ttlHours?: number;
  tableName: string;
}

export class CacheService {
  constructor(private options: CacheOptions) {}

  /**
   * Récupérer une entrée du cache
   */
  async get<T>(key: string, keyField: string = 'ticker'): Promise<T | null> {
    try {
      const { data, error } = await supabase
        .from(this.options.tableName)
        .select('*')
        .eq(keyField, key.toUpperCase())
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Pas de résultat trouvé
          return null;
        }
        throw new CacheError(`Failed to get cache: ${error.message}`, error);
      }

      return data as T;
    } catch (error) {
      logger.error(`Cache get failed for ${key}`, error);
      return null;
    }
  }

  /**
   * Récupérer plusieurs entrées du cache
   */
  async getMany<T>(key: string, keyField: string = 'ticker', limit: number = 100): Promise<T[]> {
    try {
      const { data, error } = await supabase
        .from(this.options.tableName)
        .select('*')
        .eq(keyField, key.toUpperCase())
        .gt('expires_at', new Date().toISOString())
        .limit(limit)
        .order('created_at', { ascending: false });

      if (error) {
        throw new CacheError(`Failed to get many cache: ${error.message}`, error);
      }

      return (data || []) as T[];
    } catch (error) {
      logger.error(`Cache getMany failed for ${key}`, error);
      return [];
    }
  }

  /**
   * Mettre en cache une entrée
   */
  async set<T extends Record<string, any>>(
    key: string,
    data: T | T[],
    keyField: string = 'ticker',
    ttlHours?: number
  ): Promise<void> {
    const ttl = ttlHours || this.options.ttlHours || 24;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttl);

    // Si data est un array, le stocker dans un champ JSONB 'data'
    // Sinon, spreader les propriétés
    const isArray = Array.isArray(data);
    const cacheEntry = {
      [keyField]: key.toUpperCase(),
      ...(isArray ? {} : data), // Ne spreader que si ce n'est pas un array
      ...(isArray ? { data: data as any } : {}), // Stocker l'array dans 'data' si c'est un array
      expires_at: expiresAt.toISOString(),
      cached_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from(this.options.tableName)
        .upsert(cacheEntry, { onConflict: keyField });

      if (error) {
        throw new CacheError(`Failed to set cache: ${error.message}`, error);
      }

      logger.debug(`Cached ${key} in ${this.options.tableName}`, { ttlHours: ttl, isArray });
    } catch (error) {
      logger.error(`Cache set failed for ${key}`, error);
      // Ne pas throw pour ne pas faire échouer l'opération principale
    }
  }

  /**
   * Mettre en cache plusieurs entrées
   */
  async setMany<T extends Record<string, any>>(
    key: string,
    items: T[],
    keyField: string = 'ticker',
    ttlHours?: number
  ): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const ttl = ttlHours || this.options.ttlHours || 24;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + ttl);

    const cacheEntries = items.map((item) => ({
      [keyField]: key.toUpperCase(),
      ...item,
      expires_at: expiresAt.toISOString(),
      cached_at: new Date().toISOString(),
    }));

    try {
      const { error } = await supabase
        .from(this.options.tableName)
        .upsert(cacheEntries, { onConflict: keyField });

      if (error) {
        throw new CacheError(`Failed to set many cache: ${error.message}`, error);
      }

      logger.debug(`Cached ${items.length} items for ${key}`, { ttlHours: ttl });
    } catch (error) {
      logger.error(`Cache setMany failed for ${key}`, error);
      // Ne pas throw pour ne pas faire échouer l'opération principale
    }
  }

  /**
   * Invalider le cache pour une clé
   */
  async invalidate(key: string, keyField: string = 'ticker'): Promise<void> {
    try {
      const { error } = await supabase
        .from(this.options.tableName)
        .delete()
        .eq(keyField, key.toUpperCase());

      if (error) {
        throw new CacheError(`Failed to invalidate cache: ${error.message}`, error);
      }

      logger.debug(`Invalidated cache for ${key}`);
    } catch (error) {
      logger.error(`Cache invalidate failed for ${key}`, error);
    }
  }
}

