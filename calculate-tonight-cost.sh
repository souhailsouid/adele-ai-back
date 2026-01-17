#!/bin/bash
# Calcul du coût de cette nuit (16 jan 22h UTC → 17 jan 6h UTC)

TONIGHT_START="2026-01-16T22:00:00Z"
TONIGHT_END="2026-01-17T06:00:00Z"

echo "💰 CALCUL COÛT CETTE NUIT (${TONIGHT_START} → ${TONIGHT_END})"
echo "====================================================="
echo ""

# 1. Lambda invocations
echo "1️⃣  Lambda form4-parser - Invocations cette nuit:"
INVOCATIONS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=adel-ai-dev-form4-parser \
  --start-time "$TONIGHT_START" \
  --end-time "$TONIGHT_END" \
  --period 3600 \
  --statistics Sum \
  --query 'Datapoints[*].Sum' \
  --output text 2>/dev/null | awk '{sum+=$1} END {print sum}')

echo "   Total invocations: ${INVOCATIONS:-0}"

# 2. Lambda duration (pour calculer GB-seconds)
echo ""
echo "2️⃣  Lambda form4-parser - Durée moyenne:"
DURATION_AVG=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=adel-ai-dev-form4-parser \
  --start-time "$TONIGHT_START" \
  --end-time "$TONIGHT_END" \
  --period 3600 \
  --statistics Average \
  --query 'Datapoints[*].Average' \
  --output text 2>/dev/null | awk '{sum+=$1; count++} END {print count>0 ? sum/count : 0}')

echo "   Durée moyenne: ${DURATION_AVG:-0}ms"

# 3. Lambda errors
echo ""
echo "3️⃣  Lambda form4-parser - Errors:"
ERRORS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=adel-ai-dev-form4-parser \
  --start-time "$TONIGHT_START" \
  --end-time "$TONIGHT_END" \
  --period 3600 \
  --statistics Sum \
  --query 'Datapoints[*].Sum' \
  --output text 2>/dev/null | awk '{sum+=$1} END {print sum}')

echo "   Total errors: ${ERRORS:-0}"

# 4. Calcul coût Lambda
if [ -n "$INVOCATIONS" ] && [ "$INVOCATIONS" != "0" ] && [ "$INVOCATIONS" != "None" ]; then
  MEMORY_GB=1
  DURATION_SEC=$(echo "scale=2; ${DURATION_AVG:-1000} / 1000" | bc 2>/dev/null || echo "${DURATION_AVG:-1000} / 1000" | awk '{printf "%.2f", $1 / 1000}')
  GB_SECONDS=$(echo "scale=2; $INVOCATIONS * $MEMORY_GB * $DURATION_SEC" | bc 2>/dev/null || echo "$INVOCATIONS * $MEMORY_GB * $DURATION_SEC" | awk '{printf "%.2f", $1 * $2 * $3}')
  LAMBDA_COST=$(echo "scale=4; $GB_SECONDS * 0.0000166667" | bc 2>/dev/null || echo "$GB_SECONDS * 0.0000166667" | awk '{printf "%.4f", $1 * 0.0000166667}')
  
  echo ""
  echo "💰 COÛT LAMBDA:"
  echo "   Invocations: $INVOCATIONS"
  echo "   Durée moyenne: ${DURATION_SEC}s"
  echo "   Memory: ${MEMORY_GB}GB"
  echo "   GB-seconds: ${GB_SECONDS}"
  echo "   Coût: \$${LAMBDA_COST}"
else
  LAMBDA_COST=0
  echo ""
  echo "💰 COÛT LAMBDA: \$0.00 (aucune invocation)"
fi

# 5. Estimation requêtes Athena
if [ -n "$INVOCATIONS" ] && [ "$INVOCATIONS" != "0" ] && [ "$INVOCATIONS" != "None" ]; then
  ATHENA_QUERIES=$(echo "$INVOCATIONS * 5" | awk '{printf "%.0f", $1 * 5}')
  GB_SCANNED=$(echo "scale=2; $ATHENA_QUERIES * 10 / 1024" | bc 2>/dev/null || echo "$ATHENA_QUERIES * 10 / 1024" | awk '{printf "%.2f", $1 * 10 / 1024}')
  ATHENA_COST=$(echo "scale=4; $GB_SCANNED * 5 / 1000" | bc 2>/dev/null || echo "$GB_SCANNED * 5 / 1000" | awk '{printf "%.4f", $1 * 5 / 1000}')
  
  echo ""
  echo "💰 COÛT ATHENA (estimation):"
  echo "   Queries estimées: ${ATHENA_QUERIES} (5 par invocation)"
  echo "   GB scannés: ${GB_SCANNED}"
  echo "   Coût: \$${ATHENA_COST}"
else
  ATHENA_COST=0
  echo ""
  echo "💰 COÛT ATHENA: \$0.00"
fi

# 6. Total
TOTAL_COST=$(echo "scale=4; $LAMBDA_COST + $ATHENA_COST" | bc 2>/dev/null || echo "$LAMBDA_COST + $ATHENA_COST" | awk '{printf "%.4f", $1 + $2}')

echo ""
echo "📊 TOTAL CETTE NUIT: \$${TOTAL_COST}"
echo ""
echo "⚠️  Note: Coût S3 non inclus (nécessite CloudWatch metrics S3)"
echo "   Si s3-direct-read était utilisé, ajouter ~\$0.0042 par 10K GET requests"

