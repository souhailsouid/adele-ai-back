# ============================================
# AWS Budget Alert - Protection contre les dérives de coûts
# ============================================
# 
# Alerte immédiate pour ne plus être surpris par une facture élevée
# Définie à $100 avec alertes à 80% et 100%

# Budget principal pour surveiller les coûts totaux
resource "aws_budgets_budget" "main" {
  name         = "${var.project}-${var.stage}-cost-budget"
  budget_type  = "COST"
  limit_amount = "10"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Alertes à 80% et 100% du budget
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 79
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 99
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 79
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_alert_emails
  }
}

# Budget pour S3 (stockage + requêtes) - Baissé à $5 pour détecter rapidement les dérives
resource "aws_budgets_budget" "s3" {
  name         = "${var.project}-${var.stage}-s3-budget"
  budget_type  = "COST"
  limit_amount = "5"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "Service"
    values = ["Amazon Simple Storage Service"]
  }

  # Alerte précoce à 50% pour détecter rapidement les explosions
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 49
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 79
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 99
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  # Alerte prévisionnelle
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 79
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_alert_emails
  }
}

# Budget spécifique pour les REQUÊTES S3 (GET/LIST) - Détection ultra-rapide
# Les requêtes S3 représentent ~80% du coût S3 lors d'explosions (43M+ requêtes = $18/jour)
# Ce budget est très bas ($2) pour alerter immédiatement en cas d'explosion de requêtes
resource "aws_budgets_budget" "s3_requests" {
  name         = "${var.project}-${var.stage}-s3-requests-budget"
  budget_type  = "COST"
  limit_amount = "2"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "Service"
    values = ["Amazon Simple Storage Service"]
  }

  # Filtre par Usage Type pour cibler les requêtes (GET, LIST, etc.)
  # Note: AWS Budgets ne permet pas de filtrer directement par opération,
  # mais on peut utiliser des Cost Categories avec tags si nécessaire.
  # Pour l'instant, ce budget S3 global avec un montant très bas ($2) 
  # détectera rapidement les explosions de requêtes (qui dominent le coût S3).

  # Alerte URGENTE à 50% ($1) - Détection immédiate
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 49
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  # Alerte CRITIQUE à 80% ($1.60)
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 79
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  # Alerte MAXIMUM à 100% ($2)
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 99
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }

  # Alerte prévisionnelle
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 79
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.budget_alert_emails
  }
}

# Budget pour Athena (19% du coût initial)
resource "aws_budgets_budget" "athena" {
  name         = "${var.project}-${var.stage}-athena-budget"
  budget_type  = "COST"
  limit_amount = "20"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "Service"
    values = ["Amazon Athena"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 79
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = var.budget_alert_emails
  }
}
