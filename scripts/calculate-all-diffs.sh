#!/bin/bash

# Script pour calculer automatiquement les diffs pour tous les filings parsés
# Usage: ./scripts/calculate-all-diffs.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Charger les variables d'environnement depuis .env si présent
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Vérifier que les variables requises sont présentes
if [ -z "$SUPABASE_SERVICE_KEY" ] && [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "❌ SUPABASE_SERVICE_KEY ou SUPABASE_ANON_KEY requis"
  echo "💡 Créez un fichier .env ou exportez les variables d'environnement"
  exit 1
fi

# Utiliser la version JavaScript (plus simple, pas besoin de tsx)
if [ -f "scripts/calculate-all-diffs.js" ]; then
  echo "🚀 Exécution du script JavaScript..."
  node scripts/calculate-all-diffs.js
else
  echo "❌ Script calculate-all-diffs.js non trouvé"
  exit 1
fi
