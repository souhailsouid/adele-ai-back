#!/bin/bash
# Script pour relancer le cron sec-smart-money-sync après déploiement

echo "🔄 Relance du cron sec-smart-money-sync..."
echo ""

# Vérifier que la queue est vide
QUEUE_NOT_VISIBLE=$(aws sqs get-queue-attributes \
  --queue-url https://sqs.eu-west-3.amazonaws.com/956633302249/adel-ai-dev-form4-parser \
  --attribute-names ApproximateNumberOfMessagesNotVisible \
  --region eu-west-3 \
  --query 'Attributes.ApproximateNumberOfMessagesNotVisible' \
  --output text)

if [ "$QUEUE_NOT_VISIBLE" != "0" ]; then
  echo "⚠️  La queue contient encore $QUEUE_NOT_VISIBLE messages en cours"
  echo "   Attendez que la queue soit vide avant de relancer le cron"
  exit 1
fi

echo "✅ Queue vide, relance du cron..."

# Relancer le cron en mode insiders-only
aws lambda invoke \
  --function-name adel-ai-dev-sec-smart-money-sync \
  --region eu-west-3 \
  --payload '{"mode": "insiders-only"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/lambda-response.json

echo ""
echo "✅ Cron relancé !"
echo "📊 Vérifiez la queue dans quelques minutes:"
echo "   aws sqs get-queue-attributes --queue-url https://sqs.eu-west-3.amazonaws.com/956633302249/adel-ai-dev-form4-parser --attribute-names ApproximateNumberOfMessages --region eu-west-3"
