#!/bin/bash
# Script pour augmenter la limite de concurrence Lambda au niveau du compte
# Résout le problème de throttling (503) causé par une limite trop basse (10 slots)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"

cd "$TERRAFORM_DIR"

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Fix Lambda Account Concurrency Limit${NC}"
echo ""

# Vérifier AWS CLI
if ! command -v aws &> /dev/null; then
  echo -e "${RED}❌ AWS CLI n'est pas installé${NC}"
  exit 1
fi

# Vérifier les credentials AWS
echo "📋 Vérification des credentials AWS..."
if ! aws sts get-caller-identity &> /dev/null; then
  echo -e "${RED}❌ Credentials AWS non configurés. Exécutez 'aws configure'${NC}"
  exit 1
fi

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=${AWS_REGION:-"eu-west-3"}

echo -e "${GREEN}✅ AWS Account: ${AWS_ACCOUNT_ID}${NC}"
echo -e "${GREEN}✅ Région: ${AWS_REGION}${NC}"
echo ""

# Vérifier la limite actuelle
echo "📊 Vérification de la limite actuelle..."
ACCOUNT_SETTINGS=$(aws lambda get-account-settings --region "$AWS_REGION" 2>/dev/null || echo "{}")
CURRENT_LIMIT=$(echo "$ACCOUNT_SETTINGS" | jq -r '.AccountLimit.ConcurrentExecutions // "unknown"' 2>/dev/null || echo "unknown")

echo -e "${YELLOW}Limite de concurrence actuelle: ${CURRENT_LIMIT}${NC}"
echo ""

# Demander confirmation
read -p "Voulez-vous supprimer la limite de concurrence (revenir à 1000 par défaut) ? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${YELLOW}❌ Opération annulée${NC}"
  exit 0
fi

# Supprimer la limite (revenir à la valeur par défaut)
echo "🚀 Suppression de la limite de concurrence..."
if aws lambda delete-account-concurrency --region "$AWS_REGION" 2>/dev/null; then
  echo -e "${GREEN}✅ Limite supprimée avec succès${NC}"
  echo -e "${GREEN}✅ La limite par défaut AWS (1000) est maintenant active${NC}"
else
  echo -e "${YELLOW}⚠️  La commande delete-account-concurrency a échoué${NC}"
  echo -e "${YELLOW}   Tentative avec put-account-concurrency...${NC}"
  
  # Alternative : mettre une valeur élevée
  if aws lambda put-account-concurrency --reserved-concurrent-executions 1000 --region "$AWS_REGION" 2>/dev/null; then
    echo -e "${GREEN}✅ Limite fixée à 1000 avec succès${NC}"
  else
    echo -e "${RED}❌ Erreur lors de la configuration${NC}"
    echo -e "${YELLOW}   Veuillez configurer manuellement dans AWS Console :${NC}"
    echo -e "${YELLOW}   Lambda → Account settings → Concurrency → Edit → Remove limit${NC}"
    exit 1
  fi
fi

echo ""
echo -e "${GREEN}✅ Configuration terminée !${NC}"
echo ""
echo -e "${BLUE}📝 Prochaines étapes :${NC}"
echo -e "   1. Vérifier dans AWS Console que la limite est bien supprimée/à 1000"
echo -e "   2. Appliquer Terraform pour mettre à jour parser-13f avec reserved_concurrent_executions = 5"
echo -e "   3. Tester les endpoints API pour confirmer l'absence de throttling"
