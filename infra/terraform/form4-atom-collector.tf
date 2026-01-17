# ============================================
# Form 4 Atom Collector Lambda
# Récupère les Form 4 depuis le flux Atom SEC (plus efficace que scanner toutes les entreprises)
# ============================================

resource "aws_cloudwatch_log_group" "form4_atom_collector" {
  name              = "/aws/lambda/${var.project}-${var.stage}-form4-atom-collector"
  retention_in_days = 14
}

resource "aws_lambda_function" "form4_atom_collector" {
  function_name = "${var.project}-${var.stage}-form4-atom-collector"
  role          = aws_iam_role.collector_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/form4-atom-collector/form4-atom-collector.zip"
  source_code_hash = filebase64sha256("${path.module}/../../workers/form4-atom-collector/form4-atom-collector.zip")
  timeout       = 60  # 1 minute (suffisant pour récupérer le flux Atom)
  memory_size   = 512 # 512MB suffisant pour parsing Atom

  depends_on = [aws_cloudwatch_log_group.form4_atom_collector]

  environment {
    variables = {
      FORM4_PARSER_QUEUE_URL = aws_sqs_queue.form4_parser_queue.url
    }
  }
}

# Cron 1: Run du matin (5h15 UTC) - Récap de la journée passée avec count=1000
resource "aws_cloudwatch_event_rule" "form4_atom_collector_morning" {
  name                = "${var.project}-${var.stage}-form4-atom-collector-morning"
  description         = "Déclenche le collector Form 4 Atom chaque jour à 5h15 UTC (récap avec count=1000)"
  schedule_expression = "cron(15 5 * * ? *)" # 5h15 UTC tous les jours
}

# Cron 2: Scan intraday (toutes les 30 min pendant les heures de marché)
# Wall Street: 14h-22h UTC (9h30-17h30 EST), lundi-vendredi
resource "aws_cloudwatch_event_rule" "form4_atom_collector_intraday" {
  name                = "${var.project}-${var.stage}-form4-atom-collector-intraday"
  description         = "Déclenche le collector Form 4 Atom toutes les 30 min pendant les heures de marché (14h-22h UTC, lundi-vendredi)"
  schedule_expression = "cron(0/30 14-22 ? * MON-FRI *)" # Toutes les 30 min entre 14h et 22h UTC, lundi-vendredi
}

# EventBridge → Lambda pour le run du matin
resource "aws_cloudwatch_event_target" "form4_atom_collector_morning" {
  rule      = aws_cloudwatch_event_rule.form4_atom_collector_morning.name
  target_id = "Form4AtomCollectorMorning"
  arn       = aws_lambda_function.form4_atom_collector.arn
}

# EventBridge → Lambda pour le scan intraday
resource "aws_cloudwatch_event_target" "form4_atom_collector_intraday" {
  rule      = aws_cloudwatch_event_rule.form4_atom_collector_intraday.name
  target_id = "Form4AtomCollectorIntraday"
  arn       = aws_lambda_function.form4_atom_collector.arn
}

# Permissions pour EventBridge d'invoquer la Lambda
resource "aws_lambda_permission" "form4_atom_collector_morning_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridgeMorning"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.form4_atom_collector.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.form4_atom_collector_morning.arn
}

resource "aws_lambda_permission" "form4_atom_collector_intraday_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridgeIntraday"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.form4_atom_collector.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.form4_atom_collector_intraday.arn
}
