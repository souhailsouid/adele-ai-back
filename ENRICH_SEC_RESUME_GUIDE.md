# Guide : Reprendre l'enrichissement SEC après interruption

## 🎯 Fonctionnalités ajoutées

Le script `enrich_companies_from_sec.ts` a été amélioré pour :

1. **Détecter automatiquement les entreprises déjà enrichies**
   - Vérifie si l'entreprise a un EIN (indicateur d'enrichissement)
   - Vérifie si l'entreprise a au moins 10 filings (déjà traitée)
   - Skip automatiquement ces entreprises

2. **Permettre la reprise depuis un CIK spécifique**
   - Utilise `--start-from=CIK` pour reprendre à partir d'un point précis

3. **Option force pour retraiter**
   - Utilise `--force` pour forcer le retraitement même si déjà enrichi

## 📋 Utilisation

### Reprendre après interruption

Si tu as arrêté le script à l'entreprise 266 (par exemple, MKC avec CIK `0000063754`), tu peux reprendre ainsi :

```bash
# Reprendre depuis le CIK suivant
npx tsx scripts/enrich_companies_from_sec.ts --start-from=0000063754
```

Le script va :
- ✅ Ignorer automatiquement toutes les entreprises déjà enrichies (avec EIN ou filings)
- ✅ Traiter uniquement les entreprises non enrichies
- ✅ Reprendre depuis le CIK spécifié

### Vérifier le dernier CIK traité

Pour trouver le dernier CIK traité, tu peux utiliser :

```sql
-- Dans Supabase SQL Editor
SELECT c.ticker, c.name, c.cik, c.ein, COUNT(cf.id) as filings_count
FROM companies c
LEFT JOIN company_filings cf ON cf.cik = c.cik
WHERE c.ein IS NOT NULL
GROUP BY c.id, c.ticker, c.name, c.cik, c.ein
ORDER BY c.cik DESC
LIMIT 10;
```

### Exemples d'utilisation

```bash
# Reprendre depuis un CIK spécifique (skip les déjà enrichies)
npx tsx scripts/enrich_companies_from_sec.ts --start-from=0000063754

# Traiter seulement 100 entreprises non enrichies
npx tsx scripts/enrich_companies_from_sec.ts --limit=100

# Forcer le retraitement de toutes les entreprises (même enrichies)
npx tsx scripts/enrich_companies_from_sec.ts --force

# Combiner : reprendre depuis un CIK + limiter + forcer
npx tsx scripts/enrich_companies_from_sec.ts --start-from=0000063754 --limit=50 --force
```

## 🔍 Comment ça fonctionne

### Détection des entreprises enrichies

Le script considère qu'une entreprise est enrichie si :
- Elle a un `EIN` (Employer Identification Number) dans la base
- OU elle a au moins **10 filings** dans `company_filings`

### Logique de skip

1. **Au début** : Le script charge toutes les entreprises avec EIN ou filings (≥10) et les exclut de la liste à traiter
2. **Pendant le traitement** : Pour chaque entreprise, vérification finale avant traitement (au cas où elle aurait été enrichie entre temps)
3. **Résultat** : Seules les entreprises non enrichies sont traitées

## ⚠️ Notes importantes

- Le script respecte toujours le rate limiting (200ms entre chaque requête)
- Les entreprises déjà enrichies ne sont **pas** retraitées sauf si `--force` est utilisé
- Le script peut être arrêté et repris à tout moment sans perte de données
- Les doublons de filings sont évités grâce à `accession_number` unique

## 📊 Statistiques

Après chaque exécution, le script affiche :
- Nombre d'entreprises traitées
- Nombre d'entreprises ignorées (déjà enrichies)
- Nombre d'entreprises mises à jour
- Nombre de filings insérés
- Nombre d'erreurs
