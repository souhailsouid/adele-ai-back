# ✅ Checklist de Déploiement SEC Smart Money

## Prérequis

- [x] `sec-smart-money-sync.zip` créé (5.0K)
- [x] `form4-parser.zip` créé (3.2K)
- [x] Configuration Terraform prête

## Étapes de déploiement

### 1. Vérifier les fichiers zip

```bash
ls -lh workers/sec-smart-money-sync/*.zip
ls -lh workers/form4-parser/*.zip
```

✅ **Résultat attendu :**
- `sec-smart-money-sync.zip` : ~5KB
- `form4-parser.zip` : ~3KB

### 2. Plan Terraform

```bash
cd infra/terraform
terraform plan
```

**Ressources à créer :**
- ✅ `aws_sqs_queue.form4_parser_queue`
- ✅ `aws_sqs_queue.form4_parser_dlq`
- ✅ `aws_lambda_function.sec_smart_money_sync`
- ✅ `aws_lambda_function.form4_parser`
- ✅ `aws_cloudwatch_event_rule.sec_smart_money_sync_cron` (05h15 UTC)
- ✅ `aws_cloudwatch_event_rule.sec_smart_money_track_insiders_cron` (Dimanche 22h UTC)
- ✅ `aws_cloudwatch_event_target.sec_smart_money_sync`
- ✅ `aws_cloudwatch_event_target.sec_smart_money_track_insiders`
- ✅ `aws_lambda_event_source_mapping.sec_smart_money_sync_sqs`
- ✅ `aws_lambda_event_source_mapping.form4_parser_sqs`
- ✅ `aws_sqs_queue_policy.form4_parser_queue_policy`
- ✅ `aws_iam_role_policy.collectors_sqs_send`

### 3. Déployer

```bash
terraform apply
```

Confirmer avec `yes` quand demandé.

### 4. Vérifier le déploiement

```bash
# Vérifier les Lambdas
aws lambda get-function --function-name adel-ai-dev-sec-smart-money-sync --query 'Configuration.[FunctionName,LastModified,Runtime,Timeout,MemorySize]'
aws lambda get-function --function-name adel-ai-dev-form4-parser --query 'Configuration.[FunctionName,LastModified,Runtime,Timeout,MemorySize]'

# Vérifier les crons
aws events describe-rule --name adel-ai-dev-sec-smart-money-sync-cron --query 'ScheduleExpression'
aws events describe-rule --name adel-ai-dev-sec-smart-money-track-insiders-cron --query 'ScheduleExpression'

# Vérifier la queue SQS
aws sqs get-queue-url --queue-name adel-ai-dev-form4-parser --query 'QueueUrl'
```

### 5. Test manuel (optionnel)

```bash
# Tester le worker principal
aws lambda invoke \
  --function-name adel-ai-dev-sec-smart-money-sync \
  --payload '{"Records":[{"messageId":"test-123","body":"{\"mode\":\"insiders-only\"}"}]}' \
  /tmp/response.json && cat /tmp/response.json

# Vérifier les logs
aws logs tail /aws/lambda/adel-ai-dev-sec-smart-money-sync --since 5m
```

## Configuration finale

### Crons

| CRON | Schedule | Mode | Fonction |
|------|----------|------|----------|
| **Form 4** | `cron(15 5 * * ? *)` | `insiders-only` | Quotidien à 05h15 UTC |
| **Cross-Company** | `cron(0 22 ? * SUN *)` | `track-insiders` | Dimanche 22h UTC |

### Architecture

```
EventBridge (05h15 UTC)
  → SQS (collectors_queue)
    → Lambda (sec-smart-money-sync)
      → Découvre Form 4 (delta processing)
        → SQS (form4-parser-queue)
          → Lambda (form4-parser)
            → Parse avec rate limiting (10 req/s)
              → S3 Parquet (insider_trades)
```

## Prochaines exécutions

- **Premier cron Form 4** : Demain à 05h15 UTC
- **Premier cron Cross-Company** : Prochain dimanche à 22h UTC

## Monitoring

### Logs CloudWatch

```bash
# Suivre les logs en temps réel
aws logs tail /aws/lambda/adel-ai-dev-sec-smart-money-sync --follow
aws logs tail /aws/lambda/adel-ai-dev-form4-parser --follow
```

### Métriques SQS

```bash
# Profondeur de la queue
aws sqs get-queue-attributes \
  --queue-url $(aws sqs get-queue-url --queue-name adel-ai-dev-form4-parser | jq -r .QueueUrl) \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
  | jq '.Attributes'
```

## ✅ Checklist post-déploiement

- [ ] Vérifier que les Lambdas sont créées
- [ ] Vérifier que les crons sont configurés
- [ ] Vérifier que la queue SQS existe
- [ ] Tester manuellement (optionnel)
- [ ] Vérifier les logs après le premier cron
