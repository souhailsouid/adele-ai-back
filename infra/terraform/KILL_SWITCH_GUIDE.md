# 🛡️ Guide: Kill Switch & Budget Alerts

## Vue d'ensemble

Système de protection multi-niveaux contre les explosions de coûts AWS :

1. **Budgets AWS** : Alertes précoces (50%, 80%, 100%)
2. **Reserved Concurrency Lambda** : Limite d'exécution (1 = normal limité, 0 = arrêt complet)
3. **EventBridge Rules** : Faciles à disable
4. **SQS Event Source Mappings** : Disable les triggers Lambda

---

## 🚨 Kill Switch - Reserved Concurrency

### Principe

Les Lambdas parsers ont une **reserved concurrency** configurable :
- **1** = Fonctionnement normal mais limité (1 exécution à la fois)
- **0** = Arrêt complet (aucune exécution possible)

### Lambdas concernées

**Nouveau workflow SEC Form 4** (recommandé) :
- `sec-form4-discover` → Variable: `sec_form4_discover_concurrency`
- `sec-form4-parser` → Variable: `sec_form4_parser_concurrency`

**Ancien workflow** (à déprécier) :
- `form4-parser` → Variable: `form4_parser_concurrency` ⚠️ DEPRECATED
- `form144-parser` → Variable: `form144_parser_concurrency`
- `sec-smart-money-sync` → Variable: `sec_smart_money_sync_concurrency`
- `parser-13f` → Variable: `parser_13f_concurrency`

### Activation du Kill Switch

**Option 1 : Via Terraform (recommandé)**

Modifier `terraform.tfvars` :

```hcl
# Kill switch complet (arrêt total)
# Nouveau workflow SEC Form 4
sec_form4_discover_concurrency = 0
sec_form4_parser_concurrency = 0

# Ancien workflow (à déprécier)
form4_parser_concurrency = 0
form144_parser_concurrency = 0
sec_smart_money_sync_concurrency = 0
parser_13f_concurrency = 0
```

Puis appliquer :
```bash
cd infra/terraform
terraform apply
```

**Option 2 : Via AWS CLI (rapide, sans Terraform)**

```bash
# Form 4 Parser
aws lambda put-function-concurrency \
  --function-name adel-ai-dev-form4-parser \
  --reserved-concurrent-executions 0

# Form 144 Parser
aws lambda put-function-concurrency \
  --function-name adel-ai-dev-form144-parser \
  --reserved-concurrent-executions 0

# SEC Smart Money Sync
aws lambda put-function-concurrency \
  --function-name adel-ai-dev-sec-smart-money-sync \
  --reserved-concurrent-executions 0

# Parser 13F
aws lambda put-function-concurrency \
  --function-name adel-ai-dev-parser-13f \
  --reserved-concurrent-executions 0
```

**Option 3 : Via AWS Console**

1. AWS Lambda → Fonction
2. Configuration → Concurrency
3. Edit → Reserved concurrency = 0

---

## 📊 Budget Alerts

### Budgets configurés

1. **Budget Total** : $10/mois
   - Alertes à 80% et 100%

2. **Budget S3** : $5/mois (baissé pour détection rapide)
   - Alertes à 50%, 80%, 100%
   - Détecte rapidement les explosions de stockage ET requêtes

3. **Budget S3 Requests** : $2/mois (nouveau)
   - Alertes à 50%, 80%, 100%
   - Détection ultra-rapide des explosions de requêtes GET/LIST
   - Cible les 43M+ requêtes qui ont causé $18/jour

4. **Budget Athena** : $20/mois
   - Alertes à 80%

### Emails d'alerte

Configurés dans `terraform.tfvars` :
```hcl
budget_alert_emails = ["souhailsouidpro@gmail.com"]
```

---

## 🔧 Autres Kill Switches

### EventBridge Rules (CRONs)

Désactiver un CRON :
```bash
aws events disable-rule --name adel-ai-dev-sec-smart-money-sync-cron
```

Ou via Terraform :
```hcl
resource "aws_cloudwatch_event_rule" "sec_smart_money_sync_cron" {
  state = "DISABLED"
}
```

### SQS Event Source Mappings (Triggers Lambda)

Désactiver un trigger SQS :
```bash
# Lister les mappings
aws lambda list-event-source-mappings --function-name adel-ai-dev-form4-parser

# Désactiver
aws lambda update-event-source-mapping \
  --uuid <mapping-uuid> \
  --no-enabled
```

Ou via Terraform :
```hcl
resource "aws_lambda_event_source_mapping" "form4_parser_sqs" {
  enabled = false
}
```

---

## 🎯 Stratégie de Protection

### Niveau 1 : Prévention (Normal)

- Reserved concurrency = 1 (limite naturelle)
- EventBridge rules actives
- SQS triggers actifs
- Budgets configurés avec alertes précoces

### Niveau 2 : Alerte (Budget déclenché)

1. **Reçu email d'alerte budget** (50% ou 80%)
2. **Vérifier CloudWatch Metrics** :
   - Lambda invocations
   - SQS queue depth
   - S3 requests (GET/LIST)
   - Athena queries
3. **Identifier la source** via le dashboard admin (`/admin/aws/infrastructure`)

### Niveau 3 : Kill Switch (Urgence)

Si le budget continue d'augmenter rapidement :

1. **Reserved concurrency → 0** (arrêt immédiat des Lambdas)
2. **Disable EventBridge rules** (arrêter les CRONs)
3. **Disable SQS triggers** (arrêter le traitement des queues)
4. **Purge SQS queues** (optionnel, si backlog important)

### Niveau 4 : Investigation

Après kill switch :
1. Analyser CloudWatch Logs
2. Identifier le code responsable (s3-direct-read, boucle infinie, etc.)
3. Corriger le code
4. Réactiver progressivement (concurrency = 1, puis monitoring)

---

## 📝 Checklist d'Urgence

En cas d'alerte budget :

- [ ] Vérifier dashboard admin : `/admin/aws/infrastructure`
- [ ] Identifier Lambda/SQS/Athena responsable
- [ ] Reserved concurrency → 0 pour Lambda concernée
- [ ] Disable EventBridge rules si CRON responsable
- [ ] Disable SQS event source mapping si queue responsable
- [ ] Purge SQS queue si backlog important
- [ ] Analyser CloudWatch Logs pour cause racine
- [ ] Corriger le code
- [ ] Réactiver progressivement (concurrency = 1)

---

## 🔍 Monitoring

### Dashboard Admin

Endpoints disponibles :
- `GET /admin/aws/infrastructure` → Vue d'ensemble
- `GET /admin/aws/lambdas` → Statut des Lambdas
- `GET /admin/aws/lambdas/{functionName}/metrics` → Métriques détaillées
- `GET /admin/aws/sqs/queues` → Statut des queues SQS
- `GET /admin/aws/athena` → Statut Athena
- `GET /admin/aws/budgets` → Statut des budgets

### CloudWatch Metrics

Métriques clés à surveiller :
- `AWS/Lambda/Invocations` (par fonction)
- `AWS/Lambda/Errors` (par fonction)
- `AWS/SQS/ApproximateNumberOfMessagesVisible` (par queue)
- `AWS/S3/NumberOfObjects` (par bucket)
- `AWS/Athena/QueryExecutionTime` (par workgroup)

---

## ⚠️ Notes Importantes

1. **Budgets = Alertes uniquement** : Ils n'arrêtent pas automatiquement les services
2. **Reserved concurrency = 0** : Empêche les nouvelles exécutions, mais les exécutions en cours continuent
3. **SQS backlog** : Même avec concurrency = 0, les messages restent en queue (purge si nécessaire)
4. **Athena Workgroup** : Peut être désactivé via Terraform (`state = "DISABLED"`)

---

## 🚀 Réactivation Progressive

Après correction du code :

1. **Concurrency = 1** (limite naturelle)
2. **Enable EventBridge rules** (si CRON nécessaire)
3. **Enable SQS triggers** (si queue nécessaire)
4. **Monitorer pendant 24h** via dashboard admin
5. **Augmenter progressivement** si tout est stable

---

## 📚 Références

- [AWS Lambda Reserved Concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html)
- [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
- [S3 Request Pricing](https://aws.amazon.com/s3/pricing/)
