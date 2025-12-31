# 🚀 Guide de Déploiement : Alert-Sender

## ⚠️ Important

**Terraform doit être exécuté depuis `infra/terraform/`, PAS depuis `workers/alert-sender/`**

---

## 📋 Étapes de Déploiement

### 1. Build le Worker Alert-Sender

```bash
# Depuis la racine du projet
cd workers/alert-sender
npm install
npm run bundle
```

**Vérification** : Le fichier `workers/alert-sender/alert-sender.zip` doit exister.

---

### 2. Configurer les Variables Terraform

Éditer `infra/terraform/terraform.tfvars` :

```hcl
# Ajouter ces lignes (ou modifier si déjà présentes)
discord_webhook_url = "https://discord.com/api/webhooks/VOTRE_ID/VOTRE_TOKEN"
# Optionnel
slack_webhook_url = ""
telegram_bot_token = ""
telegram_chat_id = ""
```

**Comment obtenir l'URL Discord** :
1. Serveur Discord → Paramètres → Intégrations → Webhooks
2. Créer un webhook → Copier l'URL

---

### 3. Aller dans le Répertoire Terraform

```bash
# Depuis la racine du projet
cd infra/terraform
```

---

### 4. Initialiser Terraform (si pas déjà fait)

```bash
terraform init
```

---

### 5. Vérifier les Changements

```bash
terraform plan
```

Vous devriez voir :
- `aws_lambda_function.alert_sender` (nouveau)
- `aws_cloudwatch_log_group.alert_sender` (nouveau)
- `aws_cloudwatch_event_rule.alert_sender_cron` (nouveau)
- `aws_cloudwatch_event_target.alert_sender` (nouveau)
- `aws_lambda_permission.alert_sender_events` (nouveau)

---

### 6. Déployer

```bash
terraform apply
```

Terraform va demander confirmation. Tapez `yes` ou utilisez `-auto-approve` :

```bash
terraform apply -auto-approve
```

---

## ✅ Vérification Post-Déploiement

### 1. Vérifier que la Lambda existe

```bash
aws lambda get-function --function-name personamy-prod-alert-sender
# (remplacez personamy-prod par votre project-stage)
```

### 2. Vérifier les Logs

```bash
aws logs tail /aws/lambda/personamy-prod-alert-sender --follow
```

### 3. Tester avec un Signal

```sql
-- Dans Supabase SQL Editor
INSERT INTO signals (source, type, raw_data)
VALUES (
  'rss',
  'macro',
  '{"title": "FinancialJuice: Trump announces new policy", "feed": "financial-juice"}'
);

-- Attendre 1 minute, puis vérifier
SELECT * FROM alerts_sent WHERE status = 'sent' ORDER BY sent_at DESC LIMIT 1;
```

---

## 🐛 Dépannage

### Erreur : "No configuration files"

**Cause** : Vous êtes dans le mauvais répertoire.

**Solution** :
```bash
# Vérifier que vous êtes dans infra/terraform
pwd
# Doit afficher : .../infra/terraform

# Si non, aller dans le bon répertoire
cd /Users/souhailsouid/startup/personamy/backend/infra/terraform
```

### Erreur : "alert-sender.zip not found"

**Cause** : Le build n'a pas été fait.

**Solution** :
```bash
cd workers/alert-sender
npm install
npm run bundle
# Vérifier que alert-sender.zip existe
ls -lh alert-sender.zip
```

### Erreur : "discord_webhook_url not set"

**Cause** : Variable manquante dans `terraform.tfvars`.

**Solution** : Ajouter `discord_webhook_url = "..."` dans `infra/terraform/terraform.tfvars`.

---

## 📝 Checklist Rapide

```bash
# 1. Build
cd workers/alert-sender
npm install && npm run bundle

# 2. Config
# Éditer infra/terraform/terraform.tfvars
# Ajouter discord_webhook_url

# 3. Deploy
cd ../../infra/terraform
terraform plan
terraform apply
```

---

## 🎯 Résumé

| Étape | Commande | Répertoire |
|-------|----------|------------|
| Build | `npm run bundle` | `workers/alert-sender/` |
| Deploy | `terraform apply` | `infra/terraform/` |

**Important** : Terraform s'exécute depuis `infra/terraform/`, pas depuis `workers/alert-sender/` !


