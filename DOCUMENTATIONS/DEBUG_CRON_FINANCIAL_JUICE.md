# 🔍 Diagnostic : Cron Job Financial Juice

## 🎯 Problème

Le cron job de Financial Juice ne semble pas fonctionner.

---

## ✅ Vérifications

### 1. Vérifier que Financial Juice est dans le Code

**Fichier** : `workers/collector-rss/src/index.ts`

```typescript
const RSS_FEEDS = [
  // ... autres feeds ...
  { url: "https://www.financialjuice.com/feed.ashx?xy=rss", name: "financial-juice", type: "macro" },
];
```

**Vérification** : ✅ Financial Juice est bien dans la liste (ligne 20)

---

### 2. Vérifier la Configuration Terraform

**Fichier** : `infra/terraform/collectors.tf`

```hcl
# Cron: toutes les 15 minutes
resource "aws_cloudwatch_event_rule" "collector_rss_cron" {
  name                = "${var.project}-${var.stage}-collector-rss-cron"
  description         = "Déclenche le collector RSS toutes les 15 minutes"
  schedule_expression = "rate(15 minutes)"
}
```

**Vérification** : ✅ Le cron est configuré pour toutes les 15 minutes

---

## 🔍 Diagnostic

### Étape 1 : Vérifier les Logs CloudWatch

```bash
# Voir les logs récents du collector RSS
aws logs tail /aws/lambda/adel-prod-collector-rss --follow

# Ou filtrer pour Financial Juice
aws logs filter-log-events \
  --log-group-name /aws/lambda/adel-prod-collector-rss \
  --filter-pattern "financial-juice" \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

**Chercher** :
- ✅ `"Fetching RSS feed: financial-juice"`
- ✅ `"Found X items in financial-juice"`
- ❌ Erreurs spécifiques à Financial Juice

---

### Étape 2 : Vérifier que le Cron est Actif

```bash
# Lister les règles EventBridge
aws events list-rules --name-prefix "adel-prod-collector-rss-cron"

# Vérifier l'état de la règle
aws events describe-rule --name "adel-prod-collector-rss-cron"
```

**Vérifier** :
- ✅ `State: ENABLED`
- ✅ `ScheduleExpression: rate(15 minutes)`

---

### Étape 3 : Vérifier les Invocations Lambda

```bash
# Voir les métriques d'invocation
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=adel-prod-collector-rss \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --period 300 \
  --statistics Sum
```

**Vérifier** :
- ✅ Des invocations récentes (toutes les 15 minutes)
- ❌ Aucune invocation = problème de cron

---

### Étape 4 : Tester Manuellement

```bash
# Invoquer la Lambda manuellement
aws lambda invoke \
  --function-name adel-prod-collector-rss \
  --payload '{}' \
  response.json

# Voir la réponse
cat response.json
```

**Vérifier** :
- ✅ `"statusCode": 200`
- ✅ `"success": true`

---

### Étape 5 : Vérifier les Données en Base

```sql
-- Dans Supabase Dashboard → SQL Editor
-- Vérifier les signaux Financial Juice récents
SELECT 
  id,
  raw_data->>'feed' as feed,
  raw_data->>'title' as title,
  created_at
FROM signals
WHERE source = 'rss'
AND raw_data->>'feed' = 'financial-juice'
ORDER BY created_at DESC
LIMIT 10;
```

**Vérifier** :
- ✅ Des signaux récents (moins de 15 minutes)
- ❌ Aucun signal récent = problème de collecte

---

## 🐛 Problèmes Courants

### Problème 1 : Cron Non Déployé

**Symptôme** : Aucune invocation dans CloudWatch

**Solution** :
```bash
# Redéployer Terraform
cd infra/terraform
terraform apply
```

---

### Problème 2 : Erreur lors de la Collecte

**Symptôme** : Erreurs dans les logs CloudWatch

**Vérifier** :
- ✅ URL du feed RSS : `https://www.financialjuice.com/feed.ashx?xy=rss`
- ✅ Accessibilité du feed (rate limiting ?)
- ✅ Format du XML (parsing error ?)

**Test local** :
```bash
cd workers/collector-rss
npm run test:feed
```

---

### Problème 3 : Lambda Timeout

**Symptôme** : `Task timed out after 300.00 seconds`

**Solution** : Augmenter le timeout dans Terraform :
```hcl
resource "aws_lambda_function" "collector_rss" {
  timeout = 600  # 10 minutes au lieu de 5
}
```

---

### Problème 4 : Permissions IAM

**Symptôme** : `AccessDenied` dans les logs

**Vérifier** : Le rôle IAM a les permissions pour :
- ✅ Écrire dans Supabase
- ✅ Publier dans EventBridge

---

## 🔧 Solutions

### Solution 1 : Forcer une Exécution

```bash
# Invoquer manuellement
aws lambda invoke \
  --function-name adel-prod-collector-rss \
  --payload '{}' \
  /tmp/response.json

# Voir les logs en temps réel
aws logs tail /aws/lambda/adel-prod-collector-rss --follow
```

---

### Solution 2 : Vérifier le Code Déployé

```bash
# Télécharger le code de la Lambda
aws lambda get-function \
  --function-name adel-prod-collector-rss \
  --query 'Code.Location' \
  --output text | xargs curl -o collector-rss.zip

# Extraire et vérifier
unzip collector-rss.zip
grep -r "financial-juice" .
```

**Vérifier** : Financial Juice est bien dans le code déployé

---

### Solution 3 : Rebuild et Redéployer

```bash
# Rebuild le collector RSS
cd workers/collector-rss
npm run build
npm run package

# Redéployer avec Terraform
cd ../../infra/terraform
terraform apply
```

---

## 📊 Checklist de Diagnostic

- [ ] Financial Juice est dans `RSS_FEEDS` (code source)
- [ ] Financial Juice est dans le code déployé (Lambda)
- [ ] Le cron EventBridge est `ENABLED`
- [ ] Des invocations récentes dans CloudWatch
- [ ] Pas d'erreurs dans les logs CloudWatch
- [ ] Des signaux Financial Juice récents en base
- [ ] Le feed RSS est accessible (test manuel)

---

## 🧪 Test Rapide

### Test Local

```bash
cd workers/collector-rss
npm run test:feed
```

**Vérifier** : Financial Juice retourne des items

### Test Lambda

```bash
aws lambda invoke \
  --function-name adel-prod-collector-rss \
  --payload '{}' \
  /tmp/response.json && cat /tmp/response.json
```

**Vérifier** : `"success": true`

---

## 📝 Résumé

**Le cron job est configuré pour toutes les 15 minutes.**

**Si ça ne fonctionne pas, vérifier** :
1. ✅ Les logs CloudWatch
2. ✅ L'état du cron EventBridge
3. ✅ Les invocations Lambda
4. ✅ Les données en base

**Commande rapide pour diagnostiquer** :
```bash
# Voir les logs récents
aws logs tail /aws/lambda/adel-prod-collector-rss --since 1h | grep -i "financial-juice"
```


