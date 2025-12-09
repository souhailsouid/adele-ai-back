#!/bin/bash

# Script simple pour re-déclencher le parsing des filings FAILED
# Usage: ./scripts/reparse-failed-filings.sh <fund_id>

FUND_ID=$1
if [ -z "$FUND_ID" ]; then
  echo "Usage: $0 <fund_id>"
  exit 1
fi

SUPABASE_URL="${SUPABASE_URL:-https://your-project.supabase.co}"
SUPABASE_KEY="${SUPABASE_SERVICE_KEY:-your-service-key}"
EVENT_BUS_NAME="adel-ai-dev-signals"
REGION="eu-west-3"

echo "Re-parsing failed filings for fund $FUND_ID..."

# Récupérer le CIK du fund
FUND=$(curl -s "${SUPABASE_URL}/rest/v1/funds?id=eq.${FUND_ID}&select=cik" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

FUND_CIK=$(echo "$FUND" | jq -r '.[0].cik')
if [ -z "$FUND_CIK" ] || [ "$FUND_CIK" = "null" ]; then
  echo "Error: Could not find CIK for fund $FUND_ID"
  exit 1
fi

echo "Fund CIK: $FUND_CIK"

# Récupérer les filings FAILED
FILINGS=$(curl -s "${SUPABASE_URL}/rest/v1/fund_filings?fund_id=eq.${FUND_ID}&status=eq.FAILED&select=id,accession_number" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

COUNT=$(echo "$FILINGS" | jq '. | length')
if [ "$COUNT" -eq 0 ]; then
  echo "No failed filings found"
  exit 0
fi

echo "Found $COUNT failed filings"

# Fonction pour construire l'URL
build_filing_url() {
  local cik=$1
  local accession=$2
  local accession_no_dashes=$(echo "$accession" | tr -d '-')
  # Nettoyer le CIK : enlever les zéros en tête, mais garder au moins un chiffre
  local cik_clean=$(echo "$cik" | sed 's/^0*//')
  # Si cik_clean est vide (tous des zéros), utiliser "0"
  if [ -z "$cik_clean" ]; then
    cik_clean="0"
  fi
  echo "https://www.sec.gov/Archives/edgar/data/${cik_clean}/${accession_no_dashes}/${accession}-index.htm"
}

# Re-déclencher le parsing pour chaque filing
echo "$FILINGS" | jq -c '.[]' | while read -r filing; do
  FILING_ID=$(echo "$filing" | jq -r '.id')
  ACCESSION=$(echo "$filing" | jq -r '.accession_number')
  FILING_URL=$(build_filing_url "$FUND_CIK" "$ACCESSION")
  
  # Construire le JSON Detail avec jq (pour échappement correct)
  DETAIL_JSON=$(jq -n \
    --arg fund_id "$FUND_ID" \
    --arg filing_id "$FILING_ID" \
    --arg cik "$FUND_CIK" \
    --arg accession "$ACCESSION" \
    --arg url "$FILING_URL" \
    '{fund_id: ($fund_id | tonumber), filing_id: ($filing_id | tonumber), cik: $cik, accession_number: $accession, filing_url: $url}' | jq -c .)
  
  # Construire l'entrée EventBridge avec jq
  ENTRY_JSON=$(jq -n \
    --arg source "adel.signals" \
    --arg detail_type "13F Discovered" \
    --argjson detail "$DETAIL_JSON" \
    --arg event_bus "$EVENT_BUS_NAME" \
    '{Source: $source, DetailType: $detail_type, Detail: ($detail | tostring), EventBusName: $event_bus}' | jq -c .)
  
  # Publier l'événement
  aws events put-events \
    --region "$REGION" \
    --entries "[$ENTRY_JSON]" \
    --output json > /dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    echo "✓ Re-published event for filing $ACCESSION"
  else
    echo "✗ Failed to re-publish filing $ACCESSION"
  fi
done

echo "Done!"

