# 💰 Coûts de l'enrichissement SEC

## 📊 Situation actuelle

D'après l'analyse de ta base de données :
- **8,191 entreprises** au total
- **277 entreprises** déjà enrichies (3.4%)
- **7,914 entreprises** restantes à traiter
- **193,424 filings** déjà stockés

## 💵 Coûts réels

### 1. API SEC EDGAR
**✅ GRATUIT**
- API publique, pas de limite de requêtes
- Pas de coût pour les appels API

### 2. Exécution locale (ton ordinateur)
**✅ NÉGLIGEABLE**
- Le script tourne sur ta machine locale
- Coût : électricité (~0.01-0.05€ pour 4 heures)
- Pas de coût cloud (pas de Lambda AWS)

### 3. Supabase (Base de données) ⚠️

#### Stockage estimé
- **Filings à insérer** : ~5,278,638 (estimation basée sur 667 filings/entreprise)
- **Stockage estimé** : ~10 GB (métadonnées seulement, pas le contenu brut)

#### Plans Supabase

**Plan FREE** :
- ✅ 500 MB stockage
- ✅ 2 GB bandwidth/mois
- ✅ 500 MB base de données
- **Coût : $0/mois**

**Plan PRO** :
- ✅ 8 GB stockage
- ✅ 250 GB bandwidth/mois
- ✅ 8 GB base de données
- **Coût : $25/mois**

#### ⚠️ Conclusion

Avec ~10 GB estimés, **le plan FREE est insuffisant**.

**Tu auras besoin du plan PRO à $25/mois** si tu veux stocker tous les filings.

## 📉 Réduction des coûts

### Option 1 : Filtrer les filings (RECOMMANDÉ)

Au lieu de stocker **tous** les filings, tu peux filtrer :

```typescript
// Dans enrich_companies_from_sec.ts, ligne ~200
const targetFormTypes = ['8-K', '10-Q', '10-K', 'DEF 14A', '4'];
```

**Filtrage plus strict** :
- Seulement les **10-K** et **10-Q** (rapports trimestriels/annuels)
- Ignorer les **Form 4** (transactions d'insiders, très nombreux)

**Impact** :
- Réduction de ~70% des filings (Form 4 = majorité)
- Stockage estimé : ~3 GB au lieu de 10 GB
- **Peut rester dans le plan FREE** si tu es proche de la limite

### Option 2 : Limiter par date

Ne stocker que les filings des **5 dernières années** :

```typescript
const filingDate = filingDates[i];
const filingYear = new Date(filingDate).getFullYear();
const currentYear = new Date().getFullYear();

if (currentYear - filingYear > 5) {
  continue; // Ignorer les filings de plus de 5 ans
}
```

**Impact** :
- Réduction de ~50% des filings
- Stockage estimé : ~5 GB
- Toujours besoin du plan PRO

### Option 3 : Stockage externe

Pour les très gros volumes, considérer :
- **S3** : $0.023/GB/mois (beaucoup moins cher que Supabase)
- Stocker les métadonnées dans Supabase, les fichiers bruts dans S3

## 🎯 Recommandation

### Court terme (maintenant)
1. **Continuer le script** : Il tourne déjà, laisse-le finir
2. **Surveiller le stockage** : Vérifier dans Supabase si tu dépasses 500 MB
3. **Si < 500 MB** : Reste sur le plan FREE ✅
4. **Si > 500 MB** : Passe au plan PRO ($25/mois)

### Moyen terme (après enrichissement)
1. **Analyser l'utilisation réelle** : Vérifier combien de GB tu utilises vraiment
2. **Optimiser** : Filtrer les Form 4 si pas nécessaire
3. **Nettoyer** : Supprimer les anciens filings si pas utilisés

## 📊 Estimation finale

### Scénario 1 : Tous les filings (actuel)
- **Stockage** : ~10 GB
- **Coût Supabase** : **$25/mois** (Plan PRO)
- **Temps d'exécution** : ~1.5 heures (séquentiel) ou ~45 min (parallèle)

### Scénario 2 : Filtré (Form 4 exclus)
- **Stockage** : ~3 GB
- **Coût Supabase** : **$0/mois** (Plan FREE) ou **$25/mois** (Plan PRO selon utilisation)
- **Temps d'exécution** : ~1 heure (séquentiel) ou ~30 min (parallèle)

## ⚡ Action immédiate

**Le script tourne depuis 4h** :
- ✅ Pas de coût supplémentaire (local + API gratuite)
- ✅ Laisse-le finir
- ⚠️ Surveille le stockage Supabase après

**Pour vérifier le stockage actuel** :
```sql
-- Dans Supabase SQL Editor
SELECT 
  pg_size_pretty(pg_total_relation_size('company_filings')) AS filings_size,
  pg_size_pretty(pg_total_relation_size('companies')) AS companies_size;
```

## 💡 Conclusion

**Coût réel** :
- ✅ **API SEC** : $0
- ✅ **Exécution** : $0 (local)
- ⚠️ **Supabase** : $0/mois (FREE) ou **$25/mois** (PRO) selon le stockage réel

**Recommandation** : Laisse le script finir, puis vérifie le stockage réel. Si tu dépasses 500 MB, passe au plan PRO.
