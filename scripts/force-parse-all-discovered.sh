#!/bin/bash

# Script pour forcer le parsing de tous les filings DISCOVERED ou FAILED
# Usage: ./scripts/force-parse-all-discovered.sh [--status=DISCOVERED|FAILED|ALL] [--limit=100]
# Exemple: ./scripts/force-parse-all-discovered.sh --status=DISCOVERED --limit=50

set -e

# Obtenir le répertoire du script (où se trouve ce fichier .sh)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Aller au répertoire parent (racine du projet)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Aller dans le répertoire racine du projet
cd "$PROJECT_ROOT"

# Charger les variables d'environnement
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Exécuter le script Node.js avec tous les arguments
node "$SCRIPT_DIR/force-parse-all-discovered.js" "$@"
