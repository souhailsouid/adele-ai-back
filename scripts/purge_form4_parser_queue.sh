#!/bin/bash
# Script pour vider la queue form4-parser-queue
# Usage: ./scripts/purge_form4_parser_queue.sh

set -e

echo "🔍 Récupération de l'URL de la queue form4-parser-queue..."

# Récupérer l'URL de la queue depuis Terraform ou AWS CLI
QUEUE_NAME="adel-ai-dev-form4-parser"
REGION="eu-west-3"

# Essayer de récupérer l'URL depuis AWS CLI
QUEUE_URL=$(aws sqs get-queue-url --queue-name "$QUEUE_NAME" --region "$REGION" --query 'QueueUrl' --output text 2>/dev/null || echo "")

if [ -z "$QUEUE_URL" ]; then
  echo "❌ Erreur: Impossible de trouver la queue $QUEUE_NAME"
  echo "   Vérifiez que la queue existe et que vous avez les permissions AWS"
  exit 1
fi

echo "✅ Queue trouvée: $QUEUE_URL"
echo ""
echo "⚠️  ATTENTION: Cette action va supprimer TOUS les messages de la queue"
echo "   Appuyez sur Ctrl+C pour annuler, ou Entrée pour continuer..."
read -r

echo ""
echo "🗑️  Purge de la queue en cours..."
aws sqs purge-queue --queue-url "$QUEUE_URL" --region "$REGION"

if [ $? -eq 0 ]; then
  echo "✅ Queue vidée avec succès!"
  echo ""
  echo "💡 Note: La purge peut prendre jusqu'à 60 secondes pour être effective"
else
  echo "❌ Erreur lors de la purge de la queue"
  exit 1
fi
