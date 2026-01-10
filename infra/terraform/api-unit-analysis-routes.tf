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

# POST /analyze/convergence-risk?ticker=NVDA
# Analyser la convergence et le risque de liquidation
resource "aws_apigatewayv2_route" "post_analyze_convergence_risk" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /analyze/convergence-risk"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# POST /analyze/earnings-hub?ticker=CCL
# Analyser le Earnings Hub (score, historique, insights)
resource "aws_apigatewayv2_route" "post_analyze_earnings_hub" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /analyze/earnings-hub"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# POST /analyze/catalyst-calendar
# Calendrier catalyst agrégé (Macro, FDA, Earnings, Whale Risk)
resource "aws_apigatewayv2_route" "post_analyze_catalyst_calendar" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /analyze/catalyst-calendar"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /earnings/upcoming/{ticker}
# Récupérer les prochains earnings pour un ticker donné
resource "aws_apigatewayv2_route" "get_earnings_upcoming_ticker" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /earnings/upcoming/{ticker}"
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





