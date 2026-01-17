#!/bin/bash
# Vérifier le nombre de requêtes aujourd'hui

TODAY=$(date -u +%Y-%m-%d)
START_TIME="${TODAY}T00:00:00Z"
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "📊 REQUÊTES AUJOURD'HUI (${TODAY})"
echo "=================================="
echo ""

# 1. Lambda invocations
echo "1️⃣  Lambda sec-smart-money-sync:"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=adel-ai-dev-sec-smart-money-sync \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 3600 \
  --statistics Sum \
  --query 'Datapoints[*].Sum' \
  --output text 2>/dev/null | awk '{sum+=$1} END {print "   Total invocations:", sum+0}'

# 2. SQS messages
echo ""
echo "2️⃣  SQS Queue (collectors_queue):"
QUEUE_URL=$(aws sqs get-queue-url --queue-name adel-ai-dev-collectors 2>/dev/null | jq -r '.QueueUrl')
if [ -n "$QUEUE_URL" ] && [ "$QUEUE_URL" != "null" ]; then
  aws cloudwatch get-metric-statistics \
    --namespace AWS/SQS \
    --metric-name NumberOfMessagesSent \
    --dimensions Name=QueueName,Value=adel-ai-dev-collectors \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 3600 \
    --statistics Sum \
    --query 'Datapoints[*].Sum' \
    --output text 2>/dev/null | awk '{sum+=$1} END {print "   Messages envoyés:", sum+0}'
  
  aws cloudwatch get-metric-statistics \
    --namespace AWS/SQS \
    --metric-name NumberOfMessagesReceived \
    --dimensions Name=QueueName,Value=adel-ai-dev-collectors \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 3600 \
    --statistics Sum \
    --query 'Datapoints[*].Sum' \
    --output text 2>/dev/null | awk '{sum+=$1} END {print "   Messages reçus:", sum+0}'
fi

# 3. Athena queries
echo ""
echo "3️⃣  Athena Queries:"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Athena \
  --metric-name QueryExecutionCount \
  --dimensions Name=WorkGroupName,Value=adel-ai-dev-workgroup \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 3600 \
  --statistics Sum \
  --query 'Datapoints[*].Sum' \
  --output text 2>/dev/null | awk '{sum+=$1} END {print "   Total queries:", sum+0}'

# 4. EventBridge rules triggered
echo ""
echo "4️⃣  EventBridge Rules:"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Events \
  --metric-name TriggeredRules \
  --dimensions Name=RuleName,Value=adel-ai-dev-sec-smart-money-sync-cron \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 3600 \
  --statistics Sum \
  --query 'Datapoints[*].Sum' \
  --output text 2>/dev/null | awk '{sum+=$1} END {print "   sec-smart-money-sync-cron déclenché:", sum+0}'

echo ""
echo "✅ Vérification complète"
