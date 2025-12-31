# 📋 Schéma JSON : extracted_data

## 🎯 Structure Fixe Garantie

Le frontend peut toujours s'attendre à cette structure pour `extracted_data` :

```typescript
interface ExtractedData {
  // ⭐ CHAMPS PRINCIPAUX (toujours présents si extraction réussie)
  actual: number;              // Valeur réelle (OBLIGATOIRE si extraction réussie)
  
  // 📊 CHAMPS OPTIONNELS (présents si disponibles dans la news)
  forecast?: number;          // Prévision
  previous?: number;           // Valeur précédente
  
  // 🏷️ MÉTADONNÉES
  dataType?: 'inflation' | 'gdp' | 'employment' | 'retail_sales' | 'industrial_production' | 'other';
  indicator?: string;          // 'CPI', 'GDP', 'NFP', 'Retail Sales', etc.
  
  // 📈 CALCUL DE SURPRISE
  surprise?: 'positive' | 'negative' | 'neutral';
  surpriseMagnitude?: number; // Différence en points de pourcentage (pp)
  
  // 📐 UNITÉS
  unit?: 'percent' | 'absolute' | 'index';
  period?: 'monthly' | 'quarterly' | 'yearly';
  region?: 'US' | 'JP' | 'EU' | 'CN' | 'UK' | 'CA' | string;
}
```

---

## 📊 Exemples Concrets

### Exemple 1 : CPI (Inflation)

**News** : `"Tokyo area December core CPI +2.3% year on year government according to source poll +2.5%"`

**extracted_data** :
```json
{
  "actual": 2.3,
  "forecast": 2.5,
  "dataType": "inflation",
  "indicator": "CPI",
  "surprise": "negative",
  "surpriseMagnitude": 0.2,
  "unit": "percent",
  "period": "yearly",
  "region": "JP"
}
```

**Frontend** : `signal.raw_data.extracted_data.actual` → `2.3`

---

### Exemple 2 : GDP

**News** : `"US GDP QoQ Advance Actual 4.3% (Forecast 3.3%, Previous 3.8%)"`

**extracted_data** :
```json
{
  "actual": 4.3,
  "forecast": 3.3,
  "previous": 3.8,
  "dataType": "gdp",
  "indicator": "GDP",
  "surprise": "positive",
  "surpriseMagnitude": 1.0,
  "unit": "percent",
  "period": "quarterly",
  "region": "US"
}
```

**Frontend** : `signal.raw_data.extracted_data.actual` → `4.3`

---

### Exemple 3 : NFP (Employment)

**News** : `"US Nonfarm Payrolls Actual 250K (Forecast 200K, Previous 180K)"`

**extracted_data** :
```json
{
  "actual": 250,
  "forecast": 200,
  "previous": 180,
  "dataType": "employment",
  "indicator": "NFP",
  "surprise": "positive",
  "surpriseMagnitude": 50,
  "unit": "absolute",
  "period": "monthly",
  "region": "US"
}
```

**Frontend** : `signal.raw_data.extracted_data.actual` → `250`

---

## 🔍 Accès Frontend

### TypeScript

```typescript
// types/signals.ts
export interface ExtractedData {
  actual: number;              // ⭐ Toujours présent si extraction réussie
  forecast?: number;
  previous?: number;
  dataType?: 'inflation' | 'gdp' | 'employment' | 'retail_sales' | 'industrial_production' | 'other';
  indicator?: string;
  surprise?: 'positive' | 'negative' | 'neutral';
  surpriseMagnitude?: number;
  unit?: 'percent' | 'absolute' | 'index';
  period?: 'monthly' | 'quarterly' | 'yearly';
  region?: string;
}

// Utilisation
const signal: Signal = await fetchSignal();
if (signal.raw_data.extracted_data) {
  const { actual, forecast, surprise } = signal.raw_data.extracted_data;
  // actual est toujours un number si extraction réussie
  console.log(`Actual: ${actual}%`);
  console.log(`Forecast: ${forecast}%`);
  console.log(`Surprise: ${surprise}`);
}
```

### JavaScript

```javascript
// Accès sécurisé avec optional chaining
const actual = signal.raw_data?.extracted_data?.actual;
const forecast = signal.raw_data?.extracted_data?.forecast;
const surprise = signal.raw_data?.extracted_data?.surprise;

if (actual !== undefined) {
  console.log(`Actual: ${actual}%`);
  if (forecast !== undefined) {
    const diff = actual - forecast;
    console.log(`Différence: ${diff}pp`);
  }
}
```

---

## ✅ Garanties

1. **`actual` est toujours un `number`** si extraction réussie
2. **`forecast` est optionnel** (peut être `undefined`)
3. **`previous` est optionnel** (peut être `undefined`)
4. **`surprise` est calculé automatiquement** si `actual` et `forecast` existent
5. **`surpriseMagnitude` est en points de pourcentage** (pp)

---

## 🚨 Cas d'Erreur

Si l'extraction échoue, `extracted_data` sera `null` :

```typescript
if (signal.raw_data.extracted_data === null) {
  // Pas de données extraites pour ce signal
  // Afficher seulement le titre/description
}
```

---

## 📝 Validation PostgreSQL

Le schéma est validé côté backend lors de l'insertion. Le frontend peut faire confiance à la structure.

**Index PostgreSQL** :
- `extracted_data->>'actual'` : Index pour recherche rapide
- `extracted_data->>'surprise'` : Index pour filtrage
- `extracted_data->>'indicator'` : Index pour recherche par indicateur

---

## 🎯 Checklist Frontend

- [ ] Type `ExtractedData` défini avec `actual: number` (obligatoire)
- [ ] Utiliser optional chaining : `signal.raw_data?.extracted_data?.actual`
- [ ] Vérifier `extracted_data !== null` avant utilisation
- [ ] Afficher `actual` en priorité (toujours présent si extraction réussie)
- [ ] Afficher `forecast` et `previous` si disponibles
- [ ] Utiliser `surprise` pour le style (vert/rouge)


