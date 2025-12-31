# ⚡ Déploiement Rapide : Alert-Sender

## 🎯 Situation Actuelle

✅ **Build fait** : `alert-sender.zip` existe  
✅ **Terraform configuré** : `infra/terraform/alert-sender.tf` existe  
❌ **À faire** : Déployer via Terraform depuis le bon répertoire

---

## 🚀 Commandes à Exécuter

### 1. Aller dans le Répertoire Terraform

```bash
cd /Users/souhailsouid/startup/personamy/backend/infra/terraform
```

### 2. Vérifier la Configuration

```bash
# Vérifier que terraform.tfvars contient discord_webhook_url
grep discord_webhook_url terraform.tfvars
```

Si vide, ajouter dans `terraform.tfvars` :
```hcl
discord_webhook_url = "https://discord.com/api/webhooks/VOTRE_ID/VOTRE_TOKEN"
```

### 3. Vérifier les Changements

```bash
terraform plan
```

### 4. Déployer

```bash
terraform apply
# Ou avec auto-approve
terraform apply -auto-approve
```

---

## ⚠️ Erreur "No configuration files"

**Cause** : Vous êtes dans `workers/alert-sender/` au lieu de `infra/terraform/`

**Solution** :
```bash
# Depuis workers/alert-sender/
cd ../../infra/terraform
pwd  # Doit afficher : .../infra/terraform
terraform apply
```

---

## ✅ Vérification

```bash
# Vérifier que la Lambda existe
aws lambda list-functions --query "Functions[?contains(FunctionName, 'alert-sender')]"

# Voir les logs
aws logs tail /aws/lambda/personamy-prod-alert-sender --follow
```

---

## 📝 Résumé

| Action | Répertoire | Commande |
|--------|-----------|----------|
| Build (déjà fait) | `workers/alert-sender/` | `npm run bundle` ✅ |
| Deploy | `infra/terraform/` | `terraform apply` ⬅️ ICI |

**Vous devez être dans `infra/terraform/` pour exécuter Terraform !**


