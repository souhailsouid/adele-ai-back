#!/bin/bash
# ============================================
# Script pour migrer toutes les tables vers S3
# ============================================

BUCKET="adel-ai-dev-data-lake"

echo "═══════════════════════════════════════════════════════════"
echo "🚀 Migration complète vers S3 Parquet"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. Companies (déjà fait)
echo "✅ Companies: Déjà migré (8,191 rows)"

# 2. Funds (petite table)
echo ""
echo "📊 Migration: funds..."
npx tsx scripts/migrate_to_s3_parquet.ts \
  --table=funds \
  --s3-bucket=$BUCKET \
  --batch-size=10000

# 3. Fund Filings
echo ""
echo "📊 Migration: fund_filings..."
npx tsx scripts/migrate_to_s3_parquet.ts \
  --table=fund_filings \
  --s3-bucket=$BUCKET \
  --batch-size=10000

# 4. Company Filings (206K rows - peut prendre du temps)
echo ""
echo "📊 Migration: company_filings (206K rows)..."
npx tsx scripts/migrate_to_s3_parquet.ts \
  --table=company_filings \
  --s3-bucket=$BUCKET \
  --batch-size=50000

# 5. Fund Holdings Diff
echo ""
echo "📊 Migration: fund_holdings_diff..."
npx tsx scripts/migrate_to_s3_parquet.ts \
  --table=fund_holdings_diff \
  --s3-bucket=$BUCKET \
  --batch-size=50000

# 6. Fund Holdings (5.7M rows - TRÈS LONG)
echo ""
echo "⚠️  ATTENTION: fund_holdings contient 5.7M rows"
echo "   Cette migration peut prendre plusieurs heures"
read -p "   Voulez-vous continuer? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
  echo "📊 Migration: fund_holdings (5.7M rows)..."
  npx tsx scripts/migrate_to_s3_parquet.ts \
    --table=fund_holdings \
    --s3-bucket=$BUCKET \
    --batch-size=100000
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Migration terminée!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "💡 Prochaines étapes:"
echo "   1. Créer les tables Athena (via scripts ou console)"
echo "   2. Tester les requêtes"
echo "   3. Migrer le code API pour utiliser Athena"
