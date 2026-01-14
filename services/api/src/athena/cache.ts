/**
 * Cache local simple pour les Lambda
 * 
 * Évite les requêtes Athena répétées pour les mêmes données
 * Utile pour les petites tables (companies, funds) qui changent peu
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live en millisecondes
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes par défaut

  /**
   * Récupérer une valeur du cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Vérifier si l'entrée a expiré
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Mettre une valeur dans le cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Supprimer une clé du cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Vider tout le cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Nettoyer les entrées expirées
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Obtenir la taille du cache
   */
  size(): number {
    return this.cache.size;
  }
}

// Instance singleton partagée dans la Lambda
export const cache = new SimpleCache();

/**
 * Helper pour wrapper une fonction avec cache
 */
export function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Vérifier le cache d'abord
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return Promise.resolve(cached);
  }

  // Exécuter la fonction et mettre en cache
  return fn().then(result => {
    cache.set(key, result, ttl);
    return result;
  });
}

/**
 * Clés de cache standardisées
 */
export const CacheKeys = {
  companyByTicker: (ticker: string) => `company:ticker:${ticker.toUpperCase()}`,
  companyByCik: (cik: string) => `company:cik:${cik}`,
  companyById: (id: number) => `company:id:${id}`,
  fundById: (id: number) => `fund:id:${id}`,
  fundByCik: (cik: string) => `fund:cik:${cik}`,
  companiesList: () => 'companies:list',
  fundsList: () => 'funds:list',
  fundFilings: (fundId: number) => `fund:${fundId}:filings`,
  fundFiling: (fundId: number, filingId: number) => `fund:${fundId}:filing:${filingId}`,
  companyFilings: (companyId: number) => `company:${companyId}:filings`,
};
