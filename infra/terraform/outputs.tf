output "cognito_user_pool_id"     { value = aws_cognito_user_pool.this.id }
output "cognito_user_pool_client" { value = aws_cognito_user_pool_client.web.id }
output "cognito_domain"           { value = aws_cognito_user_pool_domain.this.domain }
output "cognito_issuer_url" {
  value = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
  description = "URL de l'issuer Cognito pour la validation JWT"
}
output "cognito_domain_url" {
  value = "https://${aws_cognito_user_pool_domain.this.domain}.auth.${var.region}.amazoncognito.com"
  description = "URL du domaine Cognito pour OAuth (frontend)"
}
output "api_gateway_url" {
  value = aws_apigatewayv2_stage.prod.invoke_url
  description = "URL de l'API Gateway"
}
output "api_gateway_id" {
  value = aws_apigatewayv2_api.http.id
  description = "ID de l'API Gateway"
}
output "region" {
  value = var.region
  description = "Région AWS utilisée"
}
output "supabase_url" {
  value = var.supabase_url
  description = "URL Supabase"
}
