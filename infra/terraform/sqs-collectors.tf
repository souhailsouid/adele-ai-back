# SQS Queues pour lisser les pics des crons
# Découple EventBridge → SQS → Lambda pour éviter le throttling

# ============================================
# Queue pour les collectors (SEC watcher, RSS, etc.)
# ============================================
resource "aws_sqs_queue" "collectors_queue" {
  name                       = "${var.project}-${var.stage}-collectors"
  visibility_timeout_seconds = 900   # 15 minutes (pour gérer les timeouts des collectors lourds)
  message_retention_seconds  = 345600 # 4 jours (permet de "pause" sans perdre les messages)
  receive_wait_time_seconds  = 20    # Long polling pour réduire les coûts

  # Dead Letter Queue pour les messages qui échouent après 3 tentatives
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.collectors_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${var.project}-${var.stage}-collectors-queue"
    Environment = var.stage
  }
}

# Dead Letter Queue
resource "aws_sqs_queue" "collectors_dlq" {
  name                      = "${var.project}-${var.stage}-collectors-dlq"
  message_retention_seconds = 1209600 # 14 jours
}

# ============================================
# Queue pour le parser-13f (peut être déclenché plusieurs fois)
# ============================================
resource "aws_sqs_queue" "parser_13f_queue" {
  name                       = "${var.project}-${var.stage}-parser-13f"
  visibility_timeout_seconds = 900   # 15 minutes (parser peut être long)
  message_retention_seconds  = 86400 # 24 heures
  receive_wait_time_seconds  = 20    # Long polling

  # Dead Letter Queue
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.parser_13f_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${var.project}-${var.stage}-parser-13f-queue"
    Environment = var.stage
  }
}

# Dead Letter Queue pour parser-13f
resource "aws_sqs_queue" "parser_13f_dlq" {
  name                      = "${var.project}-${var.stage}-parser-13f-dlq"
  message_retention_seconds = 1209600 # 14 jours
}

# ============================================
# Permissions IAM pour SQS
# ============================================

# Permission pour EventBridge d'envoyer vers SQS
# ⚠️ IMPORTANT: Sans cette policy, EventBridge ne peut pas envoyer de messages vers SQS
resource "aws_sqs_queue_policy" "collectors_queue_policy" {
  queue_url = aws_sqs_queue.collectors_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgeSECSmartMoneySync"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.collectors_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.sec_smart_money_sync_cron.arn
          }
        }
      },
      {
        Sid    = "AllowEventBridgeSECSmartMoneyTrackInsiders"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.collectors_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.sec_smart_money_track_insiders_cron.arn
          }
        }
      },
      {
        Sid    = "AllowEventBridgeCollectorSECWatcher"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.collectors_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.collector_sec_watcher_cron.arn
          }
        }
      },
      {
        Sid    = "AllowEventBridgeCollectorRSS"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.collectors_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.collector_rss_cron.arn
          }
        }
      }
    ]
  })
}

# Permission pour EventBridge d'envoyer vers SQS (parser-13f)
# ⚠️ IMPORTANT: Condition SourceArn pour restreindre aux règles EventBridge spécifiques
resource "aws_sqs_queue_policy" "parser_13f_queue_policy" {
  queue_url = aws_sqs_queue.parser_13f_queue.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgeParser13FTrigger"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sqs:SendMessage"
        Resource = aws_sqs_queue.parser_13f_queue.arn
        Condition = {
          ArnEquals = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.parser_13f_trigger.arn
          }
        }
      }
    ]
  })
}

# Permission pour Lambda de recevoir depuis SQS (collectors)
resource "aws_iam_role_policy" "collectors_sqs_receive" {
  name = "${var.project}-${var.stage}-collectors-sqs-receive"
  role = aws_iam_role.collector_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [
          aws_sqs_queue.collectors_queue.arn,
          aws_sqs_queue.parser_13f_queue.arn,
          aws_sqs_queue.form4_parser_queue.arn,
          aws_sqs_queue.form144_parser_queue.arn
        ]
      }
    ]
  })
}

# Permission pour Lambda d'envoyer vers SQS (form4-parser queue)
resource "aws_iam_role_policy" "collectors_sqs_send" {
  name = "${var.project}-${var.stage}-collectors-sqs-send"
  role = aws_iam_role.collector_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = [
          aws_sqs_queue.form4_parser_queue.arn,
          aws_sqs_queue.form144_parser_queue.arn
        ]
      }
    ]
  })
}
