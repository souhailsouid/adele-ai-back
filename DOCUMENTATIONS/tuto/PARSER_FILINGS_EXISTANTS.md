# 🔄 Parser les Filings Existants

## ❓ Problème

Les filings déjà détectés (status: "DISCOVERED") ne déclencheront **pas automatiquement** le parser car :
- Le SEC Watcher ne publie un événement EventBridge que pour les **nouveaux** filings
- Les filings existants sont déjà dans `fund_filings` mais n'ont pas été parsés

## ✅ Solution : Script de Parsing Manuel

J'ai créé un script pour parser tous les filings existants : `scripts/parse-existing-filings.py`

### Utilisation

```bash
cd /Users/souhailsouid/startup/personamy/backend

# 1. Installer les dépendances (si pas déjà fait)
pip install requests beautifulsoup4 supabase

# 2. Définir les variables d'environnement
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-key"

# 3. Exécuter le script
python3 scripts/parse-existing-filings.py
```

### Ce que fait le script

1. ✅ Récupère tous les filings avec `status = 'DISCOVERED'`
2. ✅ Pour chaque filing :
   - Construit l'URL XML depuis l'accession number
   - Télécharge le fichier XML depuis EDGAR
   - Parse les holdings
   - Insère dans `fund_holdings`
   - Met à jour le status à "PARSED"

### Résultat

Après exécution :
- ✅ Tous les filings existants seront parsés
- ✅ Les holdings seront dans `fund_holdings`
- ✅ Les status seront mis à jour à "PARSED"

## 🔄 Pour les Nouveaux Filings

Les **nouveaux** filings détectés à l'avenir seront automatiquement parsés car :
- Le SEC Watcher publie un événement EventBridge
- Le parser 13F Lambda est déclenché automatiquement
- Les holdings sont insérés automatiquement

## 📊 Vérification

### Avant le script

```sql
-- Voir les filings non parsés
SELECT COUNT(*) FROM fund_filings WHERE status = 'DISCOVERED';
-- Devrait retourner le nombre de filings à parser

-- Voir les holdings (devrait être vide ou peu)
SELECT COUNT(*) FROM fund_holdings;
```

### Après le script

```sql
-- Voir les filings parsés
SELECT COUNT(*) FROM fund_filings WHERE status = 'PARSED';

-- Voir les holdings parsés
SELECT COUNT(*) FROM fund_holdings;

-- Voir quelques exemples
SELECT 
  h.ticker,
  h.shares,
  h.market_value,
  f.filing_date,
  funds.name as fund_name
FROM fund_holdings h
JOIN fund_filings f ON h.filing_id = f.id
JOIN funds ON h.fund_id = funds.id
ORDER BY f.filing_date DESC, h.market_value DESC
LIMIT 20;
```

## ⚠️ Note

Le script parse **tous** les filings avec status "DISCOVERED". Si certains ont déjà été parsés, ils seront ignorés (pas de doublons grâce aux contraintes de la base).

