# ============================================
# SQS Queue pour le parsing Form 4 avec rate limiting
# ============================================
# Cette queue permet de parser les Form 4 avec un rate limiting strict
# pour respecter les limites de la SEC (10 requêtes/seconde)

resource "aws_sqs_queue" "form4_parser_queue" {
  name                       = "${var.project}-${var.stage}-form4-parser"
  visibility_timeout_seconds = 300   # 5 minutes (parsing peut être long)
  message_retention_seconds  = 86400 # 24 heures
  receive_wait_time_seconds  = 20    # Long polling pour réduire les coûts

  # Delay par défaut : 100ms entre chaque message (10 req/s max)
  # Note: SQS Delay Queue max = 15 minutes, mais on peut utiliser DelaySeconds dans les messages
  delay_seconds = 0  # Pas de delay global, on gère dans le message

  # Dead Letter Queue pour les messages qui échouent après 3 tentatives
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.form4_parser_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${var.project}-${var.stage}-form4-parser-queue"
    Environment = var.stage
  }
}

# Dead Letter Queue pour Form 4 parser
resource "aws_sqs_queue" "form4_parser_dlq" {
  name                      = "${var.project}-${var.stage}-form4-parser-dlq"
  message_retention_seconds = 1209600 # 14 jours
}

# Permission pour EventBridge/Lambda d'envoyer vers SQS
resource "aws_sqs_queue_policy" "form4_parser_queue_policy" {
  queue_url = aws_sqs_queue.form4_parser_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = ["events.amazonaws.com", "lambda.amazonaws.com"]
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.form4_parser_queue.arn
      }
    ]
  })
}
