# Lambda Python pour parser les filings SEC des entreprises (8-K, Form 4, etc.)

# CloudWatch logs
resource "aws_cloudwatch_log_group" "parser_company_filing" {
  name              = "/aws/lambda/${var.project}-${var.stage}-parser-company-filing"
  retention_in_days = 14
}

# Lambda Function (Python)
resource "aws_lambda_function" "parser_company_filing" {
  function_name = "${var.project}-${var.stage}-parser-company-filing"
  role          = aws_iam_role.parser_company_filing_role.arn
  runtime       = "python3.11"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/parser-company-filing.zip"
  timeout       = 300 # 5 minutes pour parsing
  memory_size   = 512

  depends_on = [aws_cloudwatch_log_group.parser_company_filing]

  environment {
    variables = {
      SUPABASE_URL         = var.supabase_url
      SUPABASE_SERVICE_KEY = var.supabase_service_key
    }
  }
}

# IAM Role
resource "aws_iam_role" "parser_company_filing_role" {
  name = "${var.project}-${var.stage}-parser-company-filing-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Logs
resource "aws_iam_role_policy_attachment" "parser_company_filing_logs" {
  role       = aws_iam_role.parser_company_filing_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Permission EventBridge
resource "aws_lambda_permission" "parser_company_filing_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.parser_company_filing.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.parser_company_filing_trigger.arn
}

# EventBridge Rule pour déclencher le parser
resource "aws_cloudwatch_event_rule" "parser_company_filing_trigger" {
  name           = "${var.project}-${var.stage}-parser-company-filing-trigger"
  event_bus_name = aws_cloudwatch_event_bus.signals.name
  description    = "Déclenche le parser company filing quand un nouveau filing est découvert"

  event_pattern = jsonencode({
    source      = ["adel.signals"]
    detail-type = ["Company Filing Discovered"]
  })
}

# Target: Lambda parser
resource "aws_cloudwatch_event_target" "parser_company_filing" {
  rule           = aws_cloudwatch_event_rule.parser_company_filing_trigger.name
  event_bus_name = aws_cloudwatch_event_bus.signals.name
  target_id      = "ParserCompanyFiling"
  arn            = aws_lambda_function.parser_company_filing.arn

  depends_on = [
    aws_lambda_function.parser_company_filing,
    aws_lambda_permission.parser_company_filing_eventbridge,
  ]
}







