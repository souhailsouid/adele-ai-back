# Routes d'ingestion pour les flow alerts
# Couche A : Collecte rapide, idempotente

# POST /ingest/flow-alerts
# Ingérer les flow alerts depuis l'API Unusual Whales et les stocker dans flow_alerts
resource "aws_apigatewayv2_route" "post_ingest_flow_alerts" {
  api_id    = aws_apigatewayv2_api.http.id
  route_key = "POST /ingest/flow-alerts"

  target = "integrations/${aws_apigatewayv2_integration.api_lambda.id}"

  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.jwt.id
}

