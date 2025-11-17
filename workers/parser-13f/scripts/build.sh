#!/bin/bash
# Script pour builder le package Lambda Python

set -e

echo "📦 Building parser-13f Lambda package..."

# Aller dans le répertoire du parser
cd "$(dirname "$0")/.."

# Créer un environnement virtuel
python3 -m venv venv
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt -t .

# Copier index.py à la racine pour Lambda handler
cp src/index.py index.py

# Créer le zip (sans venv, sans src, sans scripts)
# Exclure src/ AVANT de créer le zip
zip -r ../parser-13f.zip . \
  -x "*.git*" \
  -x "*.zip" \
  -x "venv/*" \
  -x "__pycache__/*" \
  -x "*.pyc" \
  -x "*.pyo" \
  -x "*.pyd" \
  -x ".Python" \
  -x "pip/*" \
  -x "setuptools/*" \
  -x "wheel/*" \
  -x "scripts/*" \
  -x "src/*" \
  -x "package.json" \
  --exclude="src/*"

echo "✅ Package créé: parser-13f.zip"
echo "📋 Taille: $(du -h ../parser-13f.zip | cut -f1)"

# Vérifier que index.py est dans le zip
echo "🔍 Vérification: index.py dans le zip"
unzip -l ../parser-13f.zip | grep -E "^.*index.py$" || echo "⚠️  index.py non trouvé dans le zip!"

deactivate
rm -rf venv
# NE PAS supprimer index.py - il doit rester pour le zip

