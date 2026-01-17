#!/bin/bash
# Analyse des coûts de cette nuit

TODAY=$(date -u +%Y-%m-%d)
YESTERDAY=$(date -u -d "yesterday" +%Y-%m-%d 2>/dev/null || date -u -v-1d +%Y-%m-%d 2>/dev/null || echo "2026-01-15")
NIGHT_START="${YESTERDAY}T22:00:00Z"  # 22h UTC (hier soir)
NIGHT_END="${TODAY}T06:00:00Z"         # 6h UTC (ce matin)

echo "🔍 ANALYSE COÛTS CETTE NUIT (${NIGHT_START} → ${NIGHT_END})"
echo "=========================================================="
echo ""

# 1. Messages dans la DLQ
echo "1️⃣  Dead Letter Queue (form4-parser-dlq):"
DLQ_URL=$(aws sqs get-queue-url --queue-name adel-ai-dev-form4-parser-dlq 2>/dev/null | jq -r '.QueueUrl')
if [ -n "$DLQ_URL" ] && [ "$DLQ_URL" != "null" ]; then
  DLQ_MESSAGES=$(aws sqs get-queue-attributes \
    --queue-url "$DLQ_URL" \
    --attribute-names ApproximateNumberOfMessagesVisible \
    --query 'Attributes.ApproximateNumberOfMessagesVisible' \
    --output text 2>/dev/null)
  echo "   Messages dans DLQ: ${DLQ_MESSAGES:-0}"
  
  if [ "$DLQ_MESSAGES" != "0" ] && [ -n "$DLQ_MESSAGES" ]; then
    echo "   ⚠️  ${DLQ_MESSAGES} messages en échec permanent"
    echo "   → Chaque message = 1 tentative Lambda = requêtes Athena/S3"
  fi
else
  echo "   ⚠️  DLQ non trouvée"
fi

# 2. Lambda invocations cette nuit
echo ""
echo "2️⃣  Lambda form4-parser (cette nuit):"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=adel-ai-dev-form4-parser \
  --start-time "$NIGHT_START" \
  --end-time "$NIGHT_END" \
  --period 3600 \
  --statistics Sum \
  --output table 2>/dev/null

TOTAL_INVOCATIONS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=adel-ai-dev-form4-parser \
  --start-time "$NIGHT_START" \
  --end-time "$NIGHT_END" \
  --period 86400 \
  --statistics Sum \
  --query 'Datapoints[0].Sum' \
  --output text 2>/dev/null)

echo ""
echo "   Total invocations: ${TOTAL_INVOCATIONS:-0}"

# 3. Lambda errors
echo ""
echo "3️⃣  Lambda Errors (cette nuit):"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=adel-ai-dev-form4-parser \
  --start-time "$NIGHT_START" \
  --end-time "$NIGHT_END" \
  --period 3600 \
  --statistics Sum \
  --output table 2>/dev/null

TOTAL_ERRORS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=adel-ai-dev-form4-parser \
  --start-time "$NIGHT_START" \
  --end-time "$NIGHT_END" \
  --period 86400 \
  --statistics Sum \
  --query 'Datapoints[0].Sum' \
  --output text 2>/dev/null)

echo ""
echo "   Total errors: ${TOTAL_ERRORS:-0}"

# 4. SQS messages reçus
echo ""
echo "4️⃣  SQS Messages reçus (form4-parser-queue, cette nuit):"
aws cloudwatch get-metric-statistics \
  --namespace AWS/SQS \
  --metric-name NumberOfMessagesReceived \
  --dimensions Name=QueueName,Value=adel-ai-dev-form4-parser \
  --start-time "$NIGHT_START" \
  --end-time "$NIGHT_END" \
  --period 3600 \
  --statistics Sum \
  --output table 2>/dev/null

echo ""
echo "✅ Analyse complète"
