# Filing Retry Handler

Worker Lambda pour re-parser automatiquement les filings 13F en échec.

## Fonctionnalités

- **Détection automatique** : Vérifie les filings avec status `FAILED` ou `DISCOVERED` depuis trop longtemps
- **Re-parsing intelligent** : Re-déclenche le parsing via EventBridge avec délais pour éviter les boucles
- **Limitation** : Traite maximum 50 filings par exécution pour éviter la surcharge

## Configuration

- **Cron** : Toutes les 15 minutes
- **Délai FAILED** : Re-parser les filings `FAILED` après 15 minutes
- **Timeout DISCOVERED** : Re-parser les filings `DISCOVERED` bloqués depuis plus de 30 minutes

## Build

```bash
cd workers/filing-retry-handler
npm install
npm run bundle
```

Le fichier `filing-retry-handler.zip` sera créé pour le déploiement Terraform.

## Déploiement

Le worker est déployé automatiquement via Terraform (`infra/terraform/filing-retry-handler.tf`).
