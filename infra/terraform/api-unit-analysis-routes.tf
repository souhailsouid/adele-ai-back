# Routes d'analyses unitaires
# Architecture modulaire : Couche B - Une analyse = un module
# Ces routes lisent les données en base, exécutent une analyse (LLM ou règles),
# écrivent un résultat structuré en base

# ============================================
# Routes d'analyse individuelles
# ============================================

# POST /analyze/options-flow?ticker=NVDA
# Analyser le module options_flow (analyse unitaire + IA)
resource "aws_apigatewayv2_route" "post_analyze_options_flow" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /analyze/options-flow"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# POST /analyze/dark-pool?ticker=NVDA
# Analyser le module dark_pool
resource "aws_apigatewayv2_route" "post_analyze_dark_pool" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /analyze/dark-pool"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# ============================================
# Routes d'analyse multiples
# ============================================

# POST /analyze/all?ticker=NVDA&modules=options_flow,dark_pool
# Analyser plusieurs modules en parallèle
resource "aws_apigatewayv2_route" "post_analyze_all" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /analyze/all"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# ============================================
# Routes de récupération des résultats
# ============================================

# GET /analyze/results?ticker=NVDA&modules=options_flow,dark_pool
# Récupérer les résultats d'analyses unitaires
resource "aws_apigatewayv2_route" "get_analyze_results" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /analyze/results"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}





