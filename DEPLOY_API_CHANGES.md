# 🚀 Déploiement des changements API

## 📋 Étapes de déploiement

### 1. Bundler l'API

```bash
cd /Users/souhailsouid/startup/personamy/backend/services/api
npm run bundle
```

Cette commande :
- ✅ Build le code TypeScript avec esbuild (`npm run build`)
- ✅ Crée le fichier `api.zip` (`npm run zip`)
- ✅ Terraform détectera automatiquement les changements via `source_code_hash`

### 2. Déployer avec Terraform

```bash
cd /Users/souhailsouid/startup/personamy/backend/infra/terraform
terraform plan  # Vérifier les changements
terraform apply  # Déployer
```

Terraform va :
- ✅ Détecter le nouveau `api.zip` (via `source_code_hash`)
- ✅ Mettre à jour la Lambda `adel-ai-dev-api`
- ✅ Les changements seront actifs immédiatement

## ⚡ Commande rapide (tout-en-un)

```bash
cd /Users/souhailsouid/startup/personamy/backend

# Bundler
cd services/api && npm run bundle && cd ../..

# Déployer
cd infra/terraform && terraform apply
```

## ✅ Vérification

Après le déploiement, testez les endpoints :

```bash
# Vérifier les diffs (avec fallback automatique)
curl "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/funds/32/diffs?limit=10"

# Vérifier les changes (avec support du paramètre days)
curl "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/funds/32/changes?min_change_pct=10&days=30"
```

## 📝 Notes

- ⚠️ **Temps de déploiement** : ~2-3 minutes (upload du zip + mise à jour Lambda)
- ✅ **Pas de downtime** : La Lambda est mise à jour sans interruption
- ✅ **Rollback** : Si problème, vous pouvez revenir à l'ancienne version avec `terraform apply` d'un commit précédent
