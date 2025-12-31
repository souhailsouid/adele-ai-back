#!/bin/bash
# Script pour redéployer le collector RSS avec les nouveaux feeds Investing et Barchart

set -e

echo "🚀 Redéploiement du Collector RSS"
echo "=================================="
echo ""

# 1. Rebuild le bundle
echo "1️⃣  Build du bundle..."
cd workers/collector-rss
npm run bundle

if [ ! -f "collector-rss.zip" ]; then
  echo "❌ Erreur: collector-rss.zip n'a pas été créé"
  exit 1
fi

echo "✅ Bundle créé: collector-rss.zip"
echo ""

# 2. Retour au répertoire racine
cd ../../

# 3. Déployer avec Terraform
echo "2️⃣  Déploiement avec Terraform..."
cd infra/terraform

echo "📋 Vérification des changements..."
terraform plan -target=aws_lambda_function.collector_rss

echo ""
read -p "Continuer avec terraform apply? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  terraform apply -target=aws_lambda_function.collector_rss
  echo ""
  echo "✅ Déploiement terminé!"
  echo ""
  echo "💡 Vérification:"
  echo "   - Attendre 15 minutes pour le prochain cron"
  echo "   - Ou invoquer manuellement:"
  echo "     aws lambda invoke --function-name $(terraform output -raw collector_rss_url) /tmp/response.json"
else
  echo "❌ Déploiement annulé"
  exit 1
fi


