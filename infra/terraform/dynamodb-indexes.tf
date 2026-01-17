# ============================================
# DynamoDB Lookup Index
# 
# Index de lookup pour éviter requêtes Athena unitaires et S3 GET
# 
# Structure:
# - lookup_key: ticker, cik, accession_number, cusip
# - lookup_type: 'ticker->company' | 'cik->company' | 'accession->filing' | 'cusip->ticker'
# - entity_id: company_id, filing_id, etc.
# 
# Coût: PAY_PER_REQUEST = $0.25 par million de requêtes
# vs S3 GET: $0.0042 par 10K = $420 par million (1680x plus cher!)
# ============================================

resource "aws_dynamodb_table" "lookup_index" {
  name         = "${var.project}-${var.stage}-lookup-index"
  billing_mode = "PAY_PER_REQUEST"  # Extreme Budget - pas de provisioned capacity
  hash_key     = "lookup_key"
  range_key    = "lookup_type"

  attribute {
    name = "lookup_key"
    type = "S"
  }

  attribute {
    name = "lookup_type"
    type = "S"
  }

  attribute {
    name = "entity_id"
    type = "S"
  }

  # GSI pour reverse lookup (entity_id -> lookup_key)
  # Utile pour: company_id -> ticker, filing_id -> accession_number
  global_secondary_index {
    name            = "entity-index"
    hash_key        = "entity_id"
    range_key       = "lookup_type"
    projection_type = "ALL"
  }

  # Point-in-time recovery (optionnel, coûteux)
  point_in_time_recovery {
    enabled = false
  }

  # Tags
  tags = {
    Name        = "Lookup Index"
    Environment = var.stage
    Purpose     = "Cost Safety - Replace s3-direct-read lookups"
  }
}

# Output pour utilisation dans les Lambdas
output "lookup_index_table_name" {
  value       = aws_dynamodb_table.lookup_index.name
  description = "Name of the DynamoDB lookup index table"
}
