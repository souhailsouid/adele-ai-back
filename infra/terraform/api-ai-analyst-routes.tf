# Routes pour le service d'analyse IA

# POST /ai/calendar-summary
resource "aws_apigatewayv2_route" "post_ai_calendar_summary" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /ai/calendar-summary"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# POST /ai/options-flow-analysis
resource "aws_apigatewayv2_route" "post_ai_options_flow_analysis" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /ai/options-flow-analysis"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# POST /ai/institution-moves-analysis
resource "aws_apigatewayv2_route" "post_ai_institution_moves_analysis" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /ai/institution-moves-analysis"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# POST /ai/ticker-activity-analysis
resource "aws_apigatewayv2_route" "post_ai_ticker_activity_analysis" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /ai/ticker-activity-analysis"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# POST /ai/ticker-options-analysis
resource "aws_apigatewayv2_route" "post_ai_ticker_options_analysis" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /ai/ticker-options-analysis"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# POST /ai/ticker-institutional-analysis
resource "aws_apigatewayv2_route" "post_ai_ticker_institutional_analysis" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /ai/ticker-institutional-analysis"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# POST /ai/ticker-news-events-analysis
resource "aws_apigatewayv2_route" "post_ai_ticker_news_events_analysis" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /ai/ticker-news-events-analysis"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# POST /ai/financial-juice/analyze
resource "aws_apigatewayv2_route" "post_ai_financial_juice_analyze" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /ai/financial-juice/analyze"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /ai/financial-juice/latest
resource "aws_apigatewayv2_route" "get_ai_financial_juice_latest" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /ai/financial-juice/latest"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# POST /ai/economic-calendar-analysis
resource "aws_apigatewayv2_route" "post_ai_economic_calendar_analysis" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /ai/economic-calendar-analysis"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}






