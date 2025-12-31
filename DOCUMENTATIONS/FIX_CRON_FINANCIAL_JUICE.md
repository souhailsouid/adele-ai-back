# 🔧 Correction : Cron Job Financial Juice

## ✅ Bonne Nouvelle

**Le test local fonctionne !** ✅

Le feed Financial Juice est accessible et retourne 100 items. Le problème est au niveau du déploiement/cron.

---

## 🔍 Diagnostic

### Problème 1 : Lambda Non Trouvée

```
Function not found: arn:aws:lambda:eu-west-3:956633302249:function:adel-prod-collector-rss
```

**Cause** : Le nom de la Lambda était incorrect. Le vrai nom est `adel-ai-dev-collector-rss`.

**Solution** : Utiliser le bon nom

```bash
# Trouver le nom exact depuis Terraform
cd infra/terraform
terraform output collector_rss_url
# Retourne: "adel-ai-dev-collector-rss"

# Ou utiliser le script qui le détecte automatiquement
./scripts/check-cron-rss.sh
```

---

### Problème 2 : Log Group N'existe Pas

```
The specified log group does not exist: /aws/lambda/adel-prod-collector-rss
```

**Cause** : La Lambda n'a jamais été invoquée ou le nom est différent.

**Solution** : Vérifier les log groups existants

```bash
aws logs describe-log-groups --query 'logGroups[?contains(logGroupName, `rss`)].logGroupName'
```

---

## ✅ Test Local Réussi

Le test local montre que :
- ✅ Financial Juice est accessible (100 items)
- ✅ Le parsing fonctionne
- ✅ 5 signaux existent déjà en base
- ✅ La déduplication fonctionne

**Conclusion** : Le code fonctionne, le problème est le déploiement.

---

## 🔧 Solutions

### Solution 1 : Vérifier le Nom de la Lambda

```bash
# Trouver le vrai nom depuis Terraform (recommandé)
cd infra/terraform
terraform output collector_rss_url
# Retourne: "adel-ai-dev-collector-rss"

# Ou utiliser le script qui le détecte automatiquement
./scripts/check-cron-rss.sh
```

---

### Solution 2 : Redéployer la Lambda

```bash
# 1. Rebuild le collector RSS
cd workers/collector-rss
npm run build
npm run package

# 2. Redéployer avec Terraform
cd ../../infra/terraform
terraform apply
```

---

### Solution 3 : Vérifier les Variables Terraform

**Fichier** : `infra/terraform/terraform.tfvars`

Vérifier que `project` et `stage` sont corrects :

```hcl
project = "adel"  # ou votre projet
stage   = "prod"  # ou "dev", "staging"
```

Le nom de la Lambda sera : `${project}-${stage}-collector-rss`

---

### Solution 4 : Vérifier le Cron EventBridge

```bash
# Lister les règles
aws events list-rules --query 'Rules[?contains(Name, `rss`)].{Name:Name,State:State}'

# Vérifier l'état
aws events describe-rule --name "<VRAI_NOM_DE_LA_REGLE>"
```

**Vérifier** :
- ✅ `State: ENABLED`
- ✅ `ScheduleExpression: rate(15 minutes)`

---

## 🧪 Test Rapide

### 1. Tester Financial Juice Localement

```bash
cd workers/collector-rss
npm run test:feed financial-juice
```

**Résultat attendu** : ✅ 100 items trouvés

---

### 2. Trouver le Vrai Nom de la Lambda

```bash
# Depuis Terraform (recommandé)
cd infra/terraform
terraform output collector_rss_url
# Retourne: "adel-ai-dev-collector-rss"

# Ou utiliser le script
./scripts/check-cron-rss.sh
```

**Résultat attendu** : `adel-ai-dev-collector-rss`

---

### 3. Invoquer la Lambda Manuellement

```bash
# Avec le vrai nom trouvé
aws lambda invoke \
  --function-name "<VRAI_NOM>" \
  --payload '{}' \
  /tmp/response.json && cat /tmp/response.json
```

---

## 📊 Checklist

- [x] Test local Financial Juice fonctionne
- [ ] Nom exact de la Lambda trouvé
- [ ] Lambda déployée et accessible
- [ ] Cron EventBridge actif
- [ ] Logs CloudWatch visibles
- [ ] Signaux Financial Juice collectés automatiquement

---

## 💡 Résumé

**Le code fonctionne localement** ✅

**Le problème est le déploiement** :
1. Trouver le vrai nom de la Lambda
2. Vérifier qu'elle est déployée
3. Vérifier que le cron est actif
4. Redéployer si nécessaire

**Commande pour diagnostiquer** :
```bash
# Utiliser le script qui détecte automatiquement le nom
./scripts/check-cron-rss.sh

# Ou manuellement
cd infra/terraform && terraform output collector_rss_url
```

