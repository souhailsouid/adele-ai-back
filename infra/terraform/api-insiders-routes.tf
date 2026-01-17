# ============================================
# Routes Insiders API
# ============================================
# Routes pour consulter, analyser et alerter sur les transactions insider

# GET /insiders/trending
resource "aws_apigatewayv2_route" "get_insiders_trending" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/trending"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /insiders/company/{ticker}
resource "aws_apigatewayv2_route" "get_insiders_company" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/company/{ticker}"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /insiders/person/{cik}
resource "aws_apigatewayv2_route" "get_insiders_person" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/person/{cik}"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /insiders/analytics/roi/{cik}
resource "aws_apigatewayv2_route" "get_insiders_analytics_roi" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/analytics/roi/{cik}"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /insiders/analytics/company/{ticker}
resource "aws_apigatewayv2_route" "get_insiders_analytics_company" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/analytics/company/{ticker}"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /insiders/analytics/top
resource "aws_apigatewayv2_route" "get_insiders_analytics_top" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/analytics/top"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# POST /insiders/alerts/scan
resource "aws_apigatewayv2_route" "post_insiders_alerts_scan" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "POST /insiders/alerts/scan"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /insiders/alerts/daily-summary
resource "aws_apigatewayv2_route" "get_insiders_alerts_daily_summary" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/alerts/daily-summary"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /insiders/signals/hot
resource "aws_apigatewayv2_route" "get_insiders_signals_hot" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/signals/hot"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# ============================================
# Routes Form 4 Filings
# ============================================

# GET /insiders/filings
resource "aws_apigatewayv2_route" "get_insiders_filings" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/filings"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /insiders/filings/{filingId}
resource "aws_apigatewayv2_route" "get_insiders_filing" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/filings/{filingId}"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /insiders/company/{ticker}/filings
resource "aws_apigatewayv2_route" "get_insiders_company_filings" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/company/{ticker}/filings"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /insiders/person/{cik}/filings
resource "aws_apigatewayv2_route" "get_insiders_person_filings" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/person/{cik}/filings"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /insiders/filings/{filingId}/transactions
resource "aws_apigatewayv2_route" "get_insiders_filing_transactions" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /insiders/filings/{filingId}/transactions"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}
