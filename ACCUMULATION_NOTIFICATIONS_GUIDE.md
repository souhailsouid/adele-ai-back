# 🔔 Guide des Notifications d'Accumulation Multi-Trimestres

## 🎯 Vue d'ensemble

Système de notifications global pour les accumulations multi-trimestres. Permet aux utilisateurs de voir qu'un fund accumule une position **sans avoir à cliquer dans le fund**, comme des "news" d'accumulations.

## 📋 Architecture

### Nouveau Type de Notification : `accumulation`

Les notifications d'accumulation sont générées automatiquement lorsqu'un **nouveau filing** est parsé et qu'une accumulation multi-trimestres (2+ trimestres) est détectée.

### Workflow

```
1. Nouveau filing parsé (parser-13f)
   ↓
2. Calcul de diff (calculateFundDiff)
   ↓
3. Détection d'accumulations multi-trimestres (analyzeFundDiffsStrategically)
   ↓
4. Génération automatique de notifications (generateAccumulationNotificationsForNewFiling)
   ↓
5. Notification pour tous les utilisateurs qui suivent ce fund
```

## 🗄️ Base de Données

### Migration SQL (`025_add_accumulation_notifications.sql`)

- **Nouveau type d'action** : `'accumulation'` ajouté à `fund_notifications.action`
- **Nouvelles colonnes** :
  - `trend_quarters` : Nombre de trimestres d'accumulation (2, 3, 4...)
  - `is_strong_accumulation` : `true` si 3+ trimestres (signal très fort)
- **Nouvelle préférence** : `notify_on_accumulation` dans `user_fund_notifications` (défaut: `true`)
- **Index optimisés** : Pour rechercher rapidement les notifications d'accumulation

### Vue SQL : `global_accumulation_notifications`

Vue pour récupérer toutes les notifications d'accumulation globales (tous utilisateurs), utile pour un feed "News" global.

## 🚀 Routes API

### `GET /notifications/accumulations`

Récupère les notifications d'accumulation.

**Query params :**
- `limit` : Nombre de résultats (défaut: 50)
- `include_sent` : Inclure les notifications déjà envoyées (défaut: `false`)
- `min_quarters` : Minimum de trimestres requis (défaut: 2)
- `only_strong` : Uniquement les accumulations 3+ trimestres (défaut: `false`)
- `only_global` : Retourner les notifications globales (tous utilisateurs) au lieu de celles de l'utilisateur (défaut: `false`)

**Exemples :**

```bash
# Notifications d'accumulation de l'utilisateur
GET /notifications/accumulations?limit=20

# Uniquement les accumulations 3+ trimestres (signal très fort)
GET /notifications/accumulations?only_strong=true

# Notifications globales (feed "News")
GET /notifications/accumulations?only_global=true&limit=100

# Toutes les accumulations (même envoyées)
GET /notifications/accumulations?include_sent=true
```

**Réponse :**
```json
[
  {
    "id": 123,
    "user_id": "user-123",
    "fund_id": 32,
    "fund_name": "Scion Asset Management, LLC",
    "ticker": "LULULEMON",
    "trend_quarters": 2,
    "is_strong_accumulation": false,
    "title": "📈 Scion Asset Management accumule LULULEMON depuis 2 trimestres",
    "message": "Scion Asset Management accumule LULULEMON depuis 2 trimestres consécutifs (Signal pertinent ✓).\n\n💰 Total ajouté: $0.02M\n📊 Moyenne par trimestre: $0.01M\n\nC'est un signal pertinent : le fonds construit patiemment une grosse ligne sur ce titre.",
    "priority": "medium",
    "status": "pending",
    "created_at": "2025-01-10T10:00:00Z",
    "filing_date": "2025-11-03"
  },
  {
    "id": 124,
    "user_id": "user-123",
    "fund_id": 1,
    "fund_name": "BlackRock",
    "ticker": "AAPL",
    "trend_quarters": 4,
    "is_strong_accumulation": true,
    "title": "🔥 BlackRock accumule AAPL depuis 4 trimestres",
    "message": "BlackRock accumule AAPL depuis 4 trimestres consécutifs (Signal très fort 🔥).\n\n💰 Total ajouté: $150.5M\n📊 Moyenne par trimestre: $37.6M\n\nC'est un signal très fort : le fonds construit patiemment une grosse ligne sur ce titre.",
    "priority": "high",
    "status": "pending",
    "created_at": "2025-01-10T09:30:00Z",
    "filing_date": "2025-11-03"
  }
]
```

## ⚙️ Préférences Utilisateur

### Nouvelle préférence : `notify_on_accumulation`

Contrôle si l'utilisateur souhaite recevoir des notifications d'accumulation pour un fund spécifique.

**Défaut :** `true` (activé par défaut)

**Exemple de configuration :**

```bash
PUT /funds/32/notifications/preferences
{
  "notify_on_accumulation": true,  // Activer les notifications d'accumulation
  "notify_on_new": true,
  "notify_on_exit": true,
  "min_change_pct": 5.0
}
```

## 🎨 Priorités et Signaux

### Priorité `high` : Accumulations 3+ trimestres (Signal très fort 🔥)
- Badge : "🔥 ACCUMULATION (3+Q)"
- Message : "Signal très fort"
- Priorité automatique : `high`

### Priorité `medium` : Accumulations 2 trimestres (Signal pertinent ✓)
- Badge : "📈 ACCUMULATION (2Q)"
- Message : "Signal pertinent"
- Priorité automatique : `medium`

## 📱 Intégration Frontend

### 1. Feed Global "News" d'Accumulations

```typescript
// Récupérer toutes les accumulations globales (comme des news)
const response = await fetch('/notifications/accumulations?only_global=true&limit=50', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const accumulations = await response.json();

// Afficher dans un feed "News" global
accumulations.forEach(acc => {
  console.log(`${acc.fund_name} accumule ${acc.ticker} depuis ${acc.trend_quarters}Q`);
});
```

### 2. Badge d'Accumulation dans le Feed

```tsx
{accumulation.is_strong_accumulation ? (
  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
    <Flame className="w-3 h-3 mr-1" />
    🔥 ACCUMULATION ({accumulation.trend_quarters}Q)
  </Badge>
) : (
  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
    <TrendingUp className="w-3 h-3 mr-1" />
    📈 ACCUMULATION ({accumulation.trend_quarters}Q)
  </Badge>
)}
```

### 3. Notification dans le Feed Principal

Les notifications d'accumulation peuvent être intégrées dans le feed principal avec les autres notifications de funds, **sans avoir à cliquer dans chaque fund**.

## 🔄 Génération Automatique

Les notifications d'accumulation sont générées **automatiquement** lors du calcul de diff pour un nouveau filing :

1. **Déclenchement** : Lorsqu'un nouveau filing est parsé et que les diffs sont calculés
2. **Détection** : `detectMultiQuarterTrends` identifie les accumulations sur 2+ trimestres
3. **Notification** : `generateAccumulationNotificationsForNewFiling` crée les notifications pour tous les utilisateurs qui suivent le fund
4. **Filtrage** : Respect des préférences utilisateur (`notify_on_accumulation`)

## 💡 Cas d'Usage

### Cas 1 : Feed "News" Global
L'utilisateur voit dans son feed principal : "🔥 BlackRock accumule AAPL depuis 4 trimestres", **sans avoir à ouvrir la page de BlackRock**.

### Cas 2 : Alertes Personnalisées
L'utilisateur configure : "Me notifier uniquement des accumulations 3+ trimestres (signal très fort)".

### Cas 3 : Daily Digest
Les notifications d'accumulation sont incluses dans le daily digest, regroupées par fund.

## 🚨 Notes Importantes

- **Automatique** : Les notifications sont générées automatiquement lors du parsing d'un nouveau filing
- **Non bloquant** : La génération de notifications est asynchrone et n'empêche pas le parsing si elle échoue
- **Filtrage intelligent** : Seules les accumulations présentes dans le **nouveau filing** génèrent des notifications (évite les doublons)
- **Respect des préférences** : Chaque utilisateur peut activer/désactiver les notifications d'accumulation par fund

## 📊 Métriques

- **Nombre de trimestres** : Stocké dans `trend_quarters`
- **Signal fort** : `is_strong_accumulation = true` si 3+ trimestres
- **Valeur totale ajoutée** : Affichée dans le message de notification
- **Moyenne par trimestre** : Affichée dans le message de notification

## 🔜 Prochaines Étapes

1. ✅ Système de notifications d'accumulation créé
2. ✅ Route globale pour récupérer les accumulations
3. ✅ Génération automatique lors du parsing
4. ⏳ Intégration frontend dans le feed principal
5. ⏳ Badge visuel pour les accumulations dans le feed
6. ⏳ Filtres avancés (par secteur, par ticker, etc.)
