#!/bin/bash

# Script de diagnostic pour le cron job RSS (Financial Juice)

echo "🔍 Diagnostic du Cron Job RSS (Financial Juice)"
echo "=============================================="
echo ""

# Variables (récupérer depuis Terraform ou ajuster)
# Le nom exact peut être trouvé avec: cd infra/terraform && terraform output collector_rss_url
FUNCTION_NAME="${FUNCTION_NAME:-adel-ai-dev-collector-rss}"
LOG_GROUP="/aws/lambda/${FUNCTION_NAME}"
RULE_NAME="${RULE_NAME:-adel-ai-dev-collector-rss-cron}"

# Si Terraform est disponible, utiliser la valeur réelle
if command -v terraform &> /dev/null && [ -f "infra/terraform/terraform.tfvars" ]; then
  cd infra/terraform 2>/dev/null && {
    TERRAFORM_NAME=$(terraform output -raw collector_rss_url 2>/dev/null)
    if [ -n "$TERRAFORM_NAME" ]; then
      FUNCTION_NAME="$TERRAFORM_NAME"
      LOG_GROUP="/aws/lambda/${FUNCTION_NAME}"
      RULE_NAME="${FUNCTION_NAME}-cron"
      cd - > /dev/null
    fi
  }
fi

echo "1️⃣  Vérification de la règle EventBridge"
echo "----------------------------------------"
aws events describe-rule --name "${RULE_NAME}" 2>/dev/null | jq -r '
  "Nom: " + .Name,
  "État: " + .State,
  "Schedule: " + .ScheduleExpression,
  "Description: " + .Description
' || echo "❌ Règle non trouvée : ${RULE_NAME}"
echo ""

echo "2️⃣  Vérification des invocations Lambda (dernière heure)"
echo "--------------------------------------------------------"
START_TIME=$(date -u -d '1 hour ago' +%s)
END_TIME=$(date -u +%s)

aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value="${FUNCTION_NAME}" \
  --start-time ${START_TIME} \
  --end-time ${END_TIME} \
  --period 300 \
  --statistics Sum \
  --output json 2>/dev/null | jq -r '
    if .Datapoints | length > 0 then
      "✅ Invocations trouvées:",
      (.Datapoints | sort_by(.Timestamp) | .[] | "  - \(.Timestamp): \(.Sum) invocations")
    else
      "❌ Aucune invocation dans la dernière heure"
    end
' || echo "❌ Erreur lors de la récupération des métriques"
echo ""

echo "3️⃣  Derniers logs (dernières 20 lignes)"
echo "----------------------------------------"
aws logs tail "${LOG_GROUP}" --since 1h 2>/dev/null | tail -20 || echo "❌ Impossible de récupérer les logs"
echo ""

echo "4️⃣  Recherche de 'financial-juice' dans les logs"
echo "------------------------------------------------"
aws logs filter-log-events \
  --log-group-name "${LOG_GROUP}" \
  --filter-pattern "financial-juice" \
  --start-time $(($(date +%s) - 3600))000 \
  --max-items 10 2>/dev/null | jq -r '
    if .events | length > 0 then
      "✅ Logs trouvés:",
      (.events | .[] | "  [\(.timestamp | tonumber / 1000 | strftime("%Y-%m-%d %H:%M:%S"))] \(.message)")
    else
      "❌ Aucun log contenant 'financial-juice' dans la dernière heure"
    end
' || echo "❌ Erreur lors de la recherche dans les logs"
echo ""

echo "5️⃣  Test d'invocation manuelle"
echo "------------------------------"
echo "Invoquant la Lambda..."
aws lambda invoke \
  --function-name "${FUNCTION_NAME}" \
  --payload '{}' \
  /tmp/rss-collector-response.json 2>/dev/null

if [ $? -eq 0 ]; then
  echo "✅ Invocation réussie"
  echo "Réponse:"
  cat /tmp/rss-collector-response.json | jq '.' 2>/dev/null || cat /tmp/rss-collector-response.json
  rm -f /tmp/rss-collector-response.json
else
  echo "❌ Erreur lors de l'invocation"
fi
echo ""

echo "6️⃣  Vérification du code source"
echo "-------------------------------"
if [ -f "workers/collector-rss/src/index.ts" ]; then
  if grep -q "financial-juice" workers/collector-rss/src/index.ts; then
    echo "✅ Financial Juice trouvé dans le code source"
    echo "Ligne:"
    grep -n "financial-juice" workers/collector-rss/src/index.ts
  else
    echo "❌ Financial Juice NON trouvé dans le code source"
  fi
else
  echo "⚠️  Fichier source non trouvé"
fi
echo ""

echo "✅ Diagnostic terminé"
echo ""
echo "💡 Commandes utiles:"
echo "  - Voir les logs en temps réel: aws logs tail ${LOG_GROUP} --follow"
echo "  - Vérifier les métriques: aws cloudwatch get-metric-statistics --namespace AWS/Lambda --metric-name Invocations --dimensions Name=FunctionName,Value=${FUNCTION_NAME} --start-time \$(date -u -d '1 hour ago' +%s) --end-time \$(date -u +%s) --period 300 --statistics Sum"

