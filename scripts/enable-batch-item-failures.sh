#!/bin/bash
# Script pour activer reportBatchItemFailures sur tous les Event Source Mappings SQS → Lambda

REGION="eu-west-3"

echo "🔧 Activation de reportBatchItemFailures"
echo "======================================="
echo ""

# Lister tous les event source mappings SQS
MAPPINGS=$(aws lambda list-event-source-mappings \
  --region "$REGION" \
  --query "EventSourceMappings[?contains(EventSourceArn, 'sqs')].UUID" \
  --output text 2>/dev/null)

if [ -z "$MAPPINGS" ] || [ "$MAPPINGS" == "None" ]; then
  echo "⚠️  Aucun event source mapping SQS trouvé"
  exit 0
fi

COUNT=0
for UUID in $MAPPINGS; do
  echo -n "  📋 Mapping $UUID... "
  
  # Obtenir les détails du mapping
  MAPPING_DETAILS=$(aws lambda get-event-source-mapping \
    --uuid "$UUID" \
    --region "$REGION" 2>/dev/null)
  
  if [ $? -ne 0 ]; then
    echo "⚠️  Erreur lors de la récupération"
    continue
  fi
  
  FUNCTION_NAME=$(echo "$MAPPING_DETAILS" | jq -r '.FunctionArn // ""' | sed 's/.*://')
  QUEUE_NAME=$(echo "$MAPPING_DETAILS" | jq -r '.EventSourceArn // ""' | sed 's/.*://')
  CURRENT_FUNCTION_RESPONSE_TYPES=$(echo "$MAPPING_DETAILS" | jq -r '.FunctionResponseTypes[]? // empty')
  
  # Vérifier si reportBatchItemFailures est déjà activé
  if echo "$CURRENT_FUNCTION_RESPONSE_TYPES" | grep -q "ReportBatchItemFailures"; then
    echo "✅ Déjà activé"
  else
    # Activer reportBatchItemFailures
    aws lambda update-event-source-mapping \
      --uuid "$UUID" \
      --function-response-types "ReportBatchItemFailures" \
      --region "$REGION" 2>/dev/null
    
    if [ $? -eq 0 ]; then
      echo "✅ Activé"
      COUNT=$((COUNT + 1))
    else
      echo "⚠️  Erreur"
    fi
  fi
  
  echo "     Function: $FUNCTION_NAME"
  echo "     Queue: $QUEUE_NAME"
  echo ""
done

echo "✅ Terminé: $COUNT mapping(s) mis à jour"
