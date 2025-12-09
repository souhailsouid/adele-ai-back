# 📜 Scripts de Test et Débogage

## 🚀 Utilisation Rapide

### Test de l'API en Production

```bash
# Tester tous les endpoints Ticker Activity
./scripts/test-ticker-activity-api.sh "YOUR_ACCESS_TOKEN" TSLA

# Tester tous les endpoints Unusual Whales
./scripts/test-uw-endpoints.sh

# Tester tous les endpoints FMP
./scripts/test-fmp-endpoints.sh

# Tester un seul endpoint
./scripts/test-single-endpoint.sh "YOUR_ACCESS_TOKEN" "/ticker-activity/TSLA/quote"
```

### Débogage Local en Temps Réel

```bash
# Lancer le serveur local
./scripts/start-local-server.sh

# Dans un autre terminal, tester
TOKEN="YOUR_ACCESS_TOKEN"
curl http://localhost:3001/ticker-activity/TSLA/quote \
  -H "Authorization: Bearer $TOKEN"
```

## 📁 Fichiers Créés

### Scripts Shell

1. **`scripts/test-ticker-activity-api.sh`**
   - Teste tous les endpoints de l'API
   - Affiche les résultats avec des couleurs
   - Utilise `jq` pour formater les réponses JSON

2. **`scripts/test-single-endpoint.sh`**
   - Teste un seul endpoint spécifique
   - Utile pour déboguer un problème précis

3. **`scripts/test-uw-endpoints.sh`**
   - Teste tous les endpoints Unusual Whales
   - Couvre 108+ endpoints (alerts, congress, darkpool, earnings, etfs, etc.)
   - Usage: `./scripts/test-uw-endpoints.sh [API_GATEWAY_URL]`

4. **`scripts/test-fmp-endpoints.sh`**
   - Teste tous les endpoints FMP (Financial Modeling Prep)
   - Couvre 23 endpoints (quote, financial statements, company search, etc.)
   - Usage: `./scripts/test-fmp-endpoints.sh [API_GATEWAY_URL]`

5. **`scripts/start-local-server.sh`**
   - Lance le serveur local avec toutes les variables d'environnement
   - Configure automatiquement les clés API

### Scripts TypeScript

4. **`scripts/local-server.ts`**
   - Serveur HTTP local qui simule API Gateway
   - Décode automatiquement les JWT pour extraire les claims
   - Permet le débogage en temps réel avec breakpoints

### Documentation

5. **`LOCAL_DEBUG_GUIDE.md`**
   - Guide complet pour toutes les méthodes de débogage
   - Instructions pour VS Code Debugger
   - Configuration AWS SAM Local

6. **`QUICK_START_DEBUG.md`**
   - Guide rapide pour démarrer immédiatement
   - Exemples pratiques

## 🔧 Configuration VS Code

Créez `.vscode/launch.json` :

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Local Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/services/api",
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_KEY": "VOTRE_CLE_SUPABASE",
        "COGNITO_ISSUER": "https://cognito-idp.eu-west-3.amazonaws.com/eu-west-3_FQDmhxV14",
        "COGNITO_AUDIENCE": "pkp4i82jnttthj2cbiltudgva",
        "UNUSUAL_WHALES_API_KEY": "VOTRE_CLE_UW",
        "FMP_API_KEY": "VOTRE_CLE_FMP"
      },
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

## ✅ Prérequis

- `jq` installé (pour formater JSON) : `brew install jq`
- `tsx` installé (déjà dans `devDependencies`)
- Variables d'environnement configurées (ou utiliser les valeurs par défaut dans le script)

## 🎯 Workflow Recommandé

1. **Développement** : Utiliser le serveur local avec VS Code Debugger
2. **Test rapide** : Utiliser `test-single-endpoint.sh`
3. **Test complet** : Utiliser `test-ticker-activity-api.sh`
4. **Production** : Déployer et tester avec les scripts de test

## 📝 Notes

- Le serveur local écoute sur le port **3001** par défaut
- Les tokens JWT sont automatiquement décodés pour simuler API Gateway
- Les logs sont affichés dans la console pour faciliter le débogage
- Tous les scripts sont exécutables (`chmod +x`)

