terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.50"
    }
  }
  backend "s3" {
    bucket = "personamy-dev-tf-state-956633302249"
    key    = "adel-ai-backend/terraform.tfstate"  # Nouvelle clé pour isoler ADEL AI
    region = "eu-west-3"
    dynamodb_table = "personamy-dev-tf-locks"
    encrypt = true
  }
}

provider "aws" {
  region = var.region
}
