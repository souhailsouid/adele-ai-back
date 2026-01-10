#!/bin/bash

# Script shell pour initialiser tous les funds institutionnels premium
# Utilise le script JavaScript init-all-funds.js (Node.js natif, pas besoin de ts-node)

set -e

# Couleurs pour l'output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Initialisation des funds institutionnels premium${NC}\n"

# Vérifier que les variables d'environnement sont définies
if [ -z "$API_BASE_URL" ] && [ -z "$NEXT_PUBLIC_API_MAIN_URL" ]; then
  echo -e "${RED}❌ Erreur: API_BASE_URL ou NEXT_PUBLIC_API_MAIN_URL doit être défini${NC}"
  echo "   Exemple: export API_BASE_URL='https://xxx.execute-api.eu-west-3.amazonaws.com/prod'"
  exit 1
fi

if [ -z "$API_TOKEN" ] && [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${RED}❌ Erreur: API_TOKEN ou ACCESS_TOKEN doit être défini${NC}"
  echo "   Exemple: export API_TOKEN='your-jwt-token'"
  exit 1
fi

# Vérifier que Node.js est installé (version 18+ pour fetch natif)
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Erreur: Node.js doit être installé${NC}"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${YELLOW}⚠️  Node.js 18+ est requis pour fetch natif. Version actuelle: $(node -v)${NC}"
  echo "   Vous pouvez utiliser la version TypeScript avec ts-node si nécessaire"
fi

# Exécuter le script JavaScript (Node.js natif)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/init-all-funds.js"
