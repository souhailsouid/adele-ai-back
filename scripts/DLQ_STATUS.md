# 📊 État des Dead Letter Queues (DLQ)

## ✅ Résumé

**Date de vérification:** $(date)

### DLQ Status
- ✅ **adel-ai-dev-form4-parser-dlq**: 0 messages
- ✅ **adel-ai-dev-collectors-dlq**: 0 messages
- ✅ **adel-ai-dev-parser-13f-dlq**: 0 messages
- ✅ **adel-ai-dev-form144-parser-dlq**: 0 messages

**Conclusion:** Aucun message en DLQ - système sain ✅

## 🔧 Configuration

### Queues principales et leurs DLQ

| Queue principale | DLQ associée | maxReceiveCount | Rétention DLQ |
|-----------------|--------------|-----------------|---------------|
| `form4-parser` | `form4-parser-dlq` | 3 | 14 jours |
| `collectors` | `collectors-dlq` | 3 | 14 jours |
| `parser-13f` | `parser-13f-dlq` | 3 | 14 jours |
| `form144-parser-queue` | `form144-parser-dlq` | 3 | 14 jours |

### Comportement

1. **maxReceiveCount = 3**: Un message qui échoue 3 fois est automatiquement déplacé vers la DLQ
2. **Rétention DLQ = 14 jours**: Les messages en DLQ sont conservés 14 jours pour analyse
3. **Pas de retry automatique depuis DLQ**: Les messages en DLQ doivent être traités manuellement

## 🚨 Que faire si des messages apparaissent en DLQ ?

### 1. Vérifier les logs CloudWatch
```bash
# Voir les logs de la Lambda qui a échoué
aws logs tail /aws/lambda/adel-ai-dev-<lambda-name> --follow
```

### 2. Analyser les messages en DLQ
```bash
# Recevoir un message de la DLQ (sans le supprimer)
aws sqs receive-message \
  --queue-url <DLQ_URL> \
  --max-number-of-messages 1 \
  --attribute-names All
```

### 3. Options de récupération

**Option A: Rejouer manuellement**
- Extraire le message de la DLQ
- Corriger le problème (bug, données invalides, etc.)
- Renvoyer le message dans la queue principale

**Option B: Purger la DLQ (si messages non critiques)**
```bash
aws sqs purge-queue --queue-url <DLQ_URL>
```

**Option C: Créer une Lambda de récupération**
- Lambda déclenchée par EventBridge (cron quotidien)
- Lit les messages de la DLQ
- Tente de les rejouer après correction

## 📝 Scripts de vérification

- `scripts/check-dlq-status.sh`: Vérifie le nombre de messages dans chaque DLQ
- `scripts/check-dlq-config.sh`: Vérifie la configuration des redrive policies

## ⚠️ Alertes recommandées

Créer des alarmes CloudWatch pour :
- `ApproximateNumberOfMessages > 0` sur chaque DLQ
- Envoyer une notification SNS/Email si des messages apparaissent
