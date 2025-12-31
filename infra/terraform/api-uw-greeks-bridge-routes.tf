# Bridge routes: expose selected Unusual Whales greeks endpoints on the MAIN app API Gateway
# Goal: allow comparing raw UW data with our ingested/aggregated results from the same Swagger base URL.
#
# NOTE: The full UW catalog is on API Gateway 2 (api-data-uw-routes.tf). This file only exposes the minimal
# "greek-exposure" endpoints needed for validation/debugging.

# GET /unusual-whales/stock/{ticker}/greek-exposure/strike
resource "aws_apigatewayv2_route" "get_uw_stock_greek_exposure_strike_app" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /unusual-whales/stock/{ticker}/greek-exposure/strike"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /unusual-whales/stock/{ticker}/greek-exposure/strike-expiry
resource "aws_apigatewayv2_route" "get_uw_stock_greek_exposure_strike_expiry_app" {
  api_id             = aws_apigatewayv2_api.http.id
  route_key          = "GET /unusual-whales/stock/{ticker}/greek-exposure/strike-expiry"
  target             = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}





