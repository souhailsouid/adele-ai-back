# 🔌 API Signals : Guide d'Utilisation

## 🎯 Endpoint Principal

```
GET https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals
```

---

## 📋 Paramètres de Requête

| Paramètre | Type | Description | Exemple |
|-----------|------|-------------|---------|
| `source` | string | Filtrer par source | `rss`, `scrapecreators`, `coinglass` |
| `type` | string | Filtrer par type | `macro`, `news`, `trump`, `social` |
| `limit` | number | Nombre de résultats (défaut: 100) | `50` |
| `offset` | number | Pagination (défaut: 0) | `50` |
| `min_importance` | number | Importance minimale (1-10) | `7` |

---

## 📊 Exemples de Requêtes

### 1. Tous les Signaux RSS Macro

```typescript
// ⚠️ Authentification JWT requise
const token = await getAccessToken(); // Obtenir depuis Cognito

const response = await fetch(
  'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&type=macro&limit=50',
  {
    headers: {
      'Authorization': `Bearer ${token}`, // ⚠️ OBLIGATOIRE
      'Content-Type': 'application/json',
    },
  }
);

if (!response.ok) {
  if (response.status === 401) {
    throw new Error('Non autorisé - Token JWT invalide ou manquant');
  }
  throw new Error(`Erreur API: ${response.status}`);
}

const signals: Signal[] = await response.json();
```

### 2. Signaux avec Importance ≥ 7

```typescript
// ⚠️ Authentification JWT requise
const token = await getAccessToken();

const response = await fetch(
  'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&type=macro&min_importance=7&limit=50',
  {
    headers: {
      'Authorization': `Bearer ${token}`, // ⚠️ OBLIGATOIRE
    },
  }
);

const importantSignals: Signal[] = await response.json();
```

### 3. Pagination

```typescript
// Page 1
const page1 = await fetch(
  'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&limit=50&offset=0'
).then(r => r.json());

// Page 2
const page2 = await fetch(
  'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&limit=50&offset=50'
).then(r => r.json());
```

---

## 📦 Structure de Réponse

### Exemple de Signal avec Données Extraites

```json
{
  "id": "uuid-here",
  "source": "rss",
  "type": "macro",
  "timestamp": "2025-12-27T10:30:00Z",
  "raw_data": {
    "title": "FinancialJuice: Tokyo area December core CPI +2.3% year on year government according to source poll +2.5%",
    "description": "",
    "url": "https://www.financialjuice.com/News/...",
    "feed": "financial-juice",
    "guid": "9362807",
    "extracted_data": {
      "actual": 2.3,
      "forecast": 2.5,
      "previous": 2.1,
      "dataType": "inflation",
      "indicator": "CPI",
      "surprise": "negative",
      "surpriseMagnitude": 0.2,
      "unit": "percent",
      "period": "yearly",
      "region": "JP"
    }
  },
  "summary": null,
  "importance_score": 8,
  "tags": null,
  "impact": null,
  "priority": "high",
  "processing_status": "completed",
  "created_at": "2025-12-27T10:30:00Z"
}
```

---

## 🎨 Utilisation Frontend

### Hook React avec React Query

```typescript
// hooks/useSignals.ts
import { useQuery } from '@tanstack/react-query';
import { Signal } from '@/types/signals';

interface UseSignalsOptions {
  source?: string;
  type?: string;
  minImportance?: number;
  limit?: number;
  offset?: number;
}

export const useSignals = (options: UseSignalsOptions = {}) => {
  const {
    source = 'rss',
    type = 'macro',
    minImportance,
    limit = 50,
    offset = 0,
  } = options;

  return useQuery<Signal[]>({
    queryKey: ['signals', source, type, minImportance, limit, offset],
    queryFn: async () => {
      const params = new URLSearchParams({
        source,
        type,
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (minImportance) {
        params.append('min_importance', minImportance.toString());
      }

      // ⚠️ Obtenir le token JWT depuis Cognito
      const token = await getAccessToken();

      const response = await fetch(
        `https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`, // ⚠️ OBLIGATOIRE
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch signals');
      }

      return response.json();
    },
    staleTime: 30000, // 30 secondes
    refetchInterval: 60000, // Refetch toutes les minutes
  });
};
```

### Utilisation dans un Composant

```typescript
// components/SignalsList.tsx
'use client';

import { useSignals } from '@/hooks/useSignals';
import { SignalCard } from './SignalCard';

export const SignalsList = () => {
  const { data: signals, isLoading, error } = useSignals({
    source: 'rss',
    type: 'macro',
    minImportance: 7,
    limit: 50,
  });

  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error.message}</div>;

  return (
    <div className="space-y-4">
      {signals?.map((signal) => (
        <SignalCard key={signal.id} signal={signal} />
      ))}
    </div>
  );
};
```

---

## 🔍 Filtrer par Données Extraites

### Filtrer les Surprises Économiques

```typescript
const { data: signals } = useSignals({ source: 'rss', type: 'macro' });

// Filtrer côté frontend pour les surprises significatives
const surprises = signals?.filter(
  (signal) =>
    signal.raw_data?.extracted_data?.surprise &&
    signal.raw_data.extracted_data.surprise !== 'neutral' &&
    (signal.raw_data.extracted_data.surpriseMagnitude || 0) > 0.2
);
```

### Filtrer par Indicateur

```typescript
// Filtrer seulement les signaux CPI
const cpiSignals = signals?.filter(
  (signal) => signal.raw_data?.extracted_data?.indicator === 'CPI'
);
```

---

## 📊 Exemples d'URLs Complètes

### 1. Signaux RSS Macro Importants

```
GET https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&type=macro&min_importance=7&limit=50
```

### 2. Tous les Signaux RSS

```
GET https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&limit=100
```

### 3. Signaux avec Pagination

```
GET https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&type=macro&limit=50&offset=50
```

---

## 🔐 Authentification

**⚠️ IMPORTANT : L'API nécessite une authentification JWT (Cognito)**

L'API Gateway est configurée avec un authorizer JWT. Vous devez inclure un token JWT valide :

```typescript
// Obtenir le token depuis Cognito (exemple avec AWS Amplify)
import { Auth } from 'aws-amplify';

const getAccessToken = async () => {
  const session = await Auth.currentSession();
  return session.getIdToken().getJwtToken();
};

// Utiliser le token
const token = await getAccessToken();
const response = await fetch(
  'https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/signals?source=rss&type=macro&min_importance=7&limit=50',
  {
    headers: {
      'Authorization': `Bearer ${token}`, // ⚠️ OBLIGATOIRE
      'Content-Type': 'application/json',
    },
  }
);
```

**Sans token valide, vous recevrez une erreur 401 Unauthorized.**

---

## ✅ Checklist

- [ ] URL de base : `https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod`
- [ ] Endpoint : `/signals`
- [ ] Paramètres : `source`, `type`, `limit`, `offset`, `min_importance`
- [ ] Réponse : Array de `Signal[]`
- [ ] Données extraites : `signal.raw_data.extracted_data`
- [ ] Authentification : Vérifier si nécessaire

---

## 🎯 Résumé

**Oui, c'est bien cette API !** 

- ✅ Endpoint : `/signals`
- ✅ Méthode : `GET`
- ✅ Paramètres : `source=rss&type=macro&min_importance=7&limit=50`
- ✅ Réponse : Array de signaux avec `extracted_data`

**Le frontend peut utiliser cette API pour récupérer les signaux avec les données extraites !**

