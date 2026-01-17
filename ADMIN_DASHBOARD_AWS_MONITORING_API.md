# 📊 API Dashboard Admin - Monitoring AWS

## Vue d'ensemble

Nouvelles routes API pour surveiller l'infrastructure AWS depuis le dashboard admin, remplaçant les scripts de vérification manuels.

## 🔗 Endpoints Disponibles

### 1. Infrastructure Complète
**GET** `/admin/aws/infrastructure`

Retourne un résumé complet de l'infrastructure AWS :
- Liste des Lambdas avec leur statut
- Liste des queues SQS avec nombre de messages
- Métriques Lambda (24h)
- Statut Athena
- Budgets AWS
- Résumé global

**Exemple de réponse :**
```json
{
  "lambdas": [
    {
      "function_name": "adel-ai-dev-form4-parser",
      "state": "Active",
      "reserved_concurrent_executions": 0,
      "last_modified": "2026-01-17T10:00:00Z",
      "timeout": 300,
      "memory_size": 1024
    }
  ],
  "sqs_queues": [
    {
      "queue_name": "adel-ai-dev-form4-parser",
      "approximate_number_of_messages": 0,
      "approximate_number_of_messages_not_visible": 0,
      "approximate_number_of_messages_delayed": 0,
      "visibility_timeout": 300,
      "message_retention_period": 86400
    }
  ],
  "lambda_metrics": [
    {
      "function_name": "adel-ai-dev-form4-parser",
      "invocations_24h": 0,
      "errors_24h": 0,
      "duration_avg_ms": 0,
      "throttles_24h": 0
    }
  ],
  "athena": {
    "workgroup_name": "adel-ai-dev-workgroup",
    "state": "DISABLED",
    "queries_24h": 0,
    "data_scanned_gb_24h": 0
  },
  "budgets": [
    {
      "budget_name": "adel-ai-dev-cost-budget",
      "budget_limit": 100,
      "actual_spend": 62.85,
      "forecasted_spend": 80,
      "time_unit": "MONTHLY",
      "threshold_percentage": 80
    }
  ],
  "summary": {
    "total_lambdas": 10,
    "active_lambdas": 8,
    "total_queues": 5,
    "queues_with_messages": 0,
    "total_dlq_messages": 8,
    "athena_enabled": false
  }
}
```

### 2. Liste des Lambdas
**GET** `/admin/aws/lambdas`

Retourne la liste de toutes les Lambdas du projet avec leur statut.

### 3. Métriques d'une Lambda
**GET** `/admin/aws/lambdas/{functionName}/metrics`

Retourne les métriques d'une Lambda spécifique (24h) :
- Invocations
- Erreurs
- Durée moyenne
- Throttles

**Exemple :**
```
GET /admin/aws/lambdas/adel-ai-dev-form4-parser/metrics
```

### 4. Liste des Queues SQS
**GET** `/admin/aws/sqs/queues`

Retourne la liste de toutes les queues SQS avec :
- Nombre de messages en attente
- Messages en cours de traitement
- Messages retardés
- Configuration (timeout, retention)

### 5. Statut Athena
**GET** `/admin/aws/athena`

Retourne le statut du workgroup Athena :
- État (ENABLED/DISABLED)
- Nombre de requêtes (24h)
- Données scannées (24h)

### 6. Budgets AWS
**GET** `/admin/aws/budgets`

Retourne la liste des budgets AWS configurés avec :
- Limite du budget
- Dépenses actuelles
- Dépenses prévisionnelles
- Seuils d'alerte

## 🔧 Configuration Requise

### Variables d'environnement

Les variables suivantes doivent être configurées dans la Lambda API :

```bash
PROJECT=adel-ai          # Ou VAR_PROJECT
STAGE=dev                # Ou VAR_STAGE
AWS_REGION=eu-west-3
AWS_ACCOUNT_ID=956633302249  # Optionnel
```

### Permissions IAM

Les permissions suivantes ont été ajoutées dans `infra/terraform/iam.tf` :

- **Lambda Monitoring** : `lambda:ListFunctions`, `lambda:GetFunction`, `lambda:GetFunctionConcurrency`
- **SQS Monitoring** : `sqs:ListQueues`, `sqs:GetQueueAttributes`, `sqs:ReceiveMessage`
- **CloudWatch Monitoring** : `cloudwatch:GetMetricStatistics`, `cloudwatch:ListMetrics`
- **Athena Monitoring** : `athena:GetWorkGroup`, `athena:ListWorkGroups`
- **Budgets Monitoring** : `budgets:DescribeBudget`, `budgets:DescribeBudgets`

## 📋 Utilisation

### Exemple avec curl

```bash
# Infrastructure complète
curl https://your-api-url/admin/aws/infrastructure

# Liste des Lambdas
curl https://your-api-url/admin/aws/lambdas

# Métriques d'une Lambda
curl https://your-api-url/admin/aws/lambdas/adel-ai-dev-form4-parser/metrics

# Queues SQS
curl https://your-api-url/admin/aws/sqs/queues

# Statut Athena
curl https://your-api-url/admin/aws/athena

# Budgets
curl https://your-api-url/admin/aws/budgets
```

### Exemple avec fetch (Frontend)

```typescript
// Infrastructure complète
const response = await fetch('/admin/aws/infrastructure');
const data = await response.json();

console.log(`Total Lambdas: ${data.summary.total_lambdas}`);
console.log(`Queues avec messages: ${data.summary.queues_with_messages}`);
console.log(`Messages DLQ: ${data.summary.total_dlq_messages}`);
console.log(`Athena enabled: ${data.summary.athena_enabled}`);
```

## 🚀 Déploiement

1. **Ajouter les permissions IAM** (déjà fait dans `iam.tf`)
2. **Rebuild l'API** :
   ```bash
   cd services/api
   npm run build
   npm run bundle
   ```
3. **Déployer Terraform** :
   ```bash
   cd infra/terraform
   terraform plan
   terraform apply
   ```

## 📊 Dashboard Frontend

Ces endpoints peuvent être utilisés pour créer un dashboard admin avec :

- **Vue d'ensemble** : Résumé de l'infrastructure
- **Lambdas** : Liste avec métriques en temps réel
- **Queues SQS** : Monitoring des messages
- **Athena** : Statut et utilisation
- **Budgets** : Suivi des coûts

## ⚠️ Notes

- Les métriques sont calculées sur les **24 dernières heures**
- Les budgets AWS nécessitent l'API dans la région **us-east-1**
- Les permissions IAM sont limitées aux ressources du projet (`${project}-${stage}-*`)
