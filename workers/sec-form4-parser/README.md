# SEC Form 4 PARSER Lambda

## Architecture

Lambda déclenchée par **SQS** (1 message = 1 filing) qui :

1. Vérifie l'idempotence (1 query Athena : `status = 'PARSED'`)
2. Si déjà PARSED → skip
3. Sinon : parse le Form 4 XML (SEC API)
4. Écrit dans S3 Parquet :
   - `company_filings` (status = PARSED)
   - `insider_trades` (transactions)

## ⚠️ Cost Safety

- ✅ **1 query Athena par message** (idempotence check)
- ✅ **Rate limiting SEC** : 120ms entre appels
- ✅ **Kill switch** : `ENABLE_SEC_SYNC=false` → arrêt immédiat
- ✅ **Reserved concurrency = 1** (rate limiting strict)
- ✅ **Batch size = 1** (1 message à la fois)

## Configuration

### Variables d'environnement

- `ENABLE_SEC_SYNC` : `true`/`false` (kill switch)
- `ATHENA_DATABASE` : Nom de la base Athena
- `ATHENA_WORK_GROUP` : Nom du workgroup Athena
- `ATHENA_RESULTS_BUCKET` : Bucket S3 pour résultats Athena
- `S3_DATA_LAKE_BUCKET` : Bucket S3 pour data lake Parquet

### Terraform

```hcl
# terraform.tfvars
enable_sec_sync = true
sec_form4_parser_concurrency = 1
```

## Déploiement

```bash
# Installer les dépendances
cd workers/sec-form4-parser
npm install

# Build
npm run bundle

# Déployer Terraform
cd ../../infra/terraform
terraform apply
```

## Monitoring

### Métriques CloudWatch

- `AWS/Lambda/Invocations` : ~10-100/jour (selon nombre de Form 4)
- `AWS/Lambda/Duration` : ~30-60 secondes par message
- `AWS/Lambda/Errors` : 0 (normal)
- `AWS/SQS/ApproximateNumberOfMessagesVisible` : 0-10 (normal)

### Logs

```bash
aws logs tail /aws/lambda/adel-ai-dev-sec-form4-parser --follow
```

## Kill Switch

### Via Terraform

```hcl
enable_sec_sync = false
# ou
sec_form4_parser_concurrency = 0
terraform apply
```

### Via AWS CLI

```bash
# Kill switch Lambda
aws lambda put-function-concurrency \
  --function-name adel-ai-dev-sec-form4-parser \
  --reserved-concurrent-executions 0

# Disable SQS trigger
aws lambda list-event-source-mappings \
  --function-name adel-ai-dev-sec-form4-parser \
  --query 'EventSourceMappings[0].UUID' \
  --output text | xargs -I {} aws lambda update-event-source-mapping \
  --uuid {} --no-enabled
```

## Idempotence

Le PARSER vérifie l'idempotence avant de parser :

```sql
SELECT DISTINCT accession_number
FROM company_filings
WHERE form_type = '4'
  AND status = 'PARSED'
  AND accession_number IN (...)
```

Si l'`accession_number` est déjà PARSED → skip (pas de re-parsing).

## Note : Parsing XML

La fonction `parseForm4XML()` est actuellement simplifiée (retourne un tableau vide).

Pour une implémentation complète, voir :
- `workers/form4-parser/src/index.ts` (parsing XML détaillé)

## Voir aussi

- [Runbook Cost Safety](../sec-form4-discover/RUNBOOK_COST_SAFETY.md)
- [Lambda DISCOVER](../sec-form4-discover/README.md)
