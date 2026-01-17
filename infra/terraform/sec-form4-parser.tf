# ============================================
# SEC Form 4 PARSER Lambda
# Parse les Form 4 depuis SQS avec rate limiting strict
# ============================================

resource "aws_cloudwatch_log_group" "sec_form4_parser" {
  name              = "/aws/lambda/${var.project}-${var.stage}-sec-form4-parser"
  retention_in_days = 14
}

resource "aws_lambda_function" "sec_form4_parser" {
  function_name = "${var.project}-${var.stage}-sec-form4-parser"
  role          = aws_iam_role.collector_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/sec-form4-parser/sec-form4-parser.zip"
  source_code_hash = filebase64sha256("${path.module}/../../workers/sec-form4-parser/sec-form4-parser.zip")
  timeout       = 300  # 5 minutes (parsing peut être long)
  memory_size   = 1024 # 1GB
  
  # 🛡️ KILL SWITCH: Reserved concurrency (1 = normal limité, 0 = arrêt complet)
  # Variable: sec_form4_parser_concurrency (défaut = 1)
  reserved_concurrent_executions = var.sec_form4_parser_concurrency

  depends_on = [aws_cloudwatch_log_group.sec_form4_parser]

  environment {
    variables = {
      ENABLE_SEC_SYNC        = var.enable_sec_sync ? "true" : "false"
      ATHENA_DATABASE        = aws_athena_database.main.name
      ATHENA_WORK_GROUP      = aws_athena_workgroup.main.name
      ATHENA_RESULTS_BUCKET  = aws_s3_bucket.athena_results.bucket
      S3_DATA_LAKE_BUCKET    = aws_s3_bucket.data_lake.bucket
    }
  }
}

# SQS Event Source Mapping: Lambda consomme depuis form4-parser-queue
resource "aws_lambda_event_source_mapping" "sec_form4_parser_sqs" {
  event_source_arn = aws_sqs_queue.form4_parser_queue.arn
  function_name    = aws_lambda_function.sec_form4_parser.arn
  batch_size       = 1 # Traiter 1 message à la fois (rate limiting strict)
  enabled          = var.enable_sec_sync ? true : false  # 🛡️ KILL SWITCH
  
  # ⚠️ IMPORTANT: Activer reportBatchItemFailures pour retry uniquement les messages échoués
  # WHY: Permet à la Lambda de retourner batchItemFailures pour retry sélectif
  function_response_types = ["ReportBatchItemFailures"]
}
