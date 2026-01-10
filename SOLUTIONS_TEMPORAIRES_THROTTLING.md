# 🚨 Solutions Temporaires pour le Throttling (En attendant l'approbation AWS)

## ⏳ Situation
- **Demande d'augmentation** : En cours (3-4 jours ouvrables)
- **Limite actuelle** : 10 exécutions simultanées
- **Problème** : `parser-13f` occupe 10 slots simultanément (timeout 15 min)

## ✅ Solution 1 : Réduire les fréquences des crons (GRATUIT, appliqué)

**Changements appliqués** :
- `collector-sec-watcher` : 1h → **2h** (50% de réduction)
- `collector-rss` : 15 min → **30 min** (50% de réduction)
- `notification-generator` : 5 min → **10 min** (50% de réduction)

**Impact** : Réduit la charge de ~50% sur les 10 slots disponibles

**Pour appliquer** :
```bash
cd infra/terraform
terraform plan  # Vérifier les changements
terraform apply
```

## 💰 Solution 2 : Provisioned Concurrency (PAYANT, immédiat)

**Coût** : ~$0.015/heure par exécution
- 3 exécutions = ~$32/mois
- 5 exécutions = ~$54/mois

**Avantage** : Résout immédiatement le throttling pour `parser-13f`

**Configuration** (via AWS Console) :
1. Lambda → `adel-ai-dev-parser-13f` → Configuration → Concurrency
2. "Provisioned concurrency" → "Add configuration"
3. Provisioned concurrency : **3**
4. Save

**Note** : Plus complexe à configurer via Terraform (nécessite un alias)

## 📊 Impact Attendu

### Avec Solution 1 (fréquences réduites)
- **Charge réduite** : ~50%
- **Throttling réduit** : ~50%
- **Coût** : Gratuit
- **Délai** : Immédiat après `terraform apply`

### Avec Solution 2 (provisioned concurrency)
- **Throttling parser-13f** : Résolu (3 slots garantis)
- **Coût** : ~$32-54/mois
- **Délai** : Immédiat après configuration

### Avec Solution 1 + 2 (recommandé)
- **Throttling** : Réduit de ~80%
- **Coût** : ~$32-54/mois
- **Délai** : Immédiat

## 🔄 Après l'Approval AWS

Une fois la limite augmentée à 1000 :

1. **Remettre les fréquences normales** :
   ```terraform
   # Dans collectors.tf
   schedule_expression = "rate(1 hour)"  # Au lieu de "rate(2 hours)"
   schedule_expression = "rate(15 minutes)"  # Au lieu de "rate(30 minutes)"
   
   # Dans notification-generator.tf
   schedule_expression = "rate(5 minutes)"  # Au lieu de "rate(10 minutes)"
   ```

2. **Supprimer provisioned concurrency** (si ajouté) :
   - AWS Console → Lambda → Configuration → Concurrency → Delete

3. **Réserver de la concurrence** :
   ```terraform
   # Dans parser-13f.tf
   reserved_concurrent_executions = 5
   
   # Dans api.tf
   reserved_concurrent_executions = 20
   ```

## 📝 Checklist

- [x] Réduire les fréquences des crons (Solution 1)
- [ ] Appliquer Terraform (`terraform apply`)
- [ ] (Optionnel) Ajouter provisioned concurrency pour parser-13f
- [ ] Vérifier que les throttles diminuent
- [ ] Après approval AWS : Remettre les fréquences normales
