# ========== API Gateway 3 : Routes Funds - SUPPRIMÉ ==========
# Les routes Funds ont été migrées vers l'API Gateway 2 (http_data)
# et utilisent la Lambda api principale au lieu d'une Lambda dédiée
#
# Ce fichier est commenté pour permettre la suppression via Terraform
# Une fois supprimé, ce fichier peut être supprimé du repo

# # CloudWatch logs pour API GW Funds
# resource "aws_cloudwatch_log_group" "api_funds_gw" {
#   name              = "/aws/apigw/${var.project}-${var.stage}-funds"
#   retention_in_days = 14
# }

# # API HTTP pour les routes Funds (API Gateway 3)
# resource "aws_apigatewayv2_api" "http_funds" {
#   name          = "${var.project}-${var.stage}-http-funds"
#   description   = "API Gateway 3 pour les routes Funds (isolation de charge)"
#   protocol_type = "HTTP"
#   cors_configuration {
#     allow_origins  = ["*"]
#     allow_methods  = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
#     allow_headers  = ["authorization", "content-type"]
#     expose_headers = ["*"]
#     max_age        = 600
#   }
# }

# # Lambda séparée pour les routes Funds
# resource "aws_lambda_function" "api_funds" {
#   function_name    = "${var.project}-${var.stage}-api-funds"
#   role             = aws_iam_role.api_lambda_role.arn
#   runtime          = "nodejs20.x"
#   handler          = "handlers/api-funds.handler"
#   filename         = "${path.module}/../../services/api/api.zip"
#   source_code_hash = filebase64sha256("${path.module}/../../services/api/api.zip")
#   timeout          = 60
#   memory_size      = 512

#   depends_on = [aws_cloudwatch_log_group.api_funds_lambda]

#   environment {
#     variables = {
#       SUPABASE_URL           = var.supabase_url
#       SUPABASE_SERVICE_KEY   = var.supabase_service_key
#       COGNITO_ISSUER         = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
#       COGNITO_AUDIENCE       = aws_cognito_user_pool_client.web.id
#       EVENT_BUS_NAME         = "${var.project}-${var.stage}-signals"
#     }
#   }
# }

# # CloudWatch logs pour Lambda Funds
# resource "aws_cloudwatch_log_group" "api_funds_lambda" {
#   name              = "/aws/lambda/${var.project}-${var.stage}-api-funds"
#   retention_in_days = 14
# }

# # Integration Lambda proxy pour l'API Funds
# resource "aws_apigatewayv2_integration" "api_funds_lambda" {
#   api_id                 = aws_apigatewayv2_api.http_funds.id
#   integration_type       = "AWS_PROXY"
#   integration_uri        = aws_lambda_function.api_funds.invoke_arn
#   payload_format_version = "2.0"

#   depends_on = [aws_lambda_permission.api_funds_invoke]
# }

# # Authorizer JWT (Cognito) pour l'API Funds
# resource "aws_apigatewayv2_authorizer" "jwt_funds" {
#   name             = "${var.project}-${var.stage}-cognito-funds"
#   api_id           = aws_apigatewayv2_api.http_funds.id
#   authorizer_type  = "JWT"
#   identity_sources = ["$request.header.Authorization"]
#   jwt_configuration {
#     audience = [aws_cognito_user_pool_client.web.id]
#     issuer   = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
#   }
# }

# # Stage prod pour l'API Funds
# resource "aws_apigatewayv2_stage" "prod_funds" {
#   api_id      = aws_apigatewayv2_api.http_funds.id
#   name        = "prod"
#   auto_deploy = true
#   access_log_settings {
#     destination_arn = aws_cloudwatch_log_group.api_funds_gw.arn
#     format = jsonencode({
#       requestId = "$context.requestId",
#       routeKey  = "$context.routeKey",
#       status    = "$context.status",
#       error     = "$context.integrationErrorMessage",
#       authError = "$context.authorizer.error"
#     })
#   }
# }

# # Autoriser API GW Funds à invoquer la Lambda
# resource "aws_lambda_permission" "api_funds_invoke" {
#   statement_id  = "AllowAPIGatewayFundsInvoke"
#   action        = "lambda:InvokeFunction"
#   function_name = aws_lambda_function.api_funds.function_name
#   principal     = "apigateway.amazonaws.com"
#   source_arn    = "${aws_apigatewayv2_api.http_funds.execution_arn}/*/*"

#   lifecycle {
#     create_before_destroy = true
#   }
# }
