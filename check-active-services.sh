#!/bin/bash
# Vérification de l'état des services AWS (Athena, SQS, Lambda)

echo "🔍 VÉRIFICATION ÉTAT DES SERVICES AWS"
echo "====================================="
echo ""

# 1. Vérifier les queues SQS
echo "1️⃣  QUEUES SQS - Messages en attente:"
echo ""

QUEUES=(
  "adel-ai-dev-form4-parser"
  "adel-ai-dev-form144-parser"
  "adel-ai-dev-collectors"
  "adel-ai-dev-parser-13f"
)

for QUEUE in "${QUEUES[@]}"; do
  QUEUE_URL="https://sqs.eu-west-3.amazonaws.com/956633302249/${QUEUE}"
  MESSAGES=$(aws sqs get-queue-attributes \
    --queue-url "$QUEUE_URL" \
    --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible \
    2>/dev/null | jq -r '.Attributes.ApproximateNumberOfMessages // "0"')
  
  if [ "$MESSAGES" != "0" ] && [ "$MESSAGES" != "null" ]; then
    echo "   ⚠️  ${QUEUE}: ${MESSAGES} messages en attente"
  else
    echo "   ✅ ${QUEUE}: 0 messages"
  fi
done

echo ""
echo "2️⃣  LAMBDA - Invocations récentes (dernières 2h):"
echo ""

LAMBDAS=(
  "adel-ai-dev-form4-parser"
  "adel-ai-dev-form144-parser"
  "adel-ai-dev-sec-smart-money-sync"
  "adel-ai-dev-collector-sec-watcher"
)

for LAMBDA in "${LAMBDAS[@]}"; do
  INVOCATIONS=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --dimensions Name=FunctionName,Value="$LAMBDA" \
    --start-time $(date -u -v-2H +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 3600 \
    --statistics Sum \
    2>/dev/null | jq -r '.Datapoints[0].Sum // "0"')
  
  if [ "$INVOCATIONS" != "0" ] && [ "$INVOCATIONS" != "null" ]; then
    echo "   ⚠️  ${LAMBDA}: ${INVOCATIONS} invocations (2h)"
  else
    echo "   ✅ ${LAMBDA}: 0 invocations"
  fi
done

echo ""
echo "3️⃣  ATHENA - Requêtes récentes (dernières 2h):"
echo ""

ATHENA_QUERIES=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Athena \
  --metric-name QueryExecutionCount \
  --dimensions Name=WorkGroup,Value=adel-ai-dev-workgroup \
  --start-time $(date -u -v-2H +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum \
  2>/dev/null | jq -r '.Datapoints[0].Sum // "0"')

if [ "$ATHENA_QUERIES" != "0" ] && [ "$ATHENA_QUERIES" != "null" ]; then
  echo "   ⚠️  Athena: ${ATHENA_QUERIES} requêtes (2h)"
else
  echo "   ✅ Athena: 0 requêtes"
fi

echo ""
echo "4️⃣  LAMBDA TRIGGERS - État des event source mappings:"
echo ""

# Vérifier les triggers SQS
LAMBDA_FUNCTIONS=(
  "adel-ai-dev-form4-parser"
  "adel-ai-dev-form144-parser"
  "adel-ai-dev-sec-smart-money-sync"
)

for LAMBDA in "${LAMBDA_FUNCTIONS[@]}"; do
  TRIGGERS=$(aws lambda list-event-source-mappings \
    --function-name "$LAMBDA" \
    2>/dev/null | jq -r '.EventSourceMappings[] | "\(.EventSourceArn) - Enabled: \(.Enabled)"')
  
  if [ -n "$TRIGGERS" ]; then
    echo "   ${LAMBDA}:"
    echo "$TRIGGERS" | while read -r line; do
      echo "      $line"
    done
  else
    echo "   ✅ ${LAMBDA}: Aucun trigger actif"
  fi
done

echo ""
echo "5️⃣  LAMBDA CONCURRENCY - Reserved concurrency:"
echo ""

for LAMBDA in "${LAMBDA_FUNCTIONS[@]}"; do
  CONCURRENCY=$(aws lambda get-function-concurrency \
    --function-name "$LAMBDA" \
    2>/dev/null | jq -r '.ReservedConcurrentExecutions // "Not set"')
  
  echo "   ${LAMBDA}: ${CONCURRENCY}"
done

