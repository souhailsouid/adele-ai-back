#!/bin/bash
# Script pour vérifier si la table earnings_alerts existe dans Supabase

set -e

echo "🔍 VÉRIFICATION DE LA TABLE earnings_alerts"
echo "============================================"
echo ""

# Charger les variables d'environnement
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

SUPABASE_URL="${SUPABASE_URL:-https://nmynjtrppwhiwlxfdzdh.supabase.co}"
SUPABASE_KEY="${SUPABASE_SERVICE_KEY:-}"

if [ -z "$SUPABASE_KEY" ]; then
    echo "❌ SUPABASE_SERVICE_KEY non trouvée dans .env"
    echo "   Utilisez la clé 'service_role' de Supabase (pas la clé 'anon')"
    exit 1
fi

echo "📋 Configuration:"
echo "  - Supabase URL: $SUPABASE_URL"
echo "  - Clé trouvée: ${SUPABASE_KEY:0:20}..."
echo ""

# Vérifier si la table existe
echo "🔍 Vérification de l'existence de la table..."
RESPONSE=$(curl -s -X POST \
    "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'earnings_alerts';\"}" 2>&1)

# Alternative: Utiliser une requête directe
echo "📊 Tentative de requête directe..."
RESPONSE2=$(curl -s -X GET \
    "${SUPABASE_URL}/rest/v1/earnings_alerts?select=id&limit=1" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" 2>&1)

if echo "$RESPONSE2" | grep -q "relation.*does not exist"; then
    echo "❌ La table 'earnings_alerts' n'existe PAS"
    echo ""
    echo "📋 ACTION REQUISE:"
    echo "  1. Allez dans Supabase Dashboard > SQL Editor"
    echo "  2. Copiez le contenu de: infra/supabase/migrations/004_add_earnings_alerts_table.sql"
    echo "  3. Exécutez la requête SQL"
    echo ""
    echo "📄 Contenu de la migration:"
    echo "================================"
    cat infra/supabase/migrations/004_add_earnings_alerts_table.sql
    echo "================================"
    exit 1
elif echo "$RESPONSE2" | grep -q "permission denied\|401\|403"; then
    echo "⚠️  Erreur d'authentification"
    echo "   Vérifiez que SUPABASE_SERVICE_KEY est correcte"
    exit 1
else
    echo "✅ La table 'earnings_alerts' EXISTE !"
    echo ""
    echo "📊 Test de lecture..."
    COUNT=$(curl -s -X GET \
        "${SUPABASE_URL}/rest/v1/earnings_alerts?select=id" \
        -H "apikey: ${SUPABASE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_KEY}" \
        -H "Prefer: count=exact" 2>&1 | grep -o '"count":[0-9]*' | cut -d: -f2 || echo "0")
    
    echo "  - Nombre d'alertes: ${COUNT:-0}"
    echo ""
    echo "✅ Tout est prêt !"
fi




