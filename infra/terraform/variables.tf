variable "project" {
  type = string
}

variable "stage" {
  type = string
}

variable "region" {
  type        = string
  default     = "eu-west-3"
}

variable "frontend_allowed_origins" {
  type    = list(string)
  default = ["http://localhost:3000"]
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
