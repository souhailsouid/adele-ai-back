# 📋 PLAN D'EXÉCUTION - Refonte Architecture Cost Safety

## ✅ FICHIERS CRÉÉS

### PR #1: CI Guard + Runtime Guard
- [x] `.eslintrc.js` - ESLint rule pour interdire s3-direct-read
- [x] `services/api/src/athena/s3-direct-read.ts` - Runtime guard (déjà fait ✅)

### PR #2: Index DynamoDB
- [x] `infra/terraform/dynamodb-indexes.tf` - Table DynamoDB lookup-index
- [x] `services/api/src/athena/lookup-index.service.ts` - Service de lookup

### PR #3: Optimisation Scripts
- [x] `workers/sec-smart-money-sync/src/index.ts` - Batch queries pour processInsiderFilings

### PR #4: Vérification Partitions
- [x] `scripts/verify_s3_partitions.ts` - Script de vérification

### PR #5: Top 100 Companies
- [x] `infra/athena/ddl/create_top_companies_view.sql` - Vue Athena

### PR #6: De-dup
- [x] `services/api/src/athena/write-with-dedup.ts` - Service avec de-dup automatique

---

## 🚀 PROCHAINES ÉTAPES

### 1. Installer ESLint (si pas déjà fait)
```bash
cd /Users/souhailsouid/startup/personamy/backend
npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### 2. Tester ESLint Rule
```bash
npm run lint
# Doit fail si import s3-direct-read dans services/ ou workers/
```

### 3. Déployer DynamoDB Table
```bash
cd infra/terraform
terraform plan -target=aws_dynamodb_table.lookup_index
terraform apply -target=aws_dynamodb_table.lookup_index
```

### 4. Intégrer Lookup Index dans Writers
- Modifier `services/api/src/athena/write.ts` pour appeler `putLookup()` après insertions
- Modifier `workers/form4-parser/src/index.ts` pour mettre à jour l'index

### 5. Migrer API Endpoints vers DynamoDB
- Modifier `services/api/src/athena/companies.ts` pour utiliser `getLookup()` d'abord
- Modifier `services/api/src/athena/funds.ts` pour utiliser `getLookup()` d'abord

### 6. Utiliser Top 100 Companies View
- Modifier `workers/sec-smart-money-sync/src/index.ts` pour utiliser `top_companies` view

### 7. Intégrer De-dup dans Parsers
- Modifier `workers/form4-parser/src/index.ts` pour utiliser `insertFilingS3WithDedup()`

---

## 📊 IMPACT ATTENDU

### Avant
- 43M requêtes S3 GET/jour = $18.41/jour
- 2.5M requêtes S3 LIST/jour = $13.70/jour
- **Total**: $32.11/jour = $963/mois

### Après
- 0 requêtes S3 GET via notre code (index DynamoDB)
- ~500K requêtes LIST (écritures normales) = $2.65/jour
- ~100 requêtes Athena/jour = $0.50/jour
- ~1M requêtes DynamoDB/jour = $0.25/jour
- **Total**: ~$3.40/jour = ~$102/mois

**Économie**: **$28.71/jour** = **$861/mois** = **$10,332/an** 🎉

---

## ⚠️ MIGRATION PROGRESSIVE

L'index DynamoDB peut être déployé progressivement:
1. Créer la table (Terraform)
2. Commencer à écrire dans l'index (putLookup après insertions)
3. Migrer les reads progressivement (getLookup avec fallback Athena)
4. Une fois l'index peuplé, retirer le fallback Athena

**Pas de downtime** - le système fonctionne avec ou sans index DynamoDB.

