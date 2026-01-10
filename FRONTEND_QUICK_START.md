# 🚀 Quick Start Frontend - Funds System

## 📋 Ce qui a été fait côté Backend (Résumé)

### ✅ 1. Collecte Automatique
- Polling SEC EDGAR toutes les 5 min (1 min en période de pic)
- Détection automatique des nouveaux filings (13F-HR, SC 13G, SC 13D)
- Support multi-CIK (BlackRock = 3 entités légales)

### ✅ 2. Parsing & Calculs
- Extraction automatique des holdings depuis les XML 13F
- Calcul automatique des différences entre filings
- Détection des changements : `new`, `exit`, `increase`, `decrease`

### ✅ 3. Déduplication
- Évite le double comptage pour les funds multi-CIK
- Priorise automatiquement le CIK Primary
- Route `/funds/{id}/portfolio` retourne déjà les données dédupliquées

### ✅ 4. Notifications Intelligentes
- Filtrage du bruit (min_change_pct configurable)
- Priorisation automatique (Exit = Critical)
- Daily digest pour regrouper les notifications

---

## 🔌 Routes API Principales

```typescript
// Base URL
const API_URL = 'https://xxx.execute-api.eu-west-3.amazonaws.com/prod';

// 1. Portefeuille dédupliqué (⭐ RECOMMANDÉ)
GET /funds/{id}/portfolio

// 2. Changements récents
GET /funds/{id}/changes

// 3. Différences (historique)
GET /funds/{id}/diffs?ticker=AAPL

// 4. Transparency Mode (tous les CIK)
GET /funds/{id}/transparency

// 5. Notifications
GET /notifications/funds
PUT /funds/{id}/notifications/preferences
```

---

## 💻 Code Minimal à Implémenter

### 1. API Client

```typescript
// lib/api/funds.ts
const API_URL = process.env.NEXT_PUBLIC_API_MAIN_URL;

export const fundsApi = {
  getPortfolio: (id: number) =>
    fetch(`${API_URL}/funds/${id}/portfolio`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()),

  getChanges: (id: number) =>
    fetch(`${API_URL}/funds/${id}/changes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()),
};
```

### 2. Hook React Query

```typescript
// hooks/useFunds.ts
import { useQuery } from '@tanstack/react-query';
import { fundsApi } from '@/lib/api/funds';

export const useFundPortfolio = (id: number) => {
  return useQuery({
    queryKey: ['funds', id, 'portfolio'],
    queryFn: () => fundsApi.getPortfolio(id),
  });
};
```

### 3. Composant

```typescript
// components/FundPortfolio.tsx
'use client';

import { useFundPortfolio } from '@/hooks/useFunds';

export function FundPortfolio({ fundId }: { fundId: number }) {
  const { data, isLoading } = useFundPortfolio(fundId);

  if (isLoading) return <div>Chargement...</div>;

  return (
    <div>
      <h2>{data.fund_name}</h2>
      <p>{data.total_holdings} positions</p>
      {data.holdings.map(h => (
        <div key={h.ticker}>
          {h.ticker}: {h.shares} actions
        </div>
      ))}
    </div>
  );
}
```

---

## 🎯 Fonctionnalités Clés à Implémenter

### 1. **Portfolio View** (Priorité Haute)
- Afficher le portefeuille dédupliqué
- Badge "Primary CIK" pour les positions du CIK principal
- Formatage des nombres (shares, market_value)

### 2. **Changes View** (Priorité Haute)
- Liste des changements récents
- Badges colorés par action (`new`, `exit`, `increase`, `decrease`)
- Icônes visuelles (flèches, plus, X)

### 3. **Transparency Mode** (Priorité Moyenne)
- Bouton "Info" sur chaque fund
- Modal avec tous les CIK agrégés
- Statistiques par CIK (filings, dernière date)

### 4. **Notifications** (Priorité Moyenne)
- Badge avec nombre de notifications
- Liste des notifications en attente
- Priorités visuelles (Critical = Rouge)

### 5. **Settings** (Priorité Basse)
- Préférences de notification (min_change_pct)
- Activation/désactivation du daily digest

---

## 📊 Structure de Données

### Portfolio Response
```typescript
{
  fund_id: 1,
  fund_name: "BlackRock Inc.",
  total_holdings: 2500,
  total_market_value: 5000000000,
  holdings: [
    {
      ticker: "AAPL",
      shares: 1200000,
      market_value: 240000000,
      cik: "0002012383",
      filing_date: "2025-11-12",
      is_primary: true
    }
  ]
}
```

### Changes Response
```typescript
{
  total_changes: 45,
  new_positions: 12,
  exits: 3,
  increases: 20,
  decreases: 10,
  changes: [
    {
      id: 1,
      ticker: "AAPL",
      action: "increase",
      diff_shares_pct: 15.5,
      created_at: "2025-12-01T10:00:00Z"
    }
  ]
}
```

---

## 🎨 Design Recommendations

### Actions
- `new` → 🟢 Badge vert "Nouvelle position"
- `exit` → 🔴 Badge rouge "Sortie totale" (priorité haute)
- `increase` → 🔵 Flèche ↑ bleue
- `decrease` → 🟠 Flèche ↓ orange

### Priorités
- `critical` → 🔴 Rouge + icône d'alerte
- `high` → 🟠 Orange
- `medium` → 🟡 Jaune
- `low` → ⚪ Gris

---

## 📚 Documentation Complète

Pour plus de détails, voir :
- **Guide complet** : `FRONTEND_FUNDS_INTEGRATION_GUIDE.md`
- **API Reference** : `FUNDS_API_GUIDE.md`
- **Multi-CIK** : `FUNDS_MULTIPLE_CIKS_GUIDE.md`
- **Notifications** : `FUND_NOTIFICATIONS_GUIDE.md`

---

## ✅ Checklist

- [ ] Configuration API client
- [ ] Hooks React Query
- [ ] Composant Portfolio
- [ ] Composant Changes
- [ ] Composant Transparency (optionnel)
- [ ] Composant Notifications (optionnel)
- [ ] Page Fund Detail
- [ ] Gestion erreurs/loading

**Temps estimé : 2-3 jours pour l'implémentation complète** 🚀
