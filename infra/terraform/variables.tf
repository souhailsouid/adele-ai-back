variable "project" {
  type = string
}

variable "stage" {
  type = string
}

variable "region" {
  type    = string
  default = "eu-west-3"
}

variable "frontend_allowed_origins" {
  type    = list(string)
  default = ["http://localhost:3000", "https://main.d15muhyy3o82qt.amplifyapp.com"]
}

variable "openai_api_key" {
  type        = string
  description = "OpenAI API Key for AI processing"
  sensitive   = true
}

variable "supabase_url" {
  type        = string
  description = "Supabase project URL"
  sensitive   = false
}

variable "supabase_service_key" {
  type        = string
  description = "Supabase service role key (for Lambda, not public key)"
  sensitive   = true
}

variable "scrapecreators_api_key" {
  type        = string
  description = "ScrapeCreators API Key"
  sensitive   = true
  default     = ""
}

variable "coinglass_api_key" {
  type        = string
  description = "CoinGlass API Key"
  sensitive   = true
  default     = ""
}

variable "unusual_whales_api_key" {
  type        = string
  description = "Unusual Whales API Key for ticker activity service"
  sensitive   = true
  default     = ""
}

variable "fmp_api_key" {
  type        = string
  description = "Financial Modeling Prep API Key for ticker quotes"
  sensitive   = true
  default     = ""
}

variable "neo4j_uri" {
  type        = string
  description = "Neo4j AURA URI"
  sensitive   = true
  default     = ""
}

variable "neo4j_username" {
  type        = string
  description = "Neo4j username"
  sensitive   = true
  default     = "neo4j"
}

variable "neo4j_password" {
  type        = string
  description = "Neo4j password"
  sensitive   = true
  default     = ""
}

variable "neo4j_database" {
  type        = string
  description = "Neo4j database name"
  sensitive   = false
  default     = "neo4j"
}

variable "discord_webhook_url" {
  type        = string
  description = "Discord webhook URL for real-time alerts"
  sensitive   = true
  default     = ""
}

variable "slack_webhook_url" {
  type        = string
  description = "Slack webhook URL for real-time alerts"
  sensitive   = true
  default     = ""
}

variable "telegram_bot_token" {
  type        = string
  description = "Telegram bot token for real-time alerts"
  sensitive   = true
  default     = ""
}

variable "telegram_chat_id" {
  type        = string
  description = "Telegram chat ID for real-time alerts"
  sensitive   = true
  default     = ""
}

variable "budget_alert_emails" {
  type        = list(string)
  description = "Email addresses to receive budget alerts"
  default     = []
}

# ============================================
# Kill Switch Variables - Reserved Concurrency
# ============================================
# Par défaut = 1 (fonctionnement normal mais limité)
# Mettre à 0 pour kill switch complet (aucune exécution)
#
# ⚠️ NOTE: form4_parser_concurrency est pour l'ANCIEN workflow (form4-parser)
# Pour le NOUVEAU workflow SEC Form 4, utiliser sec_form4_parser_concurrency

variable "form4_parser_concurrency" {
  type        = number
  description = "[DEPRECATED - Ancien workflow] Reserved concurrency for form4-parser Lambda (0 = kill switch, 1 = normal limited, default = 1). Utiliser sec_form4_parser_concurrency pour le nouveau workflow."
  default     = 1
}

variable "form144_parser_concurrency" {
  type        = number
  description = "Reserved concurrency for form144-parser Lambda (0 = kill switch, 1 = normal limited, default = 1)"
  default     = 1
}

variable "sec_smart_money_sync_concurrency" {
  type        = number
  description = "Reserved concurrency for sec-smart-money-sync Lambda (0 = kill switch, 1 = normal limited, default = 1)"
  default     = 1
}

variable "parser_13f_concurrency" {
  type        = number
  description = "Reserved concurrency for parser-13f Lambda (0 = kill switch, 1+ = normal limited, default = 1)"
  default     = 1
}

# ============================================
# SEC Form 4 Workflow Variables
# ============================================

variable "enable_sec_sync" {
  type        = bool
  description = "Enable SEC Form 4 sync workflow (DISCOVER + PARSER). If false, both Lambdas exit immediately."
  default     = false  # Désactivé par défaut (sécurité)
}

variable "company_ciks_json" {
  type        = string
  description = "JSON array of company CIKs to monitor (e.g., '[\"0000320193\", \"0000789019\"]')"
  default     = "[]"
}

variable "sec_form4_discover_concurrency" {
  type        = number
  description = "Reserved concurrency for sec-form4-discover Lambda (0 = kill switch, 1 = normal limited, default = 1)"
  default     = 1
}

variable "sec_form4_parser_concurrency" {
  type        = number
  description = "Reserved concurrency for sec-form4-parser Lambda (0 = kill switch, 1 = normal limited, default = 1)"
  default     = 1
}
