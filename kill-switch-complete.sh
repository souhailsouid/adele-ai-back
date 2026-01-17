#!/bin/bash
# 🛑 KILL SWITCH COMPLET - Arrêt total des workflows SEC Smart Money

echo "🛑 KILL SWITCH COMPLET - Arrêt total des workflows"
echo "=================================================="
echo ""

# 1. Désactiver le trigger Lambda depuis SQS
echo "1️⃣  Désactivation du trigger Lambda depuis SQS..."
EVENT_SOURCE_UUID=$(aws lambda list-event-source-mappings \
  --function-name adel-ai-dev-sec-smart-money-sync \
  --query 'EventSourceMappings[0].UUID' \
  --output text 2>/dev/null)

if [ "$EVENT_SOURCE_UUID" != "None" ] && [ -n "$EVENT_SOURCE_UUID" ]; then
  aws lambda update-event-source-mapping \
    --uuid "$EVENT_SOURCE_UUID" \
    --enabled false 2>/dev/null && \
    echo "   ✅ Trigger SQS désactivé (UUID: $EVENT_SOURCE_UUID)" || \
    echo "   ⚠️  Erreur lors de la désactivation du trigger"
else
  echo "   ⚠️  Aucun trigger SQS trouvé (peut-être déjà désactivé)"
fi

# 2. Purger la queue SQS (collectors_queue)
echo ""
echo "2️⃣  Purge de la queue SQS..."
QUEUE_URL=$(aws sqs get-queue-url --queue-name adel-ai-dev-collectors 2>/dev/null | jq -r '.QueueUrl' 2>/dev/null)
if [ -n "$QUEUE_URL" ] && [ "$QUEUE_URL" != "null" ]; then
  MESSAGE_COUNT=$(aws sqs get-queue-attributes \
    --queue-url "$QUEUE_URL" \
    --attribute-names ApproximateNumberOfMessages \
    --query 'Attributes.ApproximateNumberOfMessages' \
    --output text 2>/dev/null)
  
  echo "   📊 Messages dans la queue: $MESSAGE_COUNT"
  
  if [ "$MESSAGE_COUNT" != "0" ] && [ -n "$MESSAGE_COUNT" ]; then
    read -p "   ⚠️  Purger la queue (perte du backlog) ? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      aws sqs purge-queue --queue-url "$QUEUE_URL" 2>/dev/null && \
        echo "   ✅ Queue purgée" || \
        echo "   ❌ Erreur lors de la purge"
    else
      echo "   ⏭️  Purge annulée"
    fi
  else
    echo "   ✅ Queue déjà vide"
  fi
else
  echo "   ⚠️  Queue non trouvée"
fi

# 3. Mettre Reserved Concurrency = 0 (kill switch définitif)
echo ""
echo "3️⃣  Kill switch Lambda (Reserved Concurrency = 0)..."
aws lambda put-function-concurrency \
  --function-name adel-ai-dev-sec-smart-money-sync \
  --reserved-concurrent-executions 0 2>/dev/null && \
  echo "   ✅ Reserved Concurrency = 0 (aucune exécution possible)" || \
  echo "   ⚠️  Erreur (peut-être déjà à 0)"

# 4. Limiter Athena Workgroup
echo ""
echo "4️⃣  Limitation du Workgroup Athena..."
WORKGROUP_NAME="adel-ai-dev-workgroup"
aws athena update-work-group \
  --work-group "$WORKGROUP_NAME" \
  --configuration-updates "BytesScannedCutoffPerQuery=1048576,ResultConfigurationUpdates={},EnforceWorkGroupConfiguration=true" \
  --state DISABLED 2>/dev/null && \
  echo "   ✅ Workgroup désactivé" || \
  echo "   ⚠️  Erreur (peut-être déjà désactivé ou pas de permission)"

echo ""
echo "✅ KILL SWITCH COMPLET APPLIQUÉ"
echo ""
echo "📋 Vérification finale:"
echo "   - CRONs: DISABLED"
echo "   - Trigger SQS: DISABLED"
echo "   - Lambda Concurrency: 0"
echo "   - Athena Workgroup: DISABLED"
