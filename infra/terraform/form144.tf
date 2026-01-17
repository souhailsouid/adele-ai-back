# ============================================
# Form 144 System
# Notice of Proposed Sale of Securities (signal prédictif)
# ============================================

# ============================================
# SQS Queue pour Form 144 Parser
# ============================================
resource "aws_sqs_queue" "form144_parser_queue" {
  name                      = "${var.project}-${var.stage}-form144-parser-queue"
  visibility_timeout_seconds = 60  # 30s timeout Lambda + marge
  message_retention_seconds  = 1209600 # 14 jours
  receive_wait_time_seconds  = 0 # Short polling (pas de long polling nécessaire)

  tags = {
    Name        = "${var.project}-${var.stage}-form144-parser-queue"
    Environment = var.stage
    Project     = var.project
  }
}

# Dead Letter Queue pour Form 144 Parser
resource "aws_sqs_queue" "form144_parser_dlq" {
  name                      = "${var.project}-${var.stage}-form144-parser-dlq"
  message_retention_seconds = 1209600 # 14 jours

  tags = {
    Name        = "${var.project}-${var.stage}-form144-parser-dlq"
    Environment = var.stage
    Project     = var.project
  }
}

# Redrive policy pour DLQ
resource "aws_sqs_queue_redrive_policy" "form144_parser_queue_redrive" {
  queue_url = aws_sqs_queue.form144_parser_queue.id
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.form144_parser_dlq.arn
    maxReceiveCount     = 3
  })
}

# ============================================
# Form 144 Collector Lambda
# Récupère depuis flux Atom SEC et publie dans SQS
# ============================================
resource "aws_cloudwatch_log_group" "form144_collector" {
  name              = "/aws/lambda/${var.project}-${var.stage}-form144-collector"
  retention_in_days = 14
}

resource "aws_lambda_function" "form144_collector" {
  function_name = "${var.project}-${var.stage}-form144-collector"
  role          = aws_iam_role.collector_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/form144-collector/form144-collector.zip"
  source_code_hash = filebase64sha256("${path.module}/../../workers/form144-collector/form144-collector.zip")
  timeout       = 60  # 1 minute (suffisant pour récupérer le flux Atom)
  memory_size   = 512 # 512MB suffisant pour parsing Atom

  depends_on = [aws_cloudwatch_log_group.form144_collector]

  environment {
    variables = {
      FORM144_PARSER_QUEUE_URL = aws_sqs_queue.form144_parser_queue.url
    }
  }
}

# Cron 1: Run du matin (5h15) - Récap de la journée passée avec count=1000
resource "aws_cloudwatch_event_rule" "form144_collector_morning" {
  name                = "${var.project}-${var.stage}-form144-collector-morning"
  description         = "Déclenche le collector Form 144 chaque jour à 5h15 (récap avec count=1000)"
  schedule_expression = "cron(15 5 * * ? *)" # 5h15 UTC
}

# Cron 2: Scan intraday (toutes les 30 min pendant les heures de marché)
# Wall Street: 14h-22h UTC (9h30-17h30 EST), lundi-vendredi
resource "aws_cloudwatch_event_rule" "form144_collector_intraday" {
  name                = "${var.project}-${var.stage}-form144-collector-intraday"
  description         = "Déclenche le collector Form 144 toutes les 30 min pendant les heures de marché (14h-22h UTC, lundi-vendredi)"
  schedule_expression = "cron(0/30 14-22 ? * MON-FRI *)" # Toutes les 30 min entre 14h et 22h UTC, lundi-vendredi
}

# EventBridge → Lambda pour le run du matin
resource "aws_cloudwatch_event_target" "form144_collector_morning" {
  rule      = aws_cloudwatch_event_rule.form144_collector_morning.name
  target_id = "Form144CollectorMorning"
  arn       = aws_lambda_function.form144_collector.arn
}

# EventBridge → Lambda pour le scan intraday
resource "aws_cloudwatch_event_target" "form144_collector_intraday" {
  rule      = aws_cloudwatch_event_rule.form144_collector_intraday.name
  target_id = "Form144CollectorIntraday"
  arn       = aws_lambda_function.form144_collector.arn
}

# Permissions pour EventBridge d'invoquer la Lambda
resource "aws_lambda_permission" "form144_collector_morning_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridgeMorning"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.form144_collector.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.form144_collector_morning.arn
}

resource "aws_lambda_permission" "form144_collector_intraday_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridgeIntraday"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.form144_collector.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.form144_collector_intraday.arn
}

# Permission pour Lambda d'envoyer vers SQS
resource "aws_sqs_queue_policy" "form144_parser_queue_policy" {
  queue_url = aws_sqs_queue.form144_parser_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = ["lambda.amazonaws.com"]
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.form144_parser_queue.arn
      }
    ]
  })
}

# ============================================
# Form 144 Parser Lambda
# Parse les Form 144 avec rate limiting strict (10 req/s max pour SEC)
# ============================================
resource "aws_cloudwatch_log_group" "form144_parser" {
  name              = "/aws/lambda/${var.project}-${var.stage}-form144-parser"
  retention_in_days = 14
}

resource "aws_lambda_function" "form144_parser" {
  function_name = "${var.project}-${var.stage}-form144-parser"
  role          = aws_iam_role.collector_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/form144-parser/form144-parser.zip"
  source_code_hash = filebase64sha256("${path.module}/../../workers/form144-parser/form144-parser.zip")
  timeout       = 60  # 60 secondes (comme demandé: 30s+)
  memory_size   = 1024 # 1GB pour parsing XML
  # 🛡️ KILL SWITCH: Reserved concurrency (1 = normal limité, 0 = arrêt complet)
  # Variable: form144_parser_concurrency (défaut = 1)
  reserved_concurrent_executions = var.form144_parser_concurrency

  depends_on = [aws_cloudwatch_log_group.form144_parser]

  layers = [aws_lambda_layer_version.parquetjs_layer.arn] # Utiliser le layer parquetjs

  environment {
    variables = {
      ATHENA_DATABASE        = aws_athena_database.main.name
      ATHENA_WORK_GROUP      = aws_athena_workgroup.main.name
      ATHENA_RESULTS_BUCKET  = aws_s3_bucket.athena_results.bucket
      S3_DATA_LAKE_BUCKET    = aws_s3_bucket.data_lake.bucket
      FORM144_PARSER_QUEUE_URL = aws_sqs_queue.form144_parser_queue.url
    }
  }
}

# Lambda consomme depuis SQS avec rate limiting
# batch_size = 1 pour traiter 1 message à la fois (rate limiting strict)
resource "aws_lambda_event_source_mapping" "form144_parser_sqs" {
  event_source_arn = aws_sqs_queue.form144_parser_queue.arn
  function_name    = aws_lambda_function.form144_parser.arn
  batch_size       = 1 # Traiter 1 message à la fois pour respecter 10 req/s
  enabled          = false  # 🛑 DÉSACTIVÉ
  
  # ⚠️ IMPORTANT: Activer reportBatchItemFailures pour retry uniquement les messages échoués
  function_response_types = ["ReportBatchItemFailures"]
}
