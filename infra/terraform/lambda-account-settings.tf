# ============================================
# Configuration de la Concurrence Lambda au Niveau du Compte
# ============================================
# 
# ⚠️ PROBLÈME CRITIQUE IDENTIFIÉ :
# La limite de compte était fixée à 10 slots, causant des throttles massifs (503)
# quand parser-13f (60-120s) occupait plusieurs slots simultanément.
#
# ✅ SOLUTION :
# Augmenter la limite à 1000 (valeur par défaut AWS) pour permettre
# l'exécution parallèle de toutes les Lambdas sans throttling.
#
# 📝 NOTE :
# Terraform ne supporte pas la ressource aws_lambda_account_settings.
# Utiliser le script scripts/fix-lambda-concurrency.sh ou configurer manuellement :
#
# OPTION 1 - Script automatique (recommandé) :
#   cd infra/terraform
#   ./scripts/fix-lambda-concurrency.sh
#
# OPTION 2 - AWS Console (manuel) :
#   1. AWS Lambda → Account settings → Concurrency
#   2. Edit → Remove limit (ou set to 1000)
#
# OPTION 3 - AWS CLI (manuel) :
#   aws lambda put-account-concurrency --reserved-concurrent-executions 1000
#   # ou pour supprimer la limite :
#   aws lambda delete-account-concurrency
