# EventBridge pour orchestrer les signaux

resource "aws_cloudwatch_event_bus" "signals" {
  name = "${var.project}-${var.stage}-signals"
}


# EventBridge Rule pour déclencher le processor IA
# DÉSACTIVÉ - Le processor IA est désactivé
resource "aws_cloudwatch_event_rule" "processor_ia_trigger" {
  name           = "${var.project}-${var.stage}-processor-ia-trigger"
  event_bus_name = aws_cloudwatch_event_bus.signals.name
  description    = "Déclenche le processor IA pour nouveaux signaux"
  state          = "DISABLED" # Désactivé

  event_pattern = jsonencode({
    source      = ["adel.signals"]
    detail-type = ["New Signal"]
  })
}

# EventBridge Rule pour déclencher le diff engine 13F
# OBSOLÈTE - Le diff engine 13F n'existe pas et le parser-13f ne publie pas d'événement "13F Parsed"
resource "aws_cloudwatch_event_rule" "diff_13f_trigger" {
  name           = "${var.project}-${var.stage}-diff-13f-trigger"
  event_bus_name = aws_cloudwatch_event_bus.signals.name
  description    = "Déclenche le diff engine après parsing 13F"
  state          = "DISABLED" # Désactivé - obsolète

  event_pattern = jsonencode({
    source      = ["adel.signals"]
    detail-type = ["13F Parsed"]
  })
}

# Target: Processor IA (défini dans processor-ia.tf)

