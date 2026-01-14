# ============================================
# Lambdas Séparées par Type de Route
# ============================================

# ============================================
# Lambda 1: API Fast (Routes rapides < 10s)
# ============================================
resource "aws_cloudwatch_log_group" "api_fast" {
  name              = "/aws/lambda/${var.project}-${var.stage}-api-fast"
  retention_in_days = 14
}

resource "aws_lambda_function" "api_fast" {
  function_name    = "${var.project}-${var.stage}-api-fast"
  role             = aws_iam_role.api_lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "handlers/api-fast.handler"
  filename         = "${path.module}/../../services/api/api.zip"
  source_code_hash = filebase64sha256("${path.module}/../../services/api/api.zip")
  timeout          = 10  # 10s pour routes rapides
  memory_size      = 256 # Moins de mémoire = moins cher

  depends_on = [aws_cloudwatch_log_group.api_fast]

  environment {
    variables = {
      SUPABASE_URL           = var.supabase_url
      SUPABASE_SERVICE_KEY   = var.supabase_service_key
      COGNITO_ISSUER         = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
      COGNITO_AUDIENCE       = aws_cognito_user_pool_client.web.id
      EVENT_BUS_NAME         = "${var.project}-${var.stage}-signals"
      OPENAI_API_KEY         = var.openai_api_key
      UNUSUAL_WHALES_API_KEY = var.unusual_whales_api_key
      FMP_API_KEY            = var.fmp_api_key
      NEO4J_URI              = var.neo4j_uri
      NEO4J_USERNAME         = var.neo4j_username
      NEO4J_PASSWORD         = var.neo4j_password
      NEO4J_DATABASE         = var.neo4j_database
    }
  }
}

# Permission pour API Gateway
resource "aws_lambda_permission" "api_fast_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_fast.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ============================================
# Lambda 2: API AI Heavy (Routes lourdes 15-30s)
# ============================================
resource "aws_cloudwatch_log_group" "api_ai_heavy" {
  name              = "/aws/lambda/${var.project}-${var.stage}-api-ai-heavy"
  retention_in_days = 14
}

resource "aws_lambda_function" "api_ai_heavy" {
  function_name    = "${var.project}-${var.stage}-api-ai-heavy"
  role             = aws_iam_role.api_lambda_role.arn
  runtime          = "nodejs20.x"
  handler          = "handlers/api-ai-heavy.handler"
  filename         = "${path.module}/../../services/api/api.zip"
  source_code_hash = filebase64sha256("${path.module}/../../services/api/api.zip")
  timeout          = 30   # 30s pour routes lourdes
  memory_size      = 1024 # Plus de mémoire = CPU plus rapide

  depends_on = [aws_cloudwatch_log_group.api_ai_heavy]

  environment {
    variables = {
      SUPABASE_URL           = var.supabase_url
      SUPABASE_SERVICE_KEY   = var.supabase_service_key
      COGNITO_ISSUER         = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
      COGNITO_AUDIENCE       = aws_cognito_user_pool_client.web.id
      EVENT_BUS_NAME         = "${var.project}-${var.stage}-signals"
      OPENAI_API_KEY         = var.openai_api_key
      UNUSUAL_WHALES_API_KEY = var.unusual_whales_api_key
      FMP_API_KEY            = var.fmp_api_key
      NEO4J_URI              = var.neo4j_uri
      NEO4J_USERNAME         = var.neo4j_username
      NEO4J_PASSWORD         = var.neo4j_password
      NEO4J_DATABASE         = var.neo4j_database
    }
  }
}

# Permission pour API Gateway
resource "aws_lambda_permission" "api_ai_heavy_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_ai_heavy.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

# ============================================
# Intégrations API Gateway
# ============================================

# Intégration pour routes rapides
resource "aws_apigatewayv2_integration" "api_fast" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api_fast.invoke_arn
  payload_format_version = "2.0"
  depends_on             = [aws_lambda_permission.api_fast_invoke]
}

# Intégration pour routes lourdes
resource "aws_apigatewayv2_integration" "api_ai_heavy" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api_ai_heavy.invoke_arn
  payload_format_version = "2.0"
  depends_on             = [aws_lambda_permission.api_ai_heavy_invoke]
}

# ============================================
# Routes API Gateway (à configurer dans api.tf)
# ============================================
# Note: Les routes doivent être configurées dans api.tf pour router vers la bonne Lambda
# Exemple:
# - POST /ai/ticker-institutional-analysis -> api_fast
# - POST /ai/institution-moves-analysis -> api_ai_heavy





