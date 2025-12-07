#!/bin/bash

# Script de validation des données dans les endpoints d'analyse combinée
# Vérifie que les données Unusual Whales sont bien présentes et valides
# Usage: ACCESS_TOKEN="your_token" ./scripts/validate-combined-analysis-data.sh [API_GATEWAY_URL]

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

ACCESS_TOKEN="${ACCESS_TOKEN:-}"
API_URL="${1:-https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod}"

if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}Erreur: ACCESS_TOKEN est requis${NC}"
  exit 1
fi

TICKER="AAPL"
PASSED=0
FAILED=0
WARNINGS=0

# Fonction pour extraire une valeur JSON
extract_json_value() {
  local json=$1
  local path=$2
  echo "$json" | jq -r "$path" 2>/dev/null || echo ""
}

# Fonction pour vérifier qu'une valeur n'est pas vide/null/0
check_value_not_empty() {
  local value=$1
  local name=$2
  
  if [ -z "$value" ] || [ "$value" = "null" ] || [ "$value" = "0" ] || [ "$value" = "[]" ] || [ "$value" = "{}" ]; then
    echo -e "  ${RED}✗ ${name}: vide/null/0${NC}"
    return 1
  else
    echo -e "  ${GREEN}✓ ${name}: ${value}${NC}"
    return 0
  fi
}

# Fonction pour vérifier qu'un tableau n'est pas vide
check_array_not_empty() {
  local json=$1
  local path=$2
  local name=$3
  
  local length=$(echo "$json" | jq -r "${path} | length" 2>/dev/null || echo "0")
  if [ "$length" = "0" ] || [ -z "$length" ]; then
    echo -e "  ${YELLOW}⚠ ${name}: tableau vide (${length} éléments)${NC}"
    return 1
  else
    echo -e "  ${GREEN}✓ ${name}: ${length} éléments${NC}"
    return 0
  fi
}

echo -e "${BLUE}=== Validation des données Unusual Whales dans les endpoints combinés ===${NC}"
echo -e "API URL: ${API_URL}"
echo -e "Ticker de test: ${TICKER}"
echo ""

# ========== Phase 1: Vérifier les endpoints UW directement ==========
echo -e "${CYAN}=== Phase 1: Vérification des endpoints UW directement ===${NC}"

test_uw_endpoint() {
  local path=$1
  local description=$2
  local required_field=$3
  
  echo -e "${YELLOW}Testing: ${description}${NC}"
  echo -e "  GET ${path}"
  
  response=$(curl -s -w "\n%{http_code}" -X GET \
    "${API_URL}${path}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    --max-time 30)
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" != "200" ]; then
    echo -e "  ${RED}✗ Status: ${http_code}${NC}"
    FAILED=$((FAILED + 1))
    return 1
  fi
  
  echo -e "  ${GREEN}✓ Status: ${http_code}${NC}"
  
  # Vérifier la structure de la réponse
  success=$(extract_json_value "$body" ".success")
  if [ "$success" != "true" ]; then
    echo -e "  ${RED}✗ success: ${success} (attendu: true)${NC}"
    FAILED=$((FAILED + 1))
    return 1
  fi
  
  # Vérifier que les données sont présentes
  if [ -n "$required_field" ]; then
    data_value=$(extract_json_value "$body" ".data${required_field}")
    if ! check_value_not_empty "$data_value" "Données ($required_field)"; then
      FAILED=$((FAILED + 1))
      return 1
    fi
  else
    # Vérifier que data existe et n'est pas vide
    data_exists=$(echo "$body" | jq -r ".data != null and .data != [] and .data != {}" 2>/dev/null)
    if [ "$data_exists" != "true" ]; then
      echo -e "  ${RED}✗ Données absentes ou vides${NC}"
      FAILED=$((FAILED + 1))
      return 1
    fi
    echo -e "  ${GREEN}✓ Données présentes${NC}"
  fi
  
  PASSED=$((PASSED + 1))
  echo ""
  return 0
}

# Tester les endpoints UW utilisés par les analyses combinées
test_uw_endpoint "/unusual-whales/stock/${TICKER}/flow-recent?limit=10" "Recent Flows" "[0].premium"
test_uw_endpoint "/unusual-whales/institution/${TICKER}/ownership" "Institution Ownership" "[0].name"
test_uw_endpoint "/unusual-whales/shorts/${TICKER}/interest-float" "Short Interest" "[0].percent_returned"
test_uw_endpoint "/unusual-whales/dark-pool/${TICKER}?limit=10" "Dark Pool Trades" "[0].executed_at"
test_uw_endpoint "/unusual-whales/stock/${TICKER}/insider-buy-sells" "Insider Buy/Sells" "[0].filing_date"

echo ""

# ========== Phase 2: Vérifier les endpoints combinés ==========
echo -e "${CYAN}=== Phase 2: Vérification des données UW dans les endpoints combinés ===${NC}"

test_combined_endpoint() {
  local path=$1
  local description=$2
  
  echo -e "${YELLOW}Testing: ${description}${NC}"
  echo -e "  GET ${path}"
  
  response=$(curl -s -w "\n%{http_code}" -X GET \
    "${API_URL}${path}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    --max-time 120)
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" != "200" ]; then
    echo -e "  ${RED}✗ Status: ${http_code}${NC}"
    FAILED=$((FAILED + 1))
    echo ""
    return 1
  fi
  
  echo -e "  ${GREEN}✓ Status: ${http_code}${NC}"
  
  # Vérifier la structure
  success=$(extract_json_value "$body" ".success")
  if [ "$success" != "true" ]; then
    echo -e "  ${RED}✗ success: ${success}${NC}"
    FAILED=$((FAILED + 1))
    echo ""
    return 1
  fi
  
  local has_issues=0
  
  # Vérifications spécifiques selon l'endpoint
  case "$path" in
    */complete)
      # Vérifier sentiment score
      sentiment_score=$(extract_json_value "$body" ".data.sentiment.score")
      if [ "$sentiment_score" = "50" ]; then
        echo -e "  ${YELLOW}⚠ Sentiment score: 50 (valeur par défaut suspecte)${NC}"
        WARNINGS=$((WARNINGS + 1))
        has_issues=1
      else
        check_value_not_empty "$sentiment_score" "Sentiment score" || has_issues=1
      fi
      
      # Vérifier les détails du sentiment
      call_put_ratio=$(extract_json_value "$body" ".data.sentiment.details.callPutRatio")
      if [ "$call_put_ratio" = "1" ] || [ -z "$call_put_ratio" ] || [ "$call_put_ratio" = "null" ]; then
        echo -e "  ${YELLOW}⚠ Call/Put Ratio: ${call_put_ratio} (suspect)${NC}"
        WARNINGS=$((WARNINGS + 1))
        has_issues=1
      else
        check_value_not_empty "$call_put_ratio" "Call/Put Ratio" || has_issues=1
      fi
      
      dark_pool_trades=$(extract_json_value "$body" ".data.sentiment.details.darkPoolTrades")
      if [ "$dark_pool_trades" = "0" ] || [ -z "$dark_pool_trades" ]; then
        echo -e "  ${YELLOW}⚠ Dark Pool Trades: ${dark_pool_trades} (suspect)${NC}"
        WARNINGS=$((WARNINGS + 1))
      else
        check_value_not_empty "$dark_pool_trades" "Dark Pool Trades" || has_issues=1
      fi
      ;;
    
    */valuation)
      # Vérifier currentPrice
      current_price=$(extract_json_value "$body" ".data.currentPrice")
      if ! check_value_not_empty "$current_price" "Current Price"; then
        has_issues=1
      fi
      
      # Vérifier que currentPrice est raisonnable pour AAPL (> 100)
      if [ -n "$current_price" ] && [ "$current_price" != "null" ] && [ "$current_price" != "0" ]; then
        price_num=$(echo "$current_price" | awk '{print int($1)}')
        if [ "$price_num" -lt 100 ]; then
          echo -e "  ${YELLOW}⚠ Current Price: ${current_price} (suspect pour AAPL)${NC}"
          WARNINGS=$((WARNINGS + 1))
        fi
      fi
      
      # Vérifier sentiment multiplier
      sentiment_mult=$(extract_json_value "$body" ".data.sentimentMultiplier")
      if [ "$sentiment_mult" = "1" ] || [ -z "$sentiment_mult" ]; then
        echo -e "  ${YELLOW}⚠ Sentiment Multiplier: ${sentiment_mult} (suspect)${NC}"
        WARNINGS=$((WARNINGS + 1))
      else
        check_value_not_empty "$sentiment_mult" "Sentiment Multiplier" || has_issues=1
      fi
      ;;
    
    */earnings-prediction)
      # Vérifier les signaux
      options_score=$(extract_json_value "$body" ".data.signals.options.score")
      if [ "$options_score" = "50" ] || [ "$options_score" = "65" ]; then
        echo -e "  ${YELLOW}⚠ Options Score: ${options_score} (valeur par défaut suspecte)${NC}"
        WARNINGS=$((WARNINGS + 1))
      fi
      
      call_volume=$(extract_json_value "$body" ".data.signals.options.callVolume")
      put_volume=$(extract_json_value "$body" ".data.signals.options.putVolume")
      if [ "$call_volume" = "0" ] && [ "$put_volume" = "0" ]; then
        echo -e "  ${YELLOW}⚠ Options Volume: call=${call_volume}, put=${put_volume} (suspect)${NC}"
        WARNINGS=$((WARNINGS + 1))
      fi
      
      unusual_activity=$(extract_json_value "$body" ".data.signals.options.unusualActivity")
      if [ "$unusual_activity" = "0" ] || [ -z "$unusual_activity" ]; then
        echo -e "  ${YELLOW}⚠ Unusual Activity: ${unusual_activity} (suspect)${NC}"
        WARNINGS=$((WARNINGS + 1))
      else
        check_value_not_empty "$unusual_activity" "Unusual Activity" || has_issues=1
      fi
      ;;
    
    */risk)
      # Vérifier les scores de risque
      overall_risk=$(extract_json_value "$body" ".data.overallRisk")
      check_value_not_empty "$overall_risk" "Overall Risk" || has_issues=1
      
      financial_risk=$(extract_json_value "$body" ".data.breakdown.financial.score")
      if [ "$financial_risk" = "50" ]; then
        echo -e "  ${YELLOW}⚠ Financial Risk: 50 (valeur par défaut suspecte)${NC}"
        WARNINGS=$((WARNINGS + 1))
      fi
      ;;
    
    */institutions/*/tracking)
      # Vérifier les holdings
      total_holdings=$(extract_json_value "$body" ".data.totalHoldings")
      if [ "$total_holdings" = "0" ] || [ -z "$total_holdings" ]; then
        echo -e "  ${YELLOW}⚠ Total Holdings: ${total_holdings} (suspect)${NC}"
        WARNINGS=$((WARNINGS + 1))
      fi
      
      # Vérifier l'activité récente
      recent_activity=$(echo "$body" | jq -r ".data.recentActivity | length" 2>/dev/null || echo "0")
      if [ "$recent_activity" = "0" ]; then
        echo -e "  ${YELLOW}⚠ Recent Activity: ${recent_activity} éléments (suspect)${NC}"
        WARNINGS=$((WARNINGS + 1))
      fi
      ;;
    
    */sector/*)
      # Vérifier averagePE
      avg_pe=$(extract_json_value "$body" ".data.averagePE")
      if [ "$avg_pe" = "0" ] || [ -z "$avg_pe" ]; then
        echo -e "  ${YELLOW}⚠ Average PE: ${avg_pe} (suspect)${NC}"
        WARNINGS=$((WARNINGS + 1))
      fi
      
      # Vérifier sentiment
      sentiment_score=$(extract_json_value "$body" ".data.sentiment.score")
      if [ "$sentiment_score" = "50" ]; then
        echo -e "  ${YELLOW}⚠ Sentiment Score: 50 (valeur par défaut suspecte)${NC}"
        WARNINGS=$((WARNINGS + 1))
      fi
      ;;
  esac
  
  if [ $has_issues -eq 0 ]; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
  fi
  
  echo ""
}

# Tester les endpoints combinés
test_combined_endpoint "/analysis/${TICKER}/complete" "Complete Analysis"
test_combined_endpoint "/analysis/${TICKER}/valuation" "Comprehensive Valuation"
test_combined_endpoint "/analysis/${TICKER}/earnings-prediction" "Earnings Prediction"
test_combined_endpoint "/analysis/${TICKER}/risk" "Risk Analysis"
test_combined_endpoint "/institutions/Berkshire%20Hathaway/tracking" "Institution Tracking (Berkshire)"
test_combined_endpoint "/analysis/sector/Technology" "Sector Analysis (Technology)"

# ========== Résumé ==========
echo -e "${BLUE}=== Résumé ===${NC}"
echo -e "Tests passés: ${GREEN}${PASSED}${NC}"
echo -e "Tests échoués: ${RED}${FAILED}${NC}"
echo -e "Avertissements: ${YELLOW}${WARNINGS}${NC}"
echo ""

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✓ Tous les tests sont passés sans avertissements !${NC}"
  exit 0
elif [ $FAILED -eq 0 ]; then
  echo -e "${YELLOW}⚠ Tests passés mais avec des avertissements (valeurs suspectes)${NC}"
  exit 0
else
  echo -e "${RED}✗ Certains tests ont échoué${NC}"
  exit 1
fi

