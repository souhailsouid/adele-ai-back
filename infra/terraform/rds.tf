# ============================================
# RDS PostgreSQL Database
# ============================================
# 
# ⚠️ NOTE: Ce fichier est DÉSACTIVÉ pour l'architecture "Extreme Budget"
# Toutes les données sont stockées sur S3 + Athena (pas de RDS nécessaire)
# 
# Pour activer RDS (si besoin futur), décommenter et configurer:
# - VPC et subnets
# - Security groups
# - Variables db_username et db_password
#
# Migration depuis Supabase vers RDS pour réduire les coûts
# Tables: companies, funds, earnings_calendar, fund_holdings_diff
#
# Coût estimé: ~$15/mois (db.t3.micro, 20GB)

/*
# Security Group pour RDS
resource "aws_security_group" "rds" {
  name        = "${var.project}-${var.stage}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    description = "PostgreSQL from Lambda"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [
      aws_security_group.lambda.id
    ]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-${var.stage}-rds-sg"
  }
}

# DB Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-${var.stage}-db-subnet-group"
  subnet_ids = data.aws_subnets.private.ids

  tags = {
    Name = "${var.project}-${var.stage}-db-subnet-group"
  }
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier     = "${var.project}-${var.stage}-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"  # $15/mois
  
  allocated_storage     = 20  # GB
  max_allocated_storage = 100  # Auto-scaling jusqu'à 100GB
  storage_type          = "gp3"
  storage_encrypted      = true
  
  db_name  = "personamy"
  username = var.db_username
  password = var.db_password  # À stocker dans Secrets Manager en production
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  publicly_accessible    = false  # Privé uniquement
  
  backup_retention_period = 7  # 7 jours de backup
  backup_window          = "03:00-04:00"  # UTC
  maintenance_window     = "mon:04:00-mon:05:00"  # UTC
  
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-${var.stage}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  
  # Performance Insights (optionnel, coûteux)
  performance_insights_enabled = false
  
  # Monitoring
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  
  tags = {
    Name        = "${var.project}-${var.stage}-db"
    Environment = var.stage
    ManagedBy   = "Terraform"
  }
}

# Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "rds_address" {
  description = "RDS instance address (hostname)"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.main.port
}
*/

# Variables nécessaires (à ajouter dans variables.tf si RDS est activé)
# variable "db_username" {
#   description = "RDS master username"
#   type        = string
#   default     = "postgres"
# }
#
# variable "db_password" {
#   description = "RDS master password"
#   type        = string
#   sensitive   = true
# }
