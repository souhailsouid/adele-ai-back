# 🎯 Guide Frontend : Intégration Funds (Système Complet)

## 📋 Vue d'Ensemble

Ce guide explique comment intégrer côté frontend le **nouveau système de suivi des funds institutionnels** que nous venons d'implémenter. Ce système remplace progressivement les APIs externes (comme Unusual Whales) par notre propre infrastructure basée sur les données SEC EDGAR.

---

## 🚀 Ce qui a été fait côté Backend

### 1. **Collecte Automatique des Filings SEC**
- ✅ Polling automatique de la SEC EDGAR toutes les 5 minutes (1 min en période de pic)
- ✅ Détection des nouveaux filings : `13F-HR`, `SC 13G`, `SC 13D`
- ✅ Support multi-CIK (ex: BlackRock a plusieurs entités légales)
- ✅ Rate limiting respecté (150ms entre requêtes)

### 2. **Parsing des 13F**
- ✅ Extraction automatique des `InformationTable` (holdings)
- ✅ Détection automatique milliers vs dollars
- ✅ Support de tous les formats SEC (XML brut, HTML transformé)

### 3. **Calcul de Différences**
- ✅ Comparaison automatique entre filings successifs
- ✅ Détection des changements : `new`, `exit`, `increase`, `decrease`
- ✅ Calcul des pourcentages de variation

### 4. **Déduplication Multi-CIK**
- ✅ Évite le double comptage pour les funds avec plusieurs CIK
- ✅ Priorise automatiquement le CIK Primary
- ✅ Vue SQL automatique pour le portefeuille dédupliqué

### 5. **Système de Notifications**
- ✅ Filtrage intelligent du bruit (min_change_pct)
- ✅ Priorisation automatique (Exit = Critical)
- ✅ Daily digest pour regrouper les notifications
- ✅ Préférences utilisateur configurables

### 6. **Calendrier SEC**
- ✅ Détection des périodes de pic (1-15 fév, mai, août, nov)
- ✅ Calcul des deadlines de publication
- ✅ Recommandations d'intervalles de polling

---

## 🔌 Routes API Disponibles

**Base URL** : `https://{api-gateway-url}/prod`

**Authentification** : JWT Token (Cognito) requis dans le header `Authorization`

```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### 📊 Routes de Base

#### `GET /funds`
Liste tous les funds suivis.

**Réponse:**
```typescript
interface Fund {
  id: number;
  name: string;
  cik: string;
  created_at: string;
}
```

#### `GET /funds/{id}`
Détails d'un fund spécifique.

#### `GET /funds/{id}/holdings`
Holdings d'un fund (simple, sans déduplication).

**Query params:**
- `limit`: Nombre de résultats (défaut: 100)

#### `GET /funds/{id}/filings`
Liste tous les filings d'un fund.

**Query params:**
- `form_type`: Filtrer par type (`13F-HR`, `SC 13G`, `SC 13D`)

---

### ⭐ Routes Avancées (Nouvelles)

#### `GET /funds/{id}/portfolio`
**Portefeuille dédupliqué** (recommandé pour l'affichage).

Retourne le portefeuille actuel sans double comptage. Priorise automatiquement le CIK Primary.

**Réponse:**
```typescript
interface FundPortfolio {
  fund_id: number;
  fund_name: string;
  total_holdings: number;
  total_market_value: number;
  holdings: Array<{
    ticker: string;
    shares: number;
    market_value: number;
    cik: string;
    filing_date: string;
    is_primary: boolean;
  }>;
}
```

**Exemple d'utilisation:**
```typescript
const portfolio = await fetch(`/funds/1/portfolio`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

#### `GET /funds/{id}/diffs`
Liste toutes les différences entre filings successifs.

**Query params:**
- `limit`: Nombre de résultats (défaut: 50)
- `ticker`: Filtrer par ticker

**Réponse:**
```typescript
interface FundDiff {
  id: number;
  fund_id: number;
  ticker: string;
  action: 'new' | 'exit' | 'increase' | 'decrease';
  diff_shares: number;
  diff_shares_pct: number;
  diff_market_value: number;
  filing_id_old: number | null;
  filing_id_new: number;
  created_at: string;
}
```

#### `GET /funds/{id}/diffs/{ticker}`
Historique des changements pour un ticker spécifique.

#### `GET /funds/{id}/changes`
Changements récents (derniers 30 jours).

**Réponse:**
```typescript
interface FundChanges {
  total_changes: number;
  new_positions: number;
  exits: number;
  increases: number;
  decreases: number;
  changes: FundDiff[];
}
```

#### `POST /funds/{id}/filings/{filingId}/calculate-diff`
Calculer manuellement les différences pour un filing.

**Body:**
```typescript
{
  compare_with_previous: boolean; // Comparer avec le filing précédent
}
```

---

### 🔍 Multi-CIK Management

#### `GET /funds/{id}/ciks`
Liste tous les CIK associés à un fund.

**Réponse:**
```typescript
interface FundCik {
  id: number;
  fund_id: number;
  cik: string;
  entity_name: string;
  is_primary: boolean;
  created_at: string;
}
```

#### `POST /funds/{id}/ciks`
Ajouter un CIK supplémentaire.

**Body:**
```typescript
{
  cik: string;
  entity_name: string;
  is_primary?: boolean;
}
```

#### `DELETE /funds/{id}/ciks/{cik}`
Supprimer un CIK.

#### `GET /funds/{id}/transparency`
**Transparency Mode** - Affiche tous les CIK avec leurs statistiques.

**Réponse:**
```typescript
interface TransparencyData {
  fund_id: number;
  fund_name: string;
  total_ciks: number;
  ciks: Array<{
    cik: string;
    entity_name: string;
    is_primary: boolean;
    total_filings: number;
    last_filing_date: string | null;
    last_form_type: string | null;
  }>;
}
```

**Exemple d'utilisation:**
```typescript
// Afficher tous les CIK de BlackRock
const transparency = await fetch(`/funds/1/transparency`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Afficher dans l'UI :
// "BlackRock Inc. agrège 3 entités légales :
//  - BlackRock Inc. (CIK: 0002012383) - Primary - 45 filings
//  - BlackRock Advisors LLC (CIK: 0001364742) - 12 filings
//  - ..."
```

---

### 🔔 Notifications

#### `GET /funds/{id}/notifications/preferences`
Récupérer les préférences de notification.

**Réponse:**
```typescript
interface NotificationPreference {
  id: number;
  user_id: string;
  fund_id: number;
  min_change_pct: number;
  notify_on_new: boolean;
  notify_on_exit: boolean;
  notify_on_increase: boolean;
  notify_on_decrease: boolean;
  digest_enabled: boolean;
  digest_time: string; // Format: "09:00:00"
  email_enabled: boolean;
  push_enabled: boolean;
}
```

#### `PUT /funds/{id}/notifications/preferences`
Mettre à jour les préférences.

**Body:**
```typescript
{
  min_change_pct?: number; // Ex: 10.0 (notifier si changement >= 10%)
  notify_on_exit?: boolean; // Toujours true recommandé
  notify_on_new?: boolean;
  digest_enabled?: boolean;
  digest_time?: string; // Format: "09:00:00"
}
```

#### `GET /notifications/funds`
Récupérer les notifications en attente (non regroupées).

**Réponse:**
```typescript
interface FundNotification {
  id: number;
  user_id: string;
  fund_id: number;
  fund_name: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  ticker: string;
  action: 'new' | 'exit' | 'increase' | 'decrease';
  diff_shares_pct: number;
  status: 'pending' | 'sent' | 'failed' | 'batched';
  created_at: string;
}
```

#### `POST /notifications/digest`
Créer un daily digest manuellement.

**Body:**
```typescript
{
  digest_time: string; // Format: "09:00:00"
}
```

#### `GET /notifications/digests`
Liste tous les digests de l'utilisateur.

#### `GET /notifications/digests/{digestId}`
Détails d'un digest spécifique.

**Réponse:**
```typescript
interface NotificationDigest {
  id: number;
  user_id: string;
  digest_date: string;
  title: string;
  summary: string;
  total_notifications: number;
  funds_count: number;
  status: 'pending' | 'sent' | 'failed';
  notifications: FundNotification[];
}
```

---

### 📅 Calendrier SEC

#### `GET /sec/calendar`
Informations sur le calendrier SEC.

**Réponse:**
```typescript
interface SECCalendar {
  current_quarter: {
    quarter: number; // 1-4
    year: number;
    start_date: string;
    end_date: string;
    deadline: string; // Date limite de publication
  };
  is_peak_period: boolean; // true si période 1-15 du mois de deadline
  days_until_deadline: number;
  recommended_polling_interval: number; // en minutes (1 ou 5)
}
```

---

## 💻 Implémentation Frontend

### 1. Configuration API Client

```typescript
// lib/api/funds.ts
import { getAccessToken } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_MAIN_URL || 'https://xxx.execute-api.eu-west-3.amazonaws.com/prod';

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Types
export interface Fund {
  id: number;
  name: string;
  cik: string;
  created_at: string;
}

export interface FundPortfolio {
  fund_id: number;
  fund_name: string;
  total_holdings: number;
  total_market_value: number;
  holdings: Array<{
    ticker: string;
    shares: number;
    market_value: number;
    cik: string;
    filing_date: string;
    is_primary: boolean;
  }>;
}

export interface FundDiff {
  id: number;
  fund_id: number;
  ticker: string;
  action: 'new' | 'exit' | 'increase' | 'decrease';
  diff_shares: number;
  diff_shares_pct: number;
  diff_market_value: number;
  filing_id_old: number | null;
  filing_id_new: number;
  created_at: string;
}

// API Functions
export const fundsApi = {
  // Liste tous les funds
  getFunds: (): Promise<Fund[]> => 
    apiRequest<Fund[]>('/funds'),

  // Détails d'un fund
  getFund: (id: number): Promise<Fund> => 
    apiRequest<Fund>(`/funds/${id}`),

  // Portefeuille dédupliqué (recommandé)
  getPortfolio: (id: number): Promise<FundPortfolio> => 
    apiRequest<FundPortfolio>(`/funds/${id}/portfolio`),

  // Différences
  getDiffs: (id: number, params?: { limit?: number; ticker?: string }): Promise<FundDiff[]> => {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.ticker) query.set('ticker', params.ticker);
    return apiRequest<FundDiff[]>(`/funds/${id}/diffs?${query}`);
  },

  // Changements récents
  getChanges: (id: number): Promise<{ total_changes: number; changes: FundDiff[] }> => 
    apiRequest(`/funds/${id}/changes`),

  // Transparency Mode
  getTransparency: (id: number): Promise<any> => 
    apiRequest(`/funds/${id}/transparency`),

  // Notifications
  getNotificationPreferences: (id: number): Promise<any> => 
    apiRequest(`/funds/${id}/notifications/preferences`),

  updateNotificationPreferences: (id: number, preferences: any): Promise<any> => 
    apiRequest(`/funds/${id}/notifications/preferences`, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    }),

  getNotifications: (): Promise<any[]> => 
    apiRequest('/notifications/funds'),

  getDigests: (): Promise<any[]> => 
    apiRequest('/notifications/digests'),
};
```

---

### 2. Hook React Query

```typescript
// hooks/useFunds.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fundsApi, Fund, FundPortfolio, FundDiff } from '@/lib/api/funds';

// Liste des funds
export const useFunds = () => {
  return useQuery<Fund[]>({
    queryKey: ['funds'],
    queryFn: () => fundsApi.getFunds(),
  });
};

// Détails d'un fund
export const useFund = (id: number) => {
  return useQuery<Fund>({
    queryKey: ['funds', id],
    queryFn: () => fundsApi.getFund(id),
    enabled: !!id,
  });
};

// Portefeuille dédupliqué
export const useFundPortfolio = (id: number) => {
  return useQuery<FundPortfolio>({
    queryKey: ['funds', id, 'portfolio'],
    queryFn: () => fundsApi.getPortfolio(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Différences
export const useFundDiffs = (id: number, ticker?: string) => {
  return useQuery<FundDiff[]>({
    queryKey: ['funds', id, 'diffs', ticker],
    queryFn: () => fundsApi.getDiffs(id, { limit: 50, ticker }),
    enabled: !!id,
  });
};

// Changements récents
export const useFundChanges = (id: number) => {
  return useQuery({
    queryKey: ['funds', id, 'changes'],
    queryFn: () => fundsApi.getChanges(id),
    enabled: !!id,
    refetchInterval: 5 * 60 * 1000, // Refetch toutes les 5 min
  });
};

// Transparency Mode
export const useFundTransparency = (id: number) => {
  return useQuery({
    queryKey: ['funds', id, 'transparency'],
    queryFn: () => fundsApi.getTransparency(id),
    enabled: !!id,
  });
};

// Notifications
export const useNotificationPreferences = (id: number) => {
  return useQuery({
    queryKey: ['funds', id, 'notifications', 'preferences'],
    queryFn: () => fundsApi.getNotificationPreferences(id),
    enabled: !!id,
  });
};

export const useUpdateNotificationPreferences = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, preferences }: { id: number; preferences: any }) =>
      fundsApi.updateNotificationPreferences(id, preferences),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['funds', id, 'notifications'] });
    },
  });
};

export const useNotifications = () => {
  return useQuery({
    queryKey: ['notifications', 'funds'],
    queryFn: () => fundsApi.getNotifications(),
    refetchInterval: 2 * 60 * 1000, // Refetch toutes les 2 min
  });
};
```

---

### 3. Composants UI

#### Composant Portfolio

```typescript
// components/funds/FundPortfolio.tsx
'use client';

import { useFundPortfolio } from '@/hooks/useFunds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber } from '@/lib/utils';

interface FundPortfolioProps {
  fundId: number;
}

export function FundPortfolio({ fundId }: FundPortfolioProps) {
  const { data: portfolio, isLoading, error } = useFundPortfolio(fundId);

  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error.message}</div>;
  if (!portfolio) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{portfolio.fund_name} - Portefeuille</CardTitle>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{portfolio.total_holdings} positions</span>
          <span>{formatCurrency(portfolio.total_market_value)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {portfolio.holdings.map((holding) => (
            <div
              key={holding.ticker}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{holding.ticker}</span>
                  {holding.is_primary && (
                    <Badge variant="secondary" className="text-xs">
                      Primary CIK
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatNumber(holding.shares)} actions
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">
                  {formatCurrency(holding.market_value)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(holding.filing_date).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### Composant Changements

```typescript
// components/funds/FundChanges.tsx
'use client';

import { useFundChanges } from '@/hooks/useFunds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Plus, X } from 'lucide-react';

interface FundChangesProps {
  fundId: number;
}

const actionIcons = {
  new: Plus,
  exit: X,
  increase: ArrowUp,
  decrease: ArrowDown,
};

const actionColors = {
  new: 'bg-green-100 text-green-800',
  exit: 'bg-red-100 text-red-800',
  increase: 'bg-blue-100 text-blue-800',
  decrease: 'bg-orange-100 text-orange-800',
};

export function FundChanges({ fundId }: FundChangesProps) {
  const { data: changes, isLoading } = useFundChanges(fundId);

  if (isLoading) return <div>Chargement...</div>;
  if (!changes) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Changements Récents</CardTitle>
        <div className="flex gap-4 text-sm">
          <span>Total: {changes.total_changes}</span>
          <span className="text-green-600">Nouveaux: {changes.new_positions}</span>
          <span className="text-red-600">Sorties: {changes.exits}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {changes.changes.map((change) => {
            const Icon = actionIcons[change.action];
            return (
              <div
                key={change.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <div>
                    <div className="font-semibold">{change.ticker}</div>
                    <Badge className={actionColors[change.action]}>
                      {change.action}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">
                    {change.diff_shares_pct > 0 ? '+' : ''}
                    {change.diff_shares_pct.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(change.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### Composant Transparency Mode

```typescript
// components/funds/FundTransparency.tsx
'use client';

import { useFundTransparency } from '@/hooks/useFunds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

interface FundTransparencyProps {
  fundId: number;
}

export function FundTransparency({ fundId }: FundTransparencyProps) {
  const { data: transparency, isLoading } = useFundTransparency(fundId);

  if (isLoading) return <div>Chargement...</div>;
  if (!transparency) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="w-5 h-5" />
          Transparency Mode
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {transparency.fund_name} agrège {transparency.total_ciks} entité(s) légale(s)
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transparency.ciks.map((cik) => (
            <div
              key={cik.cik}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{cik.entity_name}</span>
                  {cik.is_primary && (
                    <Badge variant="default">Primary</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  CIK: {cik.cik}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{cik.total_filings} filings</div>
                {cik.last_filing_date && (
                  <div className="text-xs text-muted-foreground">
                    Dernier: {new Date(cik.last_filing_date).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### Composant Notifications

```typescript
// components/funds/FundNotifications.tsx
'use client';

import { useNotifications } from '@/hooks/useFunds';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, AlertCircle } from 'lucide-react';

export function FundNotifications() {
  const { data: notifications, isLoading } = useNotifications();

  if (isLoading) return <div>Chargement...</div>;
  if (!notifications || notifications.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Aucune notification en attente
        </CardContent>
      </Card>
    );
  }

  const priorityColors = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-gray-100 text-gray-800',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notifications ({notifications.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="flex items-start gap-3 p-3 border rounded-lg"
            >
              {notification.priority === 'critical' && (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{notification.title}</span>
                  <Badge className={priorityColors[notification.priority]}>
                    {notification.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {notification.message}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <span>{notification.fund_name}</span>
                  <span>•</span>
                  <span>{notification.ticker}</span>
                  {notification.diff_shares_pct && (
                    <>
                      <span>•</span>
                      <span>
                        {notification.diff_shares_pct > 0 ? '+' : ''}
                        {notification.diff_shares_pct.toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 4. Page Complète

```typescript
// app/funds/[id]/page.tsx
'use client';

import { useFund, useFundPortfolio, useFundChanges, useFundTransparency } from '@/hooks/useFunds';
import { FundPortfolio } from '@/components/funds/FundPortfolio';
import { FundChanges } from '@/components/funds/FundChanges';
import { FundTransparency } from '@/components/funds/FundTransparency';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function FundPage({ params }: { params: { id: string } }) {
  const fundId = parseInt(params.id);
  const { data: fund } = useFund(fundId);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">{fund?.name}</h1>

      <Tabs defaultValue="portfolio" className="space-y-4">
        <TabsList>
          <TabsTrigger value="portfolio">Portefeuille</TabsTrigger>
          <TabsTrigger value="changes">Changements</TabsTrigger>
          <TabsTrigger value="transparency">Transparency</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio">
          <FundPortfolio fundId={fundId} />
        </TabsContent>

        <TabsContent value="changes">
          <FundChanges fundId={fundId} />
        </TabsContent>

        <TabsContent value="transparency">
          <FundTransparency fundId={fundId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

## 🎨 Points d'Attention UI/UX

### 1. **Affichage des Actions**
- ✅ `new` → Badge vert "Nouvelle position"
- ✅ `exit` → Badge rouge "Sortie totale" (priorité haute)
- ✅ `increase` → Flèche vers le haut bleue
- ✅ `decrease` → Flèche vers le bas orange

### 2. **Priorités de Notifications**
- ✅ `critical` → Rouge, icône d'alerte
- ✅ `high` → Orange
- ✅ `medium` → Jaune
- ✅ `low` → Gris

### 3. **Transparency Mode**
- ✅ Toujours afficher le CIK Primary en premier
- ✅ Badge "Primary" pour le distinguer
- ✅ Statistiques claires (nombre de filings, dernière date)

### 4. **Performance**
- ✅ Utiliser `staleTime` pour éviter les refetch inutiles
- ✅ `refetchInterval` uniquement pour les données critiques (notifications, changements)
- ✅ Pagination pour les grandes listes (holdings, diffs)

---

## 📚 Ressources

- **Guide API complet** : `FUNDS_API_GUIDE.md`
- **Guide Multi-CIK** : `FUNDS_MULTIPLE_CIKS_GUIDE.md`
- **Guide Notifications** : `FUND_NOTIFICATIONS_GUIDE.md`
- **Guide Déduplication** : `FUND_DEDUPLICATION_GUIDE.md`

---

## ✅ Checklist d'Implémentation

- [ ] Configuration API client (`lib/api/funds.ts`)
- [ ] Hooks React Query (`hooks/useFunds.ts`)
- [ ] Composant Portfolio (`components/funds/FundPortfolio.tsx`)
- [ ] Composant Changements (`components/funds/FundChanges.tsx`)
- [ ] Composant Transparency (`components/funds/FundTransparency.tsx`)
- [ ] Composant Notifications (`components/funds/FundNotifications.tsx`)
- [ ] Page Fund Detail (`app/funds/[id]/page.tsx`)
- [ ] Page Liste Funds (`app/funds/page.tsx`)
- [ ] Gestion des erreurs et loading states
- [ ] Tests unitaires des hooks
- [ ] Tests d'intégration des composants

---

**Le système est prêt côté backend. Il ne reste plus qu'à implémenter l'interface utilisateur !** 🚀
