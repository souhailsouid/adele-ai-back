# 📊 Extraction de Données & Alertes Temps Réel

## 🎯 Fonctionnalités Implémentées

### 1. Extraction de Données Structurées

Le système extrait automatiquement les valeurs, prévisions et surprises depuis les news RSS.

**Exemples d'extraction** :
- `"Tokyo area December core CPI +2.3% year on year government according to source poll +2.5%"`
  → `actual: 2.3%`, `forecast: 2.5%`, `surprise: negative` (-0.2pp)

- `"US GDP QoQ Advance Actual 4.3% (Forecast 3.3%, Previous 3.8%)"`
  → `actual: 4.3%`, `forecast: 3.3%`, `previous: 3.8%`, `surprise: positive` (+1.0pp)

**Indicateurs supportés** :
- CPI / Inflation
- GDP
- Employment / NFP
- Retail Sales
- Industrial Production
- Pattern générique pour autres indicateurs

**Données extraites** :
```typescript
{
  actual: 2.3,
  forecast: 2.5,
  previous: 2.1,
  dataType: 'inflation',
  indicator: 'CPI',
  surprise: 'negative',
  surpriseMagnitude: 0.2,
  unit: 'percent',
  period: 'yearly',
  region: 'JP'
}
```

### 2. Alertes Temps Réel

Système d'alertes automatiques déclenché par :
- **Keywords critiques** : Trump, Zelenskiy, CPI, Musk, BTC, TSLA, AI, Fed, etc.
- **Surprises économiques** : Actual vs Forecast avec magnitude > 0.2pp

**Channels supportés** :
- Discord (webhook)
- Slack (webhook)
- Telegram (bot)

**Déclenchement** :
- Trigger Supabase automatique lors de l'insertion d'un signal RSS
- Worker Lambda qui traite les alertes en attente

---

## 📋 Installation

### 1. Appliquer la Migration SQL

```bash
# Dans Supabase Dashboard → SQL Editor
# Exécuter le fichier :
infra/supabase/migrations/018_add_data_extraction_and_alerts.sql
```

**Ou via CLI** :
```bash
supabase db push
```

### 2. Configurer les Webhooks

**Discord** :
1. Créer un webhook dans votre serveur Discord
2. Copier l'URL du webhook
3. Ajouter dans les variables d'environnement Lambda : `DISCORD_WEBHOOK_URL`

**Slack** (optionnel) :
1. Créer une app Slack → Incoming Webhooks
2. Copier l'URL
3. Ajouter : `SLACK_WEBHOOK_URL`

**Telegram** (optionnel) :
1. Créer un bot avec @BotFather
2. Obtenir le token
3. Obtenir le chat_id (envoyer un message au bot, puis `https://api.telegram.org/bot<TOKEN>/getUpdates`)
4. Ajouter : `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID`

### 3. Déployer le Worker Alert-Sender

**Build** :
```bash
cd workers/alert-sender
npm install
npm run bundle
```

**Terraform** (à ajouter dans `infra/terraform/alert-sender.tf`) :
```hcl
resource "aws_lambda_function" "alert_sender" {
  function_name = "${var.project}-${var.stage}-alert-sender"
  role          = aws_iam_role.collector_role.arn
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  filename      = "${path.module}/../../workers/alert-sender/alert-sender.zip"
  timeout       = 60
  memory_size   = 256

  environment {
    variables = {
      SUPABASE_URL        = var.supabase_url
      SUPABASE_SERVICE_KEY = var.supabase_service_key
      DISCORD_WEBHOOK_URL = var.discord_webhook_url
      SLACK_WEBHOOK_URL   = var.slack_webhook_url
      TELEGRAM_BOT_TOKEN  = var.telegram_bot_token
      TELEGRAM_CHAT_ID    = var.telegram_chat_id
    }
  }
}

# Cron: toutes les minutes pour traiter les alertes
resource "aws_cloudwatch_event_rule" "alert_sender_cron" {
  name                = "${var.project}-${var.stage}-alert-sender-cron"
  description         = "Déclenche le alert-sender toutes les minutes"
  schedule_expression = "rate(1 minute)"
}

resource "aws_cloudwatch_event_target" "alert_sender" {
  rule      = aws_cloudwatch_event_rule.alert_sender_cron.name
  target_id = "AlertSender"
  arn       = aws_lambda_function.alert_sender.arn
}
```

---

## 🔧 Configuration

### Ajouter/Modifier des Keywords

```sql
-- Ajouter un nouveau keyword
INSERT INTO alert_keywords (keyword, priority, notification_channels)
VALUES ('AAPL', 7, ARRAY['discord']);

-- Désactiver un keyword
UPDATE alert_keywords 
SET enabled = false 
WHERE keyword = 'AI';

-- Modifier la priorité
UPDATE alert_keywords 
SET priority = 10 
WHERE keyword = 'Fed';
```

### Voir les Alertes Envoyées

```sql
-- Dernières alertes
SELECT 
  a.*,
  s.raw_data->>'title' as signal_title,
  s.extracted_data
FROM alerts_sent a
JOIN signals s ON a.signal_id = s.id
ORDER BY a.sent_at DESC
LIMIT 20;

-- Statistiques par keyword
SELECT 
  keyword,
  channel,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM alerts_sent
GROUP BY keyword, channel
ORDER BY total DESC;
```

---

## 📊 Exemples d'Alertes

### Alerte Keyword (Trump)

```
🔴 FinancialJuice: Trump: Tonight, at my direction as commander in chief...

Keyword: Trump | Financial Juice RSS
```

### Alerte Surprise Économique (CPI)

```
🟠 FinancialJuice: Tokyo area December core CPI +2.3% year on year...

📊 Données:
- Actual: 2.3%
- Forecast: 2.5%
- Previous: 2.1%
📉 Surprise: negative (0.20pp)

Keyword: CPI | Financial Juice RSS
```

---

## 🧪 Tester

### Test d'Extraction de Données

```typescript
import { extractStructuredData } from './workers/collector-rss/src/data-extractor';

const title = "Tokyo area December core CPI +2.3% year on year government according to source poll +2.5%";
const data = extractStructuredData(title);

console.log(data);
// {
//   actual: 2.3,
//   forecast: 2.5,
//   dataType: 'inflation',
//   indicator: 'CPI',
//   surprise: 'negative',
//   surpriseMagnitude: 0.2,
//   region: 'JP',
//   period: 'yearly'
// }
```

### Test d'Alerte Manuelle

```sql
-- Insérer un signal de test
INSERT INTO signals (source, type, raw_data)
VALUES (
  'rss',
  'macro',
  '{"title": "FinancialJuice: Trump announces new policy", "feed": "financial-juice"}'
);

-- Vérifier que l'alerte a été créée
SELECT * FROM alerts_sent WHERE status = 'pending' ORDER BY sent_at DESC LIMIT 1;
```

---

## 🚀 Prochaines Étapes

1. ✅ **Appliquez la migration SQL** dans Supabase
2. ✅ **Configurez les webhooks** (Discord minimum)
3. ✅ **Déployez le worker alert-sender** via Terraform
4. ✅ **Testez** avec un signal contenant "Trump" ou "CPI"
5. ➡️ **Ajustez les keywords** selon vos besoins

---

## 📝 Notes

- Les alertes sont créées automatiquement par le trigger Supabase
- Le worker `alert-sender` traite les alertes toutes les minutes
- Les alertes échouées sont marquées `failed` avec un message d'erreur
- Vous pouvez réessayer les alertes échouées en les remettant à `pending`

---

## 🔍 Monitoring

```sql
-- Vue récapitulative des alertes
SELECT * FROM v_alerts_summary 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```


