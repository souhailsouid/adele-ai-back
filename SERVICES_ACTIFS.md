# 📋 Services Actifs - Résumé

## ✅ Services à GARDER (utilisés dans le système)

### 1. **`adel-ai-dev-parser-13f`** - Parser 13F
**Fonction :** Parse les fichiers XML 13F depuis SEC EDGAR et extrait les holdings

**APIs utilisées :**
- **SEC EDGAR** : `https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no}/`
  - Télécharge les fichiers XML 13F
  - Parse les `informationTable` pour extraire les holdings

**Déclencheur :** EventBridge (`13F Discovered`)
**Fréquence :** Asynchrone (déclenché par `collector-sec-watcher`)

**Utilisé pour :**
- Routes API `/funds/{id}/portfolio`
- Routes API `/funds/{id}/holdings`
- Routes API `/funds/{id}/diffs`
- Toutes les fonctionnalités funds

---

### 2. **`adel-ai-dev-collector-sec-watcher`** - Détection des filings SEC
**Fonction :** Surveille les nouveaux filings 13F sur SEC EDGAR pour tous les funds

**APIs utilisées :**
- **SEC EDGAR RSS Feed** : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=13F-HR&output=atom`
  - Récupère les nouveaux filings 13F-HR, SC 13G, SC 13D
  - Parse le flux RSS/Atom

**Déclencheur :** Cron EventBridge (toutes les 5 minutes)
**Fréquence :** `rate(5 minutes)`

**Utilisé pour :**
- Découverte automatique des nouveaux filings 13F
- Déclenche `parser-13f` via événement `13F Discovered`
- Système funds complet

---

### 3. **`adel-ai-dev-collector-rss`** - Collecte des news RSS
**Fonction :** Collecte les news depuis les flux RSS (Financial Juice, Reuters, etc.)

**APIs utilisées :**
- **Financial Juice RSS** : Flux RSS multiples
  - Macro news (CPI, GDP, NFP, etc.)
  - Corporate news
  - Market news
- **Autres flux RSS** : Reuters, AP, Yahoo Finance (selon configuration)

**Déclencheur :** Cron EventBridge (toutes les 15 minutes)
**Fréquence :** `rate(15 minutes)`

**Utilisé pour :**
- Route API `/signals?source=rss`
- Frontend affiche les signaux RSS
- Extraction de données structurées (surprises économiques)

---

### 4. **`adel-ai-dev-alert-sender`** - Envoi d'alertes
**Fonction :** Envoie les alertes vers Discord/Slack/Telegram

**APIs utilisées :**
- **Discord Webhook** : `https://discord.com/api/webhooks/{id}/{token}`
- **Slack Webhook** : `https://hooks.slack.com/services/{workspace}/{channel}/{token}`
- **Telegram Bot API** : `https://api.telegram.org/bot{token}/sendMessage`

**Déclencheur :** Cron EventBridge (toutes les minutes)
**Fréquence :** `rate(1 minute)`

**Utilisé pour :**
- Envoi d'alertes temps réel
- Notifications utilisateurs

---

## ❌ Services OBSOLÈTES (désactivés)

### 5. **`adel-ai-dev-collector-scrapecreators`** - OBSOLÈTE
**Raison :** Non utilisé dans le frontend, code incomplet

**APIs utilisées (obsolètes) :**
- `https://api.scrapecreators.com/v1/trump/posts` (URL hardcodée, non fonctionnelle)

---

### 6. **`adel-ai-dev-collector-coinglass`** - OBSOLÈTE
**Raison :** Non utilisé dans le frontend

**APIs utilisées (obsolètes) :**
- `https://fapi.coinglass.com/api/futures/v2/funding-rate`
- `https://fapi.coinglass.com/api/futures/v2/open-interest`
- `https://fapi.coinglass.com/api/liquidation/v2/liquidation`

---

## 📊 Résumé des APIs Externes Utilisées

| Service | API | Type | Authentification |
|---------|-----|------|------------------|
| **parser-13f** | SEC EDGAR | HTTP | User-Agent |
| **collector-sec-watcher** | SEC EDGAR RSS | RSS/Atom | User-Agent |
| **collector-rss** | Financial Juice RSS | RSS | Aucune |
| **collector-rss** | Reuters/AP/Yahoo | RSS | Aucune |
| **alert-sender** | Discord Webhook | Webhook | Token dans URL |
| **alert-sender** | Slack Webhook | Webhook | Token dans URL |
| **alert-sender** | Telegram Bot API | REST | Bot Token |

---

## 🔧 Variables d'Environnement Requises

### Pour les services actifs :
- `SUPABASE_URL` (tous)
- `SUPABASE_SERVICE_KEY` (tous)
- `EVENT_BUS_NAME` (collectors)
- `DISCORD_WEBHOOK_URL` (alert-sender, optionnel)
- `SLACK_WEBHOOK_URL` (alert-sender, optionnel)
- `TELEGRAM_BOT_TOKEN` (alert-sender, optionnel)
- `TELEGRAM_CHAT_ID` (alert-sender, optionnel)

### Plus nécessaires (obsolètes) :
- ~~`COINGLASS_API_KEY`~~ (collector-coinglass désactivé)
- ~~`SCRAPECREATORS_API_KEY`~~ (collector-scrapecreators désactivé)

---

## 📝 Notes

- Les services obsolètes sont commentés dans `infra/terraform/collectors.tf`
- Pour les supprimer complètement, exécuter `terraform apply` puis supprimer les ressources manuellement dans AWS Console si nécessaire
- Les services actifs sont essentiels pour le fonctionnement des funds et des news RSS
