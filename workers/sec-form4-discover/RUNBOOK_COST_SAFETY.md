# 🛡️ Runbook Cost Safety - SEC Form 4 Workflow

## Vue d'ensemble

Ce runbook décrit comment arrêter le workflow SEC Form 4 en **30 secondes** en cas d'urgence (explosion de coûts, erreur de code, etc.).

---

## 🚨 Arrêt d'urgence (30 secondes)

### Option 1 : Kill Switch Global (recommandé)

**Via Terraform** (le plus rapide si tu as accès) :

```bash
cd infra/terraform
# Modifier terraform.tfvars
enable_sec_sync = false
terraform apply
```

**Via AWS Console** (sans Terraform) :

1. **Lambda DISCOVER** :
   - AWS Lambda → `adel-ai-dev-sec-form4-discover`
   - Configuration → Concurrency → Edit
   - Reserved concurrency = **0**

2. **Lambda PARSER** :
   - AWS Lambda → `adel-ai-dev-sec-form4-parser`
   - Configuration → Concurrency → Edit
   - Reserved concurrency = **0**

3. **SQS Event Source Mapping** :
   - Lambda → `adel-ai-dev-sec-form4-parser` → Configuration → Triggers
   - Désactiver le trigger SQS

4. **EventBridge Rule** :
   - EventBridge → Rules → `adel-ai-dev-sec-form4-discover-cron`
   - Disable rule

**Via AWS CLI** (le plus rapide) :

```bash
# Kill switch Lambda DISCOVER
aws lambda put-function-concurrency \
  --function-name adel-ai-dev-sec-form4-discover \
  --reserved-concurrent-executions 0

# Kill switch Lambda PARSER
aws lambda put-function-concurrency \
  --function-name adel-ai-dev-sec-form4-parser \
  --reserved-concurrent-executions 0

# Disable SQS trigger
aws lambda list-event-source-mappings \
  --function-name adel-ai-dev-sec-form4-parser \
  --query 'EventSourceMappings[0].UUID' \
  --output text | xargs -I {} aws lambda update-event-source-mapping \
  --uuid {} --no-enabled

# Disable EventBridge rule
aws events disable-rule --name adel-ai-dev-sec-form4-discover-cron
```

---

## 🧹 Nettoyage après arrêt

### 1. Purger SQS Queue (optionnel)

**⚠️ ATTENTION** : Purger = **perte définitive** des messages en attente.

```bash
# Vérifier la profondeur de la queue
aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-3.amazonaws.com/956633302249/adel-ai-dev-form4-parser-queue \
  --attribute-names ApproximateNumberOfMessages

# Purger (si tu acceptes de perdre le backlog)
aws sqs purge-queue \
  --queue-url https://sqs.eu-west-3.amazonaws.com/956633302249/adel-ai-dev-form4-parser-queue
```

**Quand purger ?**
- ✅ Si la queue contient des messages corrompus/dupliqués
- ✅ Si tu veux repartir clean après correction du code
- ❌ Si tu veux reprendre le traitement plus tard (ne pas purger)

### 2. Vérifier les exécutions en cours

```bash
# Lister les exécutions en cours (CloudWatch Logs)
aws logs tail /aws/lambda/adel-ai-dev-sec-form4-discover --follow
aws logs tail /aws/lambda/adel-ai-dev-sec-form4-parser --follow
```

**Note** : Les exécutions en cours continueront jusqu'à leur timeout (15 min max pour DISCOVER, 5 min pour PARSER).

### 3. Vérifier les coûts

**CloudWatch Metrics** :

```bash
# Lambda invocations (24h)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=adel-ai-dev-sec-form4-discover \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum

# SQS queue depth
aws cloudwatch get-metric-statistics \
  --namespace AWS/SQS \
  --metric-name ApproximateNumberOfMessagesVisible \
  --dimensions Name=QueueName,Value=adel-ai-dev-form4-parser-queue \
  --start-time $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Average
```

**AWS Cost Explorer** :
- Vérifier les coûts S3 (GET requests), Athena (queries), Lambda (invocations)

---

## ⚠️ Ce qu'il ne faut JAMAIS supprimer

### ❌ Ne JAMAIS supprimer :

1. **S3 Data Lake Bucket** (`adel-ai-dev-data-lake`)
   - Contient toutes les données Parquet (companies, company_filings, insider_trades)
   - Suppression = **perte définitive** de toutes les données

2. **S3 Athena Results Bucket** (`adel-ai-dev-athena-results`)
   - Contient les résultats des requêtes Athena
   - Peut être nettoyé via lifecycle policy (7 jours), mais ne pas supprimer le bucket

3. **DynamoDB Tables** (si utilisées)
   - `adel-ai-dev-insiders-cache` (cache des transactions importantes)

4. **CloudWatch Logs**
   - Utiles pour debugging
   - Nettoyage automatique après 14 jours (retention configurée)

### ✅ Peut être supprimé (si nécessaire) :

1. **SQS Messages** (via purge-queue)
   - Messages en attente dans `form4-parser-queue`
   - ⚠️ Perte définitive, mais peut être régénéré par DISCOVER

2. **CloudWatch Logs anciens** (> 14 jours)
   - Nettoyage automatique, mais peut être supprimé manuellement si besoin

---

## 🔄 Réactivation progressive

Après correction du code :

### 1. Vérifier le code

- ✅ Pas d'utilisation de `s3-direct-read.ts`
- ✅ Pas de boucles avec requêtes Athena
- ✅ Dédup batch (WHERE IN (...))
- ✅ Rate limiting SEC (120ms)
- ✅ Throttling Athena (500ms)

### 2. Réactiver progressivement

**Étape 1** : Reserved concurrency = 1 (au lieu de 0)

```bash
aws lambda put-function-concurrency \
  --function-name adel-ai-dev-sec-form4-discover \
  --reserved-concurrent-executions 1

aws lambda put-function-concurrency \
  --function-name adel-ai-dev-sec-form4-parser \
  --reserved-concurrent-executions 1
```

**Étape 2** : Enable SQS trigger

```bash
aws lambda list-event-source-mappings \
  --function-name adel-ai-dev-sec-form4-parser \
  --query 'EventSourceMappings[0].UUID' \
  --output text | xargs -I {} aws lambda update-event-source-mapping \
  --uuid {} --enabled
```

**Étape 3** : Enable EventBridge rule

```bash
aws events enable-rule --name adel-ai-dev-sec-form4-discover-cron
```

**Étape 4** : Monitorer pendant 24h

- CloudWatch Metrics (invocations, errors, duration)
- SQS queue depth
- Budgets AWS (alertes)

---

## 📊 Monitoring continu

### Métriques clés à surveiller

1. **Lambda Invocations** (CloudWatch)
   - DISCOVER : 1/jour (normal)
   - PARSER : ~10-100/jour (selon nombre de Form 4)

2. **SQS Queue Depth**
   - Normal : 0-10 messages
   - ⚠️ Alerte si > 100 messages (backlog)

3. **Athena Queries**
   - DISCOVER : 1 query/jour (batch WHERE IN (...))
   - PARSER : 1 query/message (idempotence check)

4. **S3 GET Requests**
   - Normal : ~100-1000/jour
   - ⚠️ Alerte si > 10,000/jour (explosion)

### Alertes CloudWatch

Créer des alarmes pour :
- SQS queue depth > 100
- Lambda errors > 5 en 5 minutes
- Lambda duration > 10 minutes (DISCOVER) ou 4 minutes (PARSER)

---

## 🐛 Troubleshooting

### Problème : TooManyRequestsException (Athena)

**Cause** : Trop de requêtes Athena en parallèle

**Solution** :
1. Vérifier que le throttling est actif (500ms entre requêtes)
2. Vérifier qu'il n'y a pas de `Promise.all` avec requêtes Athena
3. Réduire la reserved concurrency à 1

### Problème : SQS queue depth qui explose

**Cause** : PARSER trop lent ou erreurs répétées

**Solution** :
1. Vérifier les erreurs dans CloudWatch Logs
2. Augmenter le timeout Lambda si nécessaire
3. Vérifier le rate limiting SEC (120ms)

### Problème : Coûts S3 élevés

**Cause** : Trop de GET requests (peut-être `s3-direct-read.ts` utilisé)

**Solution** :
1. Vérifier qu'aucun code n'utilise `s3-direct-read.ts`
2. Utiliser Athena avec batch queries (WHERE IN (...))
3. Utiliser DynamoDB pour les lookups fréquents

---

## 📚 Références

- [AWS Lambda Reserved Concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html)
- [AWS SQS Purge Queue](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/API_PurgeQueue.html)
- [AWS EventBridge Disable Rule](https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_DisableRule.html)
- [SEC API Rate Limiting](https://www.sec.gov/developer)

---

## ✅ Checklist d'urgence

En cas d'alerte budget ou explosion de coûts :

- [ ] Reserved concurrency → 0 (DISCOVER + PARSER)
- [ ] Disable SQS event source mapping (PARSER)
- [ ] Disable EventBridge rule (DISCOVER)
- [ ] Vérifier CloudWatch Metrics (identifier la source)
- [ ] Analyser CloudWatch Logs (erreurs, boucles)
- [ ] (Optionnel) Purge SQS queue si backlog corrompu
- [ ] Corriger le code
- [ ] Réactiver progressivement (concurrency = 1)
- [ ] Monitorer pendant 24h

---

**Dernière mise à jour** : 2025-01-XX
