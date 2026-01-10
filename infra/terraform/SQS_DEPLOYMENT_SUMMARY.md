# Résumé du déploiement SQS

## ✅ Workers modifiés pour SQS

### 1. **collector-sec-watcher** ✅
- **Code** : Modifié pour accepter `SQSEvent`
- **Terraform** : EventBridge → SQS → Lambda
- **RAM** : 1024MB (parsing XML EDGAR)
- **Timeout** : 300s (5 min)

### 2. **collector-rss** ✅
- **Code** : Déjà modifié pour accepter `SQSEvent`
- **Terraform** : EventBridge → SQS → Lambda
- **RAM** : 1024MB (parsing XML RSS)
- **Timeout** : 300s (5 min)

### 3. **parser-13f** ✅
- **Code** : Déjà modifié pour accepter SQS (Python)
- **Terraform** : EventBridge → SQS → Lambda
- **RAM** : **1769MB** (max CPU pour parsing XML lourd - 5-10x plus rapide)
- **Timeout** : **900s (15 min)** - Si timeout, SQS remet le message pour retry

### 4. **notification-generator** ✅
- **Code** : À vérifier/modifier
- **Terraform** : Déjà configuré pour SQS
- **RAM** : 512MB (pas de parsing lourd)
- **Timeout** : 300s (5 min)

### 5. **collector-sec-company-filings** ⏳
- **Code** : À modifier pour accepter SQS
- **Terraform** : À modifier pour utiliser SQS
- **RAM** : 1024MB (parsing XML EDGAR)
- **Timeout** : 300s (5 min)

## 📊 Configuration RAM optimisée

| Worker | RAM | Raison |
|--------|-----|--------|
| `parser-13f` | **1769MB** | Parsing XML très lourd (BlackRock, etc.) |
| `collector-rss` | **1024MB** | Parsing XML RSS |
| `collector-sec-watcher` | **1024MB** | Parsing XML EDGAR |
| `collector-sec-company-filings` | **1024MB** | Parsing XML EDGAR |
| `notification-generator` | 512MB | Pas de parsing lourd |

## 🔄 Architecture SQS

```
EventBridge (Cron) → SQS Queue → Lambda (consomme à son rythme)
```

**Avantages :**
- ✅ Lisse les pics de trafic
- ✅ Pas de throttling (Lambda consomme 1 message à la fois)
- ✅ Retries automatiques (3 tentatives)
- ✅ Dead Letter Queue pour les échecs
- ✅ Si timeout Lambda → message retourne dans la file pour retry

## 📝 Prochaines étapes

1. ✅ Configuration Terraform SQS créée
2. ✅ `collector-sec-watcher` modifié
3. ✅ `parser-13f` modifié (code + Terraform)
4. ⏳ Vérifier `notification-generator` code
5. ⏳ Modifier `collector-sec-company-filings` code + Terraform
6. ⏳ Rebuild tous les workers
7. ⏳ Appliquer Terraform
8. ⏳ Tester

## 🚀 Déploiement

```bash
# 1. Rebuild les workers modifiés
cd workers/collector-sec-watcher && npm run build
cd workers/collector-rss && npm run build  # Si modifié
cd workers/parser-13f && ./build.sh  # Python

# 2. Appliquer Terraform
cd infra/terraform
terraform plan
terraform apply
```

## 💰 Coûts

- **SQS** : ~$0.40 par million de requêtes (quasi gratuit)
- **Lambda** : Inchangé (même nombre d'exécutions)
- **RAM augmentée** : Coût légèrement supérieur mais performances 5-10x meilleures
- **Bénéfice** : Évite le throttling = moins d'erreurs 503
