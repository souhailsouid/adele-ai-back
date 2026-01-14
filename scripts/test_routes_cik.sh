#!/bin/bash
# Script de test des routes avec CIK

TOKEN="${1:-$TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "❌ Erreur: Token manquant"
  echo "Usage: $0 <token>"
  exit 1
fi

API_BASE="https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod"
API_FUNDS="https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod"

echo "═══════════════════════════════════════════════════════════"
echo "🧪 TESTS ROUTES AVEC CIK"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. Récupérer un fund
echo "1️⃣  GET /funds (liste):"
FUNDS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/funds")
CIK=$(echo "$FUNDS" | jq -r '.[0].cik // empty' 2>/dev/null)
NAME=$(echo "$FUNDS" | jq -r '.[0].name // empty' 2>/dev/null)

if [ -z "$CIK" ] || [ "$CIK" = "null" ]; then
  echo "❌ Aucun fund trouvé"
  exit 1
fi

echo "✅ Fund trouvé: $NAME (CIK: $CIK)"
echo ""

# 2. Tester GET /funds/{cik}
echo "2️⃣  GET /funds/$CIK:"
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_FUNDS/funds/$CIK")
if echo "$RESPONSE" | jq -e '.cik' >/dev/null 2>&1; then
  echo "✅ Route fonctionne: $(echo "$RESPONSE" | jq -r '.name // "N/A"')"
else
  echo "❌ Erreur: $RESPONSE"
fi
echo ""

# 3. Tester GET /funds/{cik}/filings
echo "3️⃣  GET /funds/$CIK/filings:"
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_FUNDS/funds/$CIK/filings")
if echo "$RESPONSE" | jq -e 'type == "array"' >/dev/null 2>&1; then
  COUNT=$(echo "$RESPONSE" | jq 'length')
  echo "✅ Route fonctionne: $COUNT filings"
else
  echo "❌ Erreur: $RESPONSE"
fi
echo ""

# 4. Tester GET /funds/{cik}/diffs
echo "4️⃣  GET /funds/$CIK/diffs:"
RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_FUNDS/funds/$CIK/diffs")
if echo "$RESPONSE" | jq -e 'type == "array"' >/dev/null 2>&1; then
  COUNT=$(echo "$RESPONSE" | jq 'length')
  echo "✅ Route fonctionne: $COUNT diffs"
else
  echo "❌ Erreur: $RESPONSE"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "✅ Tests terminés"
echo "═══════════════════════════════════════════════════════════"
