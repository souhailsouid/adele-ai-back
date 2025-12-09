#!/bin/bash

# Script de nettoyage pour nouveau repo
# Supprime les clés API exposées et les fichiers obsolètes

set -e

echo "🧹 Nettoyage pour nouveau repo..."

# 1. Supprimer les clés API des fichiers MD
echo "📝 Nettoyage des clés API dans les fichiers MD..."

# LOCAL_TESTING_GUIDE.md
if [ -f "LOCAL_TESTING_GUIDE.md" ]; then
  sed -i '' 's/UNUSUAL_WHALES_API_KEY=925866f5-e97f-459d-850d-5d5856fef716/UNUSUAL_WHALES_API_KEY=VOTRE_CLE/g' LOCAL_TESTING_GUIDE.md
  sed -i '' 's/FMP_API_KEY=SEZmUVb6Q54FfrThfe3rzyKeG3vmXPQ5/FMP_API_KEY=VOTRE_CLE/g' LOCAL_TESTING_GUIDE.md
  echo "✅ LOCAL_TESTING_GUIDE.md nettoyé"
fi

# FIX_OPENAI_API_KEY.md
if [ -f "FIX_OPENAI_API_KEY.md" ]; then
  sed -i '' 's/sk-proj-[^"]*/sk-proj-VOTRE_CLE/g' FIX_OPENAI_API_KEY.md
  echo "✅ FIX_OPENAI_API_KEY.md nettoyé"
fi

# 2. Supprimer terraform.tfvars s'il existe (devrait être dans .gitignore)
if [ -f "infra/terraform/terraform.tfvars" ]; then
  echo "⚠️  terraform.tfvars trouvé - VÉRIFIEZ qu'il est dans .gitignore"
  echo "   Le fichier contient des clés sensibles et ne doit PAS être commité"
fi

# 3. Vérifier .gitignore
if grep -q "terraform.tfvars" .gitignore; then
  echo "✅ terraform.tfvars est dans .gitignore"
else
  echo "⚠️  terraform.tfvars n'est PAS dans .gitignore - À AJOUTER"
fi

# 4. Supprimer les fichiers MD obsolètes
echo "🗑️  Suppression des fichiers MD obsolètes..."

OBSOLETE_MD=(
  "DEPLOY_ECONOMIC_CALENDAR_ANALYSIS.md"
  "FIX_ECONOMIC_CALENDAR_ANALYSIS.md"
  "ECONOMIC_CALENDAR_ANALYSIS.md"
  "ECONOMIC_CALENDAR_REFACTORING.md"
  "ECONOMIC_CALENDAR_PLANET_SHAKING_FIX.md"
  "ECONOMIC_CALENDAR_MAJOR_ECONOMIES_FIX.md"
  "ECONOMIC_CALENDAR_CRITICAL_FIX.md"
  "ECONOMIC_CALENDAR_FMP_IMPROVEMENTS.md"
  "FIX_OPENAI_API_KEY.md"
  "FINANCIAL_JUICE_IA_SCRAPING.md"
  "FINANCIAL_JUICE_TEST_GUIDE.md"
  "FMP_ECONOMIC_CALENDAR_INTEGRATION.md"
  "FINANCIAL_JUICE_INTEGRATION.md"
  "WHAT_IS_FDA.md"
  "AI_CALENDAR_CRITICAL_EVENTS_IMPROVEMENTS.md"
  "AI_CALENDAR_CRITICAL_EVENTS.md"
  "TIMEOUT_FIX.md"
  "CLEANUP_SUMMARY.md"
  "VALIDATION_COMBINED_ANALYSIS.md"
  "IMPROVEMENTS_COMBINED_ANALYSIS.md"
  "COMBINED_ANALYSIS_IMPLEMENTATION.md"
  "DOMINANT_ENTITIES_IMPROVEMENTS.md"
  "ATTRIBUTION_FLOW_ARKHAM_IMPROVEMENTS.md"
  "ATTRIBUTION_ENGINE_ARKHAM_IMPROVEMENTS.md"
  "ATTRIBUTION_ENGINE_IMPROVEMENTS.md"
  "ADVANCED_ARKHAM_FEATURES.md"
  "RESUME_ROADMAP_ARKHAM.md"
  "ROADMAP_ARKHAM_INTELLIGENCE.md"
  "RESUME_EXECUTIF.md"
  "RAPPORT_TECHNIQUE_EQUIPE.md"
  "FRONTEND_IMPLEMENTATION_GUIDE.md"
  "FRONTEND_QUICK_START.md"
  "FRONTEND_BRIEF.md"
  "RESUME_IMPLEMENTATION.md"
  "INDEX_DOCUMENTATION.md"
  "ROUTES_COVERAGE.md"
  "TESTING_GUIDE.md"
  "UNUSUAL_WHALES_USE_CASES.md"
  "FMP_UW_SYNERGY.md"
  "FRONTEND_API_DOCUMENTATION.md"
  "APIS_TICKER_INSIGHTS.md"
  "OPTIONS_API_ENDPOINTS.md"
  "INSTITUTION_MOVES_GUIDE.md"
  "EXPLICATION_IA_ANALYST.md"
  "AI_ANALYST_GUIDE.md"
  "AI_ANALYST_DYNAMIC_SPEC.md"
  "ROADMAP_UNUSUAL_WHALES.md"
  "IMPLEMENTATION_STATUS.md"
)

for file in "${OBSOLETE_MD[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "  ✅ Supprimé: $file"
  fi
done

# 5. Créer un fichier de documentation consolidé
echo "📚 Création de la documentation consolidée..."

cat > DOCUMENTATION.md << 'EOF'
# 📚 Documentation Personamy Backend

## 🚀 Guides Principaux

### Frontend
- **FRONTEND_LLM_IMPROVEMENTS_GUIDE.md** - Guide complet pour implémenter les analyses LLM enrichies
- **FRONTEND_LLM_QUICK_START.md** - Quick start pour le frontend

### Architecture
- **ARCHITECTURE.md** - Architecture générale du système
- **README.md** - Guide de démarrage

### Roadmaps
- **ROADMAP_LLM.md** - Roadmap complète des fonctionnalités LLM
- **ROADMAP_LLM_SUMMARY.md** - Résumé exécutif de la roadmap LLM
- **IMPROVEMENTS_LLM_ANALYSIS.md** - Détails des améliorations LLM
- **IMPROVEMENTS_LLM_SUMMARY.md** - Résumé des améliorations

### APIs
- **ECONOMIC_CALENDAR_APIS.md** - Documentation des APIs de calendrier économique
- **API_FRONTEND_GUIDE.md** - Guide API pour le frontend

### Infrastructure
- **infra/terraform/API_GATEWAY_QUICK_REFERENCE.md** - Référence rapide API Gateway
- **infra/terraform/API_GATEWAY_ROUTES_REFERENCE.md** - Référence des routes
- **LOCAL_TESTING_GUIDE.md** - Guide de test local

### Tests
- **api-tests.http** - Tests HTTP pour REST Client

## 📝 Notes

- Les fichiers de déploiement temporaires ont été supprimés
- Les clés API ont été nettoyées des fichiers MD
- `terraform.tfvars` ne doit JAMAIS être commité (dans .gitignore)
EOF

echo "✅ DOCUMENTATION.md créé"

# 6. Vérifier qu'il n'y a plus de clés exposées
echo "🔍 Vérification finale des clés API..."

if grep -r "sk-proj-[A-Za-z0-9_-]\{50,\}" . --include="*.md" --exclude-dir=".git" --exclude-dir="node_modules" --exclude-dir="venv" 2>/dev/null | grep -v "VOTRE_CLE" | grep -v "example"; then
  echo "⚠️  ATTENTION: Des clés API réelles trouvées dans les fichiers MD"
  echo "   Vérifiez manuellement:"
  grep -r "sk-proj-[A-Za-z0-9_-]\{50,\}" . --include="*.md" --exclude-dir=".git" --exclude-dir="node_modules" --exclude-dir="venv" 2>/dev/null | grep -v "VOTRE_CLE" | grep -v "example" || true
else
  echo "✅ Aucune clé API réelle trouvée dans les fichiers MD"
fi

if grep -r "SEZmUVb6Q54FfrThfe3rzyKeG3vmXPQ5\|925866f5-e97f-459d-850d-5d5856fef716" . --include="*.md" --exclude-dir=".git" --exclude-dir="node_modules" --exclude-dir="venv" 2>/dev/null; then
  echo "⚠️  ATTENTION: Des clés API réelles trouvées dans les fichiers MD"
else
  echo "✅ Aucune clé API FMP/UW réelle trouvée"
fi

echo ""
echo "✅ Nettoyage terminé !"
echo ""
echo "📋 Prochaines étapes:"
echo "1. Vérifiez que terraform.tfvars est bien dans .gitignore"
echo "2. Vérifiez qu'il n'y a pas de clés dans l'historique Git (git log -p)"
echo "3. Créez un nouveau repo vierge"
echo "4. Initialisez Git: git init"
echo "5. Ajoutez les fichiers: git add ."
echo "6. Commit: git commit -m 'Initial commit'"
echo "7. Ajoutez le remote: git remote add origin <nouveau-repo-url>"
echo "8. Push: git push -u origin main"

