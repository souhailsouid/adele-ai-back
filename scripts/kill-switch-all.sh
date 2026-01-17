#!/bin/bash
# Script pour activer le kill switch sur plusieurs Lambdas et queues SQS

PROJECT="adel-ai"
STAGE="dev"
REGION="eu-west-3"

echo "🛑 ACTIVATION DU KILL SWITCH"
echo "============================"
echo ""

# Liste des Lambdas à bloquer
LAMBDAS=(
  "${PROJECT}-${STAGE}-collector-fmp-signals"
  "${PROJECT}-${STAGE}-collector-coinglass"
  "${PROJECT}-${STAGE}-collector-scrapecrea"
  "${PROJECT}-${STAGE}-processor-ia"
)

# Liste des queues SQS à désactiver
QUEUES=(
  "${PROJECT}-${STAGE}-form144-parser-queue"
  "${PROJECT}-${STAGE}-collectors"
  "${PROJECT}-${STAGE}-form4-parser-queue"
)

echo "1️⃣  Blocage des Lambdas (reserved_concurrent_executions = 0)"
echo "------------------------------------------------------------"
for LAMBDA in "${LAMBDAS[@]}"; do
  echo -n "  🔒 $LAMBDA... "
  
  # Mettre reserved concurrency à 0
  aws lambda put-function-concurrency \
    --function-name "$LAMBDA" \
    --reserved-concurrent-executions 0 \
    --region "$REGION" 2>/dev/null
  
  if [ $? -eq 0 ]; then
    echo "✅ Bloqué"
  else
    echo "⚠️  Erreur (peut-être déjà bloqué ou Lambda n'existe pas)"
  fi
done

echo ""
echo "2️⃣  Désactivation des Event Source Mappings SQS"
echo "------------------------------------------------"
for QUEUE_NAME in "${QUEUES[@]}"; do
  echo "  📋 Queue: $QUEUE_NAME"
  
  # Obtenir l'URL de la queue
  QUEUE_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region "$REGION" 2>/dev/null | jq -r '.QueueUrl // empty')
  
  if [ -z "$QUEUE_URL" ]; then
    echo "    ⚠️  Queue non trouvée"
    continue
  fi
  
  # Trouver tous les event source mappings qui utilisent cette queue
  MAPPINGS=$(aws lambda list-event-source-mappings \
    --region "$REGION" \
    --query "EventSourceMappings[?contains(EventSourceArn, '$(basename $QUEUE_URL)')].UUID" \
    --output text 2>/dev/null)
  
  if [ -z "$MAPPINGS" ] || [ "$MAPPINGS" == "None" ]; then
    echo "    ℹ️  Aucun event source mapping trouvé"
  else
    for UUID in $MAPPINGS; do
      echo -n "    🔒 Désactivation mapping $UUID... "
      aws lambda update-event-source-mapping \
        --uuid "$UUID" \
        --no-enabled \
        --region "$REGION" 2>/dev/null
      
      if [ $? -eq 0 ]; then
        echo "✅ Désactivé"
      else
        echo "⚠️  Erreur"
      fi
    done
  fi
done

echo ""
echo "3️⃣  Vérification des EventBridge Rules"
echo "---------------------------------------"
# Chercher les règles EventBridge qui ciblent ces Lambdas
for LAMBDA in "${LAMBDAS[@]}"; do
  echo "  📋 Lambda: $LAMBDA"
  
  # Lister les règles EventBridge
  RULES=$(aws events list-rules \
    --region "$REGION" \
    --query "Rules[?contains(Targets[0].Arn, '$LAMBDA')].Name" \
    --output text 2>/dev/null)
  
  if [ -z "$RULES" ] || [ "$RULES" == "None" ]; then
    echo "    ℹ️  Aucune règle EventBridge trouvée"
  else
    for RULE in $RULES; do
      echo -n "    🔒 Désactivation règle $RULE... "
      aws events disable-rule \
        --name "$RULE" \
        --region "$REGION" 2>/dev/null
      
      if [ $? -eq 0 ]; then
        echo "✅ Désactivé"
      else
        echo "⚠️  Erreur"
      fi
    done
  fi
done

echo ""
echo "4️⃣  Vérification des DLQ"
echo "------------------------"
./scripts/check-dlq-status.sh

echo ""
echo "✅ Kill switch activé"
echo ""
echo "📊 Résumé:"
echo "  - Lambdas bloquées: ${#LAMBDAS[@]}"
echo "  - Queues SQS désactivées: ${#QUEUES[@]}"
echo ""
echo "💡 Pour réactiver plus tard:"
echo "  - Lambda: aws lambda put-function-concurrency --function-name <name> --reserved-concurrent-executions 1"
echo "  - Event Source Mapping: aws lambda update-event-source-mapping --uuid <uuid> --enabled"
echo "  - EventBridge: aws events enable-rule --name <rule-name>"
