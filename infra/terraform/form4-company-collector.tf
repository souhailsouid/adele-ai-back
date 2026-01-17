# ============================================
# Form 4 Company Collector Lambda
# Collecte les Form 4 depuis les flux Atom RSS par entreprise (100 entreprises prioritaires)
# ============================================

resource "aws_cloudwatch_log_group" "form4_company_collector" {
  name              = "/aws/lambda/${var.project}-${var.stage}-form4-company-collector"
  retention_in_days = 14
}

resource "aws_lambda_function" "form4_company_collector" {
  function_name = "${var.project}-${var.stage}-form4-company-collector"
  role          = aws_iam_role.collector_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/form4-company-collector/form4-company-collector.zip"
  source_code_hash = filebase64sha256("${path.module}/../../workers/form4-company-collector/form4-company-collector.zip")
  timeout       = 300  # 5 minutes (100 entreprises × 2-3 secondes chacune)
  memory_size   = 1024 # 1GB pour gérer 100 entreprises

  depends_on = [aws_cloudwatch_log_group.form4_company_collector]

  environment {
    variables = {
      FORM4_PARSER_QUEUE_URL = aws_sqs_queue.form4_parser_queue.url
    }
  }
}

# Cron: Scan intraday (toutes les 30 min pendant les heures de marché)
# Wall Street: 14h-22h UTC (9h30-17h30 EST), lundi-vendredi
resource "aws_cloudwatch_event_rule" "form4_company_collector_intraday" {
  name                = "${var.project}-${var.stage}-form4-company-collector-intraday"
  description         = "Déclenche le collector Form 4 par entreprise toutes les 30 min pendant les heures de marché (14h-22h UTC, lundi-vendredi)"
  schedule_expression = "cron(0/30 14-22 ? * MON-FRI *)" # Toutes les 30 min entre 14h et 22h UTC, lundi-vendredi
}

# EventBridge → Lambda pour le scan intraday
resource "aws_cloudwatch_event_target" "form4_company_collector_intraday" {
  rule      = aws_cloudwatch_event_rule.form4_company_collector_intraday.name
  target_id = "Form4CompanyCollectorIntraday"
  arn       = aws_lambda_function.form4_company_collector.arn
}

# Permissions pour EventBridge d'invoquer la Lambda
resource "aws_lambda_permission" "form4_company_collector_intraday_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridgeIntraday"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.form4_company_collector.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.form4_company_collector_intraday.arn
}
