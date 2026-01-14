# ============================================
# Monitoring pour Form 4 Parser Queue
# Surveille ApproximateNumberOfMessagesVisible pour détecter les problèmes
# ============================================

# CloudWatch Alarm: Queue trop pleine (indique que le parser est trop lent)
resource "aws_cloudwatch_metric_alarm" "form4_parser_queue_depth" {
  alarm_name          = "${var.project}-${var.stage}-form4-parser-queue-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300  # 5 minutes
  statistic           = "Average"
  threshold           = 100  # Alerte si > 100 messages en attente
  alarm_description   = "Form 4 parser queue has too many messages (parser may be too slow or rate limiting too restrictive)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.form4_parser_queue.name
  }

  alarm_actions = [
    # Optionnel: Envoyer une notification SNS ou Slack
    # aws_sns_topic.alerts.arn
  ]

  tags = {
    Name        = "${var.project}-${var.stage}-form4-parser-queue-depth-alarm"
    Environment = var.stage
  }
}

# CloudWatch Alarm: Queue vide (système bien calibré)
resource "aws_cloudwatch_metric_alarm" "form4_parser_queue_empty" {
  alarm_name          = "${var.project}-${var.stage}-form4-parser-queue-empty"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300  # 5 minutes
  statistic           = "Average"
  threshold           = 1    # OK si < 1 message (queue vide)
  alarm_description   = "Form 4 parser queue is empty (system is well calibrated)"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.form4_parser_queue.name
  }

  # Pas d'alarme pour "vide" (c'est bon signe), juste pour monitoring
  # On peut créer un dashboard avec cette métrique

  tags = {
    Name        = "${var.project}-${var.stage}-form4-parser-queue-empty-alarm"
    Environment = var.stage
  }
}

# CloudWatch Dashboard pour monitoring visuel
resource "aws_cloudwatch_dashboard" "form4_parser_monitoring" {
  dashboard_name = "${var.project}-${var.stage}-form4-parser-monitoring"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", aws_sqs_queue.form4_parser_queue.name, { "stat" = "Average", "label" = "Messages en attente" }],
            ["...", "ApproximateNumberOfMessagesNotVisible", { "stat" = "Average", "label" = "Messages en traitement" }],
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.region
          title   = "Form 4 Parser Queue Depth"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.form4_parser.function_name, { "stat" = "Sum", "label" = "Invocations" }],
            ["...", "Errors", { "stat" = "Sum", "label" = "Erreurs" }],
            ["...", "Duration", { "stat" = "Average", "label" = "Durée moyenne (ms)" }],
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.region
          title   = "Form 4 Parser Lambda Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 24
        height = 6

        properties = {
          metrics = [
            ["AWS/SQS", "NumberOfMessagesSent", "QueueName", aws_sqs_queue.form4_parser_queue.name, { "stat" = "Sum", "label" = "Messages envoyés" }],
            ["...", "NumberOfMessagesReceived", { "stat" = "Sum", "label" = "Messages reçus" }],
            ["...", "NumberOfMessagesDeleted", { "stat" = "Sum", "label" = "Messages supprimés" }],
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.region
          title   = "Form 4 Parser Queue Activity"
          period  = 300
        }
      },
    ]
  })
}
