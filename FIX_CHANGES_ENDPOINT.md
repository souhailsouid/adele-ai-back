# 🔧 Fix: Endpoint /funds/{id}/changes retourne vide

## 🔍 Problème identifié

L'endpoint `/funds/32/changes`` retournait un tableau vide `[]` malgré plusieurs filings `PARSED` car :

1. **Les différences ne sont pas calculées automatiquement** après le parsing
2. **Le paramètre `days` n'était pas pris en compte** dans la fonction `getFundRecentChanges`
3. **La table `fund_holdings_diff` est vide** car elle n'est remplie que lorsque `calculateFundDiff` est appelée

## ✅ Corrections apportées

### 1. Support du paramètre `days` dans `getFundRecentChanges`

**Fichier**: `services/api/src/funds.ts`

- Ajout du paramètre `days?: number` à la fonction
- Filtrage par date du filing si `days` est fourni
- Filtrage côté application pour gérer les jointures avec `fund_filings`

**Fichiers**: `services/api/src/router-funds.ts` et `services/api/src/router.ts`

- Extraction du paramètre `days` depuis les query params
- Passage du paramètre à `getFundRecentChanges`

### 2. Script pour calculer les différences

**Fichier**: `scripts/calculate-fund-diffs.ts`

Script pour calculer les différences pour un fund spécifique en appelant l'API `/funds/{id}/filings/{filingId}/calculate-diff` pour chaque filing parsé.

## 🚀 Utilisation

### Calculer les différences pour le fund 32

```bash
cd /Users/souhailsouid/startup/personamy/backend

# Avec token JWT
ACCESS_TOKEN="votre_token_jwt" npx tsx scripts/calculate-fund-diffs.ts 32

# Ou avec toutes les variables d'environnement
SUPABASE_URL="..." SUPABASE_SERVICE_KEY="..." BASE_URL="..." ACCESS_TOKEN="..." npx tsx scripts/calculate-fund-diffs.ts 32
```

### Vérifier les résultats

Après avoir exécuté le script, vous pouvez vérifier :

```bash
# Vérifier les changements
curl "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/funds/32/changes?min_change_pct=10&days=30"

# Vérifier les diffs
curl "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/funds/32/diffs?limit=50"
```

## 📋 Prochaines étapes (optionnel)

### Automatiser le calcul des différences après le parsing

Pour automatiser le calcul des différences après chaque parsing réussi, vous pouvez :

1. **Option 1**: Appeler l'API depuis le parser Python après un parsing réussi
2. **Option 2**: Créer un worker Lambda qui écoute les événements "13F Parsed" et calcule les diffs
3. **Option 3**: Utiliser un trigger Supabase qui appelle une fonction Edge pour calculer les diffs

**Recommandation**: Option 2 (worker Lambda) pour découpler le parsing du calcul des différences.

## 🔍 Vérification

Pour vérifier que les différences sont bien calculées :

```sql
-- Vérifier les différences dans la base de données
SELECT 
  fhd.*,
  ff_new.filing_date as new_filing_date,
  ff_old.filing_date as old_filing_date
FROM fund_holdings_diff fhd
LEFT JOIN fund_filings ff_new ON fhd.filing_id_new = ff_new.id
LEFT JOIN fund_filings ff_old ON fhd.filing_id_old = ff_old.id
WHERE fhd.fund_id = 32
ORDER BY fhd.created_at DESC
LIMIT 20;
```
