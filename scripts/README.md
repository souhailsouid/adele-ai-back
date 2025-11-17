# Scripts Utilitaires

## parse-existing-filings.py

Parse manuellement tous les filings 13F existants dans Supabase qui ont le status "DISCOVERED".

### Utilisation

```bash
cd /Users/souhailsouid/startup/personamy/backend

# Définir les variables d'environnement (ou les modifier dans le script)
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-key"

# Installer les dépendances si nécessaire
pip install requests beautifulsoup4 supabase

# Exécuter le script
python3 scripts/parse-existing-filings.py
```

### Ce que fait le script

1. Récupère tous les filings avec `status = 'DISCOVERED'` depuis Supabase
2. Pour chaque filing :
   - Construit l'URL du fichier XML depuis l'accession number
   - Télécharge le fichier XML depuis EDGAR
   - Parse les holdings
   - Insère dans `fund_holdings`
   - Met à jour le status à "PARSED"

### Résultat

Après exécution, tous les filings existants seront parsés et les holdings seront dans `fund_holdings`.

