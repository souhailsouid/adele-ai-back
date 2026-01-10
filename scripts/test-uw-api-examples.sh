# Exemples de commandes curl pour l'API Unusual Whales

## ⚠️ Important
Remplacez `YOUR_API_KEY` par votre vraie clé API Unusual Whales.

---

## 1. Test de base - Flow Alerts (l'endpoint qui pose problème)

```bash
curl --request GET \
  --url 'https://api.unusualwhales.com/api/option-trades/flow-alerts?limit=100&min_premium=1000000' \
  --header 'Accept: application/json, text/plain' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

---

## 2. Test avec un ticker spécifique

```bash
curl --request GET \
  --url 'https://api.unusualwhales.com/api/option-trades/flow-alerts?ticker_symbol=AAPL&limit=10' \
  --header 'Accept: application/json, text/plain' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

---

## 3. Test Greeks (exemple que tu as mentionné)

```bash
curl --request GET \
  --url 'https://api.unusualwhales.com/api/stock/AAPL/greeks' \
  --header 'Accept: application/json, text/plain' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

---

## 4. Test avec variables d'environnement

```bash
# Définir la clé API
export UNUSUAL_WHALES_API_KEY="YOUR_API_KEY"

# Utiliser dans curl
curl --request GET \
  --url 'https://api.unusualwhales.com/api/option-trades/flow-alerts?limit=10' \
  --header 'Accept: application/json, text/plain' \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $UNUSUAL_WHALES_API_KEY"
```

---

## 5. Test avec affichage des headers de réponse

```bash
curl -i --request GET \
  --url 'https://api.unusualwhales.com/api/option-trades/flow-alerts?limit=10' \
  --header 'Accept: application/json, text/plain' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY'
```

---

## 6. Test avec formatage JSON (jq)

```bash
curl --request GET \
  --url 'https://api.unusualwhales.com/api/option-trades/flow-alerts?limit=5' \
  --header 'Accept: application/json, text/plain' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_API_KEY' \
  | jq '.'
```

---

## 7. Test avec script bash (recommandé)

Utilise le script fourni :

```bash
./scripts/test-uw-api-curl.sh YOUR_API_KEY
```

Ou avec un endpoint spécifique :

```bash
./scripts/test-uw-api-curl.sh YOUR_API_KEY '/stock/AAPL/greeks'
```

---

## 🔍 Diagnostic des erreurs

### Erreur 401 Unauthorized

Si tu reçois une erreur 401, cela signifie que :
- La clé API est invalide ou expirée
- La clé API n'a pas les permissions nécessaires
- Le format de la clé est incorrect (espaces, caractères invalides)

**Solution :**
1. Vérifie la clé dans ton compte Unusual Whales
2. Génère une nouvelle clé si nécessaire
3. Assure-toi qu'il n'y a pas d'espaces avant/après la clé
4. Mets à jour dans Terraform : `terraform apply -var="unusual_whales_api_key=TA_NOUVELLE_CLE"`

### Erreur 429 Too Many Requests

Tu as dépassé la limite de taux. Attends quelques secondes avant de réessayer.

### Erreur 400 Bad Request

Les paramètres de la requête sont invalides. Vérifie la syntaxe de l'URL et des paramètres.

---

## 📝 Notes

- Tous les endpoints nécessitent le header `Authorization: Bearer YOUR_API_KEY`
- Le format Bearer token est obligatoire
- Certains endpoints peuvent nécessiter des paramètres spécifiques
- Consulte la documentation Unusual Whales pour la liste complète des endpoints
