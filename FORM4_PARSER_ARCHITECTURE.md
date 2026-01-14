# 🏗️ Architecture Form 4 Parser avec Rate Limiting

## Vue d'ensemble

Architecture découplée pour parser les Form 4 avec **rate limiting strict** (10 req/s max pour SEC).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Worker Principal (sec-smart-money-sync)                 │
│    - Découvre les nouveaux Form 4                           │
│    - Crée les filings en statut DISCOVERED                  │
│    - Publie dans SQS avec delay progressif                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SQS Queue (form4-parser-queue)                          │
│    - Rate limiting via DelaySeconds dans les messages       │
│    - Dead Letter Queue pour les échecs                      │
│    - Long polling (20s) pour réduire les coûts               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Worker Parser (form4-parser)                            │
│    - Consomme depuis SQS (batch_size=1)                     │
│    - Parse avec rate limiting strict (100ms entre requêtes) │
│    - Gère les retries en cas de rate limit (429)            │
│    - Insère les transactions dans S3 Parquet                │
└─────────────────────────────────────────────────────────────┘
```

## Rate Limiting

### Stratégie multi-niveaux

1. **Niveau SQS (DelaySeconds)**
   - Chaque message a un `DelaySeconds` progressif
   - Espace les messages dans le temps
   - Max: 15 minutes (limite SQS)

2. **Niveau Lambda (batch_size=1)**
   - Lambda traite 1 message à la fois
   - Évite les pics de trafic

3. **Niveau Code (sleep 100ms)**
   - 100ms entre chaque requête SEC
   - = 10 requêtes/seconde max
   - Gestion des 429 (rate limit hit)

## Flux détaillé

### 1. Découverte (sec-smart-money-sync)

```typescript
// Pour chaque nouveau Form 4 découvert
await sqsClient.send(new SendMessageCommand({
  QueueUrl: FORM4_PARSER_QUEUE_URL,
  MessageBody: JSON.stringify({
    companyId: companyId,
    filingId: filingId,
    accessionNumber: filing.accessionNumber,
    cik: cik,
    primaryDocument: filing.primaryDocument,
  }),
  DelaySeconds: delaySeconds, // Espacement progressif
}));
```

### 2. Parsing (form4-parser)

```typescript
// Pour chaque message SQS
for (const record of event.Records) {
  const message = JSON.parse(record.body);
  
  // Rate limiting strict
  await sleep(RATE_LIMIT_DELAY); // 100ms
  
  // Parser le Form 4
  await parseForm4(message);
}
```

### 3. Gestion des erreurs

- **429 (Rate Limit)** : Retry après 2 secondes
- **404 (Not Found)** : Essayer l'URL suivante
- **Timeout** : Message retourne dans la queue (SQS retry)
- **3 échecs** : Message dans Dead Letter Queue

## Configuration Terraform

### Queue SQS

```terraform
resource "aws_sqs_queue" "form4_parser_queue" {
  name                       = "form4-parser"
  visibility_timeout_seconds = 300   # 5 minutes
  message_retention_seconds  = 86400 # 24 heures
  receive_wait_time_seconds  = 20    # Long polling
}
```

### Lambda Parser

```terraform
resource "aws_lambda_event_source_mapping" "form4_parser_sqs" {
  event_source_arn = aws_sqs_queue.form4_parser_queue.arn
  function_name    = aws_lambda_function.form4_parser.arn
  batch_size       = 1 # Rate limiting strict
  enabled          = true
}
```

## Monitoring

### Métriques importantes

1. **SQS Queue Depth**
   - Nombre de messages en attente
   - Si > 1000, augmenter le delay ou la fréquence

2. **Lambda Duration**
   - Temps de parsing moyen
   - Si > 5 min, optimiser le parsing

3. **Error Rate**
   - Taux d'erreur 429 (rate limit)
   - Si > 5%, augmenter les delays

4. **Dead Letter Queue**
   - Messages en échec permanent
   - Analyser les causes

### CloudWatch Alarms

```terraform
# Alarme si queue trop pleine
resource "aws_cloudwatch_metric_alarm" "form4_parser_queue_depth" {
  alarm_name          = "form4-parser-queue-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Average"
  threshold           = 1000
  alarm_description   = "Form 4 parser queue has too many messages"
}
```

## Coûts estimés

- **SQS** : ~$0.40 par million de messages
- **Lambda** : ~$0.20 par 1M requêtes (5 min, 1GB)
- **Athena** : ~$5 par TB scanné
- **S3** : Stockage + requêtes (négligeable)

**Total estimé : ~$10-15/mois** (pour 1000 Form 4/jour)

## Optimisations futures

1. **Batch processing** : Parser plusieurs Form 4 en parallèle (si rate limit OK)
2. **Caching** : Cache des URLs déjà parsées
3. **Priorité** : Parser d'abord les Form 4 récents
4. **Retry intelligent** : Backoff exponentiel pour les 429
