#!/bin/bash
# Script de test rapide pour toutes les routes importantes
# Usage: ./scripts/test-all-routes.sh <TOKEN>

TOKEN="${1:-$ACCESS_TOKEN}"
API_BASE="https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod"

if [ -z "$TOKEN" ]; then
  echo "❌ Erreur: Token JWT requis"
  echo "Usage: ./scripts/test-all-routes.sh <TOKEN>"
  exit 1
fi

echo "🧪 Tests des Routes API"
echo "======================"
echo ""

# Test 1: Analyse stratégique
echo "1. Test /funds/32/diffs/strategic"
RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/funds/32/diffs/strategic?limit=10")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP:" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  ALL_MOVEMENTS=$(echo "$RESPONSE" | jq '.all_movements | length' 2>/dev/null || echo "N/A")
  echo "   📊 all_movements: $ALL_MOVEMENTS mouvements"
else
  echo "   ❌ Status: $HTTP_CODE"
fi
echo ""

# Test 2: Notifications d'accumulation
echo "2. Test /notifications/accumulations?only_global=true"
RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/notifications/accumulations?only_global=true&limit=10")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP:" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  COUNT=$(echo "$RESPONSE" | jq '. | length' 2>/dev/null || echo "N/A")
  echo "   📊 Accumulations: $COUNT"
else
  echo "   ❌ Status: $HTTP_CODE"
fi
echo ""

# Test 3: Analyse stratégique avec include_low_conviction
echo "3. Test /funds/32/diffs/strategic?include_low_conviction=true"
RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/funds/32/diffs/strategic?limit=10&include_low_conviction=true")
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP:" | cut -d: -f2)
if [ "$HTTP_CODE" = "200" ]; then
  echo "   ✅ Status: $HTTP_CODE"
  ALL_MOVEMENTS=$(echo "$RESPONSE" | jq '.all_movements | length' 2>/dev/null || echo "N/A")
  echo "   📊 all_movements (avec low): $ALL_MOVEMENTS mouvements"
else
  echo "   ❌ Status: $HTTP_CODE"
fi
echo ""

echo "✅ Tests terminés"
