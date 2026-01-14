# 🚀 Déploiement : Correction de l'Enrichissement d'Entreprises

## 📋 Étapes de Déploiement

### 1. Rebuild et Bundle de l'API

```bash
cd services/api
npm run build
```

### 2. Déployer avec Terraform

```bash
cd infra/terraform
terraform apply
```

### 3. Tester l'Enrichissement

Une fois le déploiement terminé, testez avec :

```bash
# Option 1 : Script de test rapide
export ACCESS_TOKEN="votre_token_jwt"
./scripts/test-company-enrichment-quick.sh "$ACCESS_TOKEN" "TSLA"

# Option 2 : Test manuel
curl -X GET "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/companies/ticker/TSLA" \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Si secteur = null, enrichir :
curl -X POST "https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/companies/enrich" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticker": "TSLA"}'
```

---

## 🔧 Corrections Appliquées

### Problème 1 : `.select().single()` après insertion
- **Avant** : Utilisait `.single()` qui causait l'erreur "Cannot coerce the result to a single JSON object"
- **Après** : Utilise `.select()` qui retourne un tableau, puis prend le premier élément

### Problème 2 : `.or()` avec `.maybeSingle()`
- **Avant** : Utilisait `.or()` avec `.maybeSingle()` qui pouvait causer des conflits
- **Après** : Deux requêtes séparées (par ticker, puis par CIK si nécessaire)

---

## ✅ Vérifications Post-Déploiement

1. **Test GET /companies/ticker/{ticker}**
   - Doit retourner l'entreprise avec ou sans secteur
   - Ne doit pas retourner d'erreur 500

2. **Test POST /companies/enrich**
   - Doit enrichir l'entreprise depuis FMP
   - Ne doit pas retourner l'erreur "Cannot coerce the result to a single JSON object"
   - Doit retourner le secteur si trouvé dans FMP

3. **Test POST /companies/enrich/batch**
   - Doit enrichir plusieurs entreprises en batch
   - Doit gérer correctement les erreurs individuelles

---

## 📝 Fichiers Modifiés

- `services/api/src/services/company-enrichment.service.ts`
  - Ligne 80-90 : Remplacement de `.or().maybeSingle()` par deux requêtes séparées
  - Ligne 134-159 : Remplacement de `.select().single()` par `.select()` avec vérification

---

## 🐛 Problèmes Connus

- **Rate Limit FMP** : Si vous voyez "Rate limit exceeded", attendez quelques secondes avant de réessayer
- **Entreprises sans CIK** : Certaines entreprises peuvent ne pas avoir de CIK dans FMP, elles ne pourront pas être créées

---

*Guide créé le : 2026-01-10*
