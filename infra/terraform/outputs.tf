output "cognito_user_pool_id" { value = aws_cognito_user_pool.this.id }
output "cognito_user_pool_client" { value = aws_cognito_user_pool_client.web.id }
output "cognito_domain" { value = aws_cognito_user_pool_domain.this.domain }
output "cognito_issuer_url" {
  value       = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.this.id}"
  description = "URL de l'issuer Cognito pour la validation JWT"
}
output "cognito_domain_url" {
  value       = "https://${aws_cognito_user_pool_domain.this.domain}.auth.${var.region}.amazoncognito.com"
  description = "URL du domaine Cognito pour OAuth (frontend)"
}
# API Gateway 1 : Application principale (routes métier)
output "api_gateway_url" {
  value       = aws_apigatewayv2_stage.prod.invoke_url
  description = "URL de l'API Gateway principale (application)"
}
output "api_gateway_id" {
  value       = aws_apigatewayv2_api.http.id
  description = "ID de l'API Gateway principale"
}

# API Gateway 2 : Données brutes (FMP + UW + Funds)
output "api_data_gateway_url" {
  value       = aws_apigatewayv2_stage.prod_data.invoke_url
  description = "URL de l'API Gateway pour les données brutes (FMP + UW + Funds)"
}
output "api_data_gateway_id" {
  value       = aws_apigatewayv2_api.http_data.id
  description = "ID de l'API Gateway pour les données brutes (FMP + UW + Funds)"
}

# API Gateway 3 : Routes Funds - SUPPRIMÉ
# Les routes Funds sont maintenant sur l'API Gateway 2 (http_data)
# output "api_funds_gateway_url" {
#   value       = aws_apigatewayv2_stage.prod_funds.invoke_url
#   description = "URL de l'API Gateway 3 pour les routes Funds (isolation de charge)"
# }
# output "api_funds_gateway_id" {
#   value       = aws_apigatewayv2_api.http_funds.id
#   description = "ID de l'API Gateway 3 pour les routes Funds"
# }
output "region" {
  value       = var.region
  description = "Région AWS utilisée"
}
output "supabase_url" {
  value       = var.supabase_url
  description = "URL Supabase"
}

output "unusual_whales_api_url" {
  value       = "https://api.unusualwhales.com/api"
  description = "URL de base de l'API Unusual Whales"
}

output "fmp_api_url" {
  value       = "https://financialmodelingprep.com/stable"
  description = "URL de base de l'API Financial Modeling Prep"
}


output "collector_rss_url" {
  value       = aws_lambda_function.collector_rss.function_name
  description = "Nom de la Lambda collector RSS"
}