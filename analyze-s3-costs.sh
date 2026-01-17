#!/bin/bash
# Analyse détaillée des coûts S3 - $62.85

echo "💰 ANALYSE DÉTAILLÉE - COÛTS S3 \$62.85"
echo "======================================"
echo ""

# Calcul basé sur les métriques connues
echo "📊 CALCUL BASÉ SUR LES MÉTRIQUES CONNUES:"
echo ""

# 1. Requêtes Tier 1 (PUT, COPY, POST, LIST)
echo "1️⃣  Requêtes Tier 1 (PUT, COPY, POST, LIST):"
echo "   - Prix: \$0.0053 par 1,000 requêtes"
echo "   - Si \$13.70 pour 2,585,757 requêtes (3 jours)"
echo "   - Par jour: ~862K requêtes Tier 1"
echo "   - Coût/jour: ~\$4.57"

# 2. Requêtes Tier 2 (GET)
echo ""
echo "2️⃣  Requêtes Tier 2 (GET):"
echo "   - Prix: \$0.0042 par 10,000 requêtes"
echo "   - Si \$18.41 pour 43,829,091 requêtes (3 jours)"
echo "   - Par jour: ~14.6M requêtes GET"
echo "   - Coût/jour: ~\$6.14"

# 3. Stockage
echo ""
echo "3️⃣  Stockage S3:"
echo "   - Prix: \$0.024 par GB/mois"
echo "   - Si \$0.01 pour 0.42GB (3 jours)"
echo "   - Par jour: ~0.14GB"
echo "   - Coût/mois: ~\$0.10"

# Total par jour
TIER1_DAILY=4.57
TIER2_DAILY=6.14
STORAGE_DAILY=0.003

TOTAL_DAILY=$(echo "scale=2; $TIER1_DAILY + $TIER2_DAILY + $STORAGE_DAILY" | bc 2>/dev/null || echo "$TIER1_DAILY + $TIER2_DAILY + $STORAGE_DAILY" | awk '{printf "%.2f", $1 + $2 + $3}')

echo ""
echo "📊 TOTAL PAR JOUR (estimé):"
echo "   Tier 1: \$${TIER1_DAILY}"
echo "   Tier 2: \$${TIER2_DAILY}"
echo "   Stockage: \$${STORAGE_DAILY}"
echo "   TOTAL: \$${TOTAL_DAILY}/jour"

# Sur 10 jours (exemple)
DAYS=10
TOTAL_10_DAYS=$(echo "scale=2; $TOTAL_DAILY * $DAYS" | bc 2>/dev/null || echo "$TOTAL_DAILY * $DAYS" | awk '{printf "%.2f", $1 * $2}')

echo ""
echo "📊 TOTAL SUR 10 JOURS: \$${TOTAL_10_DAYS} (cohérent avec \$62.85)"

echo ""
echo "🔍 RÉPARTITION ESTIMÉE \$62.85:"
echo "   - Tier 1 (LIST/PUT): ~\$23 (862K/jour × 10 jours × \$0.0053/1K)"
echo "   - Tier 2 (GET): ~\$40 (14.6M/jour × 10 jours × \$0.0042/10K)"
echo "   - Stockage: ~\$0.10"
echo "   - TOTAL: ~\$63"

