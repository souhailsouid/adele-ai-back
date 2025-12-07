#!/bin/bash

# Script de test pour l'endpoint Ticker Insights
# Usage: 
#   ./scripts/test-ticker-insights.sh [API_GATEWAY_URL] [TICKER]
#   ou: ACCESS_TOKEN="your_token" ./scripts/test-ticker-insights.sh [API_GATEWAY_URL] [TICKER]

# Couleurs pour l'output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Token d'accès (peut être passé via variable d'environnement)
# Usage: ACCESS_TOKEN="your_token" ./scripts/test-ticker-insights.sh [API_GATEWAY_URL] [TICKER]
ACCESS_TOKEN="${ACCESS_TOKEN:-}"

# URL de l'API Gateway (par défaut ou depuis l'argument)
API_URL="${1:-https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod}"

# Ticker à tester (par défaut ou depuis l'argument)
TICKER="${2:-NVDA}"

# Vérifier que le token est fourni
if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}Erreur: ACCESS_TOKEN est requis${NC}"
  echo -e "Usage: ACCESS_TOKEN=\"your_token\" ./scripts/test-ticker-insights.sh [API_GATEWAY_URL] [TICKER]"
  exit 1
fi

echo -e "${BLUE}=== Test de l'endpoint Ticker Insights ===${NC}"
echo -e "API URL: ${API_URL}"
echo -e "Ticker: ${TICKER}"
echo ""

# Fonction pour tester l'endpoint
test_endpoint() {
  local method=$1
  local path=$2
  local description=$3
  local expected_status=${4:-200}

  echo -e "${YELLOW}Testing: ${description}${NC}"
  echo -e "  ${method} ${path}"

  response=$(curl -s -w "\n%{http_code}" -X "${method}" \
    "${API_URL}${path}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    --max-time 60)

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [[ -z "$http_code" || ! "$http_code" =~ ^[0-9]+$ ]]; then
    echo -e "  ${RED}✗ Error: Invalid HTTP status code: ${http_code}${NC}"
    echo -e "  Response: ${body}"
    return 1
  elif [ "$http_code" -eq "$expected_status" ]; then
    echo -e "  ${GREEN}✓ Status: ${http_code}${NC}"
    
    # Vérifier que la réponse contient les données attendues
    if echo "$body" | grep -q '"success"'; then
      echo -e "  ${GREEN}✓ Response structure valid${NC}"
      
      # Afficher un résumé des données
      if echo "$body" | grep -q '"ticker"'; then
        ticker=$(echo "$body" | grep -o '"ticker":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo -e "  ${BLUE}  Ticker: ${ticker}${NC}"
      fi
      
      if echo "$body" | grep -q '"companyInfo"'; then
        company_name=$(echo "$body" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)
        if [ ! -z "$company_name" ]; then
          echo -e "  ${BLUE}  Company: ${company_name}${NC}"
        fi
      fi
      
      if echo "$body" | grep -q '"quote"'; then
        price=$(echo "$body" | grep -o '"price":[0-9.]*' | head -1 | cut -d':' -f2)
        if [ ! -z "$price" ]; then
          echo -e "  ${BLUE}  Price: \$${price}${NC}"
        fi
      fi
      
      if echo "$body" | grep -q '"alerts"'; then
        alerts_count=$(echo "$body" | grep -o '"alerts":\[[^]]*\]' | grep -o '"[^"]*":' | wc -l | tr -d ' ')
        echo -e "  ${BLUE}  Alerts: ${alerts_count} signals${NC}"
      fi
      
      # Vérifier institutionalActivity
      if echo "$body" | grep -q '"institutionalActivity"'; then
        inst_activity=$(echo "$body" | python3 -c "import sys, json; data=json.load(sys.stdin); print('null' if data.get('data', {}).get('institutionalActivity') is None else 'present')" 2>/dev/null || echo "unknown")
        if [ "$inst_activity" = "null" ]; then
          echo -e "  ${RED}⚠ institutionalActivity is NULL${NC}"
        elif [ "$inst_activity" = "present" ]; then
          top_holders_count=$(echo "$body" | python3 -c "import sys, json; data=json.load(sys.stdin); ia=data.get('data', {}).get('institutionalActivity', {}); print(len(ia.get('topHolders', [])))" 2>/dev/null || echo "0")
          recent_activity_count=$(echo "$body" | python3 -c "import sys, json; data=json.load(sys.stdin); ia=data.get('data', {}).get('institutionalActivity', {}); print(len(ia.get('recentActivity', [])))" 2>/dev/null || echo "0")
          echo -e "  ${GREEN}✓ institutionalActivity: ${top_holders_count} top holders, ${recent_activity_count} recent activities${NC}"
        fi
      else
        echo -e "  ${YELLOW}⚠ institutionalActivity field missing${NC}"
      fi
      
      # Afficher un aperçu JSON formaté (premières 500 caractères)
      preview=$(echo "$body" | python3 -m json.tool 2>/dev/null | head -20 || echo "$body" | head -c 500)
      echo -e "  ${BLUE}Preview:${NC}"
      echo "$preview" | sed 's/^/    /'
    else
      echo -e "  ${YELLOW}⚠ Response structure may be invalid${NC}"
      echo -e "  Response: ${body:0:200}..."
    fi
    return 0
  else
    echo -e "  ${RED}✗ Status: ${http_code} (expected ${expected_status})${NC}"
    echo -e "  Response: ${body:0:500}"
    return 1
  fi
  echo ""
}

# Test de l'endpoint principal
echo -e "${GREEN}=== Test Principal ===${NC}"
test_endpoint "GET" "/ticker-insights/${TICKER}" "Ticker Insights for ${TICKER}"

echo ""
echo -e "${GREEN}=== Test avec différents tickers ===${NC}"
test_endpoint "GET" "/ticker-insights/TSLA" "Ticker Insights for TSLA"
test_endpoint "GET" "/ticker-insights/AAPL" "Ticker Insights for AAPL"

echo ""
echo -e "${GREEN}=== Tests terminés ===${NC}"

