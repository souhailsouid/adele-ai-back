# Routes Funds API - Sur API Gateway 2 (http_data)
# Toutes les routes /funds/* sont sur l'API Gateway 2 (http_data)
# Utilisent la Lambda api principale (pas de Lambda séparée)

# Routes Funds de base
resource "aws_apigatewayv2_route" "post_funds" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "POST /funds"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "get_funds" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# Route globale pour analyser tous les changements de tous les funds
resource "aws_apigatewayv2_route" "get_funds_changes" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/changes"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "get_fund" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "get_fund_holdings" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}/holdings"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "get_fund_filings" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}/filings"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# Route pour obtenir un filing spécifique (doit être avant /funds/{id}/filings pour éviter les conflits)
resource "aws_apigatewayv2_route" "get_fund_filing" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}/filings/{filingId}"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# Route pour obtenir les holdings d'un filing spécifique
resource "aws_apigatewayv2_route" "get_filing_holdings" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}/filings/{filingId}/holdings"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "get_fund_diffs" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}/diffs"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "get_fund_ticker_diffs" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}/diffs/{ticker}"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# Route pour l'analyse stratégique des diffs (avec détection des tendances multi-trimestres)
resource "aws_apigatewayv2_route" "get_fund_diffs_strategic" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}/diffs/strategic"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "get_fund_changes" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}/changes"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "get_fund_portfolio" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}/portfolio"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "post_fund_calculate_diff" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "POST /funds/{id}/filings/{filingId}/calculate-diff"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "post_fund_filing_retry" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "POST /funds/{id}/filings/{filingId}/retry"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "post_fund_filings_retry_all" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "POST /funds/{id}/filings/retry-all"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# Routes Fund CIKs (gestion des CIK multiples)
resource "aws_apigatewayv2_route" "get_fund_ciks" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}/ciks"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "post_fund_cik" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "POST /funds/{id}/ciks"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "delete_fund_cik" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "DELETE /funds/{id}/ciks/{cik}"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# Routes Fund Notifications
resource "aws_apigatewayv2_route" "get_fund_notification_preferences" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}/notifications/preferences"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "put_fund_notification_preferences" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "PUT /funds/{id}/notifications/preferences"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "get_fund_notifications" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /notifications/funds"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "post_notification_digest" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "POST /notifications/digest"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "get_notification_digests" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /notifications/digests"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

resource "aws_apigatewayv2_route" "get_notification_digest" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /notifications/digests/{digestId}"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# Route pour les notifications d'accumulation multi-trimestres
resource "aws_apigatewayv2_route" "get_notifications_accumulations" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /notifications/accumulations"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# Route Transparency Mode
resource "aws_apigatewayv2_route" "get_fund_transparency" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /funds/{id}/transparency"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# Route SEC Calendar
resource "aws_apigatewayv2_route" "get_sec_calendar" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /sec/calendar"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# Route pour déclencher manuellement la découverte de filings pour tous les CIK
resource "aws_apigatewayv2_route" "post_fund_discover" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "POST /funds/{id}/discover"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# ========== Market Pulse - Comparaison avec autres funds ==========
resource "aws_apigatewayv2_route" "get_ticker_funds_changes" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /ticker/{ticker}/funds/changes"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# ========== Market Pulse - Banner global ==========
resource "aws_apigatewayv2_route" "get_market_pulse" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /market/pulse"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}

# ========== Market Pulse - Feed avec filtres ==========
resource "aws_apigatewayv2_route" "get_market_pulse_feed" {
  api_id             = aws_apigatewayv2_api.http_data.id
  route_key          = "GET /market/pulse-feed"
  target             = "integrations/${aws_apigatewayv2_integration.api_data_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt_data.id
}
