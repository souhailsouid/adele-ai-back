# 🚀 Déploiement Complet SEC Smart Money

## ✅ Prérequis vérifiés

- ✅ `sec-smart-money-sync.zip` créé
- ✅ `form4-parser.zip` créé
- ✅ Configuration Terraform prête

## 📋 Étapes de déploiement

### 1. Vérifier les fichiers zip

```bash
ls -lh workers/sec-smart-money-sync/*.zip
ls -lh workers/form4-parser/*.zip
```

Les deux fichiers doivent exister et avoir une taille > 0.

### 2. Initialiser Terraform (si nécessaire)

```bash
cd infra/terraform
terraform init
```

### 3. Vérifier les changements

```bash
terraform plan
```

Vous devriez voir :
- ✅ Création de `aws_sqs_queue.form4_parser_queue`
- ✅ Création de `aws_lambda_function.sec_smart_money_sync`
- ✅ Création de `aws_lambda_function.form4_parser`
- ✅ Création de `aws_cloudwatch_event_rule.sec_smart_money_sync_cron` (05h15 UTC)
- ✅ Création de `aws_cloudwatch_event_rule.sec_smart_money_track_insiders_cron` (Dimanche 22h UTC)

### 4. Déployer

```bash
terraform apply
```

Confirmer avec `yes` quand demandé.

### 5. Vérifier le déploiement

```bash
# Vérifier les Lambdas
aws lambda get-function --function-name adel-ai-dev-sec-smart-money-sync
aws lambda get-function --function-name adel-ai-dev-form4-parser

# Vérifier les crons
aws events describe-rule --name adel-ai-dev-sec-smart-money-sync-cron
aws events describe-rule --name adel-ai-dev-sec-smart-money-track-insiders-cron

# Vérifier la queue SQS
aws sqs get-queue-url --queue-name adel-ai-dev-form4-parser
```

## 📊 Configuration finale

### Crons configurés

| CRON | Schedule | Mode | Fonction |
|------|----------|------|----------|
| **Form 4** | `cron(15 5 * * ? *)` | `insiders-only` | Quotidien à 05h15 UTC |
| **Cross-Company** | `cron(0 22 ? * SUN *)` | `track-insiders` | Dimanche 22h UTC |

### Architecture

```
EventBridge (Cron 05h15 UTC)
  → SQS (collectors_queue)
    → Lambda (sec-smart-money-sync)
      → Découvre Form 4
        → SQS (form4-parser-queue)
          → Lambda (form4-parser)
            → Parse avec rate limiting (10 req/s)
              → S3 Parquet (insider_trades)
```

## 🧪 Test manuel

### Tester le worker principal

```bash
aws lambda invoke \
  --function-name adel-ai-dev-sec-smart-money-sync \
  --payload '{"Records":[{"messageId":"test-123","body":"{\"mode\":\"insiders-only\"}"}]}' \
  response.json

cat response.json
```

### Tester le parser

```bash
aws lambda invoke \
  --function-name adel-ai-dev-form4-parser \
  --payload '{"Records":[{"messageId":"test-456","body":"{\"companyId\":1,\"filingId\":1,\"accessionNumber\":\"0001234567-25-000001\",\"cik\":\"0001234567\",\"primaryDocument\":\"xslF345X05/form4.xml\"}"}]}' \
  response.json

cat response.json
```

## 📈 Monitoring

### Logs CloudWatch

```bash
# Logs du worker principal
aws logs tail /aws/lambda/adel-ai-dev-sec-smart-money-sync --follow

# Logs du parser
aws logs tail /aws/lambda/adel-ai-dev-form4-parser --follow
```

### Métriques SQS

```bash
# Vérifier la profondeur de la queue
aws sqs get-queue-attributes \
  --queue-url $(aws sqs get-queue-url --queue-name adel-ai-dev-form4-parser | jq -r .QueueUrl) \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible
```

## ⚠️ Points d'attention

1. **Rate Limiting** : Le parser respecte strictement 10 req/s (100ms entre requêtes)
2. **Week-end** : Le cron tourne mais ne trouvera généralement rien (normal)
3. **Lundi** : Delta processing gère automatiquement (pas de nouveaux dépôts depuis vendredi)
4. **If-Modified-Since** : Évite les requêtes inutiles (304 Not Modified)

## 🎯 Prochaines étapes

1. ✅ Déployer avec `terraform apply`
2. ⏳ Attendre le premier cron (05h15 UTC)
3. 📊 Vérifier les logs CloudWatch
4. 🔍 Vérifier que les données sont insérées dans S3 Parquet
