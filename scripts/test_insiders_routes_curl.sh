#!/bin/bash

# Script pour tester les routes Insiders API avec curl et de vraies données
# Usage: ACCESS_TOKEN="your_token" ./scripts/test_insiders_routes_curl.sh

API_BASE_URL="${API_BASE_URL:-https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod}"
ACCESS_TOKEN="${ACCESS_TOKEN:-}"

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Erreur: ACCESS_TOKEN est requis"
  echo "Usage: ACCESS_TOKEN=\"your_token\" ./scripts/test_insiders_routes_curl.sh"
  exit 1
fi

echo "═══════════════════════════════════════════════════════════"
echo "🧪 TEST DES ROUTES INSIDERS API (avec vraies données)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📍 API URL: $API_BASE_URL"
echo ""

# Test 1: GET /insiders/company/BRR
echo "1️⃣  GET /insiders/company/BRR"
echo "   Description: Transactions pour BRR - ProCap Financial, Inc."
echo "   Données attendues: Purchases de Miller William H IV et Park Jeffrey Jin Hyung"
echo ""
response=$(curl -s -w "\n%{http_code}" -X GET \
  "${API_BASE_URL}/insiders/company/BRR?limit=10" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "   Status: $http_code"
if [ "$http_code" = "200" ]; then
  count=$(echo "$body" | jq '. | length' 2>/dev/null || echo "0")
  echo "   ✅ Résultats: $count transactions"
  if [ "$count" -gt 0 ]; then
    echo "   📋 Exemples:"
    echo "$body" | jq -r '.[0:3] | .[] | "      - \(.insider_name) - \(.transaction_type) - \(.shares) shares @ $\(.price_per_share // "N/A")"' 2>/dev/null || echo "      (Formatage en cours...)"
  fi
else
  echo "   ❌ Erreur: $(echo "$body" | head -3)"
fi
echo ""

# Test 2: GET /insiders/company/LLYVA
echo "2️⃣  GET /insiders/company/LLYVA"
echo "   Description: Transactions pour LLYVA - Liberty Live Holdings, Inc."
echo "   Données attendues: Beaucoup de transactions OTHER et GRANT"
echo ""
response=$(curl -s -w "\n%{http_code}" -X GET \
  "${API_BASE_URL}/insiders/company/LLYVA?limit=5" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "   Status: $http_code"
if [ "$http_code" = "200" ]; then
  count=$(echo "$body" | jq '. | length' 2>/dev/null || echo "0")
  echo "   ✅ Résultats: $count transactions"
  if [ "$count" -gt 0 ]; then
    echo "   📋 Exemples:"
    echo "$body" | jq -r '.[0:3] | .[] | "      - \(.insider_name) - \(.transaction_type) - \(.shares) shares"' 2>/dev/null || echo "      (Formatage en cours...)"
  fi
else
  echo "   ❌ Erreur: $(echo "$body" | head -3)"
fi
echo ""

# Test 3: GET /insiders/person/0002067990
echo "3️⃣  GET /insiders/person/0002067990"
echo "   Description: Track record de Pompliano Anthony John III - CEO de BRR"
echo "   Données attendues: Purchase de 1M USD le 2025-12-17"
echo ""
response=$(curl -s -w "\n%{http_code}" -X GET \
  "${API_BASE_URL}/insiders/person/0002067990" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "   Status: $http_code"
if [ "$http_code" = "200" ]; then
  if echo "$body" | jq -e '.error' > /dev/null 2>&1; then
    echo "   ⚠️  $(echo "$body" | jq -r '.error' 2>/dev/null)"
  else
    name=$(echo "$body" | jq -r '.insider_name // "N/A"' 2>/dev/null)
    companies=$(echo "$body" | jq -r '.total_companies // 0' 2>/dev/null)
    net_value=$(echo "$body" | jq -r '.net_value // 0' 2>/dev/null)
    echo "   ✅ Insider: $name"
    echo "   📊 Companies: $companies"
    echo "   💵 Net Value: \$$(printf "%.2f" $net_value 2>/dev/null || echo "N/A")"
  fi
else
  echo "   ❌ Erreur: $(echo "$body" | head -3)"
fi
echo ""

# Test 4: GET /insiders/signals/hot
echo "4️⃣  GET /insiders/signals/hot"
echo "   Description: Top signals (achats significatifs)"
echo "   Données attendues: Pompliano Anthony John III (BRR) avec score 10"
echo ""
response=$(curl -s -w "\n%{http_code}" -X GET \
  "${API_BASE_URL}/insiders/signals/hot?limit=5&min_score=5" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "   Status: $http_code"
if [ "$http_code" = "200" ]; then
  count=$(echo "$body" | jq '. | length' 2>/dev/null || echo "0")
  echo "   ✅ Résultats: $count signals"
  if [ "$count" -gt 0 ]; then
    echo "   🔥 Top Signals:"
    echo "$body" | jq -r '.[0:5] | .[] | "      - \(.ticker // "N/A") - \(.insider_name // "N/A") - Score: \(.signal_score // 0) - $\(.total_value // 0)"' 2>/dev/null || echo "      (Formatage en cours...)"
  else
    echo "   ⚠️  Aucun signal trouvé"
  fi
else
  echo "   ❌ Erreur: $(echo "$body" | head -3)"
fi
echo ""

# Test 5: GET /insiders/trending
echo "5️⃣  GET /insiders/trending"
echo "   Description: Top entreprises avec achats d'insiders (30 derniers jours)"
echo ""
response=$(curl -s -w "\n%{http_code}" -X GET \
  "${API_BASE_URL}/insiders/trending?days=30&limit=10" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')
echo "   Status: $http_code"
if [ "$http_code" = "200" ]; then
  count=$(echo "$body" | jq '. | length' 2>/dev/null || echo "0")
  echo "   ✅ Résultats: $count entreprises"
  if [ "$count" -gt 0 ]; then
    echo "   🏆 Top 3:"
    echo "$body" | jq -r '.[0:3] | .[] | "      - \(.ticker // "N/A") - Net: $\(.net_value // 0) - \(.transaction_count // 0) transactions"' 2>/dev/null || echo "      (Formatage en cours...)"
  else
    echo "   ⚠️  Aucune entreprise trouvée (normal si pas d'achats récents)"
  fi
else
  echo "   ❌ Erreur: $(echo "$body" | head -3)"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "✅ TESTS TERMINÉS"
echo "═══════════════════════════════════════════════════════════"
