#!/bin/bash
# ============================================
# Prochaines étapes après déploiement Terraform
# ============================================

echo "═══════════════════════════════════════════════════════════"
echo "🚀 Prochaines étapes : Migration Supabase → S3 + Athena"
echo "═══════════════════════════════════════════════════════════"
echo ""

# 1. Vérifier les buckets S3 créés
echo "📦 Étape 1 : Vérifier les buckets S3"
echo "   aws s3 ls | grep adel-ai-dev"
echo "   → Doit afficher : adel-ai-dev-data-lake et adel-ai-dev-athena-results"
echo ""

# 2. Migrer les données
echo "📊 Étape 2 : Migrer les données depuis Supabase"
echo ""
echo "   # Test avec companies (petite table)"
echo "   npx tsx scripts/migrate_to_s3_parquet.ts \\"
echo "     --table=companies \\"
echo "     --s3-bucket=adel-ai-dev-data-lake \\"
echo "     --batch-size=10000 \\"
echo "     --limit=100 \\"
echo "     --dry-run"
echo ""
echo "   # Si OK, migrer pour de vrai (sans --dry-run)"
echo "   npx tsx scripts/migrate_to_s3_parquet.ts \\"
echo "     --table=companies \\"
echo "     --s3-bucket=adel-ai-dev-data-lake \\"
echo "     --batch-size=10000"
echo ""

# 3. Créer les tables Athena
echo "🗄️  Étape 3 : Créer les tables Athena"
echo "   1. Ouvrir AWS Console → Athena"
echo "   2. Sélectionner la database : adel_ai_dev"
echo "   3. Exécuter les DDL depuis : infra/athena/ddl/create_tables.sql"
echo "   4. Après chaque table, exécuter : MSCK REPAIR TABLE companies;"
echo ""

# 4. Tester les requêtes
echo "🧪 Étape 4 : Tester les requêtes Athena"
echo "   SELECT COUNT(*) FROM companies;"
echo "   SELECT * FROM companies LIMIT 10;"
echo ""

# 5. Migrer les autres tables
echo "📋 Étape 5 : Migrer les autres tables (après validation)"
echo "   # Fund holdings (gros volume)"
echo "   npx tsx scripts/migrate_to_s3_parquet.ts \\"
echo "     --table=fund_holdings \\"
echo "     --s3-bucket=adel-ai-dev-data-lake \\"
echo "     --batch-size=100000"
echo ""
echo "   # Company filings"
echo "   npx tsx scripts/migrate_to_s3_parquet.ts \\"
echo "     --table=company_filings \\"
echo "     --s3-bucket=adel-ai-dev-data-lake \\"
echo "     --batch-size=50000"
echo ""

# 6. Mettre à jour le code API
echo "💻 Étape 6 : Migrer le code API"
echo "   - Remplacer les appels Supabase par Athena"
echo "   - Utiliser services/api/src/athena/correlation.ts comme exemple"
echo "   - Tester les endpoints API"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "✅ Checklist complète dans : EXTREME_BUDGET_MIGRATION_GUIDE.md"
echo "═══════════════════════════════════════════════════════════"
