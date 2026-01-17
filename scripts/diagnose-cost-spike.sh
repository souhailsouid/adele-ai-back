#!/bin/bash
# Script pour diagnostiquer une augmentation de coût soudaine

REGION="eu-west-3"
PROJECT="adel-ai"
STAGE="dev"

echo "🔍 Diagnostic d'augmentation de coût"
echo "===================================="
echo ""

# 1. Vérifier les invocations Lambda récentes (dernières 24h)
echo "1️⃣  Invocations Lambda (dernières 24h)"
echo "--------------------------------------"
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)
START_TIME=$(date -u -v-24H +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S)

# Lister toutes les Lambdas
LAMBDAS=$(aws lambda list-functions --region "$REGION" 2>/dev/null | jq -r ".Functions[] | select(.FunctionName | contains(\"$PROJECT-$STAGE\")) | .FunctionName" | sort)

TOTAL_INVOCATIONS=0
for LAMBDA in $LAMBDAS; do
  METRICS=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --dimensions Name=FunctionName,Value="$LAMBDA" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 3600 \
    --statistics Sum \
    --region "$REGION" 2>/dev/null)
  
  INVOCATIONS=$(echo "$METRICS" | jq -r '.Datapoints | map(.Sum) | add // 0')
  
  if [ "$INVOCATIONS" != "0" ] && [ "$INVOCATIONS" != "null" ]; then
    echo "  📊 $LAMBDA: $INVOCATIONS invocations"
    TOTAL_INVOCATIONS=$((TOTAL_INVOCATIONS + INVOCATIONS))
  fi
done

echo "  📈 Total: $TOTAL_INVOCATIONS invocations"
echo ""

# 2. Vérifier les requêtes Athena
echo "2️⃣  Requêtes Athena (dernières 24h)"
echo "-----------------------------------"
ATHENA_METRICS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Athena \
  --metric-name QueryExecutionCount \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 3600 \
  --statistics Sum \
  --region "$REGION" 2>/dev/null)

ATHENA_QUERIES=$(echo "$ATHENA_METRICS" | jq -r '.Datapoints | map(.Sum) | add // 0')
echo "  📊 Requêtes: $ATHENA_QUERIES"
echo ""

# 3. Vérifier les requêtes S3 (GET/LIST)
echo "3️⃣  Requêtes S3 (dernières 24h)"
echo "-------------------------------"
S3_BUCKETS=$(aws s3api list-buckets --region "$REGION" 2>/dev/null | jq -r ".Buckets[] | select(.Name | contains(\"$PROJECT-$STAGE\")) | .Name")

for BUCKET in $S3_BUCKETS; do
  # GET requests
  GET_METRICS=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/S3 \
    --metric-name NumberOfGETRequests \
    --dimensions Name=BucketName,Value="$BUCKET" Name=StorageType,Value=AllRequests \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 3600 \
    --statistics Sum \
    --region "$REGION" 2>/dev/null)
  
  GET_REQUESTS=$(echo "$GET_METRICS" | jq -r '.Datapoints | map(.Sum) | add // 0')
  
  # LIST requests
  LIST_METRICS=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/S3 \
    --metric-name NumberOfListRequests \
    --dimensions Name=BucketName,Value="$BUCKET" Name=StorageType,Value=AllRequests \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 3600 \
    --statistics Sum \
    --region "$REGION" 2>/dev/null)
  
  LIST_REQUESTS=$(echo "$LIST_METRICS" | jq -r '.Datapoints | map(.Sum) | add // 0')
  
  if [ "$GET_REQUESTS" != "0" ] || [ "$LIST_REQUESTS" != "0" ]; then
    echo "  📊 $BUCKET:"
    echo "     - GET: $GET_REQUESTS"
    echo "     - LIST: $LIST_REQUESTS"
  fi
done
echo ""

# 4. Vérifier les messages SQS traités
echo "4️⃣  Messages SQS (dernières 24h)"
echo "--------------------------------"
QUEUES=$(aws sqs list-queues --region "$REGION" 2>/dev/null | jq -r '.QueueUrls[]' | grep "$PROJECT-$STAGE" | sed 's|.*/||')

for QUEUE in $QUEUES; do
  # Messages reçus
  RECEIVED_METRICS=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/SQS \
    --metric-name NumberOfMessagesReceived \
    --dimensions Name=QueueName,Value="$QUEUE" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 3600 \
    --statistics Sum \
    --region "$REGION" 2>/dev/null)
  
  RECEIVED=$(echo "$RECEIVED_METRICS" | jq -r '.Datapoints | map(.Sum) | add // 0')
  
  # Messages supprimés
  DELETED_METRICS=$(aws cloudwatch get-metric-statistics \
    --namespace AWS/SQS \
    --metric-name NumberOfMessagesDeleted \
    --dimensions Name=QueueName,Value="$QUEUE" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period 3600 \
    --statistics Sum \
    --region "$REGION" 2>/dev/null)
  
  DELETED=$(echo "$DELETED_METRICS" | jq -r '.Datapoints | map(.Sum) | add // 0')
  
  if [ "$RECEIVED" != "0" ] || [ "$DELETED" != "0" ]; then
    echo "  📊 $QUEUE:"
    echo "     - Reçus: $RECEIVED"
    echo "     - Supprimés: $DELETED"
  fi
done
echo ""

# 5. Vérifier les Event Source Mappings actifs
echo "5️⃣  Event Source Mappings actifs"
echo "---------------------------------"
ACTIVE_MAPPINGS=$(aws lambda list-event-source-mappings --region "$REGION" 2>/dev/null | \
  jq -r ".EventSourceMappings[] | select(.State == \"Enabled\" or .State == \"Enabling\") | \"\(.FunctionArn | split(\":\")[-1]) -> \(.EventSourceArn | split(\":\")[-1])\"")

if [ -n "$ACTIVE_MAPPINGS" ]; then
  echo "$ACTIVE_MAPPINGS" | while read -r MAPPING; do
    echo "  ✅ $MAPPING"
  done
else
  echo "  ℹ️  Aucun mapping actif"
fi
echo ""

echo "✅ Diagnostic terminé"
