# ⏱️ Délais et Actions

## 🕐 Délais

### 1. **Approval AWS (Limite de concurrence)**
- **Délai** : **3-4 jours ouvrables** (déjà demandé)
- **Action** : Aucune action de votre part, AWS traite la demande
- **Vérification** : Vous recevrez un email de confirmation AWS

### 2. **Application des changements Terraform (fréquences réduites)**
- **Délai** : **Immédiat** après `terraform apply` (~30 secondes)
- **Action requise** : Exécuter `terraform apply`
- **Impact visible** : Dès le prochain cycle de cron

### 3. **Impact sur le throttling**
- **Délai** : **Quelques minutes** après `terraform apply`
- **Vérification** : Les prochains crons utiliseront les nouvelles fréquences
- **Réduction attendue** : ~70-80% de réduction de la charge

## 📋 Actions Immédiates

### Étape 1 : Appliquer les changements Terraform (MAINTENANT)
```bash
cd infra/terraform
terraform apply
```

**Délai** : ~30 secondes
**Impact** : Les crons utiliseront les nouvelles fréquences dès le prochain cycle

### Étape 2 : Vérifier l'impact (Dans 1-2 heures)
```bash
# Vérifier les throttles
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Throttles \
  --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --query 'Datapoints[*].Sum' \
  --output text
```

**Délai** : Attendre 1-2 heures pour voir l'impact
**Résultat attendu** : Throttles réduits de ~70-80%

### Étape 3 : Attendre l'approval AWS (3-4 jours)
- **Aucune action** : AWS traite automatiquement
- **Notification** : Email de confirmation AWS
- **Vérification** : 
  ```bash
  aws lambda get-account-settings --region eu-west-3 \
    --query 'AccountLimit.ConcurrentExecutions' \
    --output text
  ```
  Devrait retourner **1000** (au lieu de 10)

## 📊 Fréquences Actuelles (Après vos modifications)

| Service | Fréquence Actuelle | Impact |
|---------|-------------------|--------|
| `collector-sec-watcher` | **5 heures** | Réduction de 80% |
| `collector-rss` | **45 minutes** | Réduction de 70% |
| `notification-generator` | **40 minutes** | Réduction de 87.5% |

**Charge totale réduite** : ~75-80%

## ✅ Checklist

- [ ] Appliquer Terraform (`terraform apply`)
- [ ] Attendre 1-2 heures et vérifier les throttles
- [ ] Attendre l'approval AWS (3-4 jours ouvrables)
- [ ] Après approval : Remettre les fréquences normales
- [ ] Après approval : Réserver de la concurrence

## 🎯 Résultat Attendu

### Avant (maintenant)
- Throttles : ~80+ par heure
- Concurrence : 10/10 (saturé)
- API : 503 fréquents

### Après Terraform (immédiat)
- Throttles : ~20-30 par heure (réduction 70%)
- Concurrence : 6-8/10 (moins saturé)
- API : 503 moins fréquents

### Après Approval AWS (3-4 jours)
- Throttles : 0
- Concurrence : 10-20/1000 (large marge)
- API : Plus de 503
