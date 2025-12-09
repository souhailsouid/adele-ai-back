#!/bin/bash

# Script pour corriger les holdings avec cik NULL
# Met à jour le cik depuis la table funds

SUPABASE_URL="${SUPABASE_URL:-https://your-project.supabase.co}"
SUPABASE_KEY="${SUPABASE_SERVICE_KEY:-your-service-key}"

echo "🔧 Correction des holdings avec cik NULL..."

# Récupérer tous les funds avec leur CIK
FUNDS=$(curl -s "${SUPABASE_URL}/rest/v1/funds?select=id,cik" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

echo "$FUNDS" | jq -c '.[]' | while read -r fund; do
  FUND_ID=$(echo "$fund" | jq -r '.id')
  FUND_CIK=$(echo "$fund" | jq -r '.cik')
  
  if [ -z "$FUND_CIK" ] || [ "$FUND_CIK" = "null" ]; then
    continue
  fi
  
  # Mettre à jour les holdings de ce fund qui ont cik NULL
  RESULT=$(curl -s -X PATCH "${SUPABASE_URL}/rest/v1/fund_holdings?fund_id=eq.${FUND_ID}&cik=is.null" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "{\"cik\":\"${FUND_CIK}\"}")
  
  UPDATED=$(echo "$RESULT" | jq '. | length')
  if [ "$UPDATED" -gt 0 ]; then
    echo "✓ Fund $FUND_ID: Updated $UPDATED holdings with CIK $FUND_CIK"
  fi
done

echo "✅ Done!"

