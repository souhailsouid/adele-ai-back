#!/bin/bash
# Script pour tester le parsing d'un filing NVIDIA spécifique

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
FILING_URL="https://www.sec.gov/ix?doc=/Archives/edgar/data/0001045810/000104581025000230/nvda-20251026.htm"
CIK="0001045810"
ACCESSION_NUMBER="0001045810-25-000230"
COMPANY_ID=1  # NVIDIA

echo "🔍 Test parsing filing NVIDIA..."
echo "URL: $FILING_URL"
echo "CIK: $CIK"
echo "Accession Number: $ACCESSION_NUMBER"
echo ""

# 1. Vérifier si le filing existe dans la base
echo "📋 Vérification du filing dans la base de données..."

# 2. Si non, l'ajouter
echo "➕ Ajout du filing si nécessaire..."

# 3. Déclencher le parser via EventBridge
echo "🚀 Déclenchement du parser..."

# Récupérer l'ARN de la Lambda parser
PARSER_ARN=$(aws lambda get-function \
  --function-name adel-ai-dev-parser-company-filing \
  --query 'Configuration.FunctionArn' \
  --output text 2>/dev/null || echo "")

if [ -z "$PARSER_ARN" ]; then
  echo "❌ Lambda parser non trouvée. Déployez d'abord avec terraform apply"
  exit 1
fi

# Créer un événement de test
EVENT=$(cat <<EOF
{
  "detail": {
    "filing_id": 1,
    "company_id": $COMPANY_ID,
    "cik": "$CIK",
    "form_type": "8-K",
    "accession_number": "$ACCESSION_NUMBER",
    "document_url": "$FILING_URL",
    "filing_url": "$FILING_URL"
  }
}
EOF
)

echo "📤 Invocation de la Lambda parser..."
aws lambda invoke \
  --function-name adel-ai-dev-parser-company-filing \
  --payload "$(echo $EVENT | jq -c .)" \
  --cli-binary-format raw-in-base64-out \
  /tmp/parser-response.json

echo ""
echo "✅ Réponse du parser:"
cat /tmp/parser-response.json | jq '.'

echo ""
echo "📊 Vérifiez les événements extraits dans company_events:"
echo "SELECT * FROM company_events WHERE company_id = $COMPANY_ID ORDER BY created_at DESC LIMIT 5;"







