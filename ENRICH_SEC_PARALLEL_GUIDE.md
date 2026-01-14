# Guide : Enrichissement SEC en parallèle

## 🚀 Traitement parallèle pour accélérer

Le script `enrich_companies_from_sec_parallel.ts` permet de diviser le travail entre plusieurs terminaux pour traiter plus rapidement.

## ⚠️ Attention au Rate Limiting

L'API SEC a des limites de débit. Avec 2 workers en parallèle :
- **Risque** : Doubler le débit peut déclencher des erreurs 429 (Too Many Requests)
- **Solution** : Le script gère automatiquement les retries, mais il est recommandé de ne pas dépasser **2-3 workers** simultanés

## 📋 Utilisation avec 2 terminaux

### Étape 1 : Calculer la division

Pour 690 entreprises restantes (1000 - 310 déjà traitées) :
- Worker 1 : entreprises 1 à 345
- Worker 2 : entreprises 346 à 690

### Étape 2 : Lancer les 2 workers

**Terminal 1** :
```bash
npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=2 --worker-id=1 --start-from=0000063755
```

**Terminal 2** :
```bash
npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=2 --worker-id=2 --start-from=0000063755
```

## 📊 Comment ça fonctionne

### Division du travail

Le script divise automatiquement les entreprises en plages égales :

```
Total: 690 entreprises
Workers: 2

Worker 1: entreprises 1-345   (345 entreprises)
Worker 2: entreprises 346-690 (345 entreprises)
```

### Détection des entreprises enrichies

Chaque worker :
1. Charge toutes les entreprises
2. Filtre celles déjà enrichies (EIN ou ≥10 filings)
3. Divise le reste entre les workers
4. Traite uniquement sa plage assignée

### Sécurité

- ✅ Chaque worker traite des entreprises différentes (pas de doublons)
- ✅ Les doublons de filings sont évités (accession_number unique)
- ✅ Les entreprises déjà enrichies sont automatiquement skipées
- ✅ Rate limiting respecté (200ms par requête)

## 🎯 Exemples d'utilisation

### 2 Workers (recommandé)

```bash
# Terminal 1
npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=2 --worker-id=1

# Terminal 2
npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=2 --worker-id=2
```

### 3 Workers (plus risqué pour rate limiting)

```bash
# Terminal 1
npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=3 --worker-id=1

# Terminal 2
npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=3 --worker-id=2

# Terminal 3
npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=3 --worker-id=3
```

### Avec limite et reprise

```bash
# Terminal 1 : 200 premières entreprises non enrichies
npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=2 --worker-id=1 --limit=200

# Terminal 2 : 200 suivantes
npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=2 --worker-id=2 --limit=200
```

## ⏱️ Estimation de temps

### Séquentiel (1 worker)
- 690 entreprises × 0.2s = **~2.3 minutes** de rate limiting
- + temps API (~0.5s par requête) = **~6-7 minutes** total

### Parallèle (2 workers)
- 345 entreprises × 0.2s = **~1.15 minutes** de rate limiting par worker
- + temps API = **~3-4 minutes** total (2x plus rapide)

## 🔍 Monitoring

Pour suivre la progression des deux workers :

```bash
# Dans un 3ème terminal
npx tsx scripts/monitor_enrichment_progress.ts
```

Ou directement dans Supabase :

```sql
-- Voir les entreprises enrichies par worker
SELECT 
  c.ticker, 
  c.name, 
  c.ein, 
  COUNT(cf.id) as filings_count,
  c.updated_at
FROM companies c
LEFT JOIN company_filings cf ON cf.cik = c.cik
WHERE c.ein IS NOT NULL
GROUP BY c.id, c.ticker, c.name, c.ein, c.updated_at
ORDER BY c.updated_at DESC
LIMIT 20;
```

## ⚠️ Recommandations

1. **Ne pas dépasser 2-3 workers** pour éviter les rate limits
2. **Surveiller les erreurs 429** dans les logs
3. **Utiliser `--start-from`** pour reprendre après interruption
4. **Laisser tourner** : les workers sont indépendants et peuvent être arrêtés/repris séparément

## 🐛 Dépannage

### Erreurs 429 fréquentes

Si tu vois beaucoup d'erreurs 429, réduis le nombre de workers ou augmente `RATE_LIMIT_MS` dans le script.

### Workers qui traitent les mêmes entreprises

Cela ne devrait pas arriver car chaque worker a sa plage assignée. Si c'est le cas, vérifie que les `--worker-id` sont différents.

### Reprendre après interruption

Chaque worker peut être repris indépendamment :

```bash
# Worker 1 reprend depuis un CIK
npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=2 --worker-id=1 --start-from=0000065000

# Worker 2 reprend depuis un autre CIK
npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=2 --worker-id=2 --start-from=0000070000
```
