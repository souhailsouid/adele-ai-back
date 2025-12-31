# 🧪 Guide de Test : Collector RSS

## 📋 Objectif

Tester le `collector-rss` existant pour vérifier qu'il fonctionne correctement avant d'ajouter Financial Juice.

---

## ✅ Méthode 1 : Test Local (Recommandé)

### 1. Créer un script de test local

Créez un fichier `workers/collector-rss/test-local.ts` :

```typescript
/**
 * Script de test local pour collector-rss
 * Usage: npx tsx test-local.ts
 */

import { handler } from './src/index';
import { EventBridgeEvent } from 'aws-lambda';

// Simuler un événement EventBridge
const mockEvent: EventBridgeEvent<"Scheduled Event", any> = {
  version: '0',
  id: 'test-event-id',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  account: '123456789012',
  time: new Date().toISOString(),
  region: 'us-east-1',
  resources: [],
  detail: {},
};

async function test() {
  console.log('🚀 Démarrage du test collector-rss...\n');

  try {
    const result = await handler(mockEvent);
    console.log('\n✅ Test réussi !');
    console.log('Résultat:', JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error('\n❌ Test échoué !');
    console.error('Erreur:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

test();
```

### 2. Installer les dépendances

```bash
cd workers/collector-rss
npm install
```

### 3. Créer un fichier `.env` dans `workers/collector-rss/`

```bash
# workers/collector-rss/.env
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_KEY=votre-service-key
EVENT_BUS_NAME=adel-signals-bus  # Optionnel pour test local
```

### 4. Lancer le test

```bash
cd workers/collector-rss
npx tsx test-local.ts
```

**Résultat attendu** :
```
🚀 Démarrage du test collector-rss...

Fetching RSS feed: reuters
Found 20 items in reuters
Signal created and event published: abc-123-def
Fetching RSS feed: ap
Found 15 items in ap
...
✅ Test réussi !
```

---

## ✅ Méthode 2 : Vérifier dans Supabase

### 1. Se connecter à Supabase Dashboard

Allez sur https://app.supabase.com → Votre projet → Table Editor

### 2. Vérifier la table `signals`

```sql
-- Voir les derniers signaux RSS collectés
SELECT 
  id,
  source,
  type,
  timestamp,
  raw_data->>'title' as title,
  raw_data->>'feed' as feed,
  raw_data->>'url' as url,
  processing_status,
  created_at
FROM signals
WHERE source = 'rss'
ORDER BY created_at DESC
LIMIT 20;
```

### 3. Vérifier les statistiques

```sql
-- Statistiques par feed RSS
SELECT 
  raw_data->>'feed' as feed,
  COUNT(*) as total_signals,
  COUNT(*) FILTER (WHERE processing_status = 'pending') as pending,
  COUNT(*) FILTER (WHERE processing_status = 'completed') as completed,
  MIN(created_at) as first_signal,
  MAX(created_at) as last_signal
FROM signals
WHERE source = 'rss'
GROUP BY raw_data->>'feed'
ORDER BY total_signals DESC;
```

### 4. Vérifier les doublons (problème potentiel)

```sql
-- Vérifier s'il y a des doublons (même URL)
SELECT 
  raw_data->>'url' as url,
  COUNT(*) as count,
  array_agg(id) as signal_ids
FROM signals
WHERE source = 'rss'
GROUP BY raw_data->>'url'
HAVING COUNT(*) > 1
LIMIT 10;
```

---

## ✅ Méthode 3 : Vérifier les Logs CloudWatch (Si déployé)

### 1. Via AWS Console

1. Allez sur AWS Console → CloudWatch → Log Groups
2. Cherchez : `/aws/lambda/{project}-{stage}-collector-rss`
3. Ouvrez le dernier log stream
4. Vérifiez les logs de la dernière exécution

### 2. Via AWS CLI

```bash
# Voir les derniers logs
aws logs tail /aws/lambda/adel-prod-collector-rss --follow

# Voir les logs des 10 dernières minutes
aws logs tail /aws/lambda/adel-prod-collector-rss --since 10m
```

**Logs attendus** :
```
RSS Collector triggered
Fetching RSS feed: reuters
Found 20 items in reuters
Signal created and event published: abc-123-def
...
```

---

## ✅ Méthode 4 : Test d'un Flux RSS Individuel

### Script de test pour un seul flux

Créez `workers/collector-rss/test-single-feed.ts` :

```typescript
/**
 * Tester un seul flux RSS
 * Usage: npx tsx test-single-feed.ts reuters
 */

import { supabase } from './src/supabase';

const FEED_NAME = process.argv[2] || 'reuters';

const RSS_FEEDS: Record<string, string> = {
  reuters: 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best',
  ap: 'https://apnews.com/apf-topnews',
  'yahoo-finance': 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=finance&region=US&lang=en-US',
  cnbc: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  marketwatch: 'https://feeds.marketwatch.com/marketwatch/topstories/',
};

async function testSingleFeed() {
  const feedUrl = RSS_FEEDS[FEED_NAME];
  
  if (!feedUrl) {
    console.error(`❌ Feed "${FEED_NAME}" non trouvé`);
    console.log('Feeds disponibles:', Object.keys(RSS_FEEDS).join(', '));
    process.exit(1);
  }

  console.log(`🧪 Test du flux: ${FEED_NAME}`);
  console.log(`📡 URL: ${feedUrl}\n`);

  try {
    // 1. Récupérer le flux RSS
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'ADEL AI (contact@adel.ai)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    console.log(`✅ Flux récupéré (${xml.length} caractères)\n`);

    // 2. Parser le XML (copier la fonction depuis index.ts)
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
    const items: any[] = [];

    for (const match of itemMatches) {
      const itemXml = match[1];
      const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/);
      const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);

      if (titleMatch && linkMatch) {
        items.push({
          title: (titleMatch[1] || titleMatch[2] || '').trim(),
          description: (descMatch?.[1] || descMatch?.[2] || '').trim().substring(0, 100),
          link: linkMatch[1].trim(),
          pubDate: pubDateMatch?.[1]?.trim(),
        });
      }
    }

    console.log(`📰 ${items.length} items trouvés\n`);

    // 3. Afficher les 5 premiers items
    console.log('📋 Premiers items:');
    items.slice(0, 5).forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.title}`);
      console.log(`   URL: ${item.link}`);
      console.log(`   Date: ${item.pubDate || 'N/A'}`);
      if (item.description) {
        console.log(`   Description: ${item.description}...`);
      }
    });

    // 4. Vérifier dans Supabase
    console.log('\n🔍 Vérification dans Supabase...');
    const { data: existing, error } = await supabase
      .from('signals')
      .select('id, created_at, raw_data')
      .eq('source', 'rss')
      .eq('raw_data->>feed', FEED_NAME)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Erreur Supabase:', error);
    } else {
      console.log(`✅ ${existing?.length || 0} signaux trouvés dans Supabase pour "${FEED_NAME}"`);
      if (existing && existing.length > 0) {
        console.log('\nDerniers signaux:');
        existing.forEach((signal: any, i: number) => {
          console.log(`${i + 1}. ${signal.raw_data?.title || 'N/A'}`);
          console.log(`   Créé: ${signal.created_at}`);
        });
      }
    }

    console.log('\n✅ Test terminé !');
  } catch (error: any) {
    console.error('\n❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testSingleFeed();
```

**Usage** :
```bash
cd workers/collector-rss
npx tsx test-single-feed.ts reuters
npx tsx test-single-feed.ts ap
npx tsx test-single-feed.ts yahoo-finance
```

---

## ✅ Méthode 5 : Vérifier EventBridge (Si déployé)

### 1. Vérifier les événements publiés

```bash
# Via AWS CLI
aws events list-rules --name-prefix "collector-rss"

# Voir les événements récents
aws logs tail /aws/events/adel-signals-bus --follow
```

### 2. Vérifier que processor-ia reçoit les événements

Vérifiez les logs de `processor-ia` pour voir s'il traite les signaux RSS.

---

## 🐛 Dépannage

### Problème : "Missing required environment variable"

**Solution** : Vérifiez que `.env` existe et contient :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `EVENT_BUS_NAME` (optionnel pour test local)

### Problème : "RSS fetch error: 403"

**Solution** : Certains flux RSS bloquent les requêtes sans User-Agent. Vérifiez que le header est bien envoyé.

### Problème : "Error inserting signal"

**Solution** : Vérifiez :
1. Les permissions Supabase (RLS policies)
2. La structure de la table `signals`
3. Les logs Supabase pour plus de détails

### Problème : Aucun signal dans Supabase

**Vérifications** :
1. Le test s'est bien exécuté ?
2. Y a-t-il des erreurs dans les logs ?
3. Les flux RSS sont-ils accessibles ? (tester l'URL dans un navigateur)

---

## 📊 Checklist de Test

- [ ] Test local fonctionne (`npx tsx test-local.ts`)
- [ ] Au moins un flux RSS retourne des items
- [ ] Les signaux sont insérés dans Supabase
- [ ] Pas de doublons (même URL)
- [ ] Les événements EventBridge sont publiés (si déployé)
- [ ] Les logs CloudWatch montrent des exécutions réussies (si déployé)

---

## 🎯 Prochaines Étapes

Une fois que vous avez vérifié que le collector-rss fonctionne :

1. ✅ Vérifier les signaux dans Supabase
2. ✅ Vérifier qu'il n'y a pas de doublons
3. ✅ Vérifier que les événements EventBridge sont publiés
4. ➡️ Ensuite, on pourra ajouter Financial Juice RSS


