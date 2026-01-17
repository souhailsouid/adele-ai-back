#!/bin/bash
# Script pour vérifier l'état des Dead Letter Queues

PROJECT="adel-ai"
STAGE="dev"
REGION="eu-west-3"

echo "🔍 Vérification des Dead Letter Queues"
echo "======================================"
echo ""

# Liste des DLQ à vérifier
DLQS=(
  "${PROJECT}-${STAGE}-form4-parser-dlq"
  "${PROJECT}-${STAGE}-collectors-dlq"
  "${PROJECT}-${STAGE}-parser-13f-dlq"
  "${PROJECT}-${STAGE}-form144-parser-dlq"
)

for DLQ in "${DLQS[@]}"; do
  echo "📋 Queue: $DLQ"
  echo "-----------------------------------"
  
  # Obtenir l'URL de la queue
  QUEUE_URL=$(aws sqs get-queue-url --queue-name "$DLQ" --region "$REGION" 2>/dev/null | jq -r '.QueueUrl // empty')
  
  if [ -z "$QUEUE_URL" ]; then
    echo "  ⚠️  Queue non trouvée (peut-être pas encore créée)"
    echo ""
    continue
  fi
  
  # Obtenir les attributs de la queue
  ATTRIBUTES=$(aws sqs get-queue-attributes \
    --queue-url "$QUEUE_URL" \
    --attribute-names All \
    --region "$REGION" 2>/dev/null)
  
  if [ $? -ne 0 ]; then
    echo "  ❌ Erreur lors de la récupération des attributs"
    echo ""
    continue
  fi
  
  # Extraire les métriques importantes
  APPROXIMATE_NUMBER_OF_MESSAGES=$(echo "$ATTRIBUTES" | jq -r '.Attributes.ApproximateNumberOfMessages // "0"')
  APPROXIMATE_NUMBER_OF_MESSAGES_NOT_VISIBLE=$(echo "$ATTRIBUTES" | jq -r '.Attributes.ApproximateNumberOfMessagesNotVisible // "0"')
  APPROXIMATE_AGE_OF_OLDEST_MESSAGE=$(echo "$ATTRIBUTES" | jq -r '.Attributes.ApproximateAgeOfOldestMessage // "0"')
  MESSAGE_RETENTION_PERIOD=$(echo "$ATTRIBUTES" | jq -r '.Attributes.MessageRetentionPeriod // "0"')
  
  # Convertir l'âge en format lisible
  if [ "$APPROXIMATE_AGE_OF_OLDEST_MESSAGE" != "0" ] && [ "$APPROXIMATE_AGE_OF_OLDEST_MESSAGE" != "null" ]; then
    AGE_SECONDS=$APPROXIMATE_AGE_OF_OLDEST_MESSAGE
    AGE_HOURS=$((AGE_SECONDS / 3600))
    AGE_DAYS=$((AGE_HOURS / 24))
    if [ $AGE_DAYS -gt 0 ]; then
      AGE_READABLE="${AGE_DAYS} jour(s) ${AGE_HOURS} heure(s)"
    elif [ $AGE_HOURS -gt 0 ]; then
      AGE_READABLE="${AGE_HOURS} heure(s)"
    else
      AGE_READABLE="${AGE_SECONDS} seconde(s)"
    fi
  else
    AGE_READABLE="N/A"
  fi
  
  # Afficher les métriques
  echo "  📊 Messages visibles: $APPROXIMATE_NUMBER_OF_MESSAGES"
  echo "  📊 Messages en traitement: $APPROXIMATE_NUMBER_OF_MESSAGES_NOT_VISIBLE"
  echo "  ⏰ Âge du plus ancien message: $AGE_READABLE"
  echo "  💾 Rétention: $((MESSAGE_RETENTION_PERIOD / 86400)) jours"
  
  # Alerte si des messages sont présents
  if [ "$APPROXIMATE_NUMBER_OF_MESSAGES" != "0" ] && [ "$APPROXIMATE_NUMBER_OF_MESSAGES" != "null" ]; then
    echo "  🔴 ⚠️  ALERTE: $APPROXIMATE_NUMBER_OF_MESSAGES message(s) en DLQ !"
  else
    echo "  ✅ Aucun message en DLQ"
  fi
  
  echo ""
done

echo "✅ Vérification terminée"
