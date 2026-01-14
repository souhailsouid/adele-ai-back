# 📊 Monitoring Form 4 Parser

## Métrique clé : ApproximateNumberOfMessagesVisible

**Cette métrique indique la santé du système de parsing.**

### Interprétation

| Valeur | Signification | Action |
|--------|---------------|--------|
| **0** | ✅ **Parfait** | Queue vide, système bien calibré |
| **1-50** | ✅ **Normal** | Traitement en temps réel, pas de problème |
| **50-100** | ⚠️ **Attention** | Parser un peu lent, mais acceptable |
| **> 100** | ❌ **Problème** | Parser trop lent ou rate limiting trop restrictif |

### Comment vérifier

```bash
# Vérifier la profondeur de la queue
aws sqs get-queue-attributes \
  --queue-url $(aws sqs get-queue-url --queue-name adel-ai-dev-form4-parser | jq -r .QueueUrl) \
  --attribute-names ApproximateNumberOfMessagesVisible ApproximateNumberOfMessagesNotVisible \
  | jq '.Attributes'
```

### Alarme CloudWatch

Une alarme est configurée pour alerter si `ApproximateNumberOfMessagesVisible > 100`.

**Actions si alarme déclenchée :**
1. Vérifier les logs du parser (erreurs ?)
2. Augmenter le `BUFFER_SIZE` si nécessaire (50 → 100 → 200)
3. Vérifier le rate limiting (trop restrictif ?)
4. Augmenter le timeout Lambda si parsing trop long

## Dashboard CloudWatch

Un dashboard est créé automatiquement avec :
- **Queue Depth** : Messages en attente vs en traitement
- **Lambda Metrics** : Invocations, erreurs, durée moyenne
- **Queue Activity** : Messages envoyés/reçus/supprimés

**Accès :**
```
AWS Console → CloudWatch → Dashboards → adel-ai-dev-form4-parser-monitoring
```

## Optimisations implémentées

### 1. Batch Writing (évite Small File Problem)

- **Buffer de 50 transactions** avant d'écrire
- **Timeout de 30 secondes** pour flush automatique
- **Flush à la fin** du handler pour ne pas perdre de données

**Résultat :** 1 fichier Parquet pour 50 transactions au lieu de 50 fichiers

### 2. Rate Limiting Strict

- **100ms entre chaque requête** = 10 req/s max (limite SEC)
- **Gestion des 429** : Retry après 2 secondes
- **SQS DelaySeconds** : Espace les messages dans le temps

### 3. Partitionnement optimisé

- Fichiers partitionnés par `year/month`
- Athena scanne uniquement les partitions nécessaires
- Performance optimale pour les requêtes

## Commandes utiles

### Vérifier la queue

```bash
# Profondeur de la queue
aws sqs get-queue-attributes \
  --queue-url $(aws sqs get-queue-url --queue-name adel-ai-dev-form4-parser | jq -r .QueueUrl) \
  --attribute-names ApproximateNumberOfMessagesVisible

# Messages en traitement
aws sqs get-queue-attributes \
  --queue-url $(aws sqs get-queue-url --queue-name adel-ai-dev-form4-parser | jq -r .QueueUrl) \
  --attribute-names ApproximateNumberOfMessagesNotVisible
```

### Vérifier les logs

```bash
# Logs du parser
aws logs tail /aws/lambda/adel-ai-dev-form4-parser --follow

# Chercher les erreurs
aws logs filter-log-events \
  --log-group-name /aws/lambda/adel-ai-dev-form4-parser \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

### Vérifier les métriques

```bash
# Métriques Lambda
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=adel-ai-dev-form4-parser \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## Troubleshooting

### Queue qui monte (> 100 messages)

**Causes possibles :**
1. Parser trop lent (parsing XML complexe)
2. Rate limiting trop restrictif (100ms trop court)
3. Erreurs répétées (retries)

**Solutions :**
1. Augmenter `BUFFER_SIZE` à 100-200
2. Augmenter le timeout Lambda (5 min → 10 min)
3. Vérifier les logs pour erreurs

### Queue qui reste à 0

**✅ Parfait !** Le système est bien calibré.

### Erreurs répétées

**Vérifier :**
1. Logs CloudWatch pour détails
2. Dead Letter Queue pour messages en échec
3. Permissions IAM (S3, Athena)

## Coûts

- **SQS** : ~$0.40 par million de messages
- **Lambda** : ~$0.20 par 1M requêtes (5 min, 1GB)
- **S3** : Stockage + requêtes (négligeable)
- **CloudWatch** : Métriques gratuites (premiers 10)

**Total estimé : ~$5-10/mois** (pour 1000 Form 4/jour)
