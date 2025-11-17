#!/bin/bash
# Script pour récupérer les credentials Cognito et URLs après déploiement Terraform

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"

cd "$TERRAFORM_DIR"

if [ ! -f "terraform.tfstate" ] && [ ! -f ".terraform/terraform.tfstate" ]; then
  echo "❌ Terraform n'a pas encore été déployé. Exécutez 'terraform apply' d'abord."
  exit 1
fi

echo "📋 Récupération des credentials depuis Terraform..."
echo ""

# Récupérer les outputs
terraform output -json > /tmp/terraform-outputs.json 2>/dev/null || {
  echo "❌ Erreur lors de la récupération des outputs Terraform"
  exit 1
}

# Extraire les valeurs
COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id 2>/dev/null)
COGNITO_CLIENT_ID=$(terraform output -raw cognito_user_pool_client 2>/dev/null)
COGNITO_DOMAIN=$(terraform output -raw cognito_domain 2>/dev/null)
COGNITO_ISSUER=$(terraform output -raw cognito_issuer_url 2>/dev/null)
API_URL=$(terraform output -raw api_gateway_url 2>/dev/null)
REGION=$(terraform output -raw region 2>/dev/null || echo "eu-west-3")

echo "✅ Credentials récupérés avec succès!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Configuration pour le Frontend (.env.local)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
cat <<EOF
# Cognito Configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=${COGNITO_USER_POOL_ID}
NEXT_PUBLIC_COGNITO_CLIENT_ID=${COGNITO_CLIENT_ID}
NEXT_PUBLIC_COGNITO_DOMAIN=${COGNITO_DOMAIN}
NEXT_PUBLIC_COGNITO_ISSUER=${COGNITO_ISSUER}

# API Configuration
NEXT_PUBLIC_API_URL=${API_URL}

# Region
NEXT_PUBLIC_AWS_REGION=${REGION}
EOF
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔗 URLs Cognito"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Authorization: https://${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com/oauth2/authorize"
echo "Token:         https://${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com/oauth2/token"
echo "UserInfo:      https://${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com/oauth2/userInfo"
echo "Logout:        https://${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com/logout"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 API Gateway"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "API URL: ${API_URL}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💾 Sauvegarde dans credentials.json"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

OUTPUT_FILE="../../credentials.json"
cat > "$OUTPUT_FILE" <<EOF
{
  "cognito": {
    "userPoolId": "${COGNITO_USER_POOL_ID}",
    "clientId": "${COGNITO_CLIENT_ID}",
    "domain": "${COGNITO_DOMAIN}",
    "issuer": "${COGNITO_ISSUER}",
    "region": "${REGION}",
    "authorizationUrl": "https://${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com/oauth2/authorize",
    "tokenUrl": "https://${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com/oauth2/token",
    "userInfoUrl": "https://${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com/oauth2/userInfo",
    "logoutUrl": "https://${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com/logout"
  },
  "api": {
    "url": "${API_URL}",
    "region": "${REGION}"
  }
}
EOF

echo "✅ Credentials sauvegardés dans: $OUTPUT_FILE"
echo ""
echo "💡 Note: credentials.json est dans .gitignore (ne sera pas commité)"
echo "   Template disponible: credentials.json.example"


