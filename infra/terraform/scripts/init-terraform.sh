#!/bin/bash
# Script d'initialisation complète de Terraform pour Personamy Backend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$TERRAFORM_DIR")")"

cd "$TERRAFORM_DIR"

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Initialisation Terraform pour Personamy Backend${NC}"
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

# Demander les valeurs par défaut
read -p "Nom du projet [personamy]: " PROJECT_NAME
PROJECT_NAME=${PROJECT_NAME:-personamy}

read -p "Stage [dev]: " STAGE
STAGE=${STAGE:-dev}

read -p "Région AWS [eu-west-3]: " REGION
REGION=${REGION:-eu-west-3}

# Noms des ressources
TF_STATE_BUCKET="${PROJECT_NAME}-${STAGE}-tf-state-${AWS_ACCOUNT_ID}"
TF_LOCKS_TABLE="${PROJECT_NAME}-${STAGE}-tf-locks"

echo ""
echo -e "${YELLOW}📦 Configuration Terraform:${NC}"
echo "  Project: $PROJECT_NAME"
echo "  Stage: $STAGE"
echo "  Region: $REGION"
echo "  State Bucket: $TF_STATE_BUCKET"
echo "  Locks Table: $TF_LOCKS_TABLE"
echo ""

# Créer le bucket S3 pour le state
echo "📦 Création du bucket S3 pour le state Terraform..."
if aws s3api head-bucket --bucket "$TF_STATE_BUCKET" 2>/dev/null; then
  echo -e "${YELLOW}⚠️  Le bucket $TF_STATE_BUCKET existe déjà${NC}"
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$TF_STATE_BUCKET" --region "$REGION"
  else
    aws s3api create-bucket \
      --bucket "$TF_STATE_BUCKET" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
  
  # Activer le versioning
  aws s3api put-bucket-versioning \
    --bucket "$TF_STATE_BUCKET" \
    --versioning-configuration Status=Enabled
  
  # Activer le chiffrement
  aws s3api put-bucket-encryption \
    --bucket "$TF_STATE_BUCKET" \
    --server-side-encryption-configuration '{
      "Rules": [{
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }]
    }'
  
  # Bloquer l'accès public
  aws s3api put-public-access-block \
    --bucket "$TF_STATE_BUCKET" \
    --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
  
  echo -e "${GREEN}✅ Bucket S3 créé: $TF_STATE_BUCKET${NC}"
fi

# Créer la table DynamoDB pour les locks
echo ""
echo "🔒 Création de la table DynamoDB pour les locks..."
if aws dynamodb describe-table --table-name "$TF_LOCKS_TABLE" --region "$REGION" &>/dev/null; then
  echo -e "${YELLOW}⚠️  La table $TF_LOCKS_TABLE existe déjà${NC}"
else
  aws dynamodb create-table \
    --table-name "$TF_LOCKS_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" \
    --tags Key=Project,Value="$PROJECT_NAME" Key=Stage,Value="$STAGE" Key=Purpose,Value=terraform-locks
  
  echo -e "${GREEN}✅ Table DynamoDB créée: $TF_LOCKS_TABLE${NC}"
fi

# Mettre à jour providers.tf
echo ""
echo "📝 Mise à jour de providers.tf..."
sed -i.bak \
  -e "s|bucket = \"your-tf-state-bucket\"|bucket = \"$TF_STATE_BUCKET\"|" \
  -e "s|dynamodb_table = \"your-tf-locks\"|dynamodb_table = \"$TF_LOCKS_TABLE\"|" \
  -e "s|region = \"eu-west-3\"|region = \"$REGION\"|" \
  providers.tf

rm -f providers.tf.bak
echo -e "${GREEN}✅ providers.tf mis à jour${NC}"

# Créer terraform.tfvars
echo ""
echo "📝 Création de terraform.tfvars..."
cat > terraform.tfvars <<EOF
project = "$PROJECT_NAME"
stage   = "$STAGE"
region  = "$REGION"
frontend_allowed_origins = [
  "http://localhost:3000"
]
EOF
echo -e "${GREEN}✅ terraform.tfvars créé${NC}"

# Initialiser Terraform
echo ""
echo "🔧 Initialisation de Terraform..."
terraform init

echo ""
echo -e "${GREEN}✅ Initialisation terminée avec succès!${NC}"
echo ""
echo "📋 Prochaines étapes:"
echo "  1. Vérifier la configuration: ${YELLOW}terraform plan${NC}"
echo "  2. Déployer l'infrastructure: ${YELLOW}terraform apply${NC}"
echo "  3. Récupérer les credentials: ${YELLOW}./scripts/get-credentials.sh${NC}"
echo ""


