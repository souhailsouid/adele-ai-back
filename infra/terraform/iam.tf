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

# ============================================
# Permissions pour le monitoring AWS (Dashboard Admin)
# ============================================

# Policy pour Lambda monitoring
data "aws_iam_policy_document" "api_lambda_monitoring" {
  statement {
    actions = [
      "lambda:ListFunctions",
      "lambda:GetFunction",
      "lambda:GetFunctionConcurrency",
    ]
    resources = [
      "arn:aws:lambda:${var.region}:*:function:${var.project}-${var.stage}-*",
    ]
  }
}

resource "aws_iam_policy" "api_lambda_monitoring_policy" {
  name   = "${var.project}-${var.stage}-api-lambda-monitoring"
  policy = data.aws_iam_policy_document.api_lambda_monitoring.json
}

resource "aws_iam_role_policy_attachment" "api_lambda_monitoring_attach" {
  role       = aws_iam_role.api_lambda_role.name
  policy_arn = aws_iam_policy.api_lambda_monitoring_policy.arn
}

# Policy pour SQS monitoring
data "aws_iam_policy_document" "api_sqs_monitoring" {
  statement {
    actions = [
      "sqs:ListQueues",
      "sqs:GetQueueAttributes",
      "sqs:ReceiveMessage",
    ]
    resources = [
      "arn:aws:sqs:${var.region}:*:${var.project}-${var.stage}-*",
    ]
  }
}

resource "aws_iam_policy" "api_sqs_monitoring_policy" {
  name   = "${var.project}-${var.stage}-api-sqs-monitoring"
  policy = data.aws_iam_policy_document.api_sqs_monitoring.json
}

resource "aws_iam_role_policy_attachment" "api_sqs_monitoring_attach" {
  role       = aws_iam_role.api_lambda_role.name
  policy_arn = aws_iam_policy.api_sqs_monitoring_policy.arn
}

# Policy pour CloudWatch monitoring
data "aws_iam_policy_document" "api_cloudwatch_monitoring" {
  statement {
    actions = [
      "cloudwatch:GetMetricStatistics",
      "cloudwatch:ListMetrics",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "api_cloudwatch_monitoring_policy" {
  name   = "${var.project}-${var.stage}-api-cloudwatch-monitoring"
  policy = data.aws_iam_policy_document.api_cloudwatch_monitoring.json
}

resource "aws_iam_role_policy_attachment" "api_cloudwatch_monitoring_attach" {
  role       = aws_iam_role.api_lambda_role.name
  policy_arn = aws_iam_policy.api_cloudwatch_monitoring_policy.arn
}

# Policy pour Athena monitoring (ajouter GetWorkGroup)
data "aws_iam_policy_document" "api_athena_monitoring" {
  statement {
    actions = [
      "athena:GetWorkGroup",
      "athena:ListWorkGroups",
    ]
    resources = [
      "arn:aws:athena:${var.region}:*:workgroup/${var.project}-${var.stage}-workgroup",
    ]
  }
}

resource "aws_iam_policy" "api_athena_monitoring_policy" {
  name   = "${var.project}-${var.stage}-api-athena-monitoring"
  policy = data.aws_iam_policy_document.api_athena_monitoring.json
}

resource "aws_iam_role_policy_attachment" "api_athena_monitoring_attach" {
  role       = aws_iam_role.api_lambda_role.name
  policy_arn = aws_iam_policy.api_athena_monitoring_policy.arn
}

# Policy pour Budgets monitoring
data "aws_iam_policy_document" "api_budgets_monitoring" {
  statement {
    actions = [
      "budgets:DescribeBudget",
      "budgets:DescribeBudgets",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "api_budgets_monitoring_policy" {
  name   = "${var.project}-${var.stage}-api-budgets-monitoring"
  policy = data.aws_iam_policy_document.api_budgets_monitoring.json
}

resource "aws_iam_role_policy_attachment" "api_budgets_monitoring_attach" {
  role       = aws_iam_role.api_lambda_role.name
  policy_arn = aws_iam_policy.api_budgets_monitoring_policy.arn
}
