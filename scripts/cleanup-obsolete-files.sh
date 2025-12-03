#!/bin/bash

# Script de nettoyage des fichiers obsolètes
# Usage: ./scripts/cleanup-obsolete-files.sh [--dry-run]

DRY_RUN=${1:-""}

if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "🔍 DRY RUN MODE - Aucun fichier ne sera supprimé"
  echo ""
fi

# Compteurs
DELETED=0
KEPT=0

delete_file() {
  local file=$1
  local reason=$2
  
  if [ -f "$file" ]; then
    if [ "$DRY_RUN" = "--dry-run" ]; then
      echo "  [WOULD DELETE] $file ($reason)"
    else
      rm -f "$file"
      echo "  ✓ Supprimé: $file ($reason)"
    fi
    DELETED=$((DELETED + 1))
  else
    echo "  ⚠ Fichier non trouvé: $file"
  fi
}

echo "🧹 Nettoyage des fichiers obsolètes..."
echo ""

# 1. Fichiers .md obsolètes - Guides de Fix/Debug
echo "📝 Suppression des guides de fix/debug obsolètes..."
delete_file "FIX_API_GATEWAY_500.md" "Guide de fix obsolète"
delete_file "FIX_DARKPOOL_DATE.md" "Guide de fix obsolète"
delete_file "FIX_HEDGE_FUNDS_500.md" "Guide de fix obsolète"
delete_file "FIX_OPTIONS_404.md" "Guide de fix obsolète"
delete_file "FIX_OPTIONS_ENDPOINT.md" "Guide de fix obsolète"
delete_file "FIX_TICKER_ACTIVITY_500.md" "Guide de fix obsolète"
delete_file "IMMEDIATE_FIX.md" "Guide de fix obsolète"
delete_file "DEBUG_FUNDS_500.md" "Guide de debug obsolète"
delete_file "API_GATEWAY_DEBUG_GUIDE.md" "Guide de debug obsolète"
delete_file "QUICK_START_DEBUG.md" "Guide de debug obsolète"
delete_file "LOCAL_DEBUG_GUIDE.md" "Guide de debug obsolète"

# 2. Résumés/Status temporaires
echo ""
echo "📊 Suppression des résumés/status temporaires..."
delete_file "TICKER_ACTIVITY_SUCCESS.md" "Résumé temporaire"
delete_file "TICKER_ACTIVITY_FINAL_STATUS.md" "Résumé temporaire"
delete_file "TICKER_ACTIVITY_TEST_RESULTS.md" "Résumé temporaire"
delete_file "TICKER_ACTIVITY_DEPLOYMENT.md" "Résumé temporaire"
delete_file "TICKER_ACTIVITY_IMPLEMENTATION.md" "Résumé temporaire"
delete_file "ACCESS_TOKEN_TEST_RESULTS.md" "Résumé temporaire"
delete_file "CLEANUP_SUMMARY.md" "Résumé temporaire"
delete_file "REFACTORING_SUMMARY.md" "Résumé temporaire"
delete_file "REFACTORING_PLAN.md" "Plan temporaire"
delete_file "BACKEND_SUMMARY.md" "Résumé temporaire"
delete_file "RESUME_COMPLET.md" "Résumé temporaire"

# 3. Guides Frontend obsolètes
echo ""
echo "🎨 Suppression des guides frontend obsolètes..."
delete_file "FRONTEND_API_ENDPOINTS.md" "Remplacé par ROUTES_COVERAGE.md"
delete_file "FRONTEND_API_ROUTES_GUIDE.md" "Remplacé par ROUTES_COVERAGE.md"
delete_file "FRONTEND_AUTHENTICATION_GUIDE.md" "Intégré dans README.md"
delete_file "FRONTEND_TROUBLESHOOTING.md" "Guide obsolète"
delete_file "FRONTEND_SEC_URL_FIX.md" "Guide de fix obsolète"
delete_file "FRONTEND_ADD_FUND_EXAMPLE.md" "Exemple obsolète"
delete_file "FRONTEND_13F_DEVELOPER_GUIDE.md" "Guide obsolète"
delete_file "FRONTEND_13F_IMPLEMENTATION.md" "Guide obsolète"
delete_file "FRONTEND_FEATURES_IDEAS.md" "Idées obsolètes"
delete_file "FRONTEND_13F_DEVELOPER_GUIDE.md.bak" "Fichier backup"

# 4. Guides Backend obsolètes
echo ""
echo "🔧 Suppression des guides backend obsolètes..."
delete_file "BACKEND_SPEC_TICKER_ACTIVITY.md" "Spécification obsolète"
delete_file "BACKEND_API_MIGRATION_SUMMARY.md" "Résumé de migration obsolète"
delete_file "SECURITY_API_MIGRATION.md" "Résumé de migration obsolète"
delete_file "DEPLOY_TICKER_ACTIVITY.md" "Guide de déploiement obsolète"
delete_file "DEPLOY_FMP_UW_ROUTES.md" "Guide de déploiement obsolète"
delete_file "ALERTS_ENDPOINTS_IMPLEMENTATION.md" "Documentation d'implémentation obsolète"
delete_file "API_ENDPOINTS_REFERENCE.md" "Remplacé par ROUTES_COVERAGE.md"
delete_file "EXTERNAL_APIS_REFERENCE.md" "Référence obsolète"
delete_file "OPTIONS_FILTERS_DOC.md" "Documentation obsolète"
delete_file "EXPLICATION_FUND_HOLDINGS.md" "Explication obsolète"
delete_file "STRATEGY_COMPANIES_ANALYSIS.md" "Stratégie obsolète"
delete_file "STRATEGY_EARNINGS_AUTOMATION.md" "Stratégie obsolète"

# 5. Guides de test obsolètes
echo ""
echo "🧪 Suppression des guides de test obsolètes..."
delete_file "TEST_ENDPOINTS.md" "Remplacé par TESTING_GUIDE.md"
delete_file "QUICK_TEST_GUIDE.md" "Intégré dans TESTING_GUIDE.md"
delete_file "ID_TOKEN_VS_ACCESS_TOKEN.md" "Intégré dans README.md"

# 6. Scripts de debug obsolètes
echo ""
echo "🐛 Suppression des scripts de debug obsolètes..."
delete_file "scripts/debug-expirations.ts" "Remplacé par tests Jest"
delete_file "scripts/debug-router-expirations.ts" "Remplacé par tests Jest"
delete_file "scripts/test-expirations-parsing.ts" "Remplacé par tests Jest"

# 7. Scripts de test redondants
echo ""
echo "📋 Suppression des scripts de test redondants..."
delete_file "scripts/test-uw-endpoints.js" "Redondant avec test-uw-endpoints.sh"
delete_file "scripts/test-single-endpoint.sh" "Redondant avec test-single-uw-endpoint.sh"
delete_file "scripts/test-api-backend.sh" "Redondant avec test-uw-endpoints.sh"
delete_file "scripts/test-api-gateway-direct.sh" "Redondé par tests Jest"
delete_file "scripts/diagnose-api-gateway-routes.sh" "Redondé par tests Jest"
delete_file "scripts/verify-api-gateway-routes.sh" "Redondé par tests Jest"
delete_file "test-endpoints-quick.sh" "Redondant"

# 8. Fichiers de code obsolètes
echo ""
echo "💻 Suppression des fichiers de code obsolètes..."
delete_file "services/api/src/ticker-activity.refactored.ts" "Fichier de transition non utilisé"

# 9. Fichiers temporaires
echo ""
echo "📄 Suppression des fichiers temporaires..."
delete_file "API_FILES_LIST.txt" "Liste temporaire"
delete_file "CLEANUP_PLAN.md" "Plan temporaire (auto-supprimé après nettoyage)"

echo ""
echo "✅ Nettoyage terminé!"
if [ "$DRY_RUN" = "--dry-run" ]; then
  echo "📊 Fichiers qui seraient supprimés: $DELETED"
else
  echo "📊 Fichiers supprimés: $DELETED"
fi

