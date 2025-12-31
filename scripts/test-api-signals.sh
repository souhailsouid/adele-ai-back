#!/bin/bash

# Script de test pour l'API Signals
# Usage: ./scripts/test-api-signals.sh [JWT_TOKEN]

API_URL="https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod"
JWT_TOKEN="${1:-}"

echo "🧪 Test de l'API Signals"
echo "=========================="
echo ""

# Test 1: Vérifier que l'endpoint existe (sans auth - devrait retourner 401)
echo "📋 Test 1: Vérification de l'endpoint (sans auth)"
echo "URL: ${API_URL}/signals?source=rss&type=macro&limit=5"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_URL}/signals?source=rss&type=macro&limit=5" \
  -H "Content-Type: application/json")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "Code HTTP: $HTTP_CODE"
echo "Réponse: $BODY"
echo ""

if [ "$HTTP_CODE" == "401" ]; then
  echo "✅ Endpoint existe et nécessite une authentification (401 attendu)"
elif [ "$HTTP_CODE" == "200" ]; then
  echo "✅ Endpoint fonctionne et retourne des données"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo "⚠️  Code HTTP inattendu: $HTTP_CODE"
fi

echo ""
echo "=========================="
echo ""

# Test 2: Avec JWT Token (si fourni)
if [ -n "$JWT_TOKEN" ]; then
  echo "📋 Test 2: Avec authentification JWT"
  echo "URL: ${API_URL}/signals?source=rss&type=macro&min_importance=7&limit=10"
  echo ""

  RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${API_URL}/signals?source=rss&type=macro&min_importance=7&limit=10" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JWT_TOKEN}")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  echo "Code HTTP: $HTTP_CODE"
  
  if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ API fonctionne correctement avec authentification"
    echo ""
    echo "Nombre de signaux: $(echo "$BODY" | jq '. | length' 2>/dev/null || echo 'N/A')"
    echo ""
    echo "Premier signal:"
    echo "$BODY" | jq '.[0] | {id, source, type, timestamp, raw_data: {title, extracted_data}}' 2>/dev/null || echo "$BODY" | head -20
    
    # Vérifier extracted_data
    HAS_EXTRACTED_DATA=$(echo "$BODY" | jq '[.[] | select(.raw_data.extracted_data != null)] | length' 2>/dev/null || echo "0")
    echo ""
    echo "Signaux avec extracted_data: $HAS_EXTRACTED_DATA"
  else
    echo "❌ Erreur: Code HTTP $HTTP_CODE"
    echo "Réponse: $BODY"
  fi
else
  echo "ℹ️  Pour tester avec authentification, fournissez un JWT token:"
  echo "   ./scripts/test-api-signals.sh YOUR_JWT_TOKEN"
fi

echo ""
echo "=========================="
echo ""

# Test 3: Vérifier les paramètres
echo "📋 Test 3: Vérification des paramètres"
echo ""

if [ -n "$JWT_TOKEN" ]; then
  # Test avec différents paramètres
  echo "Test avec source=rss&type=macro&limit=3:"
  curl -s -X GET "${API_URL}/signals?source=rss&type=macro&limit=3" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -H "Content-Type: application/json" | jq 'length' 2>/dev/null || echo "Erreur"
  
  echo ""
  echo "Test avec min_importance=8:"
  curl -s -X GET "${API_URL}/signals?source=rss&type=macro&min_importance=8&limit=5" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -H "Content-Type: application/json" | jq 'length' 2>/dev/null || echo "Erreur"
fi

echo ""
echo "✅ Tests terminés"


