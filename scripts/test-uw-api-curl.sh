#!/bin/bash
# Script de test curl pour l'API Unusual Whales
# Usage: ./scripts/test-uw-api-curl.sh [API_KEY] [ENDPOINT]

API_KEY="${1:-${UNUSUAL_WHALES_API_KEY}}"
ENDPOINT="${2:-/option-trades/flow-alerts?limit=100&min_premium=1000000}"

if [ -z "$API_KEY" ]; then
  echo "❌ Erreur: UNUSUAL_WHALES_API_KEY manquante"
  echo ""
  echo "Usage:"
  echo "  ./scripts/test-uw-api-curl.sh [API_KEY] [ENDPOINT]"
  echo ""
  echo "Exemples:"
  echo "  ./scripts/test-uw-api-curl.sh VOTRE_CLE"
  echo "  ./scripts/test-uw-api-curl.sh VOTRE_CLE '/stock/AAPL/greeks'"
  echo "  ./scripts/test-uw-api-curl.sh VOTRE_CLE '/option-trades/flow-alerts?limit=10'"
  exit 1
fi

# Nettoyer le token (enlever les espaces)
API_KEY=$(echo "$API_KEY" | xargs)

BASE_URL="https://api.unusualwhales.com/api"
FULL_URL="${BASE_URL}${ENDPOINT}"

echo "🔍 Test de l'API Unusual Whales"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "URL: $FULL_URL"
echo "Token length: ${#API_KEY} caractères"
echo "Token prefix: ${API_KEY:0:10}..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test avec curl
response=$(curl -s -w "\n%{http_code}" --request GET \
  --url "$FULL_URL" \
  --header 'Accept: application/json, text/plain' \
  --header 'Content-Type: application/json' \
  --header "Authorization: Bearer $API_KEY")

# Séparer le body et le status code
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

echo "📊 Résultat:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "HTTP Status: $http_code"
echo ""

if [ "$http_code" = "200" ]; then
  echo "✅ Succès! La clé API est valide"
  echo ""
  echo "Réponse (premiers 500 caractères):"
  echo "$body" | head -c 500
  echo ""
  if [ ${#body} -gt 500 ]; then
    echo "... (tronqué, ${#body} caractères au total)"
  fi
elif [ "$http_code" = "401" ]; then
  echo "❌ Erreur 401: Authentification échouée"
  echo ""
  echo "Réponse complète:"
  echo "$body"
  echo ""
  echo "🔴 Causes possibles:"
  echo "  1. La clé API est invalide ou expirée"
  echo "  2. La clé API n'a pas les permissions nécessaires"
  echo "  3. Le format de la clé est incorrect"
  echo ""
  echo "💡 Solutions:"
  echo "  1. Vérifier la clé dans votre compte Unusual Whales"
  echo "  2. Générer une nouvelle clé si nécessaire"
  echo "  3. Mettre à jour dans Terraform:"
  echo "     terraform apply -var=\"unusual_whales_api_key=$API_KEY\""
else
  echo "⚠️  Erreur HTTP $http_code"
  echo ""
  echo "Réponse:"
  echo "$body"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
