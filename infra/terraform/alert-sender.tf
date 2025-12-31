# Alert Sender Lambda pour envoyer les alertes temps réel

resource "aws_cloudwatch_log_group" "alert_sender" {
  name              = "/aws/lambda/${var.project}-${var.stage}-alert-sender"
  retention_in_days = 14
}

resource "aws_lambda_function" "alert_sender" {
  function_name = "${var.project}-${var.stage}-alert-sender"
  role          = aws_iam_role.collector_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/alert-sender/alert-sender.zip"
  timeout       = 60
  memory_size   = 256

  depends_on = [aws_cloudwatch_log_group.alert_sender]

  environment {
    variables = {
      SUPABASE_URL         = var.supabase_url
      SUPABASE_SERVICE_KEY = var.supabase_service_key
      DISCORD_WEBHOOK_URL  = var.discord_webhook_url != "" ? var.discord_webhook_url : ""
      SLACK_WEBHOOK_URL    = var.slack_webhook_url != "" ? var.slack_webhook_url : ""
      TELEGRAM_BOT_TOKEN   = var.telegram_bot_token != "" ? var.telegram_bot_token : ""
      TELEGRAM_CHAT_ID     = var.telegram_chat_id != "" ? var.telegram_chat_id : ""
    }
  }
}

# Cron: toutes les minutes pour traiter les alertes en attente
resource "aws_cloudwatch_event_rule" "alert_sender_cron" {
  name                = "${var.project}-${var.stage}-alert-sender-cron"
  description         = "Déclenche le alert-sender toutes les minutes pour traiter les alertes"
  schedule_expression = "rate(1 minute)"
}

resource "aws_cloudwatch_event_target" "alert_sender" {
  rule      = aws_cloudwatch_event_rule.alert_sender_cron.name
  target_id = "AlertSender"
  arn       = aws_lambda_function.alert_sender.arn
}

resource "aws_lambda_permission" "alert_sender_events" {
  statement_id  = "AllowExecutionFromCloudWatch"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.alert_sender.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.alert_sender_cron.arn
}


