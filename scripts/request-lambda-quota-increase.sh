#!/bin/bash
# Script pour demander une augmentation de la limite de concurrence Lambda
# La limite actuelle est de 10, on demande 1000 (standard AWS)

echo "Demande d'augmentation de la limite de concurrence Lambda..."
echo "Limite actuelle: 10 exécutions simultanées"
echo "Limite demandée: 1000 exécutions simultanées (standard AWS)"
echo ""

# Option 1: Via AWS CLI (si disponible)
if command -v aws &> /dev/null; then
  echo "Tentative via AWS CLI..."
  aws service-quotas request-service-quota-increase \
    --service-code lambda \
    --quota-code L-B99A9384 \
    --desired-value 1000 \
    --region eu-west-3 2>&1 || echo "Erreur: Cette commande nécessite des permissions spéciales"
fi

echo ""
echo "Alternative: Demander via AWS Console"
echo "1. Aller sur: https://eu-west-3.console.aws.amazon.com/servicequotas/"
echo "2. Chercher 'Lambda' > 'Concurrent executions'"
echo "3. Cliquer 'Request quota increase'"
echo "4. Demander 1000 (standard AWS)"
echo ""
echo "Ou via AWS Support:"
echo "- Ouvrir un ticket AWS Support"
echo "- Demander: 'Increase Lambda concurrent executions limit from 10 to 1000'"
echo "- Raison: 'Multiple Lambda functions running simultaneously causing throttling'"
