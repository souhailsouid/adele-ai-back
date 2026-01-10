# ========== API Gateway 2 : Données brutes (FMP + UW) ==========
# Cette API Gateway est dédiée aux routes de données brutes pour éviter
# de dépasser la limite de 300 routes par API Gateway

# CloudWatch logs pour API GW Data
resource "aws_cloudwatch_log_group" "api_data_gw" {
  name              = "/aws/apigw/${var.project}-${var.stage}-data"
  retention_in_days = 14
}

# API HTTP pour les données brutes (FMP + UW + Funds)
resource "aws_apigatewayv2_api" "http_data" {
  name          = "${var.project}-${var.stage}-http-data-raw"
  description   = "API Gateway pour les routes de données brutes (FMP, Unusual Whales, Funds)"
  protocol_type = "HTTP"
  cors_configuration {
    # CORS: autoriser toutes les origines (Swagger, localhost, etc.)
    # Si tu veux restreindre plus tard, remets var.frontend_allowed_origins ici.
    allow_origins  = ["*"]
    allow_methods  = ["GET", "POST", "PATCH", "OPTIONS"]
    allow_headers  = ["authorization", "content-type"]
    expose_headers = ["*"]
    max_age        = 600
  }
}

# Integration Lambda proxy pour l'API Data
resource "aws_apigatewayv2_integration" "api_data_lambda" {
  api_id                 = aws_apigatewayv2_api.http_data.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.arn
  payload_format_version = "2.0"
  # API Gateway v2 limite max: 30000ms (30s). La Lambda a 60s pour gérer les endpoints lourds.
  # Si la Lambda prend > 30s, l'API Gateway retournera 504, mais la Lambda continuera.
  timeout_milliseconds   = 30000

  depends_on = [aws_lambda_permission.api_data_invoke]
}

# Authorizer JWT (Cognito) pour l'API Data
resource "aws_apigatewayv2_authorizer" "jwt_data" {
  name             = "${var.project}-${var.stage}-cognito-data"
  api_id           = aws_apigatewayv2_api.http_data.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
  }
}

# Stage prod pour l'API Data
resource "aws_apigatewayv2_stage" "prod_data" {
  api_id      = aws_apigatewayv2_api.http_data.id
  name        = "prod"
  auto_deploy = true
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_data_gw.arn
    format = jsonencode({
      requestId = "$context.requestId",
      routeKey  = "$context.routeKey",
      status    = "$context.status",
      error     = "$context.integrationErrorMessage",
      authError = "$context.authorizer.error"
    })
  }
}

# Autoriser API GW Data à invoquer la Lambda
resource "aws_lambda_permission" "api_data_invoke" {
  statement_id  = "AllowAPIGatewayDataInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_data.execution_arn}/*/*"

  lifecycle {
    create_before_destroy = true
  }
}

