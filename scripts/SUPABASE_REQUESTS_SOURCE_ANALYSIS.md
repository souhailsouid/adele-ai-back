# 🔍 Analyse: Source des 5435 requêtes Supabase

## 📊 Résultat de l'analyse

**Sources possibles** (exécution automatique il y a < 60 minutes) :

### 0. Health Check `/rest-admin/v1/ready` (⚠️ NOUVEAU - PROBABLE)

**Endpoint** : `/rest-admin/v1/ready` (Supabase REST Admin API health check)

**Type d'exécution** :
- ✅ **Health check externe** (UptimeRobot, Pingdom, Better Uptime, etc.)
- ✅ **Script de monitoring** en boucle
- ✅ **Frontend** qui vérifie la disponibilité

**Impact** :
- Si appelé toutes les **10 secondes** pendant **60 minutes** = **360 requêtes**
- Si appelé toutes les **1 seconde** pendant **60 minutes** = **3600 requêtes**
- Si appelé depuis **plusieurs sources** (multiplicateur) = **5435 requêtes** ✅ **MATCH**

**Quand appelé ?**
- Automatiquement en continu (health check)
- Possiblement depuis un service externe de monitoring

**Solution** :
- Vérifier les logs Supabase (Dashboard → Logs → IP sources)
- Identifier le service de monitoring (UptimeRobot, Pingdom, etc.)
- Augmenter l'intervalle (5min au lieu de 1min ou 10s)
- Ajouter un cache côté client si appel depuis frontend

### 1. Script `enrich_companies_from_sec_parallel.ts` (probable)

**Type d'exécution** :
- ❌ **PAS une Lambda** (aucune référence dans `infra/terraform/`)
- ❌ **PAS un cron Terraform** (aucune référence EventBridge)
- ✅ **Script exécuté automatiquement** (cron système ? CI/CD ? machine de dev/staging ?)

**Mode d'exécution** :
```bash
# Exécution manuelle ou automatique
npx tsx scripts/enrich_companies_from_sec_parallel.ts --workers=2 --worker-id=1
```

**Quand a-t-il été exécuté ?**
- Automatiquement il y a < 60 minutes (selon dashboard Supabase)
- Possiblement depuis un cron système, CI/CD, ou machine de dev/staging

### 2. API Endpoint `/companies/enrich/batch` (possible)

**Route API** : `POST /companies/enrich/batch`

**Service** : `services/api/src/services/company-enrichment.service.ts`

**Problème** : Même pattern (boucle avec requêtes Supabase)

**Quand appelé ?**
- Si appelé avec une liste de 2700+ tickers
- Depuis le frontend, un script, ou un autre service

---

## 🔴 Problème identifié

### Requêtes Supabase dans une boucle

**Ligne 410-432** : Pour chaque company, 2 requêtes Supabase :

```typescript
for (const company of workerCompanies) {
  // 1. Vérifier si company existe (1 requête)
  const { data: existingCompany } = await supabase
    .from('companies')
    .select('ein')
    .eq('cik', company.cik)
    .maybeSingle();
  
  // 2. Compter les filings (1 requête)
  const { count: filingsCount } = await supabase
    .from('company_filings')
    .select('id', { count: 'exact', head: true })
    .eq('cik', company.cik);
}
```

**Calcul** :
- Si **~2700 companies** traitées
- **2700 × 2 = 5400 requêtes**
- + overhead = **5435 requêtes** ✅ **MATCH**

---

## ✅ Solution : Optimisation avec batch queries

### Avant (actuel) : N requêtes

```typescript
for (const company of workerCompanies) {
  // 2 requêtes par company
  const { data: existingCompany } = await supabase
    .from('companies')
    .select('ein')
    .eq('cik', company.cik)
    .maybeSingle();
  
  const { count: filingsCount } = await supabase
    .from('company_filings')
    .select('id', { count: 'exact', head: true })
    .eq('cik', company.cik);
}
```

**Coût** : 2700 companies × 2 = **5400 requêtes**

### Après (optimisé) : 2 requêtes batch

```typescript
// 1. Batch query pour toutes les companies (1 requête)
const ciks = workerCompanies.map(c => c.cik);
const { data: existingCompanies } = await supabase
  .from('companies')
  .select('cik, ein')
  .in('cik', ciks);

const existingMap = new Map(
  existingCompanies?.map(c => [c.cik, c.ein]) || []
);

// 2. Batch query pour compter les filings (1 requête)
const { data: filingsCounts } = await supabase
  .from('company_filings')
  .select('cik')
  .in('cik', ciks);

const filingsCountMap = new Map<string, number>();
for (const filing of filingsCounts || []) {
  filingsCountMap.set(filing.cik, (filingsCountMap.get(filing.cik) || 0) + 1);
}

// Ensuite, utiliser les maps dans la boucle
for (const company of workerCompanies) {
  const ein = existingMap.get(company.cik);
  const count = filingsCountMap.get(company.cik) || 0;
  
  if (ein || count >= 10) {
    // Skip
    continue;
  }
  // ...
}
```

**Coût** : **2 requêtes** (peu importe le nombre de companies)

**Réduction** : **5400 → 2 requêtes** (99.96% de réduction)

---

## 🎯 Autres scripts à optimiser

### 1. `scripts/enrich_companies_from_sec.ts`

**Même problème** : Boucle avec requêtes Supabase

**Solution** : Même optimisation batch

### 2. `scripts/check_company_id_in_filings.ts`

**Problème** : Ligne 98-100, 1 requête par company

**Solution** : Batch query avec `IN`

### 3. `scripts/verify_filings_reality.ts`

**Problème** : Ligne 112-114, 1 requête par company

**Solution** : Batch query avec `IN`

---

## 📋 Plan d'action

### Priorité 1 : Script principal (CRITIQUE)

- [ ] Optimiser `enrich_companies_from_sec_parallel.ts` (batch queries)
- [ ] Tester avec `--dry-run --limit=10`
- [ ] Vérifier que les résultats sont identiques

### Priorité 2 : Scripts secondaires

- [ ] Optimiser `enrich_companies_from_sec.ts`
- [ ] Optimiser `check_company_id_in_filings.ts`
- [ ] Optimiser `verify_filings_reality.ts`

### Priorité 3 : Prévention

- [ ] Ajouter des limites par défaut (`--limit=100`)
- [ ] Ajouter des warnings si > 1000 companies sans `--force`
- [ ] Documenter les bonnes pratiques

---

## ⚠️ Recommandations

1. **Ne jamais exécuter ces scripts sans limite** sur de grandes bases
2. **Toujours utiliser batch queries** pour les lookups
3. **Monitorer les requêtes Supabase** après chaque exécution
4. **Utiliser `--dry-run`** avant les exécutions en production

---

**Dernière mise à jour** : 2025-01-XX
