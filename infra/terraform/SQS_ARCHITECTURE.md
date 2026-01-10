# Architecture SQS pour lisser les pics des crons

## Problème actuel

Avec seulement **10 exécutions simultanées** sur le compte AWS, les crons qui se déclenchent en même temps causent du **throttling**.

**Crons actifs :**
- `collector-sec-watcher` : toutes les heures
- `collector-rss` : toutes les 15 minutes
- `notification-generator` : toutes les 5 minutes
- `collector-sec-company-filings` : quotidien à 9h UTC
- `parser-13f` : déclenché par EventBridge (peut être multiple)

## Solution : SQS (Simple Queue Service)

**Architecture :**
```
EventBridge (Cron) → SQS Queue → Lambda (consomme à son rythme)
```

**Avantages :**
1. ✅ **Lissage des pics** : Les messages sont mis en file d'attente
2. ✅ **Pas de throttling** : Lambda consomme à son rythme (1 message à la fois)
3. ✅ **Retries automatiques** : SQS gère les retries (3 tentatives)
4. ✅ **Dead Letter Queue** : Messages en échec après 3 tentatives
5. ✅ **Coût faible** : ~$0.40 par million de requêtes

## Configuration Terraform

### 1. Queues SQS créées

- `collectors_queue` : Pour tous les collectors (SEC watcher, RSS, etc.)
- `parser_13f_queue` : Pour le parser 13F (peut être déclenché plusieurs fois)
- Dead Letter Queues (DLQ) pour chaque queue

### 2. Changements nécessaires

#### A. Modifier les workers pour accepter SQS

**Avant (EventBridge direct) :**
```typescript
export const handler = async (event: EventBridgeEvent) => {
  // Traitement direct
}
```

**Après (SQS) :**
```typescript
export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body);
    // Traitement du message
  }
}
```

#### B. EventBridge envoie vers SQS

**Avant :**
```terraform
resource "aws_cloudwatch_event_target" "collector" {
  arn = aws_lambda_function.collector.arn  # Direct
}
```

**Après :**
```terraform
resource "aws_cloudwatch_event_target" "collector" {
  arn = aws_sqs_queue.collectors_queue.arn  # Via SQS
}
```

#### C. Lambda consomme depuis SQS

```terraform
resource "aws_lambda_event_source_mapping" "collector_sqs" {
  event_source_arn = aws_sqs_queue.collectors_queue.arn
  function_name    = aws_lambda_function.collector.arn
  batch_size       = 1  # 1 message à la fois
}
```

## Workers à modifier

1. ✅ `collector-sec-watcher` : Modifié dans Terraform (à tester)
2. ⏳ `collector-rss` : À modifier
3. ⏳ `notification-generator` : À modifier
4. ⏳ `collector-sec-company-filings` : À modifier
5. ⏳ `parser-13f` : À modifier (EventBridge → SQS)

## Déploiement

1. **Appliquer Terraform** :
   ```bash
   cd infra/terraform
   terraform apply
   ```

2. **Modifier les workers** pour accepter SQS (voir exemples ci-dessus)

3. **Tester** avec un cron manuel

## Coûts

- **SQS** : ~$0.40 par million de requêtes (quasi gratuit)
- **Lambda** : Inchangé (même nombre d'exécutions)
- **Bénéfice** : Évite le throttling = moins d'erreurs 503

## Prochaines étapes

1. ✅ Configuration Terraform SQS créée
2. ⏳ Modifier `collector-sec-watcher` pour accepter SQS
3. ⏳ Tester avec un cron manuel
4. ⏳ Appliquer aux autres collectors
5. ⏳ Modifier `parser-13f` pour utiliser SQS
