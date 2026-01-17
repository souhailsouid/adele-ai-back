# ============================================
# SEC Smart Money Sync Lambda
# Synchronise les Form 4 des top companies (insider transactions)
# ============================================

resource "aws_cloudwatch_log_group" "sec_smart_money_sync" {
  name              = "/aws/lambda/${var.project}-${var.stage}-sec-smart-money-sync"
  retention_in_days = 14
}

resource "aws_lambda_function" "sec_smart_money_sync" {
  function_name = "${var.project}-${var.stage}-sec-smart-money-sync"
  role          = aws_iam_role.collector_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/sec-smart-money-sync/sec-smart-money-sync.zip"
  timeout       = 900  # 15 minutes (les Form 4 peuvent prendre du temps)
  memory_size   = 2048 # 2GB pour gérer les requêtes Athena et S3
  # 🛡️ KILL SWITCH: Reserved concurrency (1 = normal limité, 0 = arrêt complet)
  # Variable: sec_smart_money_sync_concurrency (défaut = 1)
  reserved_concurrent_executions = var.sec_smart_money_sync_concurrency

  depends_on = [aws_cloudwatch_log_group.sec_smart_money_sync]

  environment {
    variables = {
      # AWS_REGION est réservé par Lambda, ne pas le définir
      ATHENA_DATABASE        = aws_athena_database.main.name
      ATHENA_WORK_GROUP      = aws_athena_workgroup.main.name
      ATHENA_RESULTS_BUCKET  = aws_s3_bucket.athena_results.bucket
      S3_DATA_LAKE_BUCKET    = aws_s3_bucket.data_lake.bucket
      FORM4_PARSER_QUEUE_URL = aws_sqs_queue.form4_parser_queue.url
    }
  }
}

# Cron: Quotidien à 05h15 UTC (après clôture SEC à 22h EST/EDT = 02h-03h UTC)
# Marge de sécurité de 2-3h pour que l'API data.sec.gov soit consolidée
# 🛑 DÉSACTIVÉ TEMPORAIREMENT
resource "aws_cloudwatch_event_rule" "sec_smart_money_sync_cron" {
  name                = "${var.project}-${var.stage}-sec-smart-money-sync-cron"
  description         = "Déclenche la synchronisation SEC Smart Money (Form 4) quotidiennement à 05h15 UTC (après clôture SEC) - DÉSACTIVÉ"
  schedule_expression = "cron(15 5 * * ? *)"  # 05h15 UTC tous les jours (après 22h EST/EDT)
  state               = "DISABLED"  # 🛑 DÉSACTIVÉ
}

# EventBridge → SQS (au lieu de Lambda directement)
resource "aws_cloudwatch_event_target" "sec_smart_money_sync" {
  rule      = aws_cloudwatch_event_rule.sec_smart_money_sync_cron.name
  target_id = "SECSmartMoneySync"
  arn       = aws_sqs_queue.collectors_queue.arn
  
  # Passer le mode "insiders-only" dans le message
  input = jsonencode({
    mode = "insiders-only"
  })
}

# Cron: Hebdomadaire le dimanche à 22h UTC - Tracking cross-company des dirigeants
# 🛑 DÉSACTIVÉ TEMPORAIREMENT
resource "aws_cloudwatch_event_rule" "sec_smart_money_track_insiders_cron" {
  name                = "${var.project}-${var.stage}-sec-smart-money-track-insiders-cron"
  description         = "Déclenche le tracking cross-company des dirigeants hebdomadairement le dimanche à 22h UTC - DÉSACTIVÉ"
  schedule_expression = "cron(0 22 ? * SUN *)"  # Dimanche 22h UTC
  state               = "DISABLED"  # 🛑 DÉSACTIVÉ
}

# EventBridge → SQS pour le tracking cross-company
resource "aws_cloudwatch_event_target" "sec_smart_money_track_insiders" {
  rule      = aws_cloudwatch_event_rule.sec_smart_money_track_insiders_cron.name
  target_id = "SECSmartMoneyTrackInsiders"
  arn       = aws_sqs_queue.collectors_queue.arn
  
  # Passer le mode "track-insiders" dans le message
  input = jsonencode({
    mode = "track-insiders"
  })
}

# Lambda consomme depuis SQS
# 🛑 DÉSACTIVÉ TEMPORAIREMENT
resource "aws_lambda_event_source_mapping" "sec_smart_money_sync_sqs" {
  event_source_arn = aws_sqs_queue.collectors_queue.arn
  function_name    = aws_lambda_function.sec_smart_money_sync.arn
  batch_size       = 1 # Traiter 1 message à la fois
  enabled          = false  # 🛑 DÉSACTIVÉ
  
  # ⚠️ IMPORTANT: Activer reportBatchItemFailures pour retry uniquement les messages échoués
  function_response_types = ["ReportBatchItemFailures"]
}
