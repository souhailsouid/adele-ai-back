# Filing Retry Handler Lambda pour re-parser automatiquement les filings en échec

resource "aws_cloudwatch_log_group" "filing_retry_handler" {
  name              = "/aws/lambda/${var.project}-${var.stage}-filing-retry-handler"
  retention_in_days = 14
}

resource "aws_lambda_function" "filing_retry_handler" {
  function_name = "${var.project}-${var.stage}-filing-retry-handler"
  role          = aws_iam_role.collector_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/filing-retry-handler/filing-retry-handler.zip"
  source_code_hash = filebase64sha256("${path.module}/../../workers/filing-retry-handler/filing-retry-handler.zip")
  timeout       = 300
  memory_size   = 512

  depends_on = [aws_cloudwatch_log_group.filing_retry_handler]

  environment {
    variables = {
      SUPABASE_URL         = var.supabase_url
      SUPABASE_SERVICE_KEY = var.supabase_service_key
      EVENT_BUS_NAME      = aws_cloudwatch_event_bus.signals.name
    }
  }
}

# Déclenchement uniquement lorsqu'un nouveau filing est détecté
# Le collector-sec-watcher publie un événement "Filings Discovered" qui déclenche ce handler
resource "aws_cloudwatch_event_rule" "filing_retry_handler_trigger" {
  name           = "${var.project}-${var.stage}-filing-retry-handler-trigger"
  event_bus_name = aws_cloudwatch_event_bus.signals.name
  description    = "Déclenche le filing-retry-handler lorsqu'un nouveau filing est découvert"

  event_pattern = jsonencode({
    source      = ["adel.signals"]
    detail-type = ["Filings Discovered"]
  })
}

resource "aws_cloudwatch_event_target" "filing_retry_handler" {
  rule           = aws_cloudwatch_event_rule.filing_retry_handler_trigger.name
  event_bus_name = aws_cloudwatch_event_bus.signals.name
  target_id      = "FilingRetryHandler"
  arn            = aws_lambda_function.filing_retry_handler.arn

  depends_on = [
    aws_lambda_function.filing_retry_handler,
    aws_lambda_permission.filing_retry_handler_events,
  ]
}

resource "aws_lambda_permission" "filing_retry_handler_events" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.filing_retry_handler.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.filing_retry_handler_trigger.arn
}
