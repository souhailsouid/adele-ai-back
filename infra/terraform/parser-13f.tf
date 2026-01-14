# Lambda Python pour parser les fichiers 13F EDGAR

# CloudWatch logs
resource "aws_cloudwatch_log_group" "parser_13f" {
  name              = "/aws/lambda/${var.project}-${var.stage}-parser-13f"
  retention_in_days = 14
}

# Lambda Function (Python)
resource "aws_lambda_function" "parser_13f" {
  function_name    = "${var.project}-${var.stage}-parser-13f"
  role             = aws_iam_role.parser_13f_role.arn
  runtime          = "python3.11"
  handler          = "index.handler"
  filename         = "${path.module}/../../workers/parser-13f.zip"
  source_code_hash = filebase64sha256("${path.module}/../../workers/parser-13f.zip")
  timeout          = 900 # 15 minutes pour parsing (fichiers volumineux comme BlackRock)
  # Si timeout, SQS remet le message dans la file pour retry automatique
  memory_size = 1769 # 1769MB = max CPU pour parsing XML lourd (5-10x plus rapide que 512MB)

  depends_on = [aws_cloudwatch_log_group.parser_13f]

  environment {
    variables = {
      SUPABASE_URL         = var.supabase_url
      SUPABASE_SERVICE_KEY = var.supabase_service_key
    }
  }

  # ✅ GESTION DE LA CONCURRENCE :
  # Reserved concurrency = 5 pour éviter que cette Lambda lente (60-120s) bloque tout le pool
  # ⚠️ TEMPORAIREMENT DÉSACTIVÉ : La limite de compte est encore à 10
  # Une fois la limite augmentée à 1000 (via AWS Console ou script), décommenter :
  # reserved_concurrent_executions = 5
}

# IAM Role
resource "aws_iam_role" "parser_13f_role" {
  name = "${var.project}-${var.stage}-parser-13f-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Permission SQS pour parser-13f
resource "aws_iam_role_policy" "parser_13f_sqs" {
  name = "${var.project}-${var.stage}-parser-13f-sqs"
  role = aws_iam_role.parser_13f_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = aws_sqs_queue.parser_13f_queue.arn
      }
    ]
  })
}

# Logs
resource "aws_iam_role_policy_attachment" "parser_13f_logs" {
  role       = aws_iam_role.parser_13f_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Permission SQS (plus besoin de permission EventBridge directe)
# La permission est gérée par aws_lambda_event_source_mapping

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

# Target: SQS Queue (au lieu de Lambda directement)
# EventBridge → SQS → Lambda (lisse les pics, gère les retries)
resource "aws_cloudwatch_event_target" "parser_13f" {
  rule           = aws_cloudwatch_event_rule.parser_13f_trigger.name
  event_bus_name = aws_cloudwatch_event_bus.signals.name
  target_id      = "Parser13F"
  arn            = aws_sqs_queue.parser_13f_queue.arn
}

# Lambda consomme depuis SQS
resource "aws_lambda_event_source_mapping" "parser_13f_sqs" {
  event_source_arn = aws_sqs_queue.parser_13f_queue.arn
  function_name    = aws_lambda_function.parser_13f.arn
  batch_size       = 1 # Traiter 1 message à la fois (parsing lourd)
  enabled          = true

  # Si la Lambda expire (15 min), le message retourne dans la file pour retry
  maximum_batching_window_in_seconds = 0
}

