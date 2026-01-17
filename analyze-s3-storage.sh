#!/bin/bash
# Analyse du stockage S3

BUCKET="adel-ai-dev-data-lake"
echo "📊 ANALYSE STOCKAGE S3"
echo "====================="
echo ""

echo "1️⃣  Taille totale du bucket:"
aws s3 ls s3://$BUCKET --recursive --human-readable --summarize 2>/dev/null | tail -1

echo ""
echo "2️⃣  Répartition par dossier (premiers MB):"
echo "   data/"
aws s3 ls s3://$BUCKET/data/ --recursive --human-readable --summarize 2>/dev/null | tail -5

echo ""
echo "3️⃣  Coût mensuel estimé:"
# Récupérer la taille en GB
SIZE_GB=$(aws s3 ls s3://$BUCKET --recursive --summarize 2>/dev/null | grep "Total Size" | awk '{print $3/1024/1024/1024}')

if [ -n "$SIZE_GB" ] && [ "$SIZE_GB" != "0" ]; then
  COST=$(echo "scale=4; $SIZE_GB * 0.024" | bc 2>/dev/null || echo "$SIZE_GB * 0.024" | awk '{printf "%.4f", $1 * 0.024}')
  echo "   Taille: ${SIZE_GB} GB"
  echo "   Coût/mois: \$${COST}"
else
  echo "   Taille: Non disponible"
  echo "   Coût/mois: ~\$0.10 (estimation basée sur \$0.01 sur 3 jours)"
fi

echo ""
echo "4️⃣  Fichiers Parquet par table:"
echo "   insider_trades:"
aws s3 ls s3://$BUCKET/data/insider_trades/ --recursive 2>/dev/null | wc -l | xargs -I {} echo "     - {} fichiers"
echo "   company_filings:"
aws s3 ls s3://$BUCKET/data/company_filings/ --recursive 2>/dev/null | wc -l | xargs -I {} echo "     - {} fichiers"
echo "   fund_holdings:"
aws s3 ls s3://$BUCKET/data/fund_holdings/ --recursive 2>/dev/null | wc -l | xargs -I {} echo "     - {} fichiers"

