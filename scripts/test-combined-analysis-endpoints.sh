^#!/bin/bash

# Script de test pour les endpoints d'analyse combinée FMP + UW
# Usage: ACCESS_TOKEN="your_token" ./scripts/test-combined-analysis-endpoints.sh [API_GATEWAY_URL]

# Couleurs pour l'output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Token d'accès
ACCESS_TOKEN="${ACCESS_TOKEN:-}"

# URL de l'API Gateway (par défaut ou depuis l'argument)
API_URL="${1:-https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod}"

# Vérifier que le token est fourni
if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}Erreur: ACCESS_TOKEN est requis${NC}"
  echo -e "Usage: ACCESS_TOKEN=\"your_token\" ./scripts/test-combined-analysis-endpoints.sh [API_GATEWAY_URL]"
  exit 1
fi

# Compteurs
PASSED=0
FAILED=0
TOTAL_TESTS=0

# Fonction pour tester un endpoint
test_endpoint() {
  local method=$1
  local path=$2
  local description=$3
  local expected_status=${4:-200}
  local body=${5:-""}

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  echo -e "${YELLOW}Testing: ${description}${NC}"
  echo -e "  ${method} ${path}"

  if [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "${method}" \
      "${API_URL}${path}" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "${body}" \
      --max-time 120)
  else
    response=$(curl -s -w "\n%{http_code}" -X "${method}" \
      "${API_URL}${path}" \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      --max-time 120)
  fi

  http_code=$(echo "$response" | tail -n1)
  body_response=$(echo "$response" | sed '$d')

  if [[ -z "$http_code" || ! "$http_code" =~ ^[0-9]+$ ]]; then
    echo -e "  ${RED}✗ Error: Invalid HTTP status code: ${http_code}${NC}"
    echo -e "  Response: ${body_response:0:200}"
    FAILED=$((FAILED + 1))
    return 1
  elif [ "$http_code" -eq "$expected_status" ]; then
    echo -e "  ${GREEN}✓ Status: ${http_code}${NC}"
    
    if echo "$body_response" | grep -q '"success"'; then
      echo -e "  ${GREEN}✓ Response structure valid${NC}"
      
      # Extraire des informations spécifiques selon l'endpoint
      if echo "$body_response" | grep -q '"ticker"'; then
        ticker=$(echo "$body_response" | jq -r '.data.ticker // empty' 2>/dev/null || echo "")
        if [ ! -z "$ticker" ]; then
          echo -e "  ${BLUE}  Ticker: ${ticker}${NC}"
        fi
      fi
      
      if echo "$body_response" | grep -q '"fundamentalScore"'; then
        fundamental=$(echo "$body_response" | jq -r '.data.fundamentalScore // empty' 2>/dev/null || echo "")
        sentiment=$(echo "$body_response" | jq -r '.data.sentimentScore // empty' 2>/dev/null || echo "")
        if [ ! -z "$fundamental" ] && [ ! -z "$sentiment" ]; then
          echo -e "  ${BLUE}  Fundamental Score: ${fundamental}, Sentiment Score: ${sentiment}${NC}"
        fi
      fi
      
      if echo "$body_response" | grep -q '"overallRisk"'; then
        risk=$(echo "$body_response" | jq -r '.data.overallRisk // empty' 2>/dev/null || echo "")
        risk_level=$(echo "$body_response" | jq -r '.data.riskLevel // empty' 2>/dev/null || echo "")
        if [ ! -z "$risk" ] && [ ! -z "$risk_level" ]; then
          echo -e "  ${BLUE}  Overall Risk: ${risk} (${risk_level})${NC}"
        fi
      fi
      
      if echo "$body_response" | grep -q '"predictedSurprise"'; then
        surprise=$(echo "$body_response" | jq -r '.data.predictedSurprise // empty' 2>/dev/null || echo "")
        confidence=$(echo "$body_response" | jq -r '.data.confidence // empty' 2>/dev/null || echo "")
        if [ ! -z "$surprise" ] && [ ! -z "$confidence" ]; then
          echo -e "  ${BLUE}  Predicted Surprise: ${surprise}%, Confidence: ${confidence}%${NC}"
        fi
      fi
      
      if echo "$body_response" | grep -q '"upside"'; then
        upside=$(echo "$body_response" | jq -r '.data.upside // empty' 2>/dev/null || echo "")
        recommendation=$(echo "$body_response" | jq -r '.data.recommendation // empty' 2>/dev/null || echo "")
        if [ ! -z "$upside" ] && [ ! -z "$recommendation" ]; then
          echo -e "  ${BLUE}  Upside: ${upside}%, Recommendation: ${recommendation}${NC}"
        fi
      fi
      
      if echo "$body_response" | grep -q '"count"'; then
        count=$(echo "$body_response" | jq -r '.count // empty' 2>/dev/null || echo "")
        if [ ! -z "$count" ]; then
          echo -e "  ${BLUE}  Results: ${count} tickers${NC}"
        fi
      fi
      
      preview=$(echo "$body_response" | python3 -m json.tool 2>/dev/null | head -15 || echo "$body_response" | head -c 500)
      echo -e "  ${BLUE}Preview:${NC}"
      echo "$preview" | sed 's/^/    /'
    else
      echo -e "  ${YELLOW}⚠ Response structure may be invalid${NC}"
      echo -e "  Response: ${body_response:0:200}..."
    fi
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "  ${RED}✗ Status: ${http_code} (expected ${expected_status})${NC}"
    echo -e "  Response: ${body_response:0:500}"
    FAILED=$((FAILED + 1))
    return 1
  fi
  echo ""
}

# ========== Tests ==========

echo -e "${GREEN}=== Testing Combined Analysis Endpoints (FMP + UW) ===${NC}"
echo -e "${BLUE}API URL: ${API_URL}${NC}"
echo ""

# ========== Phase 1: Services de base (3 endpoints) ==========
echo -e "${GREEN}=== Phase 1: Services de base ===${NC}"

# 1. Analyse Complète
test_endpoint "GET" "/analysis/AAPL/complete" "Complete Analysis (AAPL)"
test_endpoint "GET" "/analysis/TSLA/complete" "Complete Analysis (TSLA)"

# 2. Détection de Divergences
test_endpoint "GET" "/analysis/AAPL/divergence" "Divergence Analysis (AAPL)"
test_endpoint "GET" "/analysis/NVDA/divergence" "Divergence Analysis (NVDA)"

# 3. Valuation Complète
test_endpoint "GET" "/analysis/AAPL/valuation" "Comprehensive Valuation (AAPL)"
test_endpoint "GET" "/analysis/MSFT/valuation" "Comprehensive Valuation (MSFT)"

echo ""

# ========== Phase 2: Services avancés (5 endpoints) ==========
echo -e "${GREEN}=== Phase 2: Services avancés ===${NC}"

# 4. Prédiction d'Earnings
test_endpoint "GET" "/analysis/AAPL/earnings-prediction" "Earnings Prediction (AAPL)"
test_endpoint "GET" "/analysis/AAPL/earnings-prediction?earningsDate=2025-01-30" "Earnings Prediction (AAPL with date)"
test_endpoint "GET" "/analysis/TSLA/earnings-prediction" "Earnings Prediction (TSLA)"

# 5. Screening Multi-Critères
SCREENING_BODY='{
  "minMarketCap": 1000000000,
  "maxPERatio": 30,
  "minSentimentScore": 60,
  "limit": 10
}'
test_endpoint "POST" "/screener/multi-criteria" "Multi-Criteria Screener" 200 "$SCREENING_BODY"

SCREENING_BODY2='{
  "sector": "Technology",
  "minRevenueGrowth": 5,
  "maxDebtToEquity": 0.5,
  "limit": 5
}'
test_endpoint "POST" "/screener/multi-criteria" "Multi-Criteria Screener (Technology)" 200 "$SCREENING_BODY2"

# 6. Analyse de Risque
test_endpoint "GET" "/analysis/AAPL/risk" "Risk Analysis (AAPL)"
test_endpoint "GET" "/analysis/TSLA/risk" "Risk Analysis (TSLA)"
test_endpoint "GET" "/analysis/NVDA/risk" "Risk Analysis (NVDA)"

# 7. Tracking d'Institutions
test_endpoint "GET" "/institutions/Berkshire%20Hathaway/tracking" "Institution Tracking (Berkshire Hathaway)"
test_endpoint "GET" "/institutions/BlackRock/tracking" "Institution Tracking (BlackRock)"

# 8. Analyse de Secteur
test_endpoint "GET" "/analysis/sector/Technology" "Sector Analysis (Technology)"
test_endpoint "GET" "/analysis/sector/Healthcare" "Sector Analysis (Healthcare)"
test_endpoint "GET" "/analysis/sector/Financial" "Sector Analysis (Financial)"

echo ""

# ========== Résumé ==========
echo -e "${GREEN}=== Résumé ===${NC}"
echo -e "Total tests: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ Tous les tests sont passés !${NC}"
  exit 0
else
  echo -e "${RED}✗ Certains tests ont échoué${NC}"
  exit 1
fi

