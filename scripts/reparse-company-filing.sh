#!/bin/bash
# Script pour reparser un filing company
# Usage: ./scripts/reparse-company-filing.sh <filing_id>

set -e

FILING_ID=${1:-1}

echo "🔄 Reparsing company filing ID: $FILING_ID"
echo ""

# Charger les variables d'environnement
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

SUPABASE_URL="${SUPABASE_URL:-https://your-project.supabase.co}"
SUPABASE_KEY="${SUPABASE_KEY}"

if [ -z "$SUPABASE_KEY" ]; then
  echo "❌ Erreur: SUPABASE_KEY non définie"
  exit 1
fi

# 1. Récupérer les infos du filing
echo "📋 Récupération des informations du filing..."
FILING_DATA=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/company_filings?id=eq.${FILING_ID}&select=*" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" | jq '.[0]')

if [ "$FILING_DATA" = "null" ] || [ -z "$FILING_DATA" ]; then
  echo "❌ Erreur: Filing ID $FILING_ID non trouvé"
  exit 1
fi

COMPANY_ID=$(echo "$FILING_DATA" | jq -r '.company_id')
CIK=$(echo "$FILING_DATA" | jq -r '.cik')
FORM_TYPE=$(echo "$FILING_DATA" | jq -r '.form_type')
ACCESSION_NUMBER=$(echo "$FILING_DATA" | jq -r '.accession_number')
DOCUMENT_URL=$(echo "$FILING_DATA" | jq -r '.document_url')

echo "   Company ID: $COMPANY_ID"
echo "   CIK: $CIK"
echo "   Form Type: $FORM_TYPE"
echo "   Accession: $ACCESSION_NUMBER"
echo ""

# 2. Supprimer les événements existants (si 8-K)
if [ "$FORM_TYPE" = "8-K" ]; then
  echo "🗑️  Suppression des événements existants..."
  DELETED=$(curl -s -X DELETE \
    "${SUPABASE_URL}/rest/v1/company_events?filing_id=eq.${FILING_ID}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Prefer: return=representation" | jq 'length')
  echo "   ✅ $DELETED événement(s) supprimé(s)"
  echo ""
fi

# 3. Supprimer les insider trades existants (si Form 4)
if [ "$FORM_TYPE" = "4" ]; then
  echo "🗑️  Suppression des insider trades existants..."
  DELETED=$(curl -s -X DELETE \
    "${SUPABASE_URL}/rest/v1/insider_trades?filing_id=eq.${FILING_ID}" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Prefer: return=representation" | jq 'length')
  echo "   ✅ $DELETED trade(s) supprimé(s)"
  echo ""
fi

# 4. Remettre le statut à DISCOVERED
echo "🔄 Remise du statut à DISCOVERED..."
curl -s -X PATCH \
  "${SUPABASE_URL}/rest/v1/company_filings?id=eq.${FILING_ID}" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{\"status\": \"DISCOVERED\"}" > /dev/null
echo "   ✅ Statut remis à DISCOVERED"
echo ""

# 5. Publier un événement EventBridge pour déclencher le parser
echo "📤 Publication de l'événement EventBridge..."
EVENT_PAYLOAD=$(jq -n \
  --arg filing_id "$FILING_ID" \
  --arg company_id "$COMPANY_ID" \
  --arg cik "$CIK" \
  --arg form_type "$FORM_TYPE" \
  --arg accession_number "$ACCESSION_NUMBER" \
  --arg document_url "$DOCUMENT_URL" \
  '{
    "Source": "personamy.reparse",
    "DetailType": "Company Filing Discovered",
    "Detail": {
      "filing_id": ($filing_id | tonumber),
      "company_id": ($company_id | tonumber),
      "cik": $cik,
      "form_type": $form_type,
      "accession_number": $accession_number,
      "document_url": $document_url
    }
  }')

aws events put-events --entries "$EVENT_PAYLOAD" > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "   ✅ Événement publié avec succès"
  echo ""
  echo "⏳ Le parser va traiter le filing dans quelques secondes..."
  echo "   Vérifiez les logs CloudWatch: adel-ai-dev-parser-company-filing"
else
  echo "   ❌ Erreur lors de la publication de l'événement"
  exit 1
fi

echo ""
echo "✅ Reparsing déclenché !"
echo ""
echo "💡 Pour vérifier le résultat:"
echo "   SELECT * FROM company_events WHERE filing_id = $FILING_ID;"
echo "   SELECT * FROM company_filings WHERE id = $FILING_ID;"







