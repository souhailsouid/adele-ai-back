# Notification Generator Lambda pour générer automatiquement les notifications de funds

resource "aws_cloudwatch_log_group" "notification_generator" {
  name              = "/aws/lambda/${var.project}-${var.stage}-notification-generator"
  retention_in_days = 14
}

resource "aws_lambda_function" "notification_generator" {
  function_name    = "${var.project}-${var.stage}-notification-generator"
  role             = aws_iam_role.collector_role.arn
  runtime          = "nodejs20.x"
  handler          = "index.handler"
  filename         = "${path.module}/../../workers/notification-generator/notification-generator.zip"
  source_code_hash = filebase64sha256("${path.module}/../../workers/notification-generator/notification-generator.zip")
  timeout          = 300
  memory_size      = 512

  depends_on = [aws_cloudwatch_log_group.notification_generator]

  environment {
    variables = {
      SUPABASE_URL         = var.supabase_url
      SUPABASE_SERVICE_KEY = var.supabase_service_key
    }
  }
}

# Cron: toutes les 10 minutes (TEMPORAIRE - réduit la charge en attendant l'augmentation de limite)
# TODO: Remettre à "rate(5 minutes)" une fois la limite de compte augmentée à 1000
resource "aws_cloudwatch_event_rule" "notification_generator_cron" {
  name                = "${var.project}-${var.stage}-notification-generator-cron"
  description         = "Déclenche le notification-generator toutes les 40 minutes (temporaire)"
  schedule_expression = "rate(40 minutes)"
}

# EventBridge → SQS (au lieu de Lambda directement)
resource "aws_cloudwatch_event_target" "notification_generator" {
  rule      = aws_cloudwatch_event_rule.notification_generator_cron.name
  target_id = "NotificationGenerator"
  arn       = aws_sqs_queue.collectors_queue.arn
}

# Lambda consomme depuis SQS
resource "aws_lambda_event_source_mapping" "notification_generator_sqs" {
  event_source_arn = aws_sqs_queue.collectors_queue.arn
  function_name    = aws_lambda_function.notification_generator.arn
  batch_size       = 1 # Traiter 1 message à la fois
  enabled          = false # 🛑 DÉSACTIVÉ
  
  # ⚠️ IMPORTANT: Activer reportBatchItemFailures pour retry uniquement les messages échoués
  function_response_types = ["ReportBatchItemFailures"]
}
