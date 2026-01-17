#!/bin/bash
# Analyse détaillée des requêtes aujourd'hui

TODAY=$(date -u +%Y-%m-%d)
START_TIME="${TODAY}T00:00:00Z"
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "📊 ANALYSE DÉTAILLÉE - REQUÊTES AUJOURD'HUI (${TODAY})"
echo "====================================================="
echo ""

# Lambda invocations (détaillé par heure)
echo "1️⃣  Lambda sec-smart-money-sync (par heure):"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=adel-ai-dev-sec-smart-money-sync \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 3600 \
  --statistics Sum \
  --output table 2>/dev/null

TOTAL_LAMBDA=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=adel-ai-dev-sec-smart-money-sync \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 86400 \
  --statistics Sum \
  --query 'Datapoints[0].Sum' \
  --output text 2>/dev/null)

echo ""
echo "   📊 TOTAL Lambda invocations: ${TOTAL_LAMBDA:-0}"

# Athena queries
echo ""
echo "2️⃣  Athena Queries (par heure):"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Athena \
  --metric-name QueryExecutionCount \
  --dimensions Name=WorkGroupName,Value=adel-ai-dev-workgroup \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 3600 \
  --statistics Sum \
  --output table 2>/dev/null

TOTAL_ATHENA=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Athena \
  --metric-name QueryExecutionCount \
  --dimensions Name=WorkGroupName,Value=adel-ai-dev-workgroup \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 86400 \
  --statistics Sum \
  --query 'Datapoints[0].Sum' \
  --output text 2>/dev/null)

echo ""
echo "   📊 TOTAL Athena queries: ${TOTAL_ATHENA:-0}"

# Estimation requêtes par invocation Lambda
echo ""
echo "3️⃣  ESTIMATION:"
if [ -n "$TOTAL_LAMBDA" ] && [ "$TOTAL_LAMBDA" != "None" ] && [ "$TOTAL_LAMBDA" != "0" ]; then
  # Chaque invocation Lambda fait environ:
  # - 1 requête pour getCompaniesAthena (top 100)
  # - 100 requêtes pour discoverNewForm4Filings (1 par company)
  # - N requêtes pour processForm4Filing (1 par filing découvert)
  # Estimation conservatrice: 10-50 requêtes Athena par invocation Lambda
  
  ESTIMATED_ATHENA=$(echo "$TOTAL_LAMBDA * 20" | bc 2>/dev/null || echo "$TOTAL_LAMBDA * 20" | awk '{print $1 * 20}')
  echo "   Lambda invocations: $TOTAL_LAMBDA"
  echo "   Estimation requêtes Athena (20 par invocation): ~$ESTIMATED_ATHENA"
  echo "   Requêtes Athena réelles (CloudWatch): ${TOTAL_ATHENA:-0}"
else
  echo "   Aucune invocation Lambda aujourd'hui"
fi

echo ""
echo "✅ Analyse complète"
