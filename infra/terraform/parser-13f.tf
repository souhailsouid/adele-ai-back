# Lambda Python pour parser les fichiers 13F EDGAR

# CloudWatch logs
resource "aws_cloudwatch_log_group" "parser_13f" {
  name              = "/aws/lambda/${var.project}-${var.stage}-parser-13f"
  retention_in_days = 14
}

# Lambda Function (Python)
resource "aws_lambda_function" "parser_13f" {
  function_name = "${var.project}-${var.stage}-parser-13f"
  role          = aws_iam_role.parser_13f_role.arn
  runtime       = "python3.11"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/parser-13f.zip"
  timeout       = 300  # 5 minutes pour parsing
  memory_size   = 512

  depends_on = [aws_cloudwatch_log_group.parser_13f]

  environment {
    variables = {
      SUPABASE_URL        = var.supabase_url
      SUPABASE_SERVICE_KEY = var.supabase_service_key
    }
  }
}

# IAM Role
resource "aws_iam_role" "parser_13f_role" {
  name = "${var.project}-${var.stage}-parser-13f-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

# Logs
resource "aws_iam_role_policy_attachment" "parser_13f_logs" {
  role       = aws_iam_role.parser_13f_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Permission EventBridge
resource "aws_lambda_permission" "parser_13f_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.parser_13f.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.parser_13f_trigger.arn
}

# EventBridge Rule pour déclencher le parser
resource "aws_cloudwatch_event_rule" "parser_13f_trigger" {
  name           = "${var.project}-${var.stage}-parser-13f-trigger"
  event_bus_name = aws_cloudwatch_event_bus.signals.name
  description    = "Déclenche le parser 13F quand un nouveau filing est découvert"

  event_pattern = jsonencode({
    source      = ["adel.signals"]
    detail-type = ["13F Discovered"]
  })
}

# Target: Lambda parser
resource "aws_cloudwatch_event_target" "parser_13f" {
  rule           = aws_cloudwatch_event_rule.parser_13f_trigger.name
  event_bus_name = aws_cloudwatch_event_bus.signals.name
  target_id      = "Parser13F"
  arn            = aws_lambda_function.parser_13f.arn

  depends_on = [
    aws_lambda_function.parser_13f,
    aws_lambda_permission.parser_13f_eventbridge,
  ]
}

