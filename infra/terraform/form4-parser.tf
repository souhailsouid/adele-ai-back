# ============================================
# Form 4 Parser Lambda
# Parse les Form 4 avec rate limiting strict (10 req/s max pour SEC)
# ============================================

resource "aws_cloudwatch_log_group" "form4_parser" {
  name              = "/aws/lambda/${var.project}-${var.stage}-form4-parser"
  retention_in_days = 14
}

resource "aws_lambda_function" "form4_parser" {
  function_name = "${var.project}-${var.stage}-form4-parser"
  role          = aws_iam_role.collector_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/form4-parser/form4-parser.zip"
  timeout       = 300  # 5 minutes (parsing peut être long)
  memory_size   = 1024 # 1GB pour parsing XML

  depends_on = [aws_cloudwatch_log_group.form4_parser]

  environment {
    variables = {
      # AWS_REGION est réservé par Lambda, ne pas le définir
      ATHENA_DATABASE        = aws_athena_database.main.name
      ATHENA_WORK_GROUP      = aws_athena_workgroup.main.name
      ATHENA_RESULTS_BUCKET  = aws_s3_bucket.athena_results.bucket
      S3_DATA_LAKE_BUCKET    = aws_s3_bucket.data_lake.bucket
      FORM4_PARSER_QUEUE_URL = aws_sqs_queue.form4_parser_queue.url
      INSIDERS_CACHE_TABLE   = aws_dynamodb_table.insiders_cache.name
      # Alertes Top Signals (Telegram/Discord)
      TELEGRAM_BOT_TOKEN     = var.telegram_bot_token
      TELEGRAM_CHAT_ID       = var.telegram_chat_id
      DISCORD_WEBHOOK_URL    = var.discord_webhook_url
    }
  }
}

# Lambda consomme depuis SQS avec rate limiting
# batch_size = 1 pour traiter 1 message à la fois (rate limiting strict)
resource "aws_lambda_event_source_mapping" "form4_parser_sqs" {
  event_source_arn = aws_sqs_queue.form4_parser_queue.arn
  function_name    = aws_lambda_function.form4_parser.arn
  batch_size       = 1 # Traiter 1 message à la fois pour respecter 10 req/s
  enabled          = true
  
  # Maximum concurrency: 1 (pour respecter strictement le rate limiting)
  # Note: Cette option nécessite AWS Lambda concurrency controls
  # Pour l'instant, batch_size=1 suffit
}
