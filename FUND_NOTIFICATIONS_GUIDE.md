# 🔔 Guide des Notifications Funds

## 🎯 Vue d'ensemble

Système de notifications intelligent pour les changements de funds, avec :
- ✅ **Filtrage du bruit** : Ne notifie que les changements significatifs
- ✅ **Priorisation** : Exit = Critical, New = High, etc.
- ✅ **Daily Digest** : Regroupe les notifications pendant les périodes de pic

## 📋 Architecture

### Tables

1. **`user_fund_notifications`** : Préférences de notification par utilisateur/fund
2. **`fund_notifications`** : Notifications générées
3. **`notification_digests`** : Daily digests regroupés

### Workflow

```
1. Calcul de diff (fund-diff.service)
   ↓
2. Génération de notifications (fund-notifications.service)
   ↓
3. Filtrage selon préférences (min_change_pct, actions)
   ↓
4. Regroupement en digest (si activé)
   ↓
5. Envoi (email/push/webhook)
```

## 🔧 Configuration des Préférences

### Règles de Filtrage

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `min_change_pct` | 5.0 | Changement minimum en % pour notifier |
| `notify_on_new` | true | Notifier les nouvelles positions |
| `notify_on_exit` | true | Notifier les sorties totales (priorité haute) |
| `notify_on_increase` | true | Notifier les augmentations |
| `notify_on_decrease` | false | Notifier les diminutions |

### Priorités Automatiques

| Action | Priorité | Condition |
|--------|----------|-----------|
| **Exit** | `critical` | Toujours |
| **New** | `high` | Toujours |
| **Increase/Decrease** | `high` | Si `diff_pct >= 20%` |
| **Increase/Decrease** | `medium` | Si `diff_pct >= 10%` |
| **Increase/Decrease** | `low` | Si `diff_pct < 10%` |

## 🚀 Routes API

### Préférences

#### `GET /funds/{id}/notifications/preferences`
Récupère les préférences de notification pour un fund.

**Réponse :**
```json
{
  "user_id": "user-123",
  "fund_id": 1,
  "min_change_pct": 5.0,
  "notify_on_new": true,
  "notify_on_exit": true,
  "notify_on_increase": true,
  "notify_on_decrease": false,
  "email_enabled": false,
  "push_enabled": true,
  "digest_enabled": true,
  "digest_time": "09:00:00"
}
```

#### `PUT /funds/{id}/notifications/preferences`
Met à jour les préférences.

**Body :**
```json
{
  "min_change_pct": 10.0,
  "notify_on_decrease": true,
  "digest_enabled": true,
  "digest_time": "08:00:00"
}
```

### Notifications

#### `GET /notifications/funds`
Récupère les notifications en attente (non regroupées).

**Query params :**
- `limit` : Nombre de résultats (défaut: 50)

**Réponse :**
```json
[
  {
    "id": 1,
    "user_id": "user-123",
    "fund_id": 1,
    "title": "🚨 BlackRock a vendu toutes ses actions TSLA",
    "message": "BlackRock a vendu toutes ses actions TSLA (500K actions)",
    "priority": "critical",
    "ticker": "TSLA",
    "action": "exit",
    "diff_shares_pct": null,
    "status": "pending",
    "created_at": "2025-01-05T10:00:00Z"
  }
]
```

### Daily Digest

#### `POST /notifications/digest`
Crée un daily digest pour aujourd'hui (ou une date spécifiée).

**Body (optionnel) :**
```json
{
  "date": "2025-01-05"
}
```

**Réponse :**
```json
{
  "id": 1,
  "user_id": "user-123",
  "digest_date": "2025-01-05",
  "title": "📊 Daily Digest - 2025-01-05",
  "summary": "Aujourd'hui, 12 fonds de votre watchlist ont publié leurs rapports.\n\n🚨 3 sorties totales détectées\n✨ 5 nouvelles positions\n\nTotal: 45 changements significatifs",
  "total_notifications": 45,
  "funds_count": 12,
  "status": "pending"
}
```

#### `GET /notifications/digests`
Liste les digests (30 derniers par défaut).

**Query params :**
- `limit` : Nombre de résultats (défaut: 30)

#### `GET /notifications/digests/{digestId}`
Récupère les notifications d'un digest.

## 📝 Exemples d'Utilisation

### 1. Configurer les préférences pour BlackRock

```bash
curl -X PUT https://your-api.com/funds/1/notifications/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "min_change_pct": 10.0,
    "notify_on_exit": true,
    "notify_on_new": true,
    "notify_on_increase": true,
    "notify_on_decrease": false,
    "digest_enabled": true,
    "digest_time": "09:00:00"
  }'
```

### 2. Récupérer les notifications en attente

```bash
curl https://your-api.com/notifications/funds?limit=20 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Créer un daily digest

```bash
curl -X POST https://your-api.com/notifications/digest \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"date": "2025-01-05"}'
```

## 🎯 Stratégies de Notification

### Stratégie 1 : Notifications Immédiates (Bruit élevé)

```json
{
  "min_change_pct": 0.1,
  "notify_on_new": true,
  "notify_on_exit": true,
  "notify_on_increase": true,
  "notify_on_decrease": true,
  "digest_enabled": false
}
```

**Résultat :** Notification pour chaque changement, même minime.

### Stratégie 2 : Filtrage Intelligent (Recommandé)

```json
{
  "min_change_pct": 5.0,
  "notify_on_new": true,
  "notify_on_exit": true,
  "notify_on_increase": true,
  "notify_on_decrease": false,
  "digest_enabled": true,
  "digest_time": "09:00:00"
}
```

**Résultat :** 
- Notifications immédiates pour Exit et New
- Daily digest pour les autres changements >5%

### Stratégie 3 : Daily Digest Uniquement (Période de pic)

```json
{
  "min_change_pct": 5.0,
  "notify_on_new": true,
  "notify_on_exit": true,
  "notify_on_increase": true,
  "notify_on_decrease": false,
  "digest_enabled": true,
  "digest_time": "09:00:00"
}
```

**Résultat :** Un seul email par jour avec tous les changements.

## 🔄 Intégration Automatique

Les notifications sont générées automatiquement lors du calcul de diff :

```typescript
// Dans fund-diff.service.ts
calculateFundDiff(fundId, filingId)
  → Génère les diffs
  → Appelle generateNotificationsForDiffs()
  → Filtre selon préférences
  → Crée les notifications
```

## 📊 Exemple de Daily Digest

```
📊 Daily Digest - 2025-01-05

Aujourd'hui, 12 fonds de votre watchlist ont publié leurs rapports.

🚨 3 sorties totales détectées
✨ 5 nouvelles positions

Total: 45 changements significatifs

---

🚨 CRITICAL
BlackRock a vendu toutes ses actions TSLA (500K actions)
Scion Asset Management a vendu toutes ses actions BABA (1.2M actions)

✨ HIGH
Berkshire Hathaway a pris une nouvelle position dans AAPL (2.5M actions)
Pershing Square a pris une nouvelle position dans NVDA (500K actions)

📊 MEDIUM
BlackRock a acheté 200K actions MSFT (+15.2%)
Vanguard a acheté 150K actions GOOGL (+12.5%)
```

## ⚙️ Prochaines Étapes

1. ✅ Système de notifications créé
2. ✅ Filtrage du bruit implémenté
3. ✅ Daily digest fonctionnel
4. ⏳ Worker pour envoyer les emails/push (à créer)
5. ⏳ Intégration webhook (à créer)
6. ⏳ Dashboard de préférences (frontend)

## 🚨 Notes Importantes

- Les notifications sont générées **automatiquement** lors du calcul de diff
- Le filtrage est appliqué **avant** la création de la notification
- Les notifications "batched" sont regroupées dans le digest
- Les notifications "pending" sont envoyées immédiatement (si digest désactivé)
