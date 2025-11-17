# EventBridge pour orchestrer les signaux

resource "aws_cloudwatch_event_bus" "signals" {
  name = "${var.project}-${var.stage}-signals"
}

# EventBridge Rule pour déclencher le processor IA
resource "aws_cloudwatch_event_rule" "processor_ia_trigger" {
  name           = "${var.project}-${var.stage}-processor-ia-trigger"
  event_bus_name = aws_cloudwatch_event_bus.signals.name
  description    = "Déclenche le processor IA pour nouveaux signaux"

  event_pattern = jsonencode({
    source      = ["adel.signals"]
    detail-type = ["New Signal"]
  })
}

# EventBridge Rule pour déclencher le diff engine 13F
resource "aws_cloudwatch_event_rule" "diff_13f_trigger" {
  name           = "${var.project}-${var.stage}-diff-13f-trigger"
  event_bus_name = aws_cloudwatch_event_bus.signals.name
  description    = "Déclenche le diff engine après parsing 13F"

  event_pattern = jsonencode({
    source      = ["adel.signals"]
    detail-type = ["13F Parsed"]
  })
}

# Target: Processor IA (défini dans processor-ia.tf)

