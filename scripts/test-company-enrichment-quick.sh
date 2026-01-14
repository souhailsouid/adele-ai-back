#!/bin/bash

# Script de test rapide pour l'enrichissement d'entreprises
# Usage: ./scripts/test-company-enrichment-quick.sh [TOKEN] [TICKER]

TOKEN="${1:-$ACCESS_TOKEN}"
TICKER="${2:-TSLA}"
API_BASE="${API_BASE_URL:-https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod}"

if [ -z "$TOKEN" ]; then
  echo "❌ Erreur: Token JWT requis"
  echo "Usage: ./scripts/test-company-enrichment-quick.sh [TOKEN] [TICKER]"
  exit 1
fi

echo "🧪 Test d'enrichissement d'entreprise"
echo "===================================="
echo ""
echo "📍 API: $API_BASE"
echo "📊 Ticker: $TICKER"
echo ""

# Test 1: Récupérer l'entreprise (avant enrichissement)
echo "1️⃣  Récupération de l'entreprise..."
RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" \
  -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/companies/ticker/$TICKER")

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP:/d')

if [ "$HTTP_CODE" = "200" ]; then
  SECTOR=$(echo "$BODY" | jq -r '.sector // "NULL"' 2>/dev/null || echo "NULL")
  echo "   ✅ Status: $HTTP_CODE"
  echo "   📊 Secteur actuel: $SECTOR"
  
  if [ "$SECTOR" = "null" ] || [ "$SECTOR" = "NULL" ]; then
    echo ""
    echo "2️⃣  Enrichissement depuis FMP..."
    ENRICH_RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" \
      -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"ticker\": \"$TICKER\"}" \
      "$API_BASE/companies/enrich")
    
    ENRICH_HTTP=$(echo "$ENRICH_RESPONSE" | grep "HTTP:" | cut -d: -f2)
    ENRICH_BODY=$(echo "$ENRICH_RESPONSE" | sed '/HTTP:/d')
    
    if [ "$ENRICH_HTTP" = "200" ]; then
      ENRICH_SECTOR=$(echo "$ENRICH_BODY" | jq -r '.sector // "NULL"' 2>/dev/null || echo "NULL")
      ENRICH_ERROR=$(echo "$ENRICH_BODY" | jq -r '.error // ""' 2>/dev/null || echo "")
      
      echo "   ✅ Status: $ENRICH_HTTP"
      echo "   📊 Secteur enrichi: $ENRICH_SECTOR"
      
      if [ -n "$ENRICH_ERROR" ] && [ "$ENRICH_ERROR" != "null" ]; then
        echo "   ⚠️  Erreur: $ENRICH_ERROR"
      fi
      
      echo ""
      echo "3️⃣  Vérification après enrichissement..."
      sleep 1
      
      FINAL_RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" \
        -H "Authorization: Bearer $TOKEN" \
        "$API_BASE/companies/ticker/$TICKER")
      
      FINAL_HTTP=$(echo "$FINAL_RESPONSE" | grep "HTTP:" | cut -d: -f2)
      FINAL_BODY=$(echo "$FINAL_RESPONSE" | sed '/HTTP:/d')
      
      if [ "$FINAL_HTTP" = "200" ]; then
        FINAL_SECTOR=$(echo "$FINAL_BODY" | jq -r '.sector // "NULL"' 2>/dev/null || echo "NULL")
        echo "   ✅ Status: $FINAL_HTTP"
        echo "   📊 Secteur final: $FINAL_SECTOR"
        
        if [ "$FINAL_SECTOR" != "null" ] && [ "$FINAL_SECTOR" != "NULL" ]; then
          echo ""
          echo "✅ SUCCÈS ! Le secteur a été enrichi avec succès."
        else
          echo ""
          echo "⚠️  Le secteur est toujours NULL. Vérifiez les logs."
        fi
      else
        echo "   ❌ Status: $FINAL_HTTP"
        echo "$FINAL_BODY" | jq '.' 2>/dev/null || echo "$FINAL_BODY"
      fi
    else
      echo "   ❌ Status: $ENRICH_HTTP"
      echo "$ENRICH_BODY" | jq '.' 2>/dev/null || echo "$ENRICH_BODY"
    fi
  else
    echo ""
    echo "✅ L'entreprise a déjà un secteur, pas besoin d'enrichissement."
  fi
else
  if [ "$HTTP_CODE" = "404" ]; then
    echo "   ⚠️  Entreprise non trouvée, tentative d'enrichissement..."
    echo ""
    echo "2️⃣  Enrichissement depuis FMP..."
    ENRICH_RESPONSE=$(curl -s -w "\nHTTP:%{http_code}" \
      -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"ticker\": \"$TICKER\"}" \
      "$API_BASE/companies/enrich")
    
    ENRICH_HTTP=$(echo "$ENRICH_RESPONSE" | grep "HTTP:" | cut -d: -f2)
    ENRICH_BODY=$(echo "$ENRICH_RESPONSE" | sed '/HTTP:/d')
    
    echo "   Status: $ENRICH_HTTP"
    echo "$ENRICH_BODY" | jq '.' 2>/dev/null || echo "$ENRICH_BODY"
  else
    echo "   ❌ Status: $HTTP_CODE"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  fi
fi

echo ""
echo "===================================="
echo "✅ Test terminé"
