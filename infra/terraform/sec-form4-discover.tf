# ============================================
# SEC Form 4 DISCOVER Lambda
# Découvre les Form 4 depuis SEC API et enqueue dans SQS
# ============================================

resource "aws_cloudwatch_log_group" "sec_form4_discover" {
  name              = "/aws/lambda/${var.project}-${var.stage}-sec-form4-discover"
  retention_in_days = 14
}

resource "aws_lambda_function" "sec_form4_discover" {
  function_name = "${var.project}-${var.stage}-sec-form4-discover"
  role          = aws_iam_role.collector_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/sec-form4-discover/sec-form4-discover.zip"
  source_code_hash = filebase64sha256("${path.module}/../../workers/sec-form4-discover/sec-form4-discover.zip")
  timeout       = 900  # 15 minutes (peut scanner 100+ companies)
  memory_size   = 1024 # 1GB
  
  # 🛡️ KILL SWITCH: Reserved concurrency (1 = normal limité, 0 = arrêt complet)
  # Variable: sec_form4_discover_concurrency (défaut = 1)
  reserved_concurrent_executions = var.sec_form4_discover_concurrency

  depends_on = [aws_cloudwatch_log_group.sec_form4_discover]

  environment {
    variables = {
      ENABLE_SEC_SYNC          = var.enable_sec_sync ? "true" : "false"
      COMPANY_CIKS_JSON        = var.company_ciks_json
      ATHENA_DATABASE          = aws_athena_database.main.name
      ATHENA_WORK_GROUP        = aws_athena_workgroup.main.name
      ATHENA_RESULTS_BUCKET    = aws_s3_bucket.athena_results.bucket
      FORM4_PARSER_QUEUE_URL   = aws_sqs_queue.form4_parser_queue.url
    }
  }
}

# EventBridge Rule: Cron quotidien à 05h15 UTC
resource "aws_cloudwatch_event_rule" "sec_form4_discover_cron" {
  name                = "${var.project}-${var.stage}-sec-form4-discover-cron"
  description         = "Déclenche la découverte Form 4 quotidiennement à 05h15 UTC"
  schedule_expression = "cron(15 5 * * ? *)"  # 05h15 UTC tous les jours
  state               = var.enable_sec_sync ? "ENABLED" : "DISABLED"
}

# EventBridge Target: Lambda direct (pas via SQS pour éviter duplication)
resource "aws_cloudwatch_event_target" "sec_form4_discover" {
  rule      = aws_cloudwatch_event_rule.sec_form4_discover_cron.name
  target_id = "SECForm4Discover"
  arn       = aws_lambda_function.sec_form4_discover.arn
}

# Permission EventBridge → Lambda
resource "aws_lambda_permission" "sec_form4_discover_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sec_form4_discover.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.sec_form4_discover_cron.arn
}
