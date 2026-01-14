# ============================================
# DynamoDB Table pour Cache Insiders
# ============================================
# 
# Architecture Extreme Budget: DynamoDB PAY_PER_REQUEST pour cache rapide
# 
# Usage: Cache des requêtes fréquentes (trending, company, person)
# TTL: 7 jours maximum (géré par l'attribut `ttl`)
#
# Coût estimé: ~$0.25/mois (PAY_PER_REQUEST, très peu de requêtes)

resource "aws_dynamodb_table" "insiders_cache" {
  name         = "${var.project}-${var.stage}-insiders-cache"
  billing_mode = "PAY_PER_REQUEST" # Pas de provisioned capacity (extreme budget)

  hash_key = "cache_key"

  attribute {
    name = "cache_key"
    type = "S"
  }

  # TTL pour expiration automatique
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = {
    Name        = "${var.project}-${var.stage}-insiders-cache"
    Project     = var.project
    Stage       = var.stage
    Purpose     = "insiders-cache"
    Environment = var.stage
  }
}

# IAM Policy pour Lambda API (lecture/écriture cache)
resource "aws_iam_role_policy" "api_lambda_dynamodb_insiders_cache" {
  name = "${var.project}-${var.stage}-api-lambda-dynamodb-insiders-cache"
  role = aws_iam_role.api_lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
        ]
        Resource = [
          aws_dynamodb_table.insiders_cache.arn,
        ]
      },
    ]
  })
}

# IAM Policy pour Lambda form4-parser (écriture cache)
resource "aws_iam_role_policy" "form4_parser_dynamodb_insiders_cache" {
  name = "${var.project}-${var.stage}-form4-parser-dynamodb-insiders-cache"
  role = aws_iam_role.collector_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
        ]
        Resource = [
          aws_dynamodb_table.insiders_cache.arn,
        ]
      },
    ]
  })
}
