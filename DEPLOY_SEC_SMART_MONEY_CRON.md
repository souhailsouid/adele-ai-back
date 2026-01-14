# 🚀 Déploiement du CRON pour SEC Smart Money Sync

## Vue d'ensemble

Ce CRON automatise la synchronisation quotidienne des **Form 4** (insider transactions) des top companies.

**Schedule :** Quotidien à **9h UTC** (après les dépôts SEC)

## Architecture

```
EventBridge (Cron) → SQS Queue → Lambda (sec-smart-money-sync)
```

## Étapes de déploiement

### 1. Builder le worker

```bash
cd workers/sec-smart-money-sync
npm install
npm run bundle
```

Cela crée `sec-smart-money-sync.zip` dans le dossier `workers/sec-smart-money-sync/`.

### 2. Déployer avec Terraform

```bash
cd infra/terraform
terraform init
terraform plan  # Vérifier les changements
terraform apply
```

### 3. Vérifier le déploiement

```bash
# Vérifier que la Lambda existe
aws lambda get-function --function-name adel-ai-dev-sec-smart-money-sync

# Vérifier que le cron est configuré
aws events describe-rule --name adel-ai-dev-sec-smart-money-sync-cron
```

## Configuration

### Variables d'environnement

La Lambda utilise automatiquement :
- `AWS_REGION` : Région AWS
- `ATHENA_DATABASE` : Database Athena (adel_ai_dev)
- `ATHENA_WORK_GROUP` : Work group Athena
- `ATHENA_RESULTS_BUCKET` : Bucket S3 pour les résultats Athena
- `S3_DATA_LAKE_BUCKET` : Bucket S3 pour le data lake

### Schedule

Le cron est configuré dans `infra/terraform/sec-smart-money-sync.tf` :

```terraform
schedule_expression = "cron(0 9 * * ? *)"  # 9h UTC tous les jours
```

Pour modifier le schedule, éditez cette ligne et relancez `terraform apply`.

## Monitoring

### Logs CloudWatch

Les logs sont disponibles dans :
```
/aws/lambda/adel-ai-dev-sec-smart-money-sync
```

### Vérifier les exécutions

```bash
# Voir les dernières exécutions
aws logs tail /aws/lambda/adel-ai-dev-sec-smart-money-sync --follow

# Voir les métriques
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=adel-ai-dev-sec-smart-money-sync \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

## Test manuel

Pour tester la Lambda manuellement :

```bash
# Déclencher la Lambda directement
aws lambda invoke \
  --function-name adel-ai-dev-sec-smart-money-sync \
  --payload '{"Records":[{"messageId":"test-123","body":"{}"}]}' \
  response.json

# Voir la réponse
cat response.json
```

## Dépannage

### La Lambda ne se déclenche pas

1. Vérifier que le cron EventBridge est actif :
   ```bash
   aws events describe-rule --name adel-ai-dev-sec-smart-money-sync-cron
   ```

2. Vérifier que SQS reçoit les messages :
   ```bash
   aws sqs get-queue-attributes \
     --queue-url $(aws sqs get-queue-url --queue-name adel-ai-dev-collectors-queue | jq -r .QueueUrl) \
     --attribute-names ApproximateNumberOfMessages
   ```

3. Vérifier que la Lambda est connectée à SQS :
   ```bash
   aws lambda list-event-source-mappings \
     --function-name adel-ai-dev-sec-smart-money-sync
   ```

### Erreurs dans les logs

1. Vérifier les permissions IAM (Athena, S3)
2. Vérifier que les variables d'environnement sont correctes
3. Vérifier que les tables Athena existent

## Coûts estimés

- **Lambda** : ~$0.20 par exécution (15 minutes, 2GB)
- **SQS** : ~$0.40 par million de requêtes
- **Athena** : ~$5 par TB scanné (dépend du volume de données)
- **S3** : Stockage + requêtes (négligeable)

**Total estimé : ~$6-10/mois** (pour une exécution quotidienne)

## Prochaines étapes

1. ✅ CRON quotidien pour Form 4 (insiders-only)
2. 🔄 CRON hebdomadaire pour tracking cross-company (à ajouter si nécessaire)
3. 📊 Dashboard de monitoring (CloudWatch Dashboard)
