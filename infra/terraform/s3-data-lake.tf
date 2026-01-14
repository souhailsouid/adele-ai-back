# ============================================
# S3 Data Lake (Extreme Budget Architecture)
# ============================================
# 
# Toutes les données volumineuses stockées en Parquet sur S3
# Structure: s3://bucket/data/{table_name}/year=2025/month=12/data.parquet

# S3 Bucket pour le Data Lake
resource "aws_s3_bucket" "data_lake" {
  bucket = "${var.project}-${var.stage}-data-lake"

  tags = {
    Name        = "${var.project}-${var.stage}-data-lake"
    Environment = var.stage
    ManagedBy   = "Terraform"
  }
}

# Versioning pour protection des données
resource "aws_s3_bucket_versioning" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Lifecycle rules pour optimiser les coûts
resource "aws_s3_bucket_lifecycle_configuration" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    filter {}

    transition {
      days          = 90            # Après 90 jours
      storage_class = "STANDARD_IA" # Infrequent Access (50% moins cher)
    }
  }

  rule {
    id     = "transition-to-glacier"
    status = "Enabled"

    filter {}

    transition {
      days          = 365       # Après 1 an
      storage_class = "GLACIER" # Glacier (80% moins cher)
    }
  }
}

# Public access block (sécurité)
resource "aws_s3_bucket_public_access_block" "data_lake" {
  bucket = aws_s3_bucket.data_lake.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Outputs
output "data_lake_bucket" {
  description = "S3 bucket for data lake"
  value       = aws_s3_bucket.data_lake.bucket
}

output "data_lake_bucket_arn" {
  description = "S3 bucket ARN for data lake"
  value       = aws_s3_bucket.data_lake.arn
}
