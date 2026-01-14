#!/bin/bash
# Script simple pour obtenir le Chat ID Telegram
# Usage: ./scripts/get_telegram_chat_id_simple.sh

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-8327759989:AAGa8KWU5jJX8Tarm_hLGvkM38Vipgcr8EY}"

echo "═══════════════════════════════════════════════════════════"
echo "🔍 RÉCUPÉRATION DU CHAT ID TELEGRAM (Méthode Simple)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📋 Instructions:"
echo "   1. Ouvrez Telegram et commencez une conversation avec @boumbobot"
echo "   2. Envoyez un message (ex: /start ou 'Hello')"
echo "   3. Appuyez sur Entrée pour continuer..."
echo ""
read -r

echo "📡 Récupération des mises à jour depuis Telegram API..."
echo ""

RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates")

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la récupération des données"
    exit 1
fi

# Extraire les chat IDs avec jq (si disponible) ou grep
if command -v jq &> /dev/null; then
    CHAT_IDS=$(echo "$RESPONSE" | jq -r '.result[] | select(.message.chat.id != null) | .message.chat.id' | sort -u)
else
    # Méthode alternative avec grep
    CHAT_IDS=$(echo "$RESPONSE" | grep -o '"chat":{"id":[0-9]*' | grep -o '[0-9]*' | sort -u)
fi

if [ -z "$CHAT_IDS" ]; then
    echo "⚠️ Aucun chat ID trouvé."
    echo ""
    echo "💡 Solutions:"
    echo "   1. Vérifiez que vous avez bien envoyé un message à @boumbobot"
    echo "   2. Attendez quelques secondes et réessayez"
    echo "   3. Visitez manuellement:"
    echo "      https://api.telegram.org/bot${BOT_TOKEN}/getUpdates"
    echo "      et cherchez 'chat':{'id':... dans la réponse"
    exit 1
fi

echo "✅ Chat ID(s) trouvé(s):"
echo ""
for CHAT_ID in $CHAT_IDS; do
    echo "   💬 Chat ID: $CHAT_ID"
    echo "   📝 Définissez: export TELEGRAM_CHAT_ID=\"$CHAT_ID\""
    echo ""
done

echo "💡 Pour tester l'alerte:"
echo "   export TELEGRAM_CHAT_ID=\"$CHAT_ID\""
echo "   npx tsx scripts/test_telegram_alert.ts"
echo ""
