# CloudWatch logs pour API GW
resource "aws_cloudwatch_log_group" "api_gw" {
  name              = "/aws/apigw/${var.project}-${var.stage}"
  retention_in_days = 14
}

# CloudWatch logs pour Lambda API
resource "aws_cloudwatch_log_group" "api_lambda" {
  name              = "/aws/lambda/${var.project}-${var.stage}-api"
  retention_in_days = 14
}

# API HTTP
resource "aws_apigatewayv2_api" "http" {
  name          = "${var.project}-${var.stage}-http"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = var.frontend_allowed_origins
    allow_methods = ["GET","POST","PATCH","OPTIONS"]
    allow_headers = ["authorization","content-type"]
    expose_headers = ["*"]
    max_age = 600
  }
}

# Lambda (ton zip sera buildé côté /services/api)
resource "aws_lambda_function" "api" {
  function_name = "${var.project}-${var.stage}-api"
  role          = aws_iam_role.api_lambda_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../services/api/api.zip"  # ← produit par npm run bundle
  timeout       = 10
  memory_size   = 512
  
  depends_on = [aws_cloudwatch_log_group.api_lambda]
  
  environment {
    variables = {
      SUPABASE_URL        = var.supabase_url
      SUPABASE_SERVICE_KEY = var.supabase_service_key
      COGNITO_ISSUER      = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
      COGNITO_AUDIENCE    = aws_cognito_user_pool_client.web.id
      EVENT_BUS_NAME      = "${var.project}-${var.stage}-signals"
      OPENAI_API_KEY      = var.openai_api_key
    }
  }
}

# Integration Lambda proxy
resource "aws_apigatewayv2_integration" "api_lambda" {
  api_id                 = aws_apigatewayv2_api.http.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.arn
  payload_format_version = "2.0"
}

# Authorizer JWT (Cognito)
resource "aws_apigatewayv2_authorizer" "jwt" {
  name             = "${var.project}-${var.stage}-cognito"
  api_id           = aws_apigatewayv2_api.http.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  jwt_configuration {
    audience = [aws_cognito_user_pool_client.web.id]
    issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
  }
}

# Routes ADEL AI
resource "aws_apigatewayv2_route" "get_signals" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /signals"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_apigatewayv2_route" "get_signal" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /signals/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_apigatewayv2_route" "post_signals" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /signals"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_apigatewayv2_route" "post_search" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /search"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_apigatewayv2_route" "post_chat" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /chat"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# Routes Funds
resource "aws_apigatewayv2_route" "post_funds" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /funds"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_apigatewayv2_route" "get_funds" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /funds"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_apigatewayv2_route" "get_fund" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /funds/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_apigatewayv2_route" "get_fund_holdings" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /funds/{id}/holdings"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

resource "aws_apigatewayv2_route" "get_fund_filings" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /funds/{id}/filings"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# Stage prod
resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.http.id
  name        = "prod"
  auto_deploy = true
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gw.arn
    format = jsonencode({
      requestId = "$context.requestId",
      routeKey  = "$context.routeKey",
      status    = "$context.status"
    })
  }
}

# Autoriser API GW à invoquer la Lambda
resource "aws_lambda_permission" "api_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http.execution_arn}/*/*"
}

