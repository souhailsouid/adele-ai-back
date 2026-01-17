#!/bin/bash
# Analyse de l'impact de la purge de la queue SQS

QUEUE_URL="https://sqs.eu-west-3.amazonaws.com/956633302249/adel-ai-dev-form4-parser"

echo "📊 ANALYSE IMPACT - PURGE QUEUE SQS"
echo "===================================="
echo ""

echo "1️⃣  État actuel de la queue:"
aws sqs get-queue-attributes \
  --queue-url "$QUEUE_URL" \
  --attribute-names ApproximateNumberOfMessagesVisible ApproximateNumberOfMessagesNotVisible ApproximateNumberOfMessagesDelayed \
  --output json 2>/dev/null | jq '{
    MessagesVisible: .Attributes.ApproximateNumberOfMessagesVisible,
    MessagesInFlight: .Attributes.ApproximateNumberOfMessagesNotVisible,
    MessagesDelayed: .Attributes.ApproximateNumberOfMessagesDelayed
  }'

echo ""
echo "2️⃣  Impact de la purge:"
echo "   ─────────────────────────────────────"
echo ""
echo "   ✅ SUPPRIMÉ:"
echo "      - Tous les messages visibles (en attente)"
echo "      - Tous les messages en retry (retournés dans la queue)"
echo "      - Tous les messages en attente de traitement"
echo ""
echo "   ⚠️  CONSERVÉ:"
echo "      - Messages en cours de traitement (InFlight)"
echo "         → Ces messages continueront d'être traités"
echo "         → S'ils échouent, ils retourneront dans la queue (vide)"
echo ""
echo "   ❌ PERDU:"
echo "      - Tous les Form 4 en attente de parsing"
echo "      - Aucune récupération possible"
echo "      - Il faudra les redécouvrir via le CRON (quand réactivé)"
echo ""
echo "3️⃣  Conséquences:"
echo "   ─────────────────────────────────────"
echo "   ✅ Avantages:"
echo "      - Queue propre (0 messages)"
echo "      - Pas de coût de stockage SQS"
echo "      - Pas de risque de traitement en masse"
echo ""
echo "   ⚠️  Inconvénients:"
echo "      - Perte du backlog (~2000 messages)"
echo "      - Form 4 non parsés perdus"
echo "      - Nécessite redécouverte via CRON"
echo ""
echo "4️⃣  Recommandation:"
echo "   ─────────────────────────────────────"
echo "   Avec concurrency = 0 et trigger disabled:"
echo "   → La purge est SÉCURISÉE (aucun traitement en cours)"
echo "   → Les messages seraient de toute façon perdus"
echo "   → Purge recommandée pour nettoyer complètement"
