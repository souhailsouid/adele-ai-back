#!/bin/bash
# Script pour vérifier les alertes earnings créées

set -e

echo "🔍 VÉRIFICATION DES ALERTES EARNINGS"
echo "===================================="
echo ""

# Charger les variables d'environnement
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

SUPABASE_URL="${SUPABASE_URL:-https://your-project.supabase.co}"
SUPABASE_KEY="${SUPABASE_SERVICE_KEY:-}"

if [ -z "$SUPABASE_KEY" ]; then
    echo "❌ SUPABASE_SERVICE_KEY non trouvée dans .env"
    exit 1
fi

echo "📊 Récupération des alertes..."
RESPONSE=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/earnings_alerts?select=*&order=created_at.desc&limit=10" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Prefer: count=exact" 2>&1)

if echo "$RESPONSE" | grep -q "relation.*does not exist"; then
    echo "❌ La table 'earnings_alerts' n'existe pas"
    exit 1
elif echo "$RESPONSE" | grep -q "permission denied\|401\|403"; then
    echo "⚠️  Erreur d'authentification"
    exit 1
else
    # Compter les alertes
    COUNT=$(echo "$RESPONSE" | grep -o '"count":[0-9]*' | cut -d: -f2 || echo "0")
    
    if [ "$COUNT" = "0" ] || [ -z "$COUNT" ]; then
        # Essayer de parser le JSON directement
        ALERTS=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data) if isinstance(data, list) else 0)" 2>/dev/null || echo "0")
        
        if [ "$ALERTS" = "0" ] || [ -z "$ALERTS" ]; then
            echo "📊 Nombre d'alertes: 0"
            echo ""
            echo "⚠️  Aucune alerte trouvée"
            echo ""
            echo "💡 Vérifiez les logs CloudWatch pour voir si:"
            echo "   - L'extraction XBRL fonctionne"
            echo "   - L'alerte est créée"
            echo "   - Il y a des erreurs"
        else
            echo "✅ $ALERTS alerte(s) trouvée(s)"
            echo ""
            echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
        fi
    else
        echo "✅ $COUNT alerte(s) trouvée(s)"
        echo ""
        echo "$RESPONSE" | python3 -m json.tool 2>/dev/null | head -100 || echo "$RESPONSE" | head -20
    fi
fi







