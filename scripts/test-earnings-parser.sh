#!/bin/bash
# Script de test complet pour le parser earnings

set -e

echo "🧪 TEST COMPLET DU PARSER EARNINGS"
echo "=================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
FUNCTION_NAME="adel-ai-dev-parser-company-filing"
FILING_ID=1
COMPANY_ID=1
CIK="0001045810"
TICKER="NVDA"
FORM_TYPE="8-K"
ACCESSION_NUMBER="0001045810-25-000230"
DOCUMENT_URL="https://www.sec.gov/ix?doc=/Archives/edgar/data/0001045810/000104581025000230/nvda-20251026.htm"

echo "📋 Configuration:"
echo "  - Function: $FUNCTION_NAME"
echo "  - Company: $TICKER (CIK: $CIK)"
echo "  - Filing: $ACCESSION_NUMBER"
echo ""

# 1. Vérifier que la Lambda existe
echo "1️⃣  Vérification de la Lambda..."
if aws lambda get-function --function-name "$FUNCTION_NAME" &>/dev/null; then
    echo -e "${GREEN}✅ Lambda trouvée${NC}"
else
    echo -e "${RED}❌ Lambda non trouvée${NC}"
    exit 1
fi

# 2. Préparer le payload
echo ""
echo "2️⃣  Préparation du payload..."
PAYLOAD=$(cat <<EOF
{
  "detail": {
    "filing_id": $FILING_ID,
    "company_id": $COMPANY_ID,
    "cik": "$CIK",
    "ticker": "$TICKER",
    "form_type": "$FORM_TYPE",
    "accession_number": "$ACCESSION_NUMBER",
    "document_url": "$DOCUMENT_URL"
  }
}
EOF
)

echo "$PAYLOAD" > /tmp/test-payload.json
echo -e "${GREEN}✅ Payload créé${NC}"

# 3. Invoker la Lambda
echo ""
echo "3️⃣  Invocation de la Lambda..."
RESPONSE=$(aws lambda invoke \
    --function-name "$FUNCTION_NAME" \
    --payload file:///tmp/test-payload.json \
    --cli-binary-format raw-in-base64-out \
    /tmp/lambda-response.json 2>&1)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Lambda invoquée avec succès${NC}"
    echo "Réponse:"
    cat /tmp/lambda-response.json | jq '.' 2>/dev/null || cat /tmp/lambda-response.json
else
    echo -e "${RED}❌ Erreur lors de l'invocation${NC}"
    echo "$RESPONSE"
    exit 1
fi

# 4. Attendre un peu pour que les logs apparaissent
echo ""
echo "4️⃣  Attente des logs (10 secondes)..."
sleep 10

# 5. Récupérer les logs
echo ""
echo "5️⃣  Analyse des logs CloudWatch..."
echo ""

LOG_LINES=$(aws logs tail "/aws/lambda/$FUNCTION_NAME" --since 1m --format short 2>&1)

# Chercher les messages clés
echo "📊 Messages clés trouvés:"
echo ""

if echo "$LOG_LINES" | grep -q "\[XBRL\] Document XBRL detecte"; then
    echo -e "${GREEN}✅ Détection XBRL${NC}"
else
    echo -e "${YELLOW}⚠️  Détection XBRL non trouvée${NC}"
fi

if echo "$LOG_LINES" | grep -q "\[XBRL\] Donnees XBRL trouvees"; then
    echo -e "${GREEN}✅ Extraction XBRL réussie${NC}"
    echo "$LOG_LINES" | grep "\[XBRL\] Donnees XBRL trouvees" | tail -1
elif echo "$LOG_LINES" | grep -q "\[PRESS\] Donnees Press Release trouvees"; then
    echo -e "${GREEN}✅ Extraction Press Release réussie${NC}"
    echo "$LOG_LINES" | grep "\[PRESS\] Donnees Press Release trouvees" | tail -1
elif echo "$LOG_LINES" | grep -q "\[REGEX\] Donnees Regex trouvees"; then
    echo -e "${GREEN}✅ Extraction Regex réussie${NC}"
    echo "$LOG_LINES" | grep "\[REGEX\] Donnees Regex trouvees" | tail -1
else
    echo -e "${YELLOW}⚠️  Aucune métrique extraite${NC}"
fi

if echo "$LOG_LINES" | grep -q "\[SUCCESS\] Evenement earnings cree"; then
    echo -e "${GREEN}✅ Événement earnings créé${NC}"
    echo "$LOG_LINES" | grep "\[SUCCESS\] Evenement earnings cree" | tail -1
else
    echo -e "${YELLOW}⚠️  Événement earnings non créé${NC}"
fi

if echo "$LOG_LINES" | grep -q "\[ALERT\] Alerte earnings creee"; then
    echo -e "${GREEN}✅ Alerte earnings créée${NC}"
    echo "$LOG_LINES" | grep "\[ALERT\] Alerte earnings creee" | tail -1
elif echo "$LOG_LINES" | grep -q "\[ERROR\] Erreur creation alerte"; then
    echo -e "${YELLOW}⚠️  Erreur lors de la création de l'alerte (table earnings_alerts manquante?)${NC}"
    echo "$LOG_LINES" | grep "\[ERROR\] Erreur creation alerte" | tail -1
else
    echo -e "${YELLOW}⚠️  Alerte non créée (normal si pas de métriques ou table manquante)${NC}"
fi

# 6. Afficher les logs récents
echo ""
echo "6️⃣  Derniers logs (extraits):"
echo "================================"
echo "$LOG_LINES" | tail -30 | grep -E "\[XBRL\]|\[PRESS\]|\[REGEX\]|\[SUCCESS\]|\[ALERT\]|\[ERROR\]|\[ANALYSIS\]|Found 0 potential|Document XBRL|metriques" || echo "Aucun log pertinent trouvé"

echo ""
echo "================================"
echo -e "${GREEN}✅ TEST TERMINÉ${NC}"
echo ""
echo "💡 Pour voir tous les logs:"
echo "   aws logs tail /aws/lambda/$FUNCTION_NAME --since 5m --format short"
echo ""







