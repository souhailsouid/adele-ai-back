#!/bin/bash
# Script de test pour l'enrichissement des entreprises

API_BASE="https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod"
TOKEN="${1:-$ACCESS_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "❌ Erreur: Token JWT requis"
  echo "Usage: ./test-company-enrichment.sh <TOKEN>"
  exit 1
fi

echo "🧪 Tests d'enrichissement des entreprises"
echo "========================================="
echo ""

# Test 1: Enrichir une entreprise unique (AAPL)
echo "1. Test POST /companies/enrich (AAPL)"
RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL","cik":"0000320193"}' \
  "$API_BASE/companies/enrich")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP:" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  echo "$RESPONSE" | grep -v "HTTP:" | jq '.' 2>/dev/null || echo "$RESPONSE" | grep -v "HTTP:"
else
  echo "   ❌ Status: $HTTP_CODE"
  echo "$RESPONSE" | grep -v "HTTP:"
fi
echo ""

# Test 2: Enrichir plusieurs entreprises en batch
echo "2. Test POST /companies/enrich/batch (AAPL, MSFT, GOOGL)"
RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tickers":["AAPL","MSFT","GOOGL"],"delayMs":200}' \
  "$API_BASE/companies/enrich/batch")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP:" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  echo "$RESPONSE" | grep -v "HTTP:" | jq '.' 2>/dev/null || echo "$RESPONSE" | grep -v "HTTP:"
else
  echo "   ❌ Status: $HTTP_CODE"
  echo "$RESPONSE" | grep -v "HTTP:"
fi
echo ""

# Test 3: Vérifier les secteurs dans la table companies
echo "3. Vérification des secteurs enrichis"
echo "   (Requiert une connexion directe à Supabase)"
echo ""

echo "✅ Tests terminés"
