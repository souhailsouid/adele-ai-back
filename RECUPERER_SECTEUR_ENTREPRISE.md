# 🏢 Récupérer le Secteur d'une Entreprise

## 🎯 Routes disponibles

### 1. **GET /companies/ticker/{ticker}** ⭐ **RECOMMANDÉE**
**Rôle** : Récupère une entreprise par son ticker (depuis la table `companies`)

**Fait** :
- ✅ Récupère toutes les infos de l'entreprise (nom, CIK, secteur, industrie, etc.)
- ✅ Retourne le secteur si l'entreprise est déjà en base
- ❌ Retourne `null` si l'entreprise n'existe pas ou n'a pas de secteur

**Exemple** :
```bash
GET /companies/ticker/LULU
```

**Retourne** :
```json
{
  "id": 123,
  "ticker": "LULU",
  "cik": "0001397187",
  "name": "Lululemon Athletica Inc.",
  "sector": "Consumer Cyclical",  // ✅ Secteur
  "industry": "Apparel Manufacturing",
  "market_cap": null,
  "headquarters_country": "United States",
  "headquarters_state": "WA",
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

**Code** : ```117:126:services/api/src/companies.ts
export async function getCompanyByTicker(ticker: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("ticker", ticker.toUpperCase())
    .single();

  if (error) throw error;
  return data;
}
```

**Si le secteur est `null`** :
- L'entreprise existe mais n'a pas encore été enrichie
- Utilisez `POST /companies/enrich` pour enrichir depuis FMP

---

### 2. **GET /companies/{id}**
**Rôle** : Récupère une entreprise par son ID

**Fait** :
- ✅ Même chose que `/ticker/{ticker}` mais avec l'ID
- Utile si vous avez déjà l'ID de l'entreprise

**Exemple** :
```bash
GET /companies/123
```

**Retourne** :
```json
{
  "id": 123,
  "ticker": "LULU",
  "sector": "Consumer Cyclical",
  "industry": "Apparel Manufacturing",
  ...
}
```

**Code** : ```103:112:services/api/src/companies.ts
export async function getCompany(id: number) {
const 
  .from("companies")
  .select("*")
  .eq("id", id)
  .single();

  if (error) throw error;
  return data;
}
```

---

### 3. **POST /companies/enrich**
**Rôle** : Enrichit une entreprise depuis FMP (récupère le secteur si manquant)

**Fait** :
- ✅ Récupère le secteur depuis l'API FMP
- ✅ Crée l'entreprise si elle n'existe pas
- ✅ Met à jour le secteur si manquant

**Exemple** :
```bash
POST /companies/enrich
Content-Type: application/json

{
  "ticker": "LULU",
  "cik": "0001397187"  // Optionnel
}
```

**Retourne** :
```json
{
  "ticker": "LULU",
  "created": false,
  "updated": true,
  "sector": "Consumer Cyclical",  // ✅ Secteur récupéré depuis FMP
  "industry": "Apparel Manufacturing"
}
```

**Code** : ```791:808:services/api/src/router.ts
      // Enrichissement depuis FMP
      {
        method: "POST",
        path: "/companies/enrich",
        handler: async (event) => {
          const body = parseBody(event);
          const ticker = body?.ticker;
          const cik = body?.cik;
          
          if (!ticker) {
            throw new Error("ticker parameter is required");
          }
          
          return await enrichCompanyFromFMPAPI(ticker, cik);
        },
      },
```

**Quand l'utiliser** :
- Si `GET /companies/ticker/{ticker}` retourne `sector: null`
- Pour enrichir automatiquement les entreprises manquantes

---

### 4. **POST /companies/enrich/batch**
**Rôle** : Enrichit plusieurs entreprises en batch

**Fait** :
- ✅ Enrichit plusieurs tickers en une seule requête
- ✅ Utile pour enrichir tous les tickers d'un portefeuille

**Exemple** :
```bash
POST /companies/enrich/batch
Content-Type: application/json

{
  "tickers": ["LULU", "AAPL", "TSLA"],
  "cik_map": {  // Optionnel
    "LULU": "0001397187",
    "AAPL": "0000320193"
  }
}
```

**Retourne** :
```json
{
  "results": [
    {
      "ticker": "LULU",
      "sector": "Consumer Cyclical",
      "created": false,
      "updated": true
    },
    {
      "ticker": "AAPL",
      "sector": "Technology",
      "created": false,
      "updated": true
    }
  ],
  "total": 2,
  "success": 2,
  "failed": 0
}
```

---

### 5. **GET /fmp/sec-filings/profile/{symbol}**
**Rôle** : Récupère le profil complet depuis FMP (sans passer par la table `companies`)

**Fait** :
- ✅ Récupère directement depuis l'API FMP
- ✅ Retourne `marketSector` (secteur FMP)
- ❌ Ne sauvegarde pas en base (appel direct à FMP)

**Exemple** :
```bash
GET /fmp/sec-filings/profile/LULU?cik=0001397187
```

**Retourne** :
```json
[
  {
    "symbol": "LULU",
    "cik": "0001397187",
    "registrantName": "Lululemon Athletica Inc.",
    "marketSector": "Consumer Cyclical",  // ✅ Secteur FMP
    "sicDescription": "Apparel Manufacturing",
    "country": "United States",
    "state": "WA",
    ...
  }
]
```

**Quand l'utiliser** :
- Pour récupérer le secteur sans créer/mettre à jour l'entreprise en base
- Pour vérifier le secteur avant enrichissement

---

## 🎯 Tableau récapitulatif

| Route | Source | Crée/Met à jour | Secteur | Quand utiliser |
|-------|--------|-----------------|---------|----------------|
| `GET /companies/ticker/{ticker}` | Base de données | ❌ | ✅ Si existant | Récupération rapide |
| `GET /companies/{id}` | Base de données | ❌ | ✅ Si existant | Si vous avez l'ID |
| `POST /companies/enrich` | FMP API | ✅ | ✅ | Si secteur manquant |
| `POST /companies/enrich/batch` | FMP API | ✅ | ✅ | Enrichissement multiple |
| `GET /fmp/sec-filings/profile/{symbol}` | FMP API | ❌ | ✅ | Consultation directe FMP |

---

## 💡 Workflow recommandé

### Cas 1 : Récupération simple (secteur déjà en base)

```typescript
// 1. Essayer de récupérer depuis la base
const company = await fetch(`/companies/ticker/LULU`);

if (company.sector) {
  // ✅ Secteur disponible
  console.log(`Secteur: ${company.sector}`);
} else {
  // ❌ Secteur manquant, enrichir
  const enriched = await fetch(`/companies/enrich`, {
    method: 'POST',
    body: JSON.stringify({ ticker: 'LULU' })
  });
  console.log(`Secteur: ${enriched.sector}`);
}
```

### Cas 2 : Enrichissement automatique

```typescript
// Enrichir automatiquement si secteur manquant
async function getCompanyWithSector(ticker: string) {
  let company = await fetch(`/companies/ticker/${ticker}`);
  
  if (!company.sector) {
    // Enrichir depuis FMP
    const enriched = await fetch(`/companies/enrich`, {
      method: 'POST',
      body: JSON.stringify({ ticker })
    });
    
    // Re-récupérer depuis la base (maintenant enrichie)
    company = await fetch(`/companies/ticker/${ticker}`);
  }
  
  return company;
}
```

### Cas 3 : Enrichissement batch (portefeuille complet)

```typescript
// Enrichir tous les tickers d'un portefeuille
const tickers = ['LULU', 'AAPL', 'TSLA', 'MSFT'];

const result = await fetch(`/companies/enrich/batch`, {
  method: 'POST',
  body: JSON.stringify({ tickers })
});

// Maintenant tous les secteurs sont disponibles
for (const ticker of tickers) {
  const company = await fetch(`/companies/ticker/${ticker}`);
  console.log(`${ticker}: ${company.sector}`);
}
```

---

## 🔍 Structure de la réponse

### Table `companies`

```typescript
interface Company {
  id: number;
  ticker: string;              // Ex: "LULU"
  cik: string;                  // Ex: "0001397187"
  name: string;                // Ex: "Lululemon Athletica Inc."
  sector: string | null;       // ✅ Secteur (ex: "Consumer Cyclical")
  industry: string | null;     // Industrie (ex: "Apparel Manufacturing")
  market_cap: number | null;
  headquarters_country: string | null;
  headquarters_state: string | null;
  created_at: string;
  updated_at: string;
}
```

### Secteurs possibles (FMP)

Les secteurs retournés par FMP incluent :
- `Technology`
- `Healthcare`
- `Financial Services`
- `Consumer Cyclical`
- `Consumer Defensive`
- `Energy`
- `Industrials`
- `Communication Services`
- `Utilities`
- `Real Estate`
- `Basic Materials`
- `Unknown` (si non trouvé)

---

## 📋 Exemples complets

### Exemple 1 : Récupérer le secteur d'un ticker

```bash
# Méthode 1 : Depuis la base (rapide)
curl -X GET "https://api.personamy.com/companies/ticker/LULU" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Réponse si secteur disponible :
{
  "ticker": "LULU",
  "sector": "Consumer Cyclical"
}

# Réponse si secteur manquant :
{
  "ticker": "LULU",
  "sector": null  // ❌ Besoin d'enrichir
}
```

```bash
# Méthode 2 : Enrichir depuis FMP
curl -X POST "https://api.personamy.com/companies/enrich" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticker": "LULU"}'

# Réponse :
{
  "ticker": "LULU",
  "created": false,
  "updated": true,
  "sector": "Consumer Cyclical",  // ✅ Enrichi
  "industry": "Apparel Manufacturing"
}
```

### Exemple 2 : Récupérer le secteur depuis les diffs stratégiques

Les diffs stratégiques incluent déjà le secteur pour chaque mouvement :

```bash
GET /funds/32/diffs/strategic
```

**Retourne** :
```json
{
  "all_movements": [
    {
      "ticker": "LULU",
      "sector": "Consumer Cyclical",  // ✅ Secteur inclus
      "action": "increase",
      "portfolio_impact_pct": 5.2
    }
  ],
  "sector_flows": [
    {
      "sector": "Consumer Cyclical",
      "net_flow_pct": 8.7
    }
  ]
}
```

---

## 🚀 Intégration Frontend

### Hook React pour récupérer le secteur

```typescript
// hooks/useCompanySector.ts
import { useState, useEffect } from 'react';

export function useCompanySector(ticker: string) {
  const [sector, setSector] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSector() {
      try {
        // 1. Essayer depuis la base
        const response = await fetch(`/api/companies/ticker/${ticker}`);
        const company = await response.json();
        
        if (company.sector) {
          setSector(company.sector);
          setLoading(false);
        } else {
          // 2. Enrichir si manquant
          await fetch(`/api/companies/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker })
          });
          
          // 3. Re-récupérer
          const updated = await fetch(`/api/companies/ticker/${ticker}`);
          const updatedCompany = await updated.json();
          setSector(updatedCompany.sector);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching sector:', error);
        setLoading(false);
      }
    }

    if (ticker) {
      fetchSector();
    }
  }, [ticker]);

  return { sector, loading };
}
```

### Utilisation dans un composant

```typescript
// components/CompanySector.tsx
import { useCompanySector } from '@/hooks/useCompanySector';

export function CompanySector({ ticker }: { ticker: string }) {
  const { sector, loading } = useCompanySector(ticker);

  if (loading) return <span>Chargement...</span>;
  if (!sector) return <span className="text-muted">Secteur inconnu</span>;

  return (
    <Badge variant="outline">
      {sector}
    </Badge>
  );
}
```

---

## ⚠️ Notes importantes

1. **Secteur `null`** :
   - L'entreprise existe mais n'a pas encore été enrichie
   - Utilisez `POST /companies/enrich` pour récupérer le secteur

2. **Secteur `Unknown`** :
   - FMP n'a pas trouvé de secteur pour ce ticker
   - Peut arriver pour des tickers peu connus ou des fonds

3. **Rate Limiting FMP** :
   - L'API FMP a des limites de taux
   - Utilisez `/enrich/batch` avec un délai pour éviter les erreurs

4. **Normalisation des tickers** :
   - Les tickers sont automatiquement convertis en majuscules
   - "lulu" → "LULU"
   - "LULULEMON " → "LULU" (normalisation automatique)

---

## 📚 Ressources

- **Guide d'enrichissement** : `COMPANY_ENRICHMENT_GUIDE.md`
- **Guide frontend secteurs** : `FRONTEND_SECTORS_INTEGRATION.md`
- **Table `companies`** : Voir migrations Supabase

---

*Guide créé le : 2026-01-10*
