#!/bin/bash

# Script pour invalider le cache DynamoDB des insiders
# Usage: ./scripts/invalidate_insiders_cache.sh

TABLE_NAME="adel-ai-dev-insiders-cache"
REGION="eu-west-3"

echo "═══════════════════════════════════════════════════════════"
echo "🗑️  Invalidation du cache DynamoDB Insiders"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "🔍 Scan de tous les items du cache..."
KEYS=$(aws dynamodb scan \
  --table-name "$TABLE_NAME" \
  --region "$REGION" \
  --query 'Items[*].cache_key.S' \
  --output text)

if [ -z "$KEYS" ]; then
  echo "✅ Cache déjà vide"
  exit 0
fi

COUNT=$(echo "$KEYS" | wc -w | tr -d ' ')
echo "📦 Total: $COUNT item(s) trouvé(s)"
echo ""

echo "🗑️  Suppression des items..."
DELETED=0

for KEY in $KEYS; do
  aws dynamodb delete-item \
    --table-name "$TABLE_NAME" \
    --region "$REGION" \
    --key "{\"cache_key\":{\"S\":\"$KEY\"}}" \
    > /dev/null 2>&1
  
  DELETED=$((DELETED + 1))
  
  if [ $((DELETED % 10)) -eq 0 ]; then
    echo "   ✅ $DELETED/$COUNT supprimé(s)"
  fi
done

echo ""
echo "✅ $DELETED item(s) supprimé(s) au total"
echo ""
echo "💡 Le cache sera régénéré avec les nouvelles données au prochain appel API"
echo ""
