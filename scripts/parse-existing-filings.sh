#!/bin/bash
# Script wrapper pour parser les filings existants

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "🔍 Parsing des filings 13F existants..."
echo ""

# Vérifier les variables d'environnement
  if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
      echo "⚠️  Variables d'environnement non définies"
      echo "   Définir SUPABASE_URL et SUPABASE_SERVICE_KEY"
      echo ""
      echo "   export SUPABASE_URL='https://your-project.supabase.co'"
      echo "   export SUPABASE_SERVICE_KEY='your-service-key'"
      echo ""
      echo "   Ou créer un fichier .env avec ces variables"
      exit 1
  fi

# Vérifier Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 non trouvé"
    exit 1
fi

# Créer/activer environnement virtuel
if [ ! -d "scripts/venv" ]; then
    echo "📦 Création de l'environnement virtuel..."
    python3 -m venv scripts/venv
fi

echo "🔌 Activation de l'environnement virtuel..."
source scripts/venv/bin/activate

# Vérifier/installer les dépendances
echo "📦 Vérification des dépendances..."
python3 -c "import requests, bs4, supabase" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  Dépendances manquantes, installation..."
    pip install requests beautifulsoup4 supabase
fi

echo "✅ Dépendances OK"
echo ""

# Exécuter le script
python3 scripts/parse-existing-filings.py
