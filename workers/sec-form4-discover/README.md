# SEC Form 4 DISCOVER Lambda

## Architecture

Lambda déclenchée par **EventBridge (cron quotidien)** qui :

1. Récupère la whitelist de CIKs depuis `COMPANY_CIKS_JSON` (env var)
2. Pour chaque CIK : appelle SEC submissions API
3. Extrait les Form 4 récents (max 20 par CIK)
4. **Dédup en 1 SEULE requête Athena batch** (WHERE IN (...))
5. Push dans SQS `form4-parser-queue` (1 message = 1 filing)

## ⚠️ Cost Safety

- ✅ **1 seule requête Athena** (batch WHERE IN (...))
- ✅ **Rate limiting SEC** : 120ms entre appels (8.3 req/s)
- ✅ **Kill switch** : `ENABLE_SEC_SYNC=false` → arrêt immédiat
- ✅ **Reserved concurrency = 1** (limite naturelle)
- ✅ **EventBridge → Lambda direct** (pas via SQS pour éviter duplication)

## Configuration

### Variables d'environnement

- `ENABLE_SEC_SYNC` : `true`/`false` (kill switch)
- `COMPANY_CIKS_JSON` : JSON array de CIKs (ex: `["0000320193", "0000789019"]`)
- `ATHENA_DATABASE` : Nom de la base Athena
- `ATHENA_WORK_GROUP` : Nom du workgroup Athena
- `ATHENA_RESULTS_BUCKET` : Bucket S3 pour résultats Athena
- `FORM4_PARSER_QUEUE_URL` : URL de la queue SQS form4-parser

### Terraform

```hcl
# terraform.tfvars
enable_sec_sync = true
company_ciks_json = "[\"0000320193\", \"0000789019\"]"  # Apple, Microsoft
sec_form4_discover_concurrency = 1
```

## Déploiement

```bash
# Installer les dépendances
cd workers/sec-form4-discover
npm install

# Build
npm run bundle

# Déployer Terraform
cd ../../infra/terraform
terraform apply
```

## Monitoring

### Métriques CloudWatch

- `AWS/Lambda/Invocations` : 1/jour (normal)
- `AWS/Lambda/Duration` : ~5-10 minutes (selon nombre de CIKs)
- `AWS/Lambda/Errors` : 0 (normal)

### Logs

```bash
aws logs tail /aws/lambda/adel-ai-dev-sec-form4-discover --follow
```

## Kill Switch

### Via Terraform

```hcl
enable_sec_sync = false
terraform apply
```

### Via AWS CLI

```bash
aws lambda put-function-concurrency \
  --function-name adel-ai-dev-sec-form4-discover \
  --reserved-concurrent-executions 0
```

## Voir aussi

- [Runbook Cost Safety](./RUNBOOK_COST_SAFETY.md)
- [Lambda PARSER](../sec-form4-parser/README.md)
