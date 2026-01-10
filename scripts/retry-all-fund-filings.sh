#!/bin/bash

# Script pour re-parser tous les filings d'un fund
# Usage: ./scripts/retry-all-fund-filings.sh <fund_id> [--status=FAILED|DISCOVERED|ALL]
# Exemple: ./scripts/retry-all-fund-filings.sh 32 --status=FAILED
# Exemple: ./scripts/retry-all-fund-filings.sh 27 --status=ALL

set -e

# Obtenir le répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Charger les variables d'environnement
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Vérifier que le fund_id est fourni
if [ -z "$1" ]; then
  echo "❌ Usage: ./scripts/retry-all-fund-filings.sh <fund_id> [--status=FAILED|DISCOVERED|ALL]"
  echo "   Exemple: ./scripts/retry-all-fund-filings.sh 32 --status=FAILED"
  echo "   Exemple: ./scripts/retry-all-fund-filings.sh 27 --status=ALL"
  exit 1
fi

FUND_ID=$1
STATUS=${2#--status=}  # Extraire la valeur après --status=

# Si status n'est pas fourni, utiliser FAILED par défaut
if [ -z "$STATUS" ] || [ "$STATUS" = "--status=" ]; then
  STATUS="FAILED"
fi

echo "🔄 Re-parsing all filings for fund $FUND_ID (status: $STATUS)"
echo ""

# Construire le body JSON
BODY="{\"status\": \"$STATUS\"}"

# Appeler l'API (nécessite une variable d'environnement API_URL ou utiliser l'URL directement)
API_URL="${API_URL:-https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod}"

# Vérifier si on a un token JWT (requis pour cette API)
if [ -z "$JWT_TOKEN" ]; then
  echo "❌ JWT_TOKEN is required for this API."
  echo "   Set it with: export JWT_TOKEN=your_token_here"
  echo ""
  echo "   Or get a token from your Cognito user pool."
  exit 1
fi

# Faire l'appel API
echo "📡 Calling API..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${API_URL}/funds/${FUND_ID}/filings/retry-all" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d "$BODY")

# Séparer la réponse et le code HTTP
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Vérifier le code HTTP
if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ Error: HTTP $HTTP_CODE"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  exit 1
fi

# Afficher le résultat
echo "✅ Success!"
echo ""
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
