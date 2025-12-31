#!/bin/bash

# Script pour vérifier les signaux dans Supabase
# Usage: ./scripts/check-signals-db.sh

echo "🔍 Vérification des signaux dans Supabase"
echo "=========================================="
echo ""

# Vérifier si .env existe
if [ ! -f .env ]; then
  echo "⚠️  Fichier .env non trouvé"
  echo "Créer un fichier .env avec :"
  echo "SUPABASE_URL=..."
  echo "SUPABASE_SERVICE_KEY=..."
  exit 1
fi

# Charger les variables d'environnement
export $(cat .env | grep -v '^#' | xargs)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "⚠️  Variables SUPABASE_URL ou SUPABASE_SERVICE_KEY manquantes dans .env"
  exit 1
fi

echo "📊 Statistiques des signaux RSS"
echo ""

# Requête SQL pour vérifier les signaux
SQL_QUERY=$(cat <<EOF
-- Total de signaux RSS
SELECT 
  COUNT(*) as total_rss,
  COUNT(*) FILTER (WHERE type = 'macro') as total_macro,
  COUNT(*) FILTER (WHERE importance_score >= 7) as total_importance_7_plus,
  COUNT(*) FILTER (WHERE raw_data->'extracted_data' IS NOT NULL) as total_with_extracted_data
FROM signals
WHERE source = 'rss';
EOF
)

echo "Exécution de la requête SQL..."
echo ""

# Utiliser psql ou une autre méthode pour exécuter la requête
# Note: Vous devrez adapter selon votre méthode d'accès à Supabase

echo "Pour vérifier manuellement dans Supabase Dashboard → SQL Editor :"
echo ""
echo "$SQL_QUERY"
echo ""
echo "=========================================="
echo ""
echo "Ou utiliser cette requête pour voir les derniers signaux :"
echo ""
echo "SELECT 
  id,
  source,
  type,
  raw_data->>'title' as title,
  importance_score,
  raw_data->'extracted_data'->>'actual' as actual,
  raw_data->'extracted_data'->>'surprise' as surprise,
  created_at
FROM signals
WHERE source = 'rss'
ORDER BY created_at DESC
LIMIT 10;"


