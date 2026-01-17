#!/bin/bash
# Script pour vérifier la configuration des Dead Letter Queues

PROJECT="adel-ai"
STAGE="dev"
REGION="eu-west-3"

echo "🔍 Vérification de la configuration des DLQ"
echo "==========================================="
echo ""

# Liste des queues principales et leurs DLQ associées (format: queue_name|dlq_name)
QUEUE_DLQ_PAIRS=(
  "${PROJECT}-${STAGE}-form4-parser|${PROJECT}-${STAGE}-form4-parser-dlq"
  "${PROJECT}-${STAGE}-collectors|${PROJECT}-${STAGE}-collectors-dlq"
  "${PROJECT}-${STAGE}-parser-13f|${PROJECT}-${STAGE}-parser-13f-dlq"
  "${PROJECT}-${STAGE}-form144-parser-queue|${PROJECT}-${STAGE}-form144-parser-dlq"
)

for PAIR in "${QUEUE_DLQ_PAIRS[@]}"; do
  QUEUE_NAME="${PAIR%%|*}"
  DLQ_NAME="${PAIR##*|}"
  
  echo "📋 Queue: $QUEUE_NAME"
  echo "   DLQ: $DLQ_NAME"
  echo "-----------------------------------"
  
  # Obtenir l'URL de la queue principale
  QUEUE_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region "$REGION" 2>/dev/null | jq -r '.QueueUrl // empty')
  
  if [ -z "$QUEUE_URL" ]; then
    echo "  ⚠️  Queue principale non trouvée"
    echo ""
    continue
  fi
  
  # Obtenir les attributs de la queue principale
  ATTRIBUTES=$(aws sqs get-queue-attributes \
    --queue-url "$QUEUE_URL" \
    --attribute-names RedrivePolicy \
    --region "$REGION" 2>/dev/null)
  
  if [ $? -ne 0 ]; then
    echo "  ❌ Erreur lors de la récupération des attributs"
    echo ""
    continue
  fi
  
  REDRIVE_POLICY=$(echo "$ATTRIBUTES" | jq -r '.Attributes.RedrivePolicy // "null"')
  
  if [ "$REDRIVE_POLICY" == "null" ] || [ -z "$REDRIVE_POLICY" ]; then
    echo "  🔴 ❌ PROBLÈME: RedrivePolicy non configurée !"
    echo "     La queue n'a pas de DLQ configurée"
  else
    # Parser la redrive policy
    MAX_RECEIVE_COUNT=$(echo "$REDRIVE_POLICY" | jq -r '.maxReceiveCount // "N/A"')
    DEAD_LETTER_TARGET_ARN=$(echo "$REDRIVE_POLICY" | jq -r '.deadLetterTargetArn // "N/A"')
    
    echo "  ✅ RedrivePolicy configurée"
    echo "     - maxReceiveCount: $MAX_RECEIVE_COUNT"
    echo "     - DLQ ARN: $(basename $DEAD_LETTER_TARGET_ARN)"
    
    # Vérifier que le maxReceiveCount est à 3
    if [ "$MAX_RECEIVE_COUNT" != "3" ]; then
      echo "  ⚠️  Attention: maxReceiveCount n'est pas à 3 (actuellement: $MAX_RECEIVE_COUNT)"
    fi
    
    # Vérifier que la DLQ existe
    DLQ_URL=$(aws sqs get-queue-url --queue-name "$DLQ_NAME" --region "$REGION" 2>/dev/null | jq -r '.QueueUrl // empty')
    if [ -z "$DLQ_URL" ]; then
      echo "  🔴 ❌ PROBLÈME: DLQ '$DLQ_NAME' n'existe pas !"
    else
      echo "  ✅ DLQ existe"
    fi
  fi
  
  # Obtenir le nombre de messages dans la queue principale
  QUEUE_ATTRIBUTES=$(aws sqs get-queue-attributes \
    --queue-url "$QUEUE_URL" \
    --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible \
    --region "$REGION" 2>/dev/null)
  
  VISIBLE=$(echo "$QUEUE_ATTRIBUTES" | jq -r '.Attributes.ApproximateNumberOfMessages // "0"')
  NOT_VISIBLE=$(echo "$QUEUE_ATTRIBUTES" | jq -r '.Attributes.ApproximateNumberOfMessagesNotVisible // "0"')
  
  echo "  📊 Messages dans la queue:"
  echo "     - Visibles: $VISIBLE"
  echo "     - En traitement: $NOT_VISIBLE"
  
  echo ""
done

echo "✅ Vérification terminée"
