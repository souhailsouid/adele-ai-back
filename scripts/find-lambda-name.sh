#!/bin/bash

# Script pour trouver le nom exact de la Lambda collector-rss

echo "🔍 Recherche de la Lambda collector-rss"
echo "========================================"
echo ""

# Chercher toutes les Lambdas contenant "collector" et "rss"
echo "1️⃣  Lambdas contenant 'collector' et 'rss':"
aws lambda list-functions --query 'Functions[?contains(FunctionName, `collector`) && contains(FunctionName, `rss`)].FunctionName' --output table 2>/dev/null || echo "❌ Erreur lors de la recherche"
echo ""

# Chercher toutes les Lambdas contenant "rss"
echo "2️⃣  Toutes les Lambdas contenant 'rss':"
aws lambda list-functions --query 'Functions[?contains(FunctionName, `rss`)].FunctionName' --output table 2>/dev/null || echo "❌ Erreur lors de la recherche"
echo ""

# Chercher les règles EventBridge contenant "rss"
echo "3️⃣  Règles EventBridge contenant 'rss':"
aws events list-rules --query 'Rules[?contains(Name, `rss`)].{Name:Name,State:State,Schedule:ScheduleExpression}' --output table 2>/dev/null || echo "❌ Erreur lors de la recherche"
echo ""

# Chercher les log groups contenant "collector" et "rss"
echo "4️⃣  Log Groups contenant 'collector' et 'rss':"
aws logs describe-log-groups --query 'logGroups[?contains(logGroupName, `collector`) && contains(logGroupName, `rss`)].logGroupName' --output table 2>/dev/null || echo "❌ Erreur lors de la recherche"
echo ""

echo "💡 Si aucune Lambda n'est trouvée, elle n'a peut-être pas encore été déployée."
echo "   Exécutez: cd infra/terraform && terraform apply"


