# 📦 Solution au Small File Problem (S3 Parquet)

## Problème

Si on écrit un fichier Parquet pour chaque transaction, on crée des **milliers de tout petits fichiers** :
- ❌ Performance dégradée (Athena doit scanner beaucoup de fichiers)
- ❌ Coûts S3 plus élevés (plus de requêtes LIST)
- ❌ Latence de requêtes augmentée

## Solution : Batch Writing

### Stratégie implémentée

1. **Buffer en mémoire** : Accumuler les transactions avant d'écrire
2. **Flush par taille** : Écrire quand le buffer atteint 50 transactions
3. **Flush par timeout** : Écrire après 30 secondes même si pas plein
4. **Flush à la fin** : Écrire le buffer restant avant de terminer le handler

### Configuration

```typescript
const BUFFER_SIZE = 50;        // Écrire par batch de 50 transactions
const BUFFER_TIMEOUT = 30000;  // Écrire après 30 secondes
```

### Avantages

- ✅ **Moins de fichiers** : 1 fichier pour 50 transactions au lieu de 50 fichiers
- ✅ **Meilleure performance Athena** : Moins de fichiers à scanner
- ✅ **Coûts réduits** : Moins de requêtes S3 LIST
- ✅ **Latence réduite** : Requêtes Athena plus rapides

## Monitoring

### Métrique clé : ApproximateNumberOfMessagesVisible

**Interprétation :**

| Valeur | Signification | Action |
|--------|---------------|--------|
| **0** | ✅ Parfait | Queue vide, système bien calibré |
| **1-50** | ✅ Normal | Traitement en temps réel |
| **50-100** | ⚠️ Attention | Parser un peu lent, mais acceptable |
| **> 100** | ❌ Problème | Parser trop lent ou rate limiting trop restrictif |

### Alarme CloudWatch

Une alarme est configurée pour alerter si `ApproximateNumberOfMessagesVisible > 100`.

**Actions recommandées si alarme déclenchée :**
1. Vérifier les logs du parser (erreurs ?)
2. Augmenter le `BUFFER_SIZE` si nécessaire
3. Vérifier le rate limiting (trop restrictif ?)
4. Augmenter le timeout Lambda si parsing trop long

## Optimisations futures

### 1. Glue Job pour consolidation (optionnel)

Si le problème persiste, créer un Glue Job qui :
- Scanne les petits fichiers Parquet
- Les fusionne en fichiers plus gros (100-500 MB)
- Optimise les partitions

**Coût estimé :** ~$0.44 par DPU-heure (négligeable si mensuel)

### 2. Lambda de consolidation (plus simple)

Créer une Lambda qui :
- S'exécute quotidiennement
- Scanne les fichiers < 1MB dans une partition
- Les fusionne en fichiers plus gros

**Avantage :** Plus simple que Glue, coût similaire

### 3. Écriture directe optimisée

Modifier `write.ts` pour :
- Accumuler les écritures par partition
- Écrire un seul fichier par partition/heure
- Utiliser un cache S3 pour les écritures en cours

## Configuration actuelle

### Buffer Configuration

```typescript
const BUFFER_SIZE = 50;        // Transactions par batch
const BUFFER_TIMEOUT = 30000;  // Timeout en ms (30s)
```

### Taille de fichier attendue

- **50 transactions** × ~500 bytes = **~25 KB par fichier**
- **Acceptable** : Fichiers > 1 MB sont optimaux pour Athena
- **Solution** : Si problème, augmenter `BUFFER_SIZE` à 200-500

### Partitionnement

Les fichiers sont partitionnés par `year/month` :
```
s3://bucket/data/insider_trades/year=2025/month=1/insert_*.parquet
```

**Avantage :** Athena peut scanner uniquement les partitions nécessaires

## Recommandations

1. **Monitorer** `ApproximateNumberOfMessagesVisible` quotidiennement
2. **Ajuster** `BUFFER_SIZE` si nécessaire (50 → 100 → 200)
3. **Créer un Glue Job** seulement si le problème persiste après optimisation
4. **Vérifier les coûts S3** : Si > $10/mois, optimiser davantage

## Dashboard CloudWatch

Un dashboard est créé automatiquement :
- **Queue Depth** : Messages en attente
- **Lambda Metrics** : Invocations, erreurs, durée
- **Queue Activity** : Messages envoyés/reçus/supprimés

**Accès :**
```
AWS Console → CloudWatch → Dashboards → adel-ai-dev-form4-parser-monitoring
```
