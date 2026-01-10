# 🔧 Fix 503 Throttling - Guide Complet

## Problème Identifié

**Erreur** : `503 Service Unavailable - The Lambda function is being throttled`

**Cause** : Le compte AWS a une limite de **10 exécutions simultanées** et cette limite est atteinte.

**Métriques** : Les logs montrent `ConcurrentExecutions: 10.0` (limite atteinte)

## ✅ Solutions Appliquées

1. **RAM Lambda API** : 512MB → **1536MB** (appliqué ✅)
2. **Timeout Lambda API** : 30s → **60s** (appliqué ✅)
3. **Timeout API Gateway** : 30s (limite max, non modifiable)
4. **SQS pour crons** : Configuration créée (à appliquer)

## 🚨 Solution Critique : Augmenter la Limite de Compte

### Option 1 : AWS Console (Recommandé - 2 minutes)

1. **Aller sur AWS Console** :
   - https://eu-west-3.console.aws.amazon.com/lambda/home?region=eu-west-3#/settings
   - Ou : Lambda → Settings → Account settings

2. **Section "Concurrency"** :
   - Cliquer sur **"Edit"**
   - **"Account limit"** : Supprimer la limite ou mettre **1000**
   - Cliquer **"Save"**

3. **Vérifier** :
   - La limite doit passer de **10** à **1000** (ou "Unreserved")

### Option 2 : Service Quotas (Si Option 1 ne fonctionne pas)

1. **Aller sur Service Quotas** :
   - https://eu-west-3.console.aws.amazon.com/servicequotas/home?region=eu-west-3/services/lambda/quotas

2. **Chercher** : "Concurrent executions"

3. **Request quota increase** :
   - Valeur demandée : **1000**
   - Raison : "Multiple Lambda functions running simultaneously causing throttling (503 errors)"

4. **Attendre** : Généralement approuvé en quelques minutes

### Option 3 : AWS CLI (Si vous avez les permissions)

```bash
# Supprimer la limite (revenir à 1000 par défaut)
aws lambda delete-account-concurrency --region eu-west-3

# OU mettre une valeur spécifique
aws lambda put-account-concurrency \
  --reserved-concurrent-executions 1000 \
  --region eu-west-3
```

## 📊 Après l'Augmentation

Une fois la limite augmentée à **1000**, vous pourrez :

1. **Réserver de la concurrence** pour les Lambdas critiques :
   ```terraform
   # Dans parser-13f.tf
   reserved_concurrent_executions = 5  # Pour parser-13f (lent)
   
   # Dans api.tf
   reserved_concurrent_executions = 20  # Pour l'API
   ```

2. **Tester** : Les erreurs 503 devraient disparaître

## 🔍 Vérification

```bash
# Vérifier la limite actuelle
aws lambda get-account-settings --region eu-west-3 \
  --query 'AccountLimit.ConcurrentExecutions' \
  --output text

# Devrait retourner : 1000 (ou plus)
```

## ⚠️ Note Importante

**Pourquoi 10 ?** : C'est probablement une limite de sécurité pour un compte sandbox/test. La limite standard AWS est **1000** par défaut.

**Coût** : Augmenter la limite ne coûte rien. Seules les exécutions réelles sont facturées.

## 🎯 Actions Immédiates

1. **Augmenter la limite** via AWS Console (Option 1) - **2 minutes**
2. **Tester** l'endpoint `/funds` - devrait fonctionner
3. **Appliquer Terraform** pour les changements SQS (optionnel, pour lisser les crons)
