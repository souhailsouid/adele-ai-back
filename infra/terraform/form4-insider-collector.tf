# ============================================
# Form 4 Insider Collector Lambda
# Collecte les Form 4 depuis les flux Atom RSS par INSIDER (CIK personnel)
# Suit les 100 dirigeants prioritaires et découvre leurs transactions cross-company
# ============================================

resource "aws_cloudwatch_log_group" "form4_insider_collector" {
  name              = "/aws/lambda/${var.project}-${var.stage}-form4-insider-collector"
  retention_in_days = 14
}

resource "aws_lambda_function" "form4_insider_collector" {
  function_name = "${var.project}-${var.stage}-form4-insider-collector"
  role          = aws_iam_role.collector_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/form4-insider-collector/form4-insider-collector.zip"
  source_code_hash = filebase64sha256("${path.module}/../../workers/form4-insider-collector/form4-insider-collector.zip")
  timeout       = 300  # 5 minutes (100 dirigeants × 2-3 secondes chacun)
  memory_size   = 1024 # 1GB pour gérer 100 dirigeants

  depends_on = [aws_cloudwatch_log_group.form4_insider_collector]

  environment {
    variables = {
      FORM4_PARSER_QUEUE_URL = aws_sqs_queue.form4_parser_queue.url
    }
  }
}

# Cron: Scan intraday (toutes les 2 heures pendant les heures de marché)
# Moins fréquent que form4-company-collector car:
# - Moins de dirigeants (100 vs 100 entreprises)
# - Moins de transactions par dirigeant
# - Les dirigeants font moins de transactions que les entreprises
# Wall Street: 14h-22h UTC (9h30-17h30 EST), lundi-vendredi
resource "aws_cloudwatch_event_rule" "form4_insider_collector_intraday" {
  name                = "${var.project}-${var.stage}-form4-insider-collector-intraday"
  description         = "Déclenche le collector Form 4 par insider toutes les 2 heures pendant les heures de marché (14h-22h UTC, lundi-vendredi)"
  schedule_expression = "cron(0 14,16,18,20,22 ? * MON-FRI *)" # Toutes les 2 heures (14h, 16h, 18h, 20h, 22h UTC), lundi-vendredi
}

# EventBridge → Lambda pour le scan intraday
resource "aws_cloudwatch_event_target" "form4_insider_collector_intraday" {
  rule      = aws_cloudwatch_event_rule.form4_insider_collector_intraday.name
  target_id = "Form4InsiderCollectorIntraday"
  arn       = aws_lambda_function.form4_insider_collector.arn
}

# Permissions pour EventBridge d'invoquer la Lambda
resource "aws_lambda_permission" "form4_insider_collector_intraday_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridgeIntraday"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.form4_insider_collector.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.form4_insider_collector_intraday.arn
}
