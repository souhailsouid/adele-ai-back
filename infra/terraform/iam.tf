# IAM Role pour Lambda API
resource "aws_iam_role" "api_lambda_role" {
  name = "${var.project}-${var.stage}-api-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
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

# ============================================
# Permissions Athena & S3 (Extreme Budget Architecture)
# ============================================

# Policy pour Athena
data "aws_iam_policy_document" "api_athena" {
  statement {
    actions = [
      "athena:StartQueryExecution",
      "athena:GetQueryExecution",
      "athena:GetQueryResults",
      "athena:StopQueryExecution",
      "athena:GetWorkGroup",
    ]
    resources = [
      "arn:aws:athena:${var.region}:*:workgroup/${var.project}-${var.stage}-workgroup",
      "arn:aws:athena:${var.region}:*:datacatalog/*",
    ]
  }

  statement {
    actions = [
      "glue:GetDatabase",
      "glue:GetTable",
      "glue:GetPartitions",
    ]
    resources = [
      "arn:aws:glue:${var.region}:*:catalog",
      "arn:aws:glue:${var.region}:*:database/${replace("${var.project}_${var.stage}", "-", "_")}",
      "arn:aws:glue:${var.region}:*:table/${replace("${var.project}_${var.stage}", "-", "_")}/*",
    ]
  }
}

resource "aws_iam_policy" "api_athena_policy" {
  name   = "${var.project}-${var.stage}-api-athena"
  policy = data.aws_iam_policy_document.api_athena.json
}

resource "aws_iam_role_policy_attachment" "api_athena_attach" {
  role       = aws_iam_role.api_lambda_role.name
  policy_arn = aws_iam_policy.api_athena_policy.arn
}

# Policy pour S3 Data Lake et Athena Results
data "aws_iam_policy_document" "api_s3" {
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:ListBucket",
      "s3:DeleteObject",
      "s3:GetBucketLocation",
      "s3:GetBucketAcl",
    ]
    resources = [
      "arn:aws:s3:::${var.project}-${var.stage}-data-lake",
      "arn:aws:s3:::${var.project}-${var.stage}-data-lake/*",
      "arn:aws:s3:::${var.project}-${var.stage}-athena-results",
      "arn:aws:s3:::${var.project}-${var.stage}-athena-results/*",
    ]
  }
}

resource "aws_iam_policy" "api_s3_policy" {
  name   = "${var.project}-${var.stage}-api-s3"
  policy = data.aws_iam_policy_document.api_s3.json
}

resource "aws_iam_role_policy_attachment" "api_s3_attach" {
  role       = aws_iam_role.api_lambda_role.name
  policy_arn = aws_iam_policy.api_s3_policy.arn
}
