#!/bin/bash
# Analyse détaillée des coûts - Comprendre pourquoi 110$

echo "🔍 ANALYSE DÉTAILLÉE - FACTURE \$110"
echo "===================================="
echo ""

# Timeline complète
echo "📅 TIMELINE DES ÉVÉNEMENTS:"
echo "─────────────────────────────"
echo ""

# 1. Quand les CRONs ont été désactivés
echo "1️⃣  Désactivation des CRONs:"
aws events describe-rule --name adel-ai-dev-sec-smart-money-sync-cron --query '{Name:Name, State:State, LastModifiedDate:LastModifiedDate}' --output json 2>/dev/null | jq '{Rule: .Name, State: .State, LastModified: .LastModifiedDate}'
aws events describe-rule --name adel-ai-dev-form4-insider-collector-intraday --query '{Name:Name, State:State, LastModifiedDate:LastModifiedDate}' --output json 2>/dev/null | jq '{Rule: .Name, State: .State, LastModified: .LastModifiedDate}'

# 2. Invocations Lambda par heure (dernières 48h)
echo ""
echo "2️⃣  Lambda form4-parser - Invocations par heure (48h):"
START_TIME=$(date -u -d "2 days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-2d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "2026-01-14T00:00:00Z")
END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=adel-ai-dev-form4-parser \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 3600 \
  --statistics Sum \
  --output table 2>/dev/null | tail -30

# 3. Messages SQS envoyés par heure
echo ""
echo "3️⃣  SQS form4-parser-queue - Messages envoyés par heure (48h):"
aws cloudwatch get-metric-statistics \
  --namespace AWS/SQS \
  --metric-name NumberOfMessagesSent \
  --dimensions Name=QueueName,Value=adel-ai-dev-form4-parser \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 3600 \
  --statistics Sum \
  --output table 2>/dev/null | tail -30

# 4. Lambda Duration (pour calculer coût)
echo ""
echo "4️⃣  Lambda form4-parser - Durée moyenne:"
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=adel-ai-dev-form4-parser \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 3600 \
  --statistics Average \
  --output table 2>/dev/null | tail -20

# 5. Total invocations sur 48h
TOTAL_INVOCATIONS=$(aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=adel-ai-dev-form4-parser \
  --start-time "$START_TIME" \
  --end-time "$END_TIME" \
  --period 86400 \
  --statistics Sum \
  --query 'Datapoints[*].Sum' \
  --output text 2>/dev/null | awk '{sum+=$1} END {print sum}')

echo ""
echo "5️⃣  TOTAL INVOCATIONS (48h): ${TOTAL_INVOCATIONS:-0}"

