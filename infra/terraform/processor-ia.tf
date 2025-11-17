# Lambda Processor IA pour enrichir les signaux

resource "aws_cloudwatch_log_group" "processor_ia" {
  name              = "/aws/lambda/${var.project}-${var.stage}-processor-ia"
  retention_in_days = 14
}

resource "aws_lambda_function" "processor_ia" {
  function_name = "${var.project}-${var.stage}-processor-ia"
  role          = aws_iam_role.processor_ia_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/processor-ia/processor-ia.zip"
  timeout       = 60
  memory_size   = 512

  depends_on = [aws_cloudwatch_log_group.processor_ia]

  environment {
    variables = {
      SUPABASE_URL        = var.supabase_url
      SUPABASE_SERVICE_KEY = var.supabase_service_key
      OPENAI_API_KEY      = var.openai_api_key
    }
  }
}

resource "aws_iam_role" "processor_ia_role" {
  name = "${var.project}-${var.stage}-processor-ia-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "processor_ia_logs" {
  role       = aws_iam_role.processor_ia_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_permission" "processor_ia_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.processor_ia.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.processor_ia_trigger.arn
}

resource "aws_cloudwatch_event_target" "processor_ia" {
  rule           = aws_cloudwatch_event_rule.processor_ia_trigger.name
  event_bus_name = aws_cloudwatch_event_bus.signals.name
  target_id      = "ProcessorIA"
  arn            = aws_lambda_function.processor_ia.arn

  depends_on = [
    aws_lambda_function.processor_ia,
    aws_lambda_permission.processor_ia_eventbridge,
  ]
}

