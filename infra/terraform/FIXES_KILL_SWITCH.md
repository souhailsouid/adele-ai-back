# 🔧 Fixes: Kill Switch & Cost Safety

## ✅ Corrections appliquées

### 1. Policy SQS pour EventBridge → SQS

**Problème** : La policy SQS existante n'avait pas de conditions `ArnEquals` pour restreindre les permissions aux règles EventBridge spécifiques.

**Solution** : Ajout de conditions `ArnEquals` pour chaque règle EventBridge :
- `sec_smart_money_sync_cron`
- `sec_smart_money_track_insiders_cron`
- `collector_sec_watcher_cron`
- `collector_rss_cron`

**Fichier modifié** : `infra/terraform/sqs-collectors.tf`

**Impact** : Quand les CRONs seront réactivés, EventBridge pourra correctement envoyer des messages vers SQS.

---

### 2. Throttling Athena dans sec-smart-money-sync

**Problème** : Le worker `sec-smart-money-sync` n'avait pas de throttling explicite entre les requêtes Athena, ce qui pouvait causer des `TooManyRequestsException`.

**Solution** : 
- Ajout d'une constante `ATHENA_QUERY_DELAY = 500ms`
- Ajout d'un `await sleep(ATHENA_QUERY_DELAY)` au début de `executeAthenaQuery()`
- Commentaires explicites sur le cost safety

**Fichier modifié** : `workers/sec-smart-money-sync/src/index.ts`

**Impact** : 
- Maximum 2 requêtes Athena/seconde (500ms entre chaque)
- Évite les `TooManyRequestsException`
- Réduit les risques de coûts explosifs

**Note** : Le code utilise déjà des batch queries (`processInsiderFilingsBatch`) pour optimiser les coûts, mais le throttling ajoute une couche de sécurité supplémentaire.

---

### 3. Kill Switch - Reserved Concurrency

**Déjà implémenté** : Variables Terraform pour contrôler la reserved concurrency :
- `form4_parser_concurrency` (défaut = 1)
- `form144_parser_concurrency` (défaut = 1)
- `sec_smart_money_sync_concurrency` (défaut = 1)
- `parser_13f_concurrency` (défaut = 1)

**Utilisation** :
- `1` = fonctionnement normal mais limité (1 exécution à la fois)
- `0` = arrêt complet (kill switch)

**Limitation** : Le reserved concurrency = 0 bloque les **nouvelles** exécutions, mais pas celles déjà en vol. Pour un arrêt total immédiat :
1. Reserved concurrency → 0
2. Disable EventBridge rules
3. Disable SQS event source mappings
4. (Optionnel) Purge SQS queues

---

## 📋 Checklist de vérification

Avant de réactiver les CRONs :

- [ ] Policy SQS mise à jour avec conditions `ArnEquals` ✅
- [ ] Throttling Athena ajouté dans `sec-smart-money-sync` ✅
- [ ] Reserved concurrency = 1 (normal limité) ✅
- [ ] EventBridge rules désactivées (pour l'instant) ✅
- [ ] SQS event source mappings désactivés (pour l'instant) ✅
- [ ] Budgets AWS configurés avec alertes précoces ✅

---

## 🚀 Réactivation progressive

Quand tu seras prêt à réactiver :

1. **Vérifier le code** : S'assurer que `s3-direct-read` n'est plus utilisé
2. **Reserved concurrency = 1** : Limite naturelle
3. **Enable EventBridge rules** : Un par un, en monitorant
4. **Enable SQS triggers** : Un par un, en monitorant
5. **Monitorer pendant 24h** : Via dashboard admin et budgets AWS

---

## ⚠️ Notes importantes

1. **Policy SQS** : Sans les conditions `ArnEquals`, EventBridge ne peut pas envoyer de messages vers SQS (erreurs silencieuses)
2. **Throttling Athena** : 500ms entre requêtes = max 2 req/s, ce qui est largement en dessous des limites AWS (20 req/s par défaut)
3. **Reserved concurrency = 0** : Bloque les nouvelles exécutions, mais les exécutions en cours continuent (timeout après 15 minutes max)

---

## 📚 Références

- [AWS SQS Queue Policies](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-using-identity-based-policies.html)
- [AWS Athena Limits](https://docs.aws.amazon.com/athena/latest/ug/service-limits.html)
- [AWS Lambda Reserved Concurrency](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html)
