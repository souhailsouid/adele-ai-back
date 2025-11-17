resource "aws_cognito_user_pool" "this" {
  name = "${var.project}-${var.stage}-user-pool"

  username_attributes = ["email"]
  auto_verified_attributes = ["email"]

  schema {
    attribute_data_type = "String"
    name                = "email"
    required            = true
    mutable             = true
  }

  # Politique de mot de passe
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
    temporary_password_validity_days = 7
  }

  # (Option) custom attrs plus tard : company_domain, etc.
}

resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project}-${var.stage}-web-client"
  user_pool_id = aws_cognito_user_pool.this.id

  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  allowed_oauth_flows_user_pool_client = true
  generate_secret                      = false  # important pour app web

  # Autoriser USER_PASSWORD_AUTH pour la connexion directe
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH",
  ]

  callback_urls = [
    "http://localhost:3000/api/auth/callback",
    "https://app.yourdomain.com/api/auth/callback"
  ]
  logout_urls = [
    "http://localhost:3000",
    "https://app.yourdomain.com"
  ]
  supported_identity_providers = ["COGNITO"]

  prevent_user_existence_errors = "ENABLED"
}

resource "aws_cognito_user_pool_domain" "this" {
  domain       = "${var.project}-${var.stage}-auth"
  user_pool_id = aws_cognito_user_pool.this.id
}
