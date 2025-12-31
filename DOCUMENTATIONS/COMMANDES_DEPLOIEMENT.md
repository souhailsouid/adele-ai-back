# 🚀 Commandes de Déploiement - Copier/Coller

## ⚡ Déploiement Rapide (Tout-en-un)

```bash
# 1. Aller dans infra/terraform
cd /Users/souhailsouid/startup/personamy/backend/infra/terraform

# 2. Vérifier que alert-sender.zip existe
ls -lh ../../workers/alert-sender/alert-sender.zip

# 3. Vérifier la config (discord_webhook_url doit être rempli)
grep discord_webhook_url terraform.tfvars

# 4. Plan (voir ce qui va être créé)
terraform plan

# 5. Deploy
terraform apply -auto-approve
```

---

## 📝 Étapes Détaillées

### Étape 1 : Vérifier le Build

```bash
cd /Users/souhailsouid/startup/personamy/backend/workers/alert-sender
ls -lh alert-sender.zip
# Doit afficher : alert-sender.zip (taille > 0)
```

Si le fichier n'existe pas :
```bash
npm install
npm run bundle
```

### Étape 2 : Configurer Discord Webhook

1. Ouvrir Discord → Serveur → Paramètres → Intégrations → Webhooks
2. Créer un webhook → Copier l'URL
3. Éditer `infra/terraform/terraform.tfvars` :
   ```hcl
   discord_webhook_url = "https://discord.com/api/webhooks/VOTRE_ID/VOTRE_TOKEN"
   ```

### Étape 3 : Déployer

```bash
cd /Users/souhailsouid/startup/personamy/backend/infra/terraform

# Voir ce qui va être créé
terraform plan

# Déployer
terraform apply
# Tapez "yes" quand demandé
```

---

## ✅ Vérification Post-Déploiement

```bash
# Vérifier que la Lambda existe
aws lambda get-function --function-name adel-ai-dev-alert-sender

# Voir les logs en temps réel
aws logs tail /aws/lambda/adel-ai-dev-alert-sender --follow
```

---

## 🐛 Si Erreur "No configuration files"

**Vous êtes dans le mauvais répertoire !**

```bash
# Vérifier où vous êtes
pwd
# Doit afficher : .../infra/terraform

# Si non, aller au bon endroit
cd /Users/souhailsouid/startup/personamy/backend/infra/terraform
```

---

## 📋 Checklist

- [ ] `alert-sender.zip` existe dans `workers/alert-sender/`
- [ ] `discord_webhook_url` rempli dans `terraform.tfvars`
- [ ] Vous êtes dans `infra/terraform/`
- [ ] `terraform plan` montre les ressources à créer
- [ ] `terraform apply` déployé avec succès

---

## 🎯 Résumé

**Répertoire pour Terraform** : `infra/terraform/`  
**Commande** : `terraform apply`  
**Prérequis** : `discord_webhook_url` dans `terraform.tfvars`


