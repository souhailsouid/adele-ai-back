# Guide d'Optimisation Lambda - Résolution des Timeouts

## ✅ Optimisations Appliquées

### 1. Timeouts Stricts avec Retries
- **Avant** : Timeouts variables (1-4s), pas de retries
- **Après** : Timeouts stricts (3-5s) avec 1 retry max
- **Impact** : Réduction des échecs dus à la latence réseau

### 2. Logs de Timing Détaillés
- **Ajouté** : Logs à chaque étape (`t0_start`, `t1_after_body_parse`, etc.)
- **Format** : `[TIMING] step_name` avec `total_elapsed_ms` et `step_elapsed_ms`
- **Bénéfice** : Identifier exactement où le temps est perdu

### 3. Fonction Timeout Partagée
- **Avant** : Redéfinie 7 fois dans différents handlers
- **Après** : 1 fonction partagée au niveau module
- **Impact** : Réduction des cold starts

### 4. Timeout Global avec Early Returns
- **Ajouté** : Vérification du temps écoulé à chaque étape
- **Fallback** : Réponse simplifiée si timeout imminent
- **Impact** : Évite les timeouts Lambda

## 📊 Timeouts Configurés

### Route `/ai/institution-moves-analysis`
- Holdings actuels : **5s** (1 retry)
- Holdings historiques : **3s** (1 retry)
- SPY quote : **3s** (1 retry)
- Timeout global : **18s** (marge de 2s)

### Autres Routes
- Timeouts : **2-4s** selon la criticité
- Retries : **0-1** selon l'importance

## 🔍 Logs de Timing

Exemple de logs CloudWatch :
```
[TIMING] t0_start { total_elapsed_ms: 0 }
[TIMING] t1_after_body_parse { total_elapsed_ms: 5, step_elapsed_ms: 5 }
[TIMING] t2_before_holdings_api { total_elapsed_ms: 10, step_elapsed_ms: 5 }
[TIMING] t3_after_holdings_api { total_elapsed_ms: 3500, step_elapsed_ms: 3490 }
[TIMING] t4_before_historical_apis { total_elapsed_ms: 3510, step_elapsed_ms: 10 }
[TIMING] t5_after_historical_apis { total_elapsed_ms: 6500, step_elapsed_ms: 2990 }
[TIMING] t6_before_data_processing { total_elapsed_ms: 6510, step_elapsed_ms: 10 }
[TIMING] t7_before_ai_call { total_elapsed_ms: 12000, step_elapsed_ms: 5490 }
[TIMING] t8_after_ai_call { total_elapsed_ms: 16500, step_elapsed_ms: 4500 }
[TIMING] t9_final_response { total_elapsed_ms: 16510, step_elapsed_ms: 10 }
```

## 🎯 Recommandations

### Option A : Optimiser l'Actuelle (Court Terme)

1. **Augmenter Timeout Lambda** (si possible)
   ```terraform
   timeout = 30  # Au lieu de 20s
   memory_size = 1024  # Plus de mémoire = CPU plus rapide
   ```

2. **Utiliser Provisioned Concurrency** (évite cold starts)
   ```terraform
   provisioned_concurrent_executions = 2
   ```

3. **Timeouts stricts partout** ✅ DÉJÀ FAIT
4. **Logs de timing** ✅ DÉJÀ FAIT

### Option B : Séparer en Plusieurs Lambdas (Moyen Terme)

#### Architecture Proposée

**Lambda 1 : `api-fast`** (Routes rapides)
- Timeout : 10s
- Memory : 256MB
- Routes : `/ai/ticker-institutional-analysis`, `/ai/ticker-news-events-analysis`, routes non-IA

**Lambda 2 : `api-ai-heavy`** (Routes lourdes)
- Timeout : 30-60s
- Memory : 1024MB
- Routes : `/ai/institution-moves-analysis`, `/ai/ticker-activity-analysis`, `/ai/options-flow-analysis`

**Lambda 3 : `api-ai-light`** (Routes IA modérées)
- Timeout : 15s
- Memory : 512MB
- Routes : `/ai/ticker-options-analysis`, `/ai/calendar-summary`

#### Avantages
- ✅ Isolation des problèmes
- ✅ Optimisation individuelle
- ✅ Scaling indépendant
- ✅ Monitoring ciblé

#### Inconvénients
- ❌ Plus de complexité de déploiement
- ❌ Plus de configurations Terraform
- ❌ Cold starts multiples (mais isolés)

## 📈 Métriques à Surveiller

1. **CloudWatch Logs Insights** :
   ```
   fields @timestamp, @message
   | filter @message like /\[TIMING\]/
   | stats avg(step_elapsed_ms) by step
   ```

2. **Lambda Metrics** :
   - Duration (p50, p95, p99)
   - Timeouts
   - Errors
   - Cold starts

3. **API Gateway Metrics** :
   - Latency
   - 5xx errors

## 🚀 Prochaines Étapes

1. **Immédiat** : Déployer les optimisations actuelles
2. **Court terme** : Augmenter timeout/mémoire Lambda
3. **Moyen terme** : Évaluer la séparation si problèmes persistent
4. **Long terme** : Provisioned Concurrency pour routes critiques

## 💡 Bonnes Pratiques Lambda Appliquées

✅ Initialisation au niveau module (pas dans handler)
✅ Services en singleton
✅ Timeouts stricts avec retries
✅ Logs de timing détaillés
✅ Early returns si timeout imminent
✅ Fallback gracieux





