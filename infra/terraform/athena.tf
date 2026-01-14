# ============================================
# Amazon Athena (Query Engine for S3 Data Lake)
# ============================================
# 
# Architecture Extreme Budget: Toutes les requêtes analytiques via Athena
# Coût: Pay-per-query ($5/TB scanned) - Très économique pour requêtes ciblées

# S3 Bucket pour les résultats Athena
resource "aws_s3_bucket" "athena_results" {
  bucket = "${var.project}-${var.stage}-athena-results"

  tags = {
    Name        = "${var.project}-${var.stage}-athena-results"
    Environment = var.stage
    ManagedBy   = "Terraform"
  }
}

# Lifecycle configuration pour supprimer les vieux résultats
resource "aws_s3_bucket_lifecycle_configuration" "athena_results" {
  bucket = aws_s3_bucket.athena_results.id

  rule {
    id     = "delete-old-results"
    status = "Enabled"

    filter {}

    expiration {
      days = 30 # Supprimer les résultats après 30 jours
    }
  }
}

# Athena Work Group
resource "aws_athena_workgroup" "main" {
  name = "${var.project}-${var.stage}-workgroup"

  configuration {
    enforce_workgroup_configuration    = true
    publish_cloudwatch_metrics_enabled = true

    result_configuration {
      output_location = "s3://${aws_s3_bucket.athena_results.bucket}/queries/"

      encryption_configuration {
        encryption_option = "SSE_S3"
      }
    }

    # Limites pour éviter les coûts imprévus
    engine_version {
      selected_engine_version = "Athena engine version 3"
    }
  }

  tags = {
    Name        = "${var.project}-${var.stage}-athena-workgroup"
    Environment = var.stage
    ManagedBy   = "Terraform"
  }
}

# Athena Database
# Note: Database name must be lowercase letters, numbers, or underscore only
resource "aws_athena_database" "main" {
  name   = replace("${var.project}_${var.stage}", "-", "_") # Replace hyphens with underscores
  bucket = aws_s3_bucket.athena_results.bucket
}

# Exemple de table externe (à créer manuellement via SQL ou script)
# Les tables sont créées via des requêtes DDL dans Athena
# Exemple pour fund_holdings:
#
# CREATE EXTERNAL TABLE fund_holdings (
#   id BIGINT,
#   fund_id BIGINT,
#   filing_id BIGINT,
#   ticker STRING,
#   cusip STRING,
#   shares BIGINT,
#   market_value BIGINT,
#   type STRING,
#   created_at TIMESTAMP
# )
# PARTITIONED BY (year INT, month INT)
# STORED AS PARQUET
# LOCATION 's3://${var.project}-${var.stage}-data-lake/data/fund_holdings/'
# TBLPROPERTIES ('parquet.compress'='SNAPPY');

# Outputs
output "athena_database" {
  description = "Athena database name"
  value       = aws_athena_database.main.name
}

output "athena_workgroup" {
  description = "Athena workgroup name"
  value       = aws_athena_workgroup.main.name
}

output "athena_results_bucket" {
  description = "S3 bucket for Athena query results"
  value       = aws_s3_bucket.athena_results.bucket
}
