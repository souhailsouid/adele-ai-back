# # Routes Combined Analysis API (FMP + Unusual Whales)

# # ========== Phase 1: Services de base ==========

# # Complete Analysis
# resource "aws_apigatewayv2_route" "get_analysis_complete" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "GET /analysis/{ticker}/complete"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

# # Divergence Analysis
# resource "aws_apigatewayv2_route" "get_analysis_divergence" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "GET /analysis/{ticker}/divergence"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

# # Comprehensive Valuation
# resource "aws_apigatewayv2_route" "get_analysis_valuation" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "GET /analysis/{ticker}/valuation"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

# # ========== Phase 2: Services avancés ==========

# # Earnings Prediction
# resource "aws_apigatewayv2_route" "get_analysis_earnings_prediction" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "GET /analysis/{ticker}/earnings-prediction"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

# # Multi-Criteria Screener
# resource "aws_apigatewayv2_route" "post_screener_multi_criteria" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "POST /screener/multi-criteria"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

# # Risk Analysis
# resource "aws_apigatewayv2_route" "get_analysis_risk" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "GET /analysis/{ticker}/risk"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

# # Institution Tracking
# resource "aws_apigatewayv2_route" "get_institutions_tracking" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "GET /institutions/{name}/tracking"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

# # Sector Analysis
# resource "aws_apigatewayv2_route" "get_analysis_sector" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "GET /analysis/sector/{sector}"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

# # Sector Rotation
# resource "aws_apigatewayv2_route" "get_market_analysis_sector_rotation" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "GET /market-analysis/sector-rotation"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

# # Market Tide
# resource "aws_apigatewayv2_route" "get_market_analysis_market_tide" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "GET /market-analysis/market-tide"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

# # ========== Phase 1: Scoring Service ==========

# # Ticker Score
# resource "aws_apigatewayv2_route" "get_ticker_analysis_score" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "GET /ticker-analysis/{ticker}/score"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

# # Ticker Breakdown
# resource "aws_apigatewayv2_route" "get_ticker_analysis_breakdown" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "GET /ticker-analysis/{ticker}/breakdown"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

# # ========== Phase 1.2: Gamma Squeeze Service ==========

# # Gamma Squeeze Analysis
# resource "aws_apigatewayv2_route" "get_ticker_analysis_gamma_squeeze" {
#   api_id             = aws_apigatewayv2_api.http.id
#   route_key          = "GET /ticker-analysis/{ticker}/gamma-squeeze"
#   target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
#   authorization_type = "JWT"
#   authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
# }

