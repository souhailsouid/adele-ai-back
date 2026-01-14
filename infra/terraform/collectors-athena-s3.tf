# Permissions Athena et S3 pour collector_role
# (sec-smart-money-sync a besoin d'Athena et S3 pour lire/écrire les données)

# Permissions Athena pour collector_role
resource "aws_iam_role_policy_attachment" "collector_athena_attach" {
  role       = aws_iam_role.collector_role.name
  policy_arn = aws_iam_policy.api_athena_policy.arn
}

# Permissions S3 pour collector_role
resource "aws_iam_role_policy_attachment" "collector_s3_attach" {
  role       = aws_iam_role.collector_role.name
  policy_arn = aws_iam_policy.api_s3_policy.arn
}
