#!/bin/bash
# Script pour ajouter les institutions premium à suivre

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Vérifier que les variables d'environnement sont définies
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
  echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set"
  echo ""
  echo "You can set them from Terraform outputs:"
  echo "  source scripts/create-env-from-tf.sh"
  echo ""
  echo "Or manually:"
  echo "  export SUPABASE_URL='your-url'"
  echo "  export SUPABASE_SERVICE_KEY='your-key'"
  exit 1
fi

echo "🚀 Adding premium funds to database..."
echo ""

# Compiler et exécuter le script TypeScript
npx tsx scripts/add-premium-funds.ts
