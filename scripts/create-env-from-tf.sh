#!/bin/bash

# Script pour créer .env depuis terraform.tfvars
# Usage: ./scripts/create-env-from-tf.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TFVARS="$PROJECT_ROOT/infra/terraform/terraform.tfvars"
ENV_FILE="$PROJECT_ROOT/.env"

echo "📝 Création du fichier .env depuis terraform.tfvars..."

if [ ! -f "$TFVARS" ]; then
  echo "❌ Erreur: terraform.tfvars non trouvé à $TFVARS"
  exit 1
fi

# Extraire les variables depuis terraform.tfvars
echo "# Variables d'environnement générées depuis terraform.tfvars" > "$ENV_FILE"
echo "# Généré le $(date)" >> "$ENV_FILE"
echo "" >> "$ENV_FILE"

# Extraire openai_api_key
OPENAI_KEY=$(grep '^openai_api_key' "$TFVARS" | sed 's/.*= *"\(.*\)"/\1/' | tr -d '"')
if [ -n "$OPENAI_KEY" ]; then
  echo "OPENAI_API_KEY=$OPENAI_KEY" >> "$ENV_FILE"
  echo "OPENAI_MODEL=gpt-4o-mini" >> "$ENV_FILE"
  echo "" >> "$ENV_FILE"
fi

# Extraire supabase_url
SUPABASE_URL=$(grep '^supabase_url' "$TFVARS" | sed 's/.*= *"\(.*\)"/\1/' | tr -d '"')
if [ -n "$SUPABASE_URL" ]; then
  echo "SUPABASE_URL=$SUPABASE_URL" >> "$ENV_FILE"
fi

# Extraire supabase_service_key
SUPABASE_KEY=$(grep '^supabase_service_key' "$TFVARS" | sed 's/.*= *"\(.*\)"/\1/' | tr -d '"')
if [ -n "$SUPABASE_KEY" ]; then
  echo "SUPABASE_SERVICE_KEY=$SUPABASE_KEY" >> "$ENV_FILE"
  echo "" >> "$ENV_FILE"
fi

# Extraire unusual_whales_api_key
UW_KEY=$(grep '^unusual_whales_api_key' "$TFVARS" | sed 's/.*= *"\(.*\)"/\1/' | tr -d '"')
if [ -n "$UW_KEY" ]; then
  echo "UNUSUAL_WHALES_API_KEY=$UW_KEY" >> "$ENV_FILE"
fi

# Extraire fmp_api_key
FMP_KEY=$(grep '^fmp_api_key' "$TFVARS" | sed 's/.*= *"\(.*\)"/\1/' | tr -d '"')
if [ -n "$FMP_KEY" ]; then
  echo "FMP_API_KEY=$FMP_KEY" >> "$ENV_FILE"
  echo "" >> "$ENV_FILE"
fi

# Extraire neo4j_uri
NEO4J_URI=$(grep '^neo4j_uri' "$TFVARS" | sed 's/.*= *"\(.*\)"/\1/' | tr -d '"')
if [ -n "$NEO4J_URI" ]; then
  echo "NEO4J_URI=$NEO4J_URI" >> "$ENV_FILE"
fi

# Extraire neo4j_username
NEO4J_USER=$(grep '^neo4j_username' "$TFVARS" | sed 's/.*= *"\(.*\)"/\1/' | tr -d '"')
if [ -n "$NEO4J_USER" ]; then
  echo "NEO4J_USERNAME=$NEO4J_USER" >> "$ENV_FILE"
fi

# Extraire neo4j_password
NEO4J_PASS=$(grep '^neo4j_password' "$TFVARS" | sed 's/.*= *"\(.*\)"/\1/' | tr -d '"')
if [ -n "$NEO4J_PASS" ]; then
  echo "NEO4J_PASSWORD=$NEO4J_PASS" >> "$ENV_FILE"
fi

# Extraire neo4j_database
NEO4J_DB=$(grep '^neo4j_database' "$TFVARS" | sed 's/.*= *"\(.*\)"/\1/' | tr -d '"')
if [ -n "$NEO4J_DB" ]; then
  echo "NEO4J_DATABASE=$NEO4J_DB" >> "$ENV_FILE"
  echo "" >> "$ENV_FILE"
fi

echo "✅ Fichier .env créé avec succès à $ENV_FILE"
echo ""
echo "📋 Variables extraites:"
echo "  - OPENAI_API_KEY: ${OPENAI_KEY:+✅} ${OPENAI_KEY:-❌}"
echo "  - SUPABASE_URL: ${SUPABASE_URL:+✅} ${SUPABASE_URL:-❌}"
echo "  - UNUSUAL_WHALES_API_KEY: ${UW_KEY:+✅} ${UW_KEY:-❌}"
echo "  - FMP_API_KEY: ${FMP_KEY:+✅} ${FMP_KEY:-❌}"
echo "  - NEO4J_URI: ${NEO4J_URI:+✅} ${NEO4J_URI:-❌}"
echo ""
echo "🚀 Vous pouvez maintenant lancer: cd services/api && npm run dev"



