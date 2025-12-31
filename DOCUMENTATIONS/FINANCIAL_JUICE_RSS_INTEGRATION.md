# Intégration Financial Juice RSS - Roadmap & Spécifications

## 📊 État Actuel

### Ce qui existe déjà
- ✅ **collector-rss** : Worker Lambda TypeScript qui collecte 5 flux RSS (Reuters, AP, Yahoo Finance, CNBC, MarketWatch)
- ✅ **financial-juice.service.ts** : Service API qui scrape la page web Financial Juice et analyse avec OpenAI
- ✅ **Table `signals`** : Stockage des signaux multi-sources dans Supabase
- ✅ **EventBridge** : Orchestration des événements (New Signal → processor-ia)
- ✅ **Déduplication basique** : Vérification par URL dans `raw_data->>url`

### Ce qui manque
- ❌ Flux RSS Financial Juice non intégré dans le collector
- ❌ Déduplication par `<guid>` (actuellement par URL uniquement)
- ❌ Nettoyage HTML des descriptions (ex: `<ul><li>` dans le flux)
- ❌ Système de filtrage par keywords
- ❌ Webhooks (Discord/Slack/Telegram)
- ❌ Catégorisation automatique (Macro, Forex, Crypto, etc.)

---

## 🎯 Recommandations Techniques

### 1. **Intégration dans l'existant (Recommandé)**

**Pourquoi** : Votre architecture est déjà solide. Il suffit d'étendre le `collector-rss` existant.

**Avantages** :
- Réutilise l'infrastructure EventBridge
- Pas de duplication de code
- Cohérence avec les autres flux RSS
- Déploiement simple

**Modifications nécessaires** :
1. Ajouter Financial Juice dans `RSS_FEEDS`
2. Améliorer le parser pour gérer `<guid>` et nettoyer le HTML
3. Utiliser `guid` pour la déduplication (plus fiable que l'URL)

### 2. **Alternative : Service dédié (Si besoin de fréquence différente)**

Si Financial Juice nécessite un polling toutes les 30 secondes (vs 15 min pour les autres), créer un `collector-financial-juice` séparé.

---

## 🚀 Roadmap d'Implémentation (4 Sprints)

### Sprint 1 : Intégration RSS & Amélioration Parser (2-3 jours)

**Objectifs** :
- Intégrer le flux RSS Financial Juice dans `collector-rss`
- Parser amélioré avec support `<guid>`
- Nettoyage HTML basique des descriptions

**Modifications** :

```typescript
// workers/collector-rss/src/index.ts

const RSS_FEEDS = [
  // ... existants
  { 
    url: "https://www.financialjuice.com/rss", // À vérifier l'URL exacte
    name: "financial-juice", 
    type: "macro" // Nouveau type pour différencier
  },
];

// Parser amélioré
function parseRSSFeed(xml: string): Array<{
  title: string;
  description: string;
  link: string;
  pubDate?: string;
  guid?: string; // NOUVEAU
}> {
  // ... extraction guid
  const guidMatch = itemXml.match(/<guid[^>]*>(.*?)<\/guid>/);
  // ... nettoyage HTML description
  const cleanDescription = cleanHTML(descMatch?.[1] || descMatch?.[2] || "");
}

function cleanHTML(html: string): string {
  // Retirer les balises HTML, garder le texte
  return html
    .replace(/<ul>/g, '\n')
    .replace(/<\/ul>/g, '')
    .replace(/<li>/g, '• ')
    .replace(/<\/li>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '') // Retirer toutes les autres balises
    .trim();
}
```

**Déduplication améliorée** :
```typescript
// Utiliser guid si disponible, sinon fallback sur URL
const dedupKey = item.guid || item.link;
const { data: existing } = await supabase
  .from("signals")
  .select("id")
  .eq("source", "rss")
  .or(`raw_data->>guid.eq.${dedupKey},raw_data->>url.eq.${item.link}`)
  .single();
```

**Migration Supabase** (optionnel) :
```sql
-- Ajouter un index sur guid pour performance
CREATE INDEX IF NOT EXISTS idx_signals_guid 
ON signals USING gin((raw_data->>'guid'));
```

---

### Sprint 2 : Filtrage & Catégorisation (3-4 jours)

**Objectifs** :
- Système de keywords pour filtrer les news importantes
- Catégorisation automatique (Macro, Forex, Crypto, Earnings, etc.)
- Priorisation des sources

**Nouvelle table Supabase** :
```sql
-- Table de filtres/keywords
CREATE TABLE rss_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  category TEXT, -- 'macro', 'forex', 'crypto', 'earnings', etc.
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exemples de keywords
INSERT INTO rss_keywords (keyword, category, priority) VALUES
  ('Fed', 'macro', 10),
  ('GDP', 'macro', 9),
  ('CPI', 'macro', 9),
  ('Nonfarm Payrolls', 'macro', 10),
  ('ECB', 'forex', 8),
  ('Bitcoin', 'crypto', 7),
  ('Earnings', 'earnings', 6);

-- Index pour recherche rapide
CREATE INDEX idx_rss_keywords_enabled ON rss_keywords(keyword) WHERE enabled = true;
```

**Service de filtrage** :
```typescript
// workers/collector-rss/src/filter.ts

interface KeywordFilter {
  keyword: string;
  category: string;
  priority: number;
}

export async function shouldProcessItem(
  title: string,
  description: string
): Promise<{ shouldProcess: boolean; category?: string; priority?: number }> {
  // Récupérer les keywords depuis Supabase
  const { data: keywords } = await supabase
    .from('rss_keywords')
    .select('*')
    .eq('enabled', true);

  if (!keywords || keywords.length === 0) {
    return { shouldProcess: true }; // Pas de filtres = tout accepter
  }

  const text = `${title} ${description}`.toLowerCase();
  
  // Chercher les matches
  const matches = keywords.filter(k => 
    text.includes(k.keyword.toLowerCase())
  );

  if (matches.length === 0) {
    return { shouldProcess: false }; // Pas de match = ignorer
  }

  // Prendre le match avec la priorité la plus élevée
  const bestMatch = matches.reduce((best, current) => 
    current.priority > best.priority ? current : best
  );

  return {
    shouldProcess: true,
    category: bestMatch.category,
    priority: bestMatch.priority,
  };
}
```

**Intégration dans collector** :
```typescript
// Dans collectRSSFeed()
for (const item of items) {
  // Filtrage par keywords
  const filterResult = await shouldProcessItem(item.title, item.description);
  if (!filterResult.shouldProcess) {
    console.log(`Skipping item (no keyword match): ${item.title}`);
    continue;
  }

  // ... reste du code avec category et priority
  const { data: signal } = await supabase
    .from("signals")
    .insert({
      source: "rss",
      type: filterResult.category || feed.type,
      // ...
      raw_data: {
        // ...
        category: filterResult.category,
        priority: filterResult.priority,
      },
    });
}
```

---

### Sprint 3 : Webhooks & Alerting (4-5 jours)

**Objectifs** :
- Service de webhooks pour Discord/Slack/Telegram
- Formatage des messages (Embeds Discord)
- Filtrage par priorité (envoyer uniquement high/critical)

**Nouvelle table Supabase** :
```sql
-- Configuration des webhooks
CREATE TABLE webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('discord', 'slack', 'telegram')),
  url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  min_priority INTEGER DEFAULT 7, -- Envoyer uniquement si priority >= 7
  filters JSONB, -- Ex: {"categories": ["macro"], "keywords": ["Fed"]}
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Nouveau worker Lambda** : `webhook-sender`
```typescript
// workers/webhook-sender/src/index.ts

import { EventBridgeEvent } from "aws-lambda";
import { supabase } from "./supabase";

export const handler = async (
  event: EventBridgeEvent<"New Signal", { signal_id: string }>
) => {
  const signalId = event.detail.signal_id;

  // Récupérer le signal
  const { data: signal } = await supabase
    .from("signals")
    .select("*")
    .eq("id", signalId)
    .single();

  if (!signal || signal.source !== "rss") {
    return; // Pas un signal RSS
  }

  // Récupérer les webhooks configurés
  const { data: webhooks } = await supabase
    .from("webhook_configs")
    .select("*")
    .eq("enabled", true);

  if (!webhooks || webhooks.length === 0) {
    return;
  }

  // Vérifier les filtres et envoyer
  for (const webhook of webhooks) {
    if (shouldSendToWebhook(signal, webhook)) {
      await sendWebhook(signal, webhook);
    }
  }
};

function shouldSendToWebhook(signal: any, webhook: any): boolean {
  const priority = signal.raw_data?.priority || 5;
  if (priority < webhook.min_priority) {
    return false;
  }

  // Vérifier les filtres (categories, keywords, etc.)
  if (webhook.filters) {
    // ... logique de filtrage
  }

  return true;
}

async function sendWebhook(signal: any, webhook: any) {
  const message = formatMessage(signal, webhook.type);
  
  await fetch(webhook.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });
}

function formatMessage(signal: any, type: "discord" | "slack" | "telegram") {
  if (type === "discord") {
    return {
      embeds: [{
        title: signal.raw_data.title,
        description: signal.raw_data.description?.substring(0, 2000),
        url: signal.raw_data.url,
        color: getColorByPriority(signal.raw_data.priority),
        timestamp: signal.timestamp,
        footer: { text: `Financial Juice - ${signal.raw_data.category}` },
      }],
    };
  }
  // ... formats pour Slack et Telegram
}
```

**Configuration EventBridge** :
```hcl
# infra/terraform/webhook-sender.tf

resource "aws_lambda_function" "webhook_sender" {
  # ... config
}

resource "aws_cloudwatch_event_rule" "new_signal" {
  name = "new-signal-webhook"
  event_pattern = jsonencode({
    source = ["adel.signals"]
    detail-type = ["New Signal"]
  })
}

resource "aws_cloudwatch_event_target" "webhook_sender" {
  rule = aws_cloudwatch_event_rule.new_signal.name
  arn = aws_lambda_function.webhook_sender.arn
}
```

---

### Sprint 4 : Performance & Monitoring (2-3 jours)

**Objectifs** :
- Monitoring des flux RSS (alertes si down)
- Cache Redis pour déduplication (optionnel, Supabase suffit pour MVP)
- Rate limiting si nécessaire
- Métriques CloudWatch

**Monitoring** :
```typescript
// Dans collector-rss handler
const startTime = Date.now();
let successCount = 0;
let errorCount = 0;

for (const feed of RSS_FEEDS) {
  try {
    await collectRSSFeed(feed);
    successCount++;
  } catch (error) {
    errorCount++;
    // Envoyer métrique CloudWatch
    await cloudwatch.putMetricData({
      Namespace: 'RSSCollector',
      MetricData: [{
        MetricName: 'FeedError',
        Value: 1,
        Dimensions: [{ Name: 'FeedName', Value: feed.name }],
      }],
    });
  }
}

// Métrique globale
await cloudwatch.putMetricData({
  Namespace: 'RSSCollector',
  MetricData: [{
    MetricName: 'ExecutionTime',
    Value: Date.now() - startTime,
  }],
});
```

**CloudWatch Alarms** :
```hcl
# Alert si aucun signal collecté depuis 30 min
resource "aws_cloudwatch_metric_alarm" "rss_collector_down" {
  alarm_name = "rss-collector-no-signals"
  comparison_operator = "LessThanThreshold"
  evaluation_periods = 2
  metric_name = "SignalsCollected"
  namespace = "RSSCollector"
  period = 900 # 15 min
  statistic = "Sum"
  threshold = 1
  alarm_description = "Aucun signal RSS collecté depuis 30 minutes"
}
```

---

## 📋 Checklist d'Implémentation

### Phase 1 : MVP (Sprint 1)
- [ ] Ajouter Financial Juice dans `RSS_FEEDS`
- [ ] Améliorer parser pour `<guid>`
- [ ] Implémenter `cleanHTML()`
- [ ] Mettre à jour déduplication (guid + URL)
- [ ] Tester avec le flux RSS réel
- [ ] Déployer et vérifier les signaux dans Supabase

### Phase 2 : Intelligence (Sprint 2)
- [ ] Créer table `rss_keywords`
- [ ] Implémenter `shouldProcessItem()`
- [ ] Ajouter catégorisation automatique
- [ ] Tester filtrage avec keywords réels
- [ ] Documenter les keywords recommandés

### Phase 3 : Alerting (Sprint 3)
- [ ] Créer table `webhook_configs`
- [ ] Créer worker `webhook-sender`
- [ ] Implémenter formats Discord/Slack/Telegram
- [ ] Configurer EventBridge rule
- [ ] Tester avec webhook de test

### Phase 4 : Production (Sprint 4)
- [ ] Ajouter monitoring CloudWatch
- [ ] Configurer alertes
- [ ] Documenter l'API webhooks
- [ ] Tests de charge (si nécessaire)
- [ ] Documentation utilisateur

---

## 🔧 Configuration Recommandée

### Keywords Prioritaires (Exemples)
```sql
-- Macro (Priorité 10)
INSERT INTO rss_keywords (keyword, category, priority) VALUES
  ('Fed', 'macro', 10),
  ('Federal Reserve', 'macro', 10),
  ('Nonfarm Payrolls', 'macro', 10),
  ('CPI', 'macro', 9),
  ('GDP', 'macro', 9),
  ('PCE', 'macro', 9),
  ('ECB', 'forex', 8),
  ('BoJ', 'forex', 8),
  ('BoE', 'forex', 8);

-- Crypto (Priorité 7)
INSERT INTO rss_keywords (keyword, category, priority) VALUES
  ('Bitcoin', 'crypto', 7),
  ('BTC', 'crypto', 7),
  ('Ethereum', 'crypto', 7),
  ('ETH', 'crypto', 7);

-- Earnings (Priorité 6)
INSERT INTO rss_keywords (keyword, category, priority) VALUES
  ('Earnings', 'earnings', 6),
  ('Q1', 'earnings', 6),
  ('Q2', 'earnings', 6),
  ('Q3', 'earnings', 6),
  ('Q4', 'earnings', 6);
```

### Webhook Discord (Exemple)
```json
{
  "name": "Financial Juice - Macro Alerts",
  "type": "discord",
  "url": "https://discord.com/api/webhooks/...",
  "enabled": true,
  "min_priority": 8,
  "filters": {
    "categories": ["macro", "forex"],
    "keywords": ["Fed", "ECB", "GDP", "CPI"]
  }
}
```

---

## 💡 Alternatives & Optimisations

### Option A : Redis pour Déduplication (Si volume élevé)
Si vous collectez > 1000 items/jour, Redis peut être utile :
```typescript
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });

// Dans collectRSSFeed()
const cacheKey = `rss:guid:${item.guid}`;
const exists = await redis.exists(cacheKey);
if (exists) continue;

await redis.setex(cacheKey, 86400, '1'); // 24h TTL
```

**Coût** : ~$10/mois (ElastiCache t3.micro)

### Option B : Lambda avec Réservé Concurrency
Pour garantir la fréquence de polling :
```hcl
resource "aws_lambda_function" "collector_rss" {
  # ...
  reserved_concurrent_executions = 1
}
```

### Option C : SQS pour Découplage
Si le traitement devient long, utiliser SQS :
```
RSS Feed → Lambda Collector → SQS → Lambda Processor → Supabase
```

---

## 📊 Métriques de Succès

- **Latence** : < 2 min entre publication RSS et signal en base
- **Déduplication** : 0% de doublons
- **Uptime** : > 99.5% (collector fonctionne)
- **Webhooks** : < 5s entre signal et notification Discord

---

## 🚨 Points d'Attention

1. **Rate Limiting** : Financial Juice peut limiter les requêtes. Ajouter retry avec backoff exponentiel.
2. **HTML Parsing** : Le flux contient du HTML dans les descriptions. Tester avec plusieurs formats.
3. **Guid Uniqueness** : Vérifier que les `<guid>` sont bien uniques (certains flux peuvent avoir des doublons).
4. **Timezone** : Les `pubDate` sont en GMT. Convertir correctement en UTC.

---

## 📚 Ressources

- [RSS 2.0 Specification](https://www.rssboard.org/rss-specification)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime) (pour notifications frontend)
- [Discord Webhooks](https://discord.com/developers/docs/resources/webhook)
- [AWS EventBridge Patterns](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html)


