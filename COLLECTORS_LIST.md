# 📋 Liste des Collectors Actifs

## ✅ Collectors ACTIFS (3)

### 1. **`adel-ai-dev-collector-sec-watcher`**
**Fonction :** Surveille les nouveaux filings 13F sur SEC EDGAR pour tous les funds

**Fréquence :** Toutes les heures (`rate(1 hour)`)

**APIs utilisées :**
- SEC EDGAR RSS Feed : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=13F-HR&output=atom`

**Utilisé pour :**
- Découverte automatique des nouveaux filings 13F
- Déclenche `parser-13f` via événement `13F Discovered`
- Système funds complet

---

### 2. **`adel-ai-dev-collector-rss`**
**Fonction :** Collecte les news depuis les flux RSS (Financial Juice, Reuters, etc.)

**Fréquence :** Toutes les 15 minutes (`rate(15 minutes)`)

**APIs utilisées :**
- Financial Juice RSS (flux multiples)
- Reuters, AP, Yahoo Finance (selon configuration)

**Utilisé pour :**
- Route API `/signals?source=rss`
- Frontend affiche les signaux RSS
- Extraction de données structurées (surprises économiques)

---

### 3. **`adel-ai-dev-collector-sec-company-filings`**
**Fonction :** Collecte les filings SEC des entreprises (8-K, Form 4, etc.)

**Fréquence :** Quotidien à 9h UTC (`cron(0 9 * * ? *)`)

**APIs utilisées :**
- SEC EDGAR (filings des entreprises)

**Utilisé pour :**
- Collecte des filings d'entreprises (non 13F)

---

## ❌ Collectors DÉSACTIVÉS (3)

### 4. **`adel-ai-dev-collector-fmp-signals`** - DÉSACTIVÉ
**Raison :** Non utilisé

---

### 5. **`adel-ai-dev-collector-coinglass`** - DÉSACTIVÉ
**Raison :** Non utilisé dans le frontend

---

### 6. **`adel-ai-dev-collector-scrapecreators`** - DÉSACTIVÉ
**Raison :** Non utilisé dans le frontend, code incomplet

---

## 📊 Résumé

| Collector | Statut | Fréquence | Utilisé pour |
|-----------|--------|-----------|--------------|
| `collector-sec-watcher` | ✅ ACTIF | 1 heure | Funds (13F) |
| `collector-rss` | ✅ ACTIF | 15 minutes | News RSS |
| `collector-sec-company-filings` | ✅ ACTIF | Quotidien (9h UTC) | Filings entreprises |
| `collector-fmp-signals` | ❌ DÉSACTIVÉ | - | - |
| `collector-coinglass` | ❌ DÉSACTIVÉ | - | - |
| `collector-scrapecreators` | ❌ DÉSACTIVÉ | - | - |

---

## 🔧 Variables d'Environnement Requises

Pour les collectors actifs :
- `SUPABASE_URL` (tous)
- `SUPABASE_SERVICE_KEY` (tous)
- `EVENT_BUS_NAME` (collector-sec-watcher, collector-rss, collector-sec-company-filings)

Plus nécessaires (collectors désactivés) :
- ~~`FMP_API_KEY`~~ (collector-fmp-signals désactivé)
- ~~`COINGLASS_API_KEY`~~ (collector-coinglass désactivé)
- ~~`SCRAPECREATORS_API_KEY`~~ (collector-scrapecreators désactivé)
