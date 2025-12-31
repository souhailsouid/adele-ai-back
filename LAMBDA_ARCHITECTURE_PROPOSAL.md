# Proposition d'Architecture Lambda Séparée

## Problème Actuel
- Une seule Lambda avec timeout de 20s pour toutes les routes
- Routes d'analyse IA qui prennent 15-20s (timeout aléatoire)
- Routes simples qui prennent <1s partagent la même Lambda
- Cold start impacte toutes les routes

## Solution Proposée : Séparation par Responsabilité

### Option 1 : Séparer par Type de Route (RECOMMANDÉ)

#### Lambda 1 : `api-fast` (Routes rapides)
- **Timeout** : 10s
- **Memory** : 256MB
- **Routes** :
  - `/ai/ticker-institutional-analysis` (simple, 1 API call)
  - `/ai/ticker-news-events-analysis` (simple, 2 API calls)
  - Routes non-IA (smart-money, combined-analysis, etc.)

#### Lambda 2 : `api-ai-heavy` (Routes lourdes avec IA)
- **Timeout** : 30s (ou 60s si possible)
- **Memory** : 1024MB (plus de mémoire = CPU plus rapide)
- **Routes** :
  - `/ai/institution-moves-analysis` (complexe, multiple APIs + IA)
  - `/ai/ticker-activity-analysis` (multiple APIs + IA)
  - `/ai/options-flow-analysis` (multiple APIs + IA)
  - `/ai/calendar-summary` (multiple APIs + IA)

#### Lambda 3 : `api-ai-light` (Routes IA simples)
- **Timeout** : 15s
- **Memory** : 512MB
- **Routes** :
  - `/ai/ticker-options-analysis` (modéré)
  - `/ai/financial-juice/*` (simple)

### Option 2 : Séparer par Domaine Métier

#### Lambda 1 : `api-ticker-analysis`
- Toutes les routes `/ai/ticker-*`
- Timeout : 20s, Memory : 512MB

#### Lambda 2 : `api-institution-analysis`
- Routes `/ai/institution-*`
- Timeout : 30s, Memory : 1024MB

#### Lambda 3 : `api-calendar-analysis`
- Routes `/ai/calendar-*`, `/ai/economic-calendar-*`
- Timeout : 20s, Memory : 512MB

#### Lambda 4 : `api-other`
- Routes non-IA (smart-money, combined-analysis, etc.)
- Timeout : 10s, Memory : 256MB

## Avantages de la Séparation

### 1. Optimisation Individuelle
- Chaque Lambda peut avoir son propre timeout/mémoire
- Routes lourdes : plus de mémoire = CPU plus rapide
- Routes simples : moins de mémoire = coûts réduits

### 2. Isolation des Problèmes
- Si une route timeout, elle n'impacte pas les autres
- Cold start isolé par type de route
- Scaling indépendant

### 3. Monitoring Amélioré
- CloudWatch metrics par Lambda
- Plus facile d'identifier les bottlenecks
- Alertes ciblées

### 4. Coûts Optimisés
- Routes simples : moins de mémoire = moins cher
- Routes lourdes : plus de mémoire mais moins d'appels

## Inconvénients

### 1. Complexité de Déploiement
- Plus de fonctions à gérer
- Plus de configurations Terraform
- Plus de monitoring

### 2. Code Dupliqué Potentiel
- Services partagés (supabase, logger, etc.)
- Nécessite une bonne organisation

### 3. Cold Starts Multiples
- Plus de fonctions = plus de cold starts possibles
- Mais isolés par type de route

## Recommandation

**Option 1 (Séparation par Type)** est recommandée car :
- Séparation claire : fast vs heavy
- Routes lourdes peuvent avoir timeout 30-60s
- Routes simples restent rapides
- Meilleure isolation

## Implémentation

### Structure Proposée
```
services/
  api/
    src/
      index.ts (router principal)
      handlers/
        fast-handler.ts (routes rapides)
        ai-heavy-handler.ts (routes IA lourdes)
        ai-light-handler.ts (routes IA simples)
      routes/ (partagé)
      services/ (partagé)
```

### Terraform
- 3-4 Lambda functions avec configurations différentes
- Même API Gateway, routes pointent vers différentes Lambdas
- IAM roles partagés si possible

## Alternative : Optimiser l'Actuelle

Si on garde une seule Lambda :
1. ✅ Timeouts stricts (5-15s) avec retries - DÉJÀ FAIT
2. ✅ Logs de timing détaillés - DÉJÀ FAIT
3. ⚠️ Augmenter timeout Lambda à 30s (si possible)
4. ⚠️ Augmenter mémoire à 1024MB (CPU plus rapide)
5. ⚠️ Utiliser Lambda Provisioned Concurrency (évite cold starts)

## Décision

**Court terme** : Optimiser l'actuelle avec timeouts stricts + logs
**Moyen terme** : Séparer en 2-3 Lambdas (fast + heavy)





