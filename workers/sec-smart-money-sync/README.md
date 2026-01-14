# SEC Smart Money Sync Worker

Lambda pour synchroniser automatiquement les Form 4 (insider transactions) des top companies.

## Build

```bash
cd workers/sec-smart-money-sync
npm install
npm run bundle
```

Cela crée `sec-smart-money-sync.zip` dans le dossier `workers/sec-smart-money-sync/`.

## Déploiement

Le déploiement se fait via Terraform :

```bash
cd infra/terraform
terraform apply
```

## Schedule

Le cron est configuré pour s'exécuter **quotidiennement à 9h UTC** (après les dépôts SEC).

## Configuration

Le worker utilise les variables d'environnement suivantes :
- `AWS_REGION` : Région AWS (par défaut: eu-west-3)
- `ATHENA_DATABASE` : Database Athena (par défaut: adel_ai_dev)
- `ATHENA_WORK_GROUP` : Work group Athena (par défaut: adel-ai-dev-workgroup)
- `ATHENA_RESULTS_BUCKET` : Bucket S3 pour les résultats Athena
- `S3_DATA_LAKE_BUCKET` : Bucket S3 pour le data lake

## Logs

Les logs sont disponibles dans CloudWatch :
```
/aws/lambda/adel-ai-dev-sec-smart-money-sync
```
