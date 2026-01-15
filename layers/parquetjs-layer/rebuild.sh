#!/bin/bash

# Script pour rebuilder la Lambda Layer parquetjs
# Usage: ./rebuild.sh

set -e

echo "🔨 Rebuilding parquetjs Lambda Layer..."

cd "$(dirname "$0")"

# Nettoyer l'ancien zip
if [ -f "parquetjs-layer.zip" ]; then
  echo "🗑️  Removing old zip..."
  rm parquetjs-layer.zip
fi

# Installer les dépendances
echo "📦 Installing dependencies..."
cd nodejs
npm install --production
cd ..

# Créer le zip
echo "📦 Creating zip archive..."
zip -r parquetjs-layer.zip nodejs

# Afficher la taille
echo ""
echo "✅ Layer rebuilt successfully!"
ls -lh parquetjs-layer.zip
