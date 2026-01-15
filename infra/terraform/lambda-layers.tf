# ============================================
# Lambda Layers
# ============================================

# Layer pour parquetjs (utilisé par l'API et d'autres workers)
resource "aws_lambda_layer_version" "parquetjs_layer" {
  filename            = "${path.module}/../../layers/parquetjs-layer/parquetjs-layer.zip"
  layer_name          = "${var.project}-${var.stage}-parquetjs-layer"
  compatible_runtimes = ["nodejs20.x"]
  description         = "Layer containing parquetjs library for Parquet file operations"

  # Rebuild si le hash du zip change
  source_code_hash = filebase64sha256("${path.module}/../../layers/parquetjs-layer/parquetjs-layer.zip")

  lifecycle {
    create_before_destroy = true
    # Ignorer les changements si le zip n'existe pas encore (première création)
    # ignore_changes = [source_code_hash]
  }
}

# Output pour référence dans d'autres ressources
output "parquetjs_layer_arn" {
  value       = aws_lambda_layer_version.parquetjs_layer.arn
  description = "ARN of the parquetjs Lambda Layer"
}
