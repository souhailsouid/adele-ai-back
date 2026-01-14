# 📅 Résumé des CRONs SEC Smart Money

## Workflow complet

### ✅ 1. CRON Quotidien - Form 4 des top companies

**Schedule :** Tous les jours à **05h15 UTC**

**Pourquoi 05h15 UTC ?**
- Clôture SEC : 22h EST/EDT = 02h-03h UTC
- Marge de sécurité : 2-3h pour que l'API `data.sec.gov` soit consolidée
- Données prêtes avant l'ouverture des bourses (Paris 08h UTC, Londres 08h UTC, US Pre-market 09h/13h UTC)

**Fonction :**
- Découvre les nouveaux Form 4 des top 100 companies
- **Delta Processing** : Compare les `accessionNumber` au lieu de filtrer par date
- Gère le cas du lundi (pas de nouveaux dépôts depuis vendredi)
- Optimisé avec `If-Modified-Since` pour éviter les requêtes inutiles
- Crée les filings en statut `DISCOVERED`
- Publie dans SQS `form4-parser-queue` pour le parsing avec rate limiting

**Worker :** `sec-smart-money-sync` (mode: `insiders-only`)

**Configuration Terraform :**
```terraform
schedule_expression = "cron(15 5 * * ? *)"  # 05h15 UTC tous les jours
input = { mode = "insiders-only" }
```

**Optimisations :**
- ✅ `If-Modified-Since` header pour éviter les requêtes inutiles (304 Not Modified)
- ✅ Delta processing : compare `accessionNumber` au lieu de filtrer par date
- ✅ Gère le week-end : pas de dépôts mais le script tourne quand même (pas d'erreur)

---

### ✅ 2. CRON Hebdomadaire - Tracking cross-company des dirigeants

**Schedule :** Tous les **dimanches à 22h UTC**

**Fonction :**
- Récupère tous les CIK de dirigeants uniques depuis `insider_trades`
- Pour chaque CIK, découvre tous ses filings (Form 3, 4, 5) via l'API submissions
- Parse et stocke les transactions même pour d'autres entreprises
- Découvre des corrélations cross-company

**Worker :** `sec-smart-money-sync` (mode: `track-insiders`)

**Configuration Terraform :**
```terraform
schedule_expression = "cron(0 22 ? * SUN *)"  # Dimanche 22h UTC
input = { mode = "track-insiders" }
```

---

## Architecture complète

```
┌─────────────────────────────────────────────────────────────┐
│ CRON Quotidien (9h UTC)                                      │
│ → EventBridge → SQS → sec-smart-money-sync (insiders-only)   │
│   → Découvre Form 4 → Publie dans form4-parser-queue        │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ form4-parser-queue (SQS)                                    │
│ → Rate limiting (10 req/s max)                              │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ form4-parser (Lambda)                                       │
│ → Parse Form 4 → Insère transactions dans S3 Parquet        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CRON Hebdomadaire (Dimanche 22h UTC)                        │
│ → EventBridge → SQS → sec-smart-money-sync (track-insiders) │
│   → Suit les dirigeants → Découvre corrélations             │
└─────────────────────────────────────────────────────────────┘
```

## Résumé

| CRON | Fréquence | Heure | Mode | Fonction |
|------|-----------|-------|------|----------|
| **Form 4** | Quotidien | **05h15 UTC** | `insiders-only` | Découvre les Form 4 des top companies (après clôture SEC) |
| **Cross-Company** | Hebdomadaire | Dimanche 22h UTC | `track-insiders` | Suit les dirigeants dans toutes leurs entreprises |

## Avantages

1. **Découplage** : Parsing séparé avec rate limiting strict
2. **Rate limiting multi-niveaux** : SQS DelaySeconds + Lambda batch_size=1 + sleep(100ms)
3. **Découverte automatique** : Form 4 quotidiens + corrélations cross-company hebdomadaires
4. **Scalabilité** : SQS gère la file d'attente, Lambda consomme à son rythme

## Monitoring

### Métriques à surveiller

1. **SQS Queue Depth** (`form4-parser-queue`)
   - Si > 1000 messages, augmenter le delay ou la fréquence

2. **Lambda Duration**
   - Form 4 parsing : ~30-60s par filing
   - Cross-company tracking : ~5-10 min pour 100 dirigeants

3. **Error Rate**
   - 429 (rate limit) : Si > 5%, augmenter les delays
   - 404 (not found) : Normal, essayer URL suivante

4. **Dead Letter Queue**
   - Messages en échec permanent
   - Analyser les causes

## Coûts estimés

- **Quotidien (Form 4)** : ~$5-8/mois
- **Hebdomadaire (Cross-company)** : ~$2-3/mois
- **Total** : ~$7-11/mois
