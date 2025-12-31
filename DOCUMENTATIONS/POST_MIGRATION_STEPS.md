# ✅ Étapes Après la Migration SQL

## 🎯 Checklist Post-Migration

### 1. ✅ Vérifier que la Migration a Réussi

Dans Supabase Dashboard → SQL Editor, exécutez :

```sql
-- Vérifier que extracted_data existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'signals' AND column_name = 'extracted_data';
-- Doit retourner : extracted_data | jsonb

-- Vérifier que les tables existent
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('alert_keywords', 'alerts_sent');
-- Doit retourner : alert_keywords et alerts_sent

-- Vérifier les triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('signals', 'alert_keywords');
-- Doit retourner : trigger_alert_on_signal_insert et update_alert_keywords_updated_at
```

---

### 2. 🔔 Activer Realtime dans le Dashboard

**IMPORTANT** : La migration SQL active Realtime, mais vous devez AUSSI l'activer dans le Dashboard.

1. **Aller dans Supabase Dashboard**
2. **Database** → **Replication**
3. **Trouver la table `signals`**
4. **Cocher "Enable Realtime"** ✅
5. **Sauvegarder**

**Vérification** :
```sql
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'signals';
-- Doit retourner une ligne
```

---

### 3. 🔒 Vérifier RLS (Sécurité)

```sql
-- Vérifier que RLS est activé
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('signals', 'alert_keywords', 'alerts_sent');
-- Doit retourner rowsecurity = true pour toutes

-- Vérifier les policies
SELECT tablename, policyname, cmd
FROM pg_policies 
WHERE tablename = 'signals';
-- Doit retourner :
-- - "Allow read signals" (SELECT)
-- - "Allow write signals for service_role" (INSERT)
-- - "Allow update signals for service_role" (UPDATE)
-- - "Allow delete signals for service_role" (DELETE)
```

---

### 4. 🧪 Tester avec un Signal

```sql
-- Insérer un signal de test avec extracted_data
INSERT INTO signals (source, type, raw_data, extracted_data)
VALUES (
  'rss',
  'macro',
  '{"title": "FinancialJuice: Tokyo CPI +2.3% (Forecast +2.5%)", "feed": "financial-juice"}',
  '{"actual": 2.3, "forecast": 2.5, "surprise": "negative", "surpriseMagnitude": 0.2, "indicator": "CPI", "region": "JP"}'
);

-- Vérifier que le signal a été créé
SELECT 
  id,
  raw_data->>'title' as title,
  extracted_data->>'actual' as actual,
  extracted_data->>'forecast' as forecast,
  extracted_data->>'surprise' as surprise
FROM signals
WHERE source = 'rss'
ORDER BY created_at DESC
LIMIT 1;
-- Doit retourner le signal avec extracted_data
```

---

### 5. 🔔 Tester le Trigger d'Alerte

```sql
-- Insérer un signal avec keyword "Trump"
INSERT INTO signals (source, type, raw_data)
VALUES (
  'rss',
  'macro',
  '{"title": "FinancialJuice: Trump announces new policy", "feed": "financial-juice"}'
);

-- Vérifier qu'une alerte a été créée
SELECT 
  a.*,
  s.raw_data->>'title' as signal_title
FROM alerts_sent a
JOIN signals s ON a.signal_id = s.id
ORDER BY a.sent_at DESC
LIMIT 1;
-- Doit retourner une alerte avec keyword = "Trump" et status = "pending"
```

---

### 6. 🚀 Rebuild et Redéployer Collector-RSS

L'extraction de données est intégrée dans le collector. Il faut rebuild et redéployer :

```bash
# Build
cd workers/collector-rss
npm install
npm run bundle

# Vérifier que le fichier existe
ls -lh collector-rss.zip
```

**Puis redéployer via Terraform** (le collector existe déjà dans votre infra).

---

### 7. 📱 Frontend : Tester l'API

Le frontend peut maintenant utiliser l'API :

```typescript
// Tester la récupération des signaux avec extracted_data
const response = await fetch(
  `${API_URL}/signals?source=rss&type=macro&limit=10`,
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  }
);

const signals = await response.json();

// Vérifier qu'un signal a extracted_data
const signalWithData = signals.find(
  (s: Signal) => s.raw_data?.extracted_data?.actual !== undefined
);

console.log('Signal avec données extraites:', signalWithData);
console.log('Actual:', signalWithData?.raw_data?.extracted_data?.actual);
```

---

### 8. 🔔 Frontend : Tester Realtime (Optionnel)

```typescript
// Tester Supabase Realtime
import { supabase } from '@/lib/supabase';

const channel = supabase
  .channel('test-signals')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'signals',
    filter: 'source=eq.rss',
  }, (payload) => {
    console.log('Nouveau signal reçu:', payload.new);
  })
  .subscribe();

// Attendre quelques secondes, puis insérer un signal de test
// Le frontend devrait recevoir la notification instantanément
```

---

## ✅ Checklist Finale

- [ ] Migration SQL exécutée sans erreur
- [ ] `extracted_data` existe sur la table `signals`
- [ ] Tables `alert_keywords` et `alerts_sent` créées
- [ ] Triggers créés (`trigger_alert_on_signal_insert`, `update_alert_keywords_updated_at`)
- [ ] Realtime activé dans Dashboard Supabase
- [ ] Realtime vérifié avec `pg_publication_tables`
- [ ] RLS activé et policies créées
- [ ] Test : Signal avec `extracted_data` inséré
- [ ] Test : Alerte créée automatiquement (trigger)
- [ ] Collector-RSS rebuild et redéployé
- [ ] Frontend : Test API `/signals` avec `extracted_data`
- [ ] Frontend : Test Realtime (optionnel)

---

## 🐛 Dépannage

### Realtime ne fonctionne pas

**Vérifier** :
1. ✅ Migration SQL appliquée
2. ✅ "Enable Realtime" coché dans Dashboard
3. ✅ `SELECT * FROM pg_publication_tables` retourne `signals`

**Si toujours pas de Realtime** :
```sql
-- Réactiver
ALTER PUBLICATION supabase_realtime DROP TABLE signals;
ALTER PUBLICATION supabase_realtime ADD TABLE signals;
-- Puis re-vérifier dans Dashboard
```

### Aucune donnée extraite

**Vérifier** :
1. ✅ Collector-RSS rebuild et redéployé
2. ✅ Des signaux RSS récents existent
3. ✅ Les signaux contiennent des patterns extractibles (CPI, GDP, etc.)

**Test** :
```sql
-- Vérifier les signaux RSS récents
SELECT 
  id,
  raw_data->>'title' as title,
  extracted_data
FROM signals
WHERE source = 'rss'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📚 Documentation

- **Schéma JSON** : `DOCUMENTATIONS/SCHEMA_EXTRACTED_DATA.md`
- **Sécurité RLS** : `DOCUMENTATIONS/SECURITE_RLS.md`
- **Guide Frontend** : `DOCUMENTATIONS/FRONTEND_GUIDE_DATA_EXTRACTION_ALERTS.md`
- **Realtime** : `DOCUMENTATIONS/REALTIME_CONFIGURATION.md`

---

## 🎉 C'est Fait !

Une fois toutes les étapes complétées, le système est opérationnel :

- ✅ Extraction de données automatique
- ✅ Alertes temps réel (frontend via Realtime)
- ✅ Sécurité RLS configurée
- ✅ API prête pour le frontend

**Le frontend peut maintenant commencer à implémenter ! 🚀**


