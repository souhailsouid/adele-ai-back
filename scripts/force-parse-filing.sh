#!/bin/bash

# Script pour forcer le parsing d'un filing spécifique
# Usage: ./scripts/force-parse-filing.sh <accession_number>
# Exemple: ./scripts/force-parse-filing.sh 0000905148-24-003106

set -e

# Charger les variables d'environnement
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Vérifier que l'accession number est fourni
if [ -z "$1" ]; then
  echo "❌ Usage: ./scripts/force-parse-filing.sh <accession_number>"
  echo "   Exemple: ./scripts/force-parse-filing.sh 0000905148-24-003106"
  exit 1
fi

ACCESSION_NUMBER=$1

# Exécuter le script Node.js
node scripts/force-parse-filing.js "$ACCESSION_NUMBER"
