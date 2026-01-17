#!/bin/bash
# Script pour désactiver les Event Source Mappings sur adel-ai-dev-collectors

REGION="eu-west-3"

echo "🛑 Désactivation des Event Source Mappings"
echo "========================================="
echo ""

# Lister tous les mappings et filtrer ceux sur "collectors"
aws lambda list-event-source-mappings --region "$REGION" 2>/dev/null | \
  jq -r '.EventSourceMappings[] | select(.EventSourceArn | contains("collectors")) | "\(.UUID)|\(.FunctionArn)|\(.State)"' | \
  while IFS='|' read -r UUID FUNCTION_ARN STATE; do
    FUNCTION_NAME=$(echo "$FUNCTION_ARN" | awk -F: '{print $NF}')
    
    if [ "$STATE" == "Enabled" ] || [ "$STATE" == "Enabling" ]; then
      echo -n "  🔒 Désactivation $FUNCTION_NAME... "
      aws lambda update-event-source-mapping \
        --uuid "$UUID" \
        --no-enabled \
        --region "$REGION" > /dev/null 2>&1
      
      if [ $? -eq 0 ]; then
        echo "✅ Désactivé"
      else
        echo "⚠️  Erreur"
      fi
    else
      echo "  ℹ️  $FUNCTION_NAME déjà désactivé (State: $STATE)"
    fi
  done

echo ""
echo "✅ Terminé"
