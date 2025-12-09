# Routes pour le service d'Attribution Engine

# POST /attribution/flow
resource "aws_apigatewayv2_route" "post_attribution_flow" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /attribution/flow"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /attribution/institution/{institutionId}/ticker/{ticker}
resource "aws_apigatewayv2_route" "get_attribution_institution_ticker" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /attribution/institution/{institutionId}/ticker/{ticker}"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /attribution/dominant-entities/{ticker}
resource "aws_apigatewayv2_route" "get_attribution_dominant_entities" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /attribution/dominant-entities/{ticker}"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /attribution/clusters
resource "aws_apigatewayv2_route" "get_attribution_clusters" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /attribution/clusters"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

# GET /graph/test-connection
resource "aws_apigatewayv2_route" "get_graph_test_connection" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "GET /graph/test-connection"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}








