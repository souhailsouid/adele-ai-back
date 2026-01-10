#!/bin/bash

# Script de test complet avec rapport pour toutes les routes API
# Usage: ./scripts/test-all-routes-with-report.sh [API_MAIN_GATEWAY_URL] [API_DATA_GATEWAY_URL] [OUTPUT_FILE]
#
# Note: 
#   - Ce script teste les routes des deux API Gateways
#   - API Gateway 1: routes de l'application principale
#   - API Gateway 2: routes de données brutes (FMP + UW)
#   - Récupérer les URLs avec: terraform output api_gateway_url et terraform output api_data_gateway_url

# Couleurs pour l'output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Token d'accès
ACCESS_TOKEN="${ACCESS_TOKEN:-}"

# URLs des deux API Gateways
API_MAIN_URL="${1:-https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod}"
API_DATA_URL="${2:-https://YOUR_API_DATA_GATEWAY_ID.execute-api.eu-west-3.amazonaws.com/prod}"
OUTPUT_FILE="${3:-test-report-$(date +%Y%m%d-%H%M%S).md}"

# Vérifier que le token est fourni
if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}Erreur: ACCESS_TOKEN est requis${NC}"
  echo -e "Usage: ACCESS_TOKEN=\"your_token\" ./scripts/test-all-routes-with-report.sh [API_MAIN_URL] [API_DATA_URL] [OUTPUT_FILE]"
  exit 1
fi

# Compteurs
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Tableau pour stocker les résultats
declare -a RESULTS

echo -e "${BLUE}=== Test complet de toutes les routes API ===${NC}"
echo -e "${BLUE}API Gateway 1 (Application): ${API_MAIN_URL}${NC}"
echo -e "${BLUE}API Gateway 2 (Données Brutes): ${API_DATA_URL}${NC}"
echo -e "Rapport: ${OUTPUT_FILE}"
echo ""

# Fonction pour tester un endpoint avec rapport détaillé
test_endpoint() {
  local method=$1
  local path=$2
  local description=$3
  local expected_status=${4:-200}
  local category=$5
  
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  
  echo -e "${YELLOW}[${TOTAL_TESTS}] Testing: ${description}${NC}"
  echo -e "  ${method} ${path}"
  
  local start_time=$(date +%s%N)
  response=$(curl -s -w "\n%{http_code}\n%{time_total}" -X "${method}" \
    "${API_URL}${path}" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" 2>&1)
  local end_time=$(date +%s%N)
  local duration=$(( (end_time - start_time) / 1000000 )) # en millisecondes
  
  local http_code=$(echo "$response" | tail -n2 | head -n1)
  local time_total=$(echo "$response" | tail -n1)
  local body=$(echo "$response" | sed '$d' | sed '$d')
  
  # Vérifier que http_code est un nombre valide
  if [ -z "$http_code" ] || ! [[ "$http_code" =~ ^[0-9]+$ ]]; then
    echo -e "  ${RED}✗ Error: Invalid HTTP status code: ${http_code}${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    RESULTS+=("FAIL|${category}|${method}|${path}|${description}|${http_code}|Invalid status code|${time_total}ms")
    echo ""
    return
  fi
  
  # Vérifier le statut
  if [ "$http_code" -eq "$expected_status" ]; then
    echo -e "  ${GREEN}✓ Status: ${http_code} (${time_total}s)${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    local preview=$(echo "$body" | head -c 200 | tr -d '\n' | sed 's/"/\\"/g')
    RESULTS+=("PASS|${category}|${method}|${path}|${description}|${http_code}|${preview}|${time_total}s")
  else
    echo -e "  ${RED}✗ Status: ${http_code} (expected ${expected_status})${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    local error_preview=$(echo "$body" | head -c 200 | tr -d '\n' | sed 's/"/\\"/g')
    RESULTS+=("FAIL|${category}|${method}|${path}|${description}|${http_code}|${error_preview}|${time_total}s")
  fi
  echo ""
}

# Générer le rapport Markdown
generate_report() {
  {
    echo "# Rapport de Test API - $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "## Résumé"
    echo ""
    echo "- **API URL**: \`${API_URL}\`"
    echo "- **Total de tests**: ${TOTAL_TESTS}"
    echo "- **✓ Réussis**: ${PASSED_TESTS}"
    echo "- **✗ Échoués**: ${FAILED_TESTS}"
    echo "- **⏭ Ignorés**: ${SKIPPED_TESTS}"
    echo "- **Taux de réussite**: $(( PASSED_TESTS * 100 / TOTAL_TESTS ))%"
    echo ""
    echo "## Détails par Catégorie"
    echo ""
    
    # Grouper par catégorie
    local current_category=""
    for result in "${RESULTS[@]}"; do
      IFS='|' read -r status category method path description http_code preview duration <<< "$result"
      
      if [ "$category" != "$current_category" ]; then
        if [ -n "$current_category" ]; then
          echo ""
        fi
        echo "### ${category}"
        echo ""
        echo "| Status | Method | Path | Description | HTTP | Response Preview | Duration |"
        echo "|--------|--------|------|-------------|------|------------------|----------|"
        current_category="$category"
      fi
      
      local status_icon="✓"
      if [ "$status" = "FAIL" ]; then
        status_icon="✗"
      fi
      
      echo "| ${status_icon} ${status} | ${method} | \`${path}\` | ${description} | ${http_code} | ${preview}... | ${duration} |"
    done
    
    echo ""
    echo "## Routes Échouées"
    echo ""
    for result in "${RESULTS[@]}"; do
      IFS='|' read -r status category method path description http_code preview duration <<< "$result"
      if [ "$status" = "FAIL" ]; then
        echo "### ${description}"
        echo "- **Path**: \`${path}\`"
        echo "- **Method**: ${method}"
        echo "- **HTTP Status**: ${http_code}"
        echo "- **Error**: ${preview}"
        echo ""
      fi
    done
  } > "$OUTPUT_FILE"
  
  echo -e "${GREEN}=== Rapport généré: ${OUTPUT_FILE} ===${NC}"
}

# Inclure toutes les routes du script original
source "$(dirname "$0")/test-uw-endpoints.sh" "$API_URL"

# Générer le rapport
generate_report

echo -e "${BLUE}=== Tests terminés ===${NC}"
echo -e "Total: ${TOTAL_TESTS} | Réussis: ${GREEN}${PASSED_TESTS}${NC} | Échoués: ${RED}${FAILED_TESTS}${NC}"

