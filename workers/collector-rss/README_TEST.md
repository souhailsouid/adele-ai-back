# 🧪 Guide de Test Rapide - Collector RSS

## ⚡ Démarrage Rapide

### 1. Installer les dépendances

```bash
cd workers/collector-rss
npm install
```

### 2. Créer le fichier `.env`

Créez un fichier `.env` dans `workers/collector-rss/` avec :

```bash
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_KEY=votre-service-key-ici
EVENT_BUS_NAME=adel-signals-bus
```

### 3. Tester tous les flux RSS

```bash
npm run test:local
```

### 4. Tester un seul flux RSS

```bash
# Tester Reuters
npm run test:feed reuters

# Tester AP News
npm run test:feed ap

# Tester Yahoo Finance
npm run test:feed yahoo-finance

# Tester CNBC
npm run test:feed cnbc

# Tester MarketWatch
npm run test:feed marketwatch
```

## 📊 Vérifier les résultats dans Supabase

```sql
-- Voir les derniers signaux RSS
SELECT 
  id,
  source,
  type,
  timestamp,
  raw_data->>'title' as title,
  raw_data->>'feed' as feed,
  raw_data->>'url' as url,
  processing_status,
  created_at
FROM signals
WHERE source = 'rss'
ORDER BY created_at DESC
LIMIT 20;
```

## ✅ Résultat attendu

Si tout fonctionne, vous devriez voir :

```
✅ Variables d'environnement chargées
🚀 Démarrage du test collector-rss...
Fetching RSS feed: reuters
Found 20 items in reuters
Signal created and event published: abc-123-def
...
✅ Test réussi !
```

## 🐛 Problèmes courants

### "Missing required environment variable"
→ Vérifiez que le fichier `.env` existe et contient `SUPABASE_URL` et `SUPABASE_SERVICE_KEY`

### "RSS fetch error: 403"
→ Normal, certains flux RSS bloquent les requêtes. Le test devrait continuer avec les autres flux.

### Aucun signal dans Supabase
→ Vérifiez les logs pour voir s'il y a des erreurs d'insertion.


