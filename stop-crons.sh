#!/bin/bash
# Script pour arrêter immédiatement les CRONs SEC Smart Money et Form 4

echo "🛑 Arrêt des CRONs EventBridge..."

# Désactiver les CRONs sec-smart-money-sync
aws events disable-rule --name adel-ai-dev-sec-smart-money-sync-cron 2>/dev/null && echo "✅ CRON sec-smart-money-sync-cron désactivé" || echo "⚠️  CRON sec-smart-money-sync-cron non trouvé ou déjà désactivé"

aws events disable-rule --name adel-ai-dev-sec-smart-money-track-insiders-cron 2>/dev/null && echo "✅ CRON sec-smart-money-track-insiders-cron désactivé" || echo "⚠️  CRON sec-smart-money-track-insiders-cron non trouvé ou déjà désactivé"

# Désactiver les CRONs form4
aws events disable-rule --name adel-ai-dev-form4-insider-collector-cron 2>/dev/null && echo "✅ CRON form4-insider-collector-cron désactivé" || echo "⚠️  CRON form4-insider-collector-cron non trouvé"

aws events disable-rule --name adel-ai-dev-form4-company-collector-cron 2>/dev/null && echo "✅ CRON form4-company-collector-cron désactivé" || echo "⚠️  CRON form4-company-collector-cron non trouvé"

aws events disable-rule --name adel-ai-dev-form4-atom-collector-cron 2>/dev/null && echo "✅ CRON form4-atom-collector-cron désactivé" || echo "⚠️  CRON form4-atom-collector-cron non trouvé"

aws events disable-rule --name adel-ai-dev-form4-atom-collector-intraday-cron 2>/dev/null && echo "✅ CRON form4-atom-collector-intraday-cron désactivé" || echo "⚠️  CRON form4-atom-collector-intraday-cron non trouvé"

aws events disable-rule --name adel-ai-dev-form144-collector-cron 2>/dev/null && echo "✅ CRON form144-collector-cron désactivé" || echo "⚠️  CRON form144-collector-cron non trouvé"

aws events disable-rule --name adel-ai-dev-form144-collector-intraday-cron 2>/dev/null && echo "✅ CRON form144-collector-intraday-cron désactivé" || echo "⚠️  CRON form144-collector-intraday-cron non trouvé"

echo ""
echo "✅ Tous les CRONs ont été désactivés"
echo ""
echo "📋 Pour réactiver plus tard:"
echo "  aws events enable-rule --name <rule-name>"
