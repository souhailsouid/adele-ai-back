#!/bin/bash
# Comparaison des requêtes sur 3 jours

echo "📊 COMPARAISON REQUÊTES - 14, 15, 16 JANVIER 2026"
echo "================================================="
echo ""

for DATE in "2026-01-14" "2026-01-15" "2026-01-16"; do
  START_TIME="${DATE}T00:00:00Z"
  END_TIME="${DATE}T23:59:59Z"
  
  echo "📅 ${DATE}:"
  echo "   ─────────────────────────────────────"
  
  # Lambda invocations
  LAMBDA_COUNT=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --dimensions Name=FunctionName,Value=adel-ai-dev-sec-smart-money-sync \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 86400 \
    --statistics Sum \
    --query 'Datapoints[0].Sum' \
    --output text 2>/dev/null)
  
  echo "   Lambda invocations: ${LAMBDA_COUNT:-0}"
  
  # Estimation requêtes Athena
  if [ -n "$LAMBDA_COUNT" ] && [ "$LAMBDA_COUNT" != "None" ] && [ "$LAMBDA_COUNT" != "0" ]; then
    ESTIMATED_ATHENA=$(echo "$LAMBDA_COUNT * 20" | awk '{printf "%.0f", $1 * 20}')
    echo "   Estimation requêtes Athena: ~${ESTIMATED_ATHENA}"
    
    # Coût estimé
    GB_SCANNED=$(echo "scale=2; $ESTIMATED_ATHENA * 10 / 1024" | bc 2>/dev/null || echo "$ESTIMATED_ATHENA * 10 / 1024" | awk '{printf "%.2f", $1 / 1024}')
    COST=$(echo "scale=4; $GB_SCANNED * 5 / 1000" | bc 2>/dev/null || echo "$GB_SCANNED * 5 / 1000" | awk '{printf "%.4f", $1 * 5 / 1000}')
    echo "   Coût estimé Athena: ~\$${COST}"
  else
    echo "   Estimation requêtes Athena: 0"
    echo "   Coût estimé Athena: \$0.00"
  fi
  
  # SQS messages
  QUEUE_URL=$(aws sqs get-queue-url --queue-name adel-ai-dev-collectors 2>/dev/null | jq -r '.QueueUrl')
  if [ -n "$QUEUE_URL" ] && [ "$QUEUE_URL" != "null" ]; then
    SQS_SENT=$(aws cloudwatch get-metric-statistics \
      --namespace AWS/SQS \
      --metric-name NumberOfMessagesSent \
      --dimensions Name=QueueName,Value=adel-ai-dev-collectors \
      --start-time "$START_TIME" \
      --end-time "$END_TIME" \
      --period 86400 \
      --statistics Sum \
      --query 'Datapoints[0].Sum' \
      --output text 2>/dev/null)
    echo "   SQS messages envoyés: ${SQS_SENT:-0}"
  fi
  
  echo ""
done

echo "📈 RÉSUMÉ:"
echo "   ─────────────────────────────────────"
echo "   Comparaison des 3 jours pour identifier"
echo "   les pics d'activité et les coûts."
