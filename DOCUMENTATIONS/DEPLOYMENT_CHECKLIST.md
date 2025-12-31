# ✅ Checklist de Déploiement : Extraction de Données & Alertes

## 📋 Ce qui est DÉJÀ en Place (Pas besoin de déployer)

### ✅ Collector-RSS avec Extraction de Données
- **Fichier** : `workers/collector-rss/src/index.ts`
- **Statut** : ✅ Code modifié, extraction intégrée
- **Action** : **DÉJÀ FONCTIONNEL** - L'extraction se fait automatiquement lors de la collecte RSS
- **Déploiement** : Juste rebuild et redéployer le collector-rss existant

```bash
cd workers/collector-rss
npm run bundle
# Puis redéployer via Terraform (le collector-rss existe déjà)
```

---

## 🆕 Ce qui DOIT être Déployé

### 1. Migration SQL (OBLIGATOIRE)

**Fichier** : `infra/supabase/migrations/018_add_data_extraction_and_alerts.sql`

**Action** :
```bash
# Option 1 : Via Supabase Dashboard
# 1. Aller sur https://app.supabase.com → Votre projet
# 2. SQL Editor → New Query
# 3. Copier-coller le contenu de 018_add_data_extraction_and_alerts.sql
# 4. Run

# Option 2 : Via Supabase CLI
supabase db push
```

**Vérification** :
```sql
-- Vérifier que les tables existent
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('alert_keywords', 'alerts_sent');

-- Vérifier que la colonne extracted_data existe
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'signals' AND column_name = 'extracted_data';
```

---

### 2. Worker Alert-Sender (NOUVEAU - À DÉPLOYER)

**Fichiers** :
- `workers/alert-sender/src/index.ts`
- `workers/alert-sender/src/supabase.ts`
- `workers/alert-sender/package.json`
- `workers/alert-sender/scripts/build.mjs`
- `infra/terraform/alert-sender.tf`

**Actions** :

#### Étape 1 : Build
```bash
cd workers/alert-sender
npm install
npm run bundle
```

#### Étape 2 : Configurer Terraform

Dans `infra/terraform/terraform.tfvars` :
```hcl
discord_webhook_url = "https://discord.com/api/webhooks/VOTRE_WEBHOOK_ID/VOTRE_WEBHOOK_TOKEN"
# Optionnel
slack_webhook_url = ""
telegram_bot_token = ""
telegram_chat_id = ""
```

#### Étape 3 : Déployer
```bash
cd infra/terraform
terraform init  # Si pas déjà fait
terraform plan  # Vérifier les changements
terraform apply # Déployer
```

**Vérification** :
```bash
# Vérifier que la Lambda existe
aws lambda get-function --function-name personamy-prod-alert-sender

# Vérifier les logs
aws logs tail /aws/lambda/personamy-prod-alert-sender --follow
```

---

## 🎯 Résumé : Quoi Déployer ?

| Composant | Statut | Action Requise |
|-----------|--------|---------------|
| **Collector-RSS** | ✅ Existe déjà | Rebuild & redéployer (extraction intégrée) |
| **Migration SQL** | ❌ Nouveau | **OBLIGATOIRE** - Appliquer dans Supabase |
| **Alert-Sender Lambda** | ❌ Nouveau | **OBLIGATOIRE** - Build & déployer via Terraform |
| **Variables Terraform** | ❌ Nouveau | Ajouter `discord_webhook_url` dans `terraform.tfvars` |

---

## 🚀 Ordre de Déploiement Recommandé

### 1. Migration SQL (5 min)
```bash
# Appliquer dans Supabase Dashboard
```

### 2. Rebuild Collector-RSS (2 min)
```bash
cd workers/collector-rss
npm run bundle
```

### 3. Configurer Terraform (2 min)
```bash
# Ajouter discord_webhook_url dans terraform.tfvars
```

### 4. Build Alert-Sender (2 min)
```bash
cd workers/alert-sender
npm install
npm run bundle
```

### 5. Déployer Terraform (5 min)
```bash
cd infra/terraform
terraform apply
```

**Total** : ~15 minutes

---

## ✅ Vérification Post-Déploiement

### 1. Vérifier l'Extraction de Données

```sql
-- Vérifier qu'un signal a des données extraites
SELECT 
  id,
  raw_data->>'title' as title,
  raw_data->'extracted_data' as extracted_data
FROM signals
WHERE source = 'rss'
  AND raw_data->'extracted_data' IS NOT NULL
LIMIT 5;
```

### 2. Vérifier les Alertes

```sql
-- Vérifier qu'une alerte a été créée
SELECT 
  a.*,
  s.raw_data->>'title' as signal_title
FROM alerts_sent a
JOIN signals s ON a.signal_id = s.id
ORDER BY a.sent_at DESC
LIMIT 5;
```

### 3. Tester l'Envoi d'Alerte

```sql
-- Insérer un signal de test avec "Trump"
INSERT INTO signals (source, type, raw_data)
VALUES (
  'rss',
  'macro',
  '{"title": "FinancialJuice: Trump announces new policy", "feed": "financial-juice"}'
);

-- Attendre 1 minute, puis vérifier
SELECT * FROM alerts_sent WHERE status = 'sent' ORDER BY sent_at DESC LIMIT 1;
```

---

## 🐛 Dépannage

### Problème : Aucune donnée extraite

**Vérifications** :
1. Le collector-rss a-t-il été redéployé après les modifications ?
2. Y a-t-il des signaux RSS récents dans Supabase ?
3. Les signaux contiennent-ils des patterns extractibles (CPI, GDP, etc.) ?

**Test** :
```typescript
// Tester l'extraction manuellement
import { extractStructuredData } from './workers/collector-rss/src/data-extractor';

const title = "Tokyo area December core CPI +2.3% year on year government according to source poll +2.5%";
const data = extractStructuredData(title);
console.log(data); // Devrait retourner un objet avec actual, forecast, surprise
```

### Problème : Aucune alerte envoyée

**Vérifications** :
1. La migration SQL a-t-elle été appliquée ?
2. Le trigger `trigger_alert_on_signal_insert` existe-t-il ?
3. Les keywords sont-ils activés dans `alert_keywords` ?
4. Le worker `alert-sender` est-il déployé ?
5. `DISCORD_WEBHOOK_URL` est-il configuré dans Terraform ?

**Vérification** :
```sql
-- Vérifier le trigger
SELECT * FROM pg_trigger WHERE tgname = 'trigger_alert_on_signal_insert';

-- Vérifier les keywords
SELECT * FROM alert_keywords WHERE enabled = true;

-- Vérifier les alertes en attente
SELECT * FROM alerts_sent WHERE status = 'pending';
```

---

## 📝 Notes Importantes

1. **Collector-RSS** : L'extraction de données est **automatique** - pas besoin de configuration supplémentaire
2. **Alertes** : Le trigger Supabase crée automatiquement les alertes, le worker Lambda les envoie
3. **Frontend** : Pas besoin de déploiement backend - juste utiliser l'API `/signals` existante
4. **Terraform** : Seul `alert-sender` est nouveau, le reste existe déjà

---

## 🎯 Checklist Finale

- [ ] Migration SQL appliquée dans Supabase
- [ ] Collector-RSS rebuild et redéployé
- [ ] `discord_webhook_url` ajouté dans `terraform.tfvars`
- [ ] Alert-Sender build (`npm run bundle`)
- [ ] Terraform déployé (`terraform apply`)
- [ ] Test : Vérifier qu'un signal a `extracted_data`
- [ ] Test : Vérifier qu'une alerte a été créée
- [ ] Test : Vérifier qu'une alerte a été envoyée sur Discord

**Une fois tout déployé, le système fonctionne automatiquement ! 🚀**


