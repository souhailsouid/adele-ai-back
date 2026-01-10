# ✅ Fix Complet: Endpoint /funds/{id}/changes

## 🔍 Problèmes identifiés et corrigés

### 1. ✅ Fonction `getFundRecentChanges` corrigée

**Fichier**: `services/api/src/funds.ts`

- ✅ Ajout du paramètre `days?: number`
- ✅ Filtrage par date du filing si `days` est fourni
- ✅ Filtrage côté application pour gérer les jointures avec `fund_filings`
- ✅ Gestion correcte des valeurs `null` pour `diff_pct_shares`

**Code corrigé**:
```typescript
export async function getFundRecentChanges(fundId: number, minChangePct = 10, days?: number) {
  // ... filtrage par date si days est fourni
  // ... filtrage par pourcentage pour increase/decrease
  // ... retourne les changements filtrés
}
```

### 2. ✅ Routers mis à jour

**Fichiers**: 
- `services/api/src/router-funds.ts`
- `services/api/src/router.ts`

- ✅ Extraction du paramètre `days` depuis les query params
- ✅ Passage du paramètre à `getFundRecentChanges`

**Code corrigé**:
```typescript
const days = getQueryParam(event, "days") 
  ? parseInt(getQueryParam(event, "days")!) 
  : undefined;
return await getFundRecentChanges(parseInt(id), minChangePct, days);
```

### 3. ✅ Script pour calculer les différences

**Script existant**: `scripts/calculate-all-diffs.ts`

Ce script calcule automatiquement les différences pour **TOUS les funds** :

```bash
# Avec token JWT (recommandé)
ACCESS_TOKEN="votre_token_jwt" npx tsx scripts/calculate-all-diffs.ts

# Ou avec toutes les variables d'environnement
SUPABASE_URL="..." SUPABASE_SERVICE_KEY="..." BASE_URL="..." ACCESS_TOKEN="..." npx tsx scripts/calculate-all-diffs.ts
```

**Fonctionnalités**:
- ✅ Parcourt tous les funds
- ✅ Pour chaque fund, parcourt tous les filings `PARSED`
- ✅ Calcule les différences entre filings consécutifs
- ✅ Insère les résultats dans `fund_holdings_diff`
- ✅ Skip les filings déjà traités
- ✅ Gère les erreurs gracieusement

**Script alternatif**: `scripts/calculate-fund-diffs.ts`

Pour calculer les différences pour un fund spécifique :

```bash
ACCESS_TOKEN="votre_token_jwt" npx tsx scripts/calculate-fund-diffs.ts 32
```

## 🚀 Utilisation

### Étape 1: Calculer les différences pour tous les funds

```bash
cd /Users/souhailsouid/startup/personamy/backend

# Avec token JWT
ACCESS_TOKEN="votre_token_jwt" npx tsx scripts/calculate-all-diffs.ts
```

Le script va :
1. Récupérer tous les funds
2. Pour chaque fund, récupérer tous les filings `PARSED` (triés par date)
3. Pour chaque filing, appeler `/funds/{id}/filings/{filingId}/calculate-diff`
4. Insérer les différences dans `fund_holdings_diff`

**Note**: Le script utilise l'API si `ACCESS_TOKEN` est fourni, sinon il importe directement le service (nécessite d'être exécuté depuis la racine du projet).

### Étape 2: Vérifier les résultats

Après l'exécution, vous pouvez vérifier :

```bash
# Vérifier les changements pour un fund spécifique
curl "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/funds/32/changes?min_change_pct=10&days=30"

# Vérifier les diffs pour un fund spécifique
curl "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/funds/32/diffs?limit=50"
```

## 📊 Vérification dans la base de données

```sql
-- Vérifier les différences calculées
SELECT 
  fhd.*,
  f.name as fund_name,
  ff_new.filing_date as new_filing_date,
  ff_old.filing_date as old_filing_date
FROM fund_holdings_diff fhd
JOIN funds f ON fhd.fund_id = f.id
LEFT JOIN fund_filings ff_new ON fhd.filing_id_new = ff_new.id
LEFT JOIN fund_filings ff_old ON fhd.filing_id_old = ff_old.id
ORDER BY fhd.created_at DESC
LIMIT 50;

-- Compter les différences par fund
SELECT 
  f.id,
  f.name,
  COUNT(fhd.id) as total_diffs
FROM funds f
LEFT JOIN fund_holdings_diff fhd ON f.id = fhd.fund_id
GROUP BY f.id, f.name
ORDER BY total_diffs DESC;
```

## ✅ État de la correction

| Composant | État | Détails |
|-----------|------|---------|
| `getFundRecentChanges` | ✅ Corrigé | Support du paramètre `days` et filtrage par date |
| `router-funds.ts` | ✅ Corrigé | Extraction et passage du paramètre `days` |
| `router.ts` | ✅ Corrigé | Extraction et passage du paramètre `days` |
| `calculate-all-diffs.ts` | ✅ Existant | Script pour calculer les diffs pour tous les funds |
| `calculate-fund-diffs.ts` | ✅ Créé | Script pour calculer les diffs pour un fund spécifique |

## 🔄 Automatisation future (optionnel)

Pour automatiser le calcul des différences après chaque parsing :

1. **Option 1**: Appeler l'API depuis le parser Python après un parsing réussi
2. **Option 2**: Créer un worker Lambda qui écoute les événements "13F Parsed" et calcule les diffs
3. **Option 3**: Utiliser un trigger Supabase qui appelle une fonction Edge

**Recommandation**: Option 2 (worker Lambda) pour découpler le parsing du calcul des différences.
