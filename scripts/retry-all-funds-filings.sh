#!/bin/bash

# Script pour re-parser tous les filings FAILED et DISCOVERED de toutes les institutions
# Usage: ./scripts/retry-all-funds-filings.sh [--status=FAILED|DISCOVERED|ALL]
# Exemple: ./scripts/retry-all-funds-filings.sh --status=FAILED
# Exemple: ./scripts/retry-all-funds-filings.sh --status=ALL

set -e

# Obtenir le répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Charger les variables d'environnement
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

STATUS=${1#--status=}  # Extraire la valeur après --status=

# Si status n'est pas fourni, utiliser FAILED et DISCOVERED par défaut
if [ -z "$STATUS" ] || [ "$STATUS" = "--status=" ]; then
  STATUSES=("FAILED" "DISCOVERED")
else
  STATUSES=("$STATUS")
fi

echo "🔄 Re-parsing filings for ALL funds (status: ${STATUSES[*]})"
echo ""

# Construire l'URL de l'API
API_URL="${API_URL:-https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod}"

# Vérifier si on a un token JWT (requis pour cette API)
if [ -z "$JWT_TOKEN" ]; then
  echo "❌ JWT_TOKEN is required for this API."
  echo "   Set it with: export JWT_TOKEN=your_token_here"
  echo ""
  echo "   Or get a token from your Cognito user pool."
  exit 1
fi

# Récupérer tous les funds
echo "📋 Fetching all funds..."
FUNDS_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
  "${API_URL}/funds" \
  -H "Authorization: Bearer $JWT_TOKEN")

# Séparer la réponse et le code HTTP
HTTP_CODE=$(echo "$FUNDS_RESPONSE" | tail -n1)
FUNDS_BODY=$(echo "$FUNDS_RESPONSE" | sed '$d')

# Vérifier le code HTTP
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Error fetching funds: HTTP $HTTP_CODE"
  echo "$FUNDS_BODY" | jq '.' 2>/dev/null || echo "$FUNDS_BODY"
  exit 1
fi

# Extraire les IDs des funds (utiliser jq si disponible, sinon parser manuellement)
if command -v jq &> /dev/null; then
  FUND_IDS=$(echo "$FUNDS_BODY" | jq -r '.[].id')
  FUND_NAMES=$(echo "$FUNDS_BODY" | jq -r '.[] | "\(.id): \(.name)"')
else
  echo "⚠️  jq is not installed. Please install it for better output."
  echo "$FUNDS_BODY"
  exit 1
fi

# Compter le nombre de funds
FUND_COUNT=$(echo "$FUND_IDS" | wc -l | tr -d ' ')
echo "✅ Found $FUND_COUNT funds"
echo ""

# Statistiques globales
TOTAL_RETRIED=0
TOTAL_ERRORS=0
SUCCESSFUL_FUNDS=0
FAILED_FUNDS=0

# Pour chaque fund, re-parser les filings
for FUND_ID in $FUND_IDS; do
  FUND_NAME=$(echo "$FUND_NAMES" | grep "^${FUND_ID}:" | cut -d: -f2- | xargs)
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 Fund #$FUND_ID: $FUND_NAME"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  FUND_RETRIED=0
  FUND_ERRORS=0
  
  # Pour chaque statut demandé
  for STATUS in "${STATUSES[@]}"; do
    echo ""
    echo "  🔄 Processing status: $STATUS"
    
    # Construire le body JSON
    BODY="{\"status\": \"$STATUS\"}"
    
    # Appeler l'API pour ce fund et ce statut
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
      "${API_URL}/funds/${FUND_ID}/filings/retry-all" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -d "$BODY")
    
    # Séparer la réponse et le code HTTP
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY_RESPONSE=$(echo "$RESPONSE" | sed '$d')
    
    # Vérifier le code HTTP
    if [ "$HTTP_CODE" = "200" ]; then
      if command -v jq &> /dev/null; then
        RETRIED=$(echo "$BODY_RESPONSE" | jq -r '.retried // 0')
        ERRORS=$(echo "$BODY_RESPONSE" | jq -r '.errors // 0')
        FUND_RETRIED=$((FUND_RETRIED + RETRIED))
        FUND_ERRORS=$((FUND_ERRORS + ERRORS))
        
        if [ "$RETRIED" -gt 0 ]; then
          echo "    ✅ Retried $RETRIED filing(s), $ERRORS error(s)"
        else
          echo "    ℹ️  No filings to retry"
        fi
      else
        echo "    ✅ Success"
        echo "$BODY_RESPONSE"
      fi
    else
      echo "    ❌ Error: HTTP $HTTP_CODE"
      echo "$BODY_RESPONSE" | jq '.' 2>/dev/null || echo "$BODY_RESPONSE"
      FUND_ERRORS=$((FUND_ERRORS + 1))
    fi
    
    # Petite pause pour éviter de surcharger l'API
    sleep 0.5
  done
  
  # Mettre à jour les statistiques globales
  TOTAL_RETRIED=$((TOTAL_RETRIED + FUND_RETRIED))
  TOTAL_ERRORS=$((TOTAL_ERRORS + FUND_ERRORS))
  
  if [ "$FUND_ERRORS" -eq 0 ]; then
    SUCCESSFUL_FUNDS=$((SUCCESSFUL_FUNDS + 1))
  else
    FAILED_FUNDS=$((FAILED_FUNDS + 1))
  fi
  
  echo ""
  echo "  📊 Fund summary: $FUND_RETRIED retried, $FUND_ERRORS error(s)"
  echo ""
done

# Résumé final
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 FINAL SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Total funds processed: $FUND_COUNT"
echo "✅ Successful funds: $SUCCESSFUL_FUNDS"
echo "❌ Failed funds: $FAILED_FUNDS"
echo "🔄 Total filings retried: $TOTAL_RETRIED"
echo "❌ Total errors: $TOTAL_ERRORS"
echo ""
