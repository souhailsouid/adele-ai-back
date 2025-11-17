# IAM Role pour Lambda API
resource "aws_iam_role" "api_lambda_role" {
  name = "${var.project}-${var.stage}-api-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

# Logs pour API Lambda
resource "aws_iam_role_policy_attachment" "api_logs_attach" {
  role       = aws_iam_role.api_lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Permission EventBridge pour l'API Lambda
data "aws_iam_policy_document" "api_eventbridge" {
  statement {
    actions = [
      "events:PutEvents",
    ]
    resources = [
      "arn:aws:events:${var.region}:*:event-bus/${var.project}-${var.stage}-signals",
    ]
  }
}

resource "aws_iam_policy" "api_eventbridge_policy" {
  name   = "${var.project}-${var.stage}-api-eventbridge"
  policy = data.aws_iam_policy_document.api_eventbridge.json
}

resource "aws_iam_role_policy_attachment" "api_eventbridge_attach" {
  role       = aws_iam_role.api_lambda_role.name
  policy_arn = aws_iam_policy.api_eventbridge_policy.arn
}
