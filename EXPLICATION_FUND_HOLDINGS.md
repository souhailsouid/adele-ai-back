# 📊 À Quoi Sert la Table `fund_holdings` ?

## 🎯 Objectif

La table `fund_holdings` stocke **les positions détenues par chaque fund à un moment donné** (snapshot trimestriel).

**C'est comme un "portefeuille photographié"** à chaque trimestre.

---

## 💡 Exemple Concret : NVDA (Nvidia)

### Scénario

Scion Asset Management (Michael Burry) détient des positions NVDA. Voici ce que tu peux voir dans `fund_holdings` :

### Q3 2025 (Filing du 2025-11-03)

```sql
SELECT 
  h.ticker,
  h.shares,
  h.market_value,
  h.type,
  f.filing_date
FROM fund_holdings h
JOIN fund_filings f ON h.filing_id = f.id
WHERE h.ticker LIKE '%NVDA%' OR h.cusip = '67066G104'
ORDER BY f.filing_date DESC;
```

**Résultat possible** :
```
ticker | shares  | market_value | type  | filing_date
-------|---------|--------------|-------|-------------
NVDA   | 500000  | 200000000    | stock | 2025-11-03
```

**Signification** :
- Scion détient **500,000 actions NVDA**
- Valeur : **$200M** (au moment du filing)
- Type : **stock** (actions, pas d'options)

### Q2 2025 (Filing du 2025-08-14)

```sql
-- Même requête mais pour le filing précédent
```

**Résultat possible** :
```
ticker | shares  | market_value | type  | filing_date
-------|---------|--------------|-------|-------------
NVDA   | 300000  | 120000000    | stock | 2025-08-14
```

---

## 🔍 Analyse : Que Comprendre ?

### Comparaison Q3 vs Q2

**Changement détecté** :
- Q2 : 300,000 actions NVDA = $120M
- Q3 : 500,000 actions NVDA = $200M
- **Différence** : +200,000 actions (+66% d'augmentation)

### Signification Métier

**Ce que ça signifie** :
1. **Michael Burry a ACHETÉ 200,000 actions NVDA** entre Q2 et Q3
2. **Il a augmenté sa position de 66%**
3. **Il croit en NVDA** (ou couvre une position short)

**Pourquoi c'est important** :
- Michael Burry est connu pour ses positions contrariennes
- Si Burry achète NVDA, c'est un signal fort
- D'autres investisseurs suivent ses mouvements

### Signal Généré

**Exemple de signal automatique** :
```
🚨 ALERTE : Scion Asset Management (Michael Burry)
   Action : AUGMENTATION significative
   Ticker : NVDA
   Changement : +200,000 actions (+66%)
   Valeur ajoutée : +$80M
   Date : Q3 2025
   
   Impact : Signal BULLISH sur NVDA
   Priorité : HIGH
```

---

## 📊 Autres Exemples d'Utilisation

### 1. Détecter les Sorties

**Exemple** :
- Q2 : 500,000 actions TSLA
- Q3 : 0 actions TSLA

**Signal** : "Scion a VENDU toutes ses positions TSLA" → Signal BEARISH

### 2. Détecter les Nouvelles Positions

**Exemple** :
- Q2 : Pas de position AAPL
- Q3 : 1,000,000 actions AAPL

**Signal** : "Scion est ENTRÉ sur AAPL avec $150M" → Nouvelle opportunité

### 3. Détecter les Options

**Exemple** :
```
ticker | shares | market_value | type
-------|--------|--------------|------
NVDA   | 0      | 5000000      | call
```

**Signification** : Scion détient des **calls NVDA** (options d'achat) → Signal BULLISH

### 4. Comparer Plusieurs Funds

**Exemple** : Si plusieurs funds augmentent NVDA en même temps :
- Scion : +200K actions
- ARK : +500K actions
- Berkshire : +1M actions

**Signal** : "Accumulation institutionnelle massive sur NVDA" → Signal TRÈS BULLISH

---

## 🎯 Utilisation Pratique

### Pour le Trading

1. **Détecter les mouvements importants** :
   - Changements > 20% = Signal fort
   - Nouvelles positions = Opportunité
   - Sorties totales = Signal de vente

2. **Suivre les "smart money"** :
   - Si Burry achète → Peut-être une bonne idée
   - Si plusieurs funds suivent → Tendance confirmée

3. **Timing** :
   - Les 13F sont publiés 45 jours après le trimestre
   - Mais c'est quand même utile pour comprendre les stratégies

### Pour l'Analyse

1. **Comprendre les stratégies** :
   - Quels secteurs le fund préfère ?
   - Quelles positions sont importantes ?
   - Quelle est la diversification ?

2. **Détecter les patterns** :
   - Le fund achète-t-il toujours les mêmes types de titres ?
   - Y a-t-il des cycles d'achat/vente ?

---

## 📈 Exemple Complet : NVDA

### Données dans `fund_holdings`

```sql
-- Holdings NVDA de Scion
SELECT 
  h.ticker,
  h.shares,
  h.market_value,
  h.type,
  f.filing_date,
  f.accession_number
FROM fund_holdings h
JOIN fund_filings f ON h.filing_id = f.id
JOIN funds ON h.fund_id = funds.id
WHERE funds.name = 'Scion Asset Management, LLC'
  AND (h.ticker LIKE '%NVDA%' OR h.cusip = '67066G104')
ORDER BY f.filing_date DESC;
```

### Évolution dans le Temps

**Q1 2025** : 200,000 actions = $80M
**Q2 2025** : 300,000 actions = $120M (+50%)
**Q3 2025** : 500,000 actions = $200M (+66%)

**Tendance** : Accumulation continue → Signal BULLISH fort

### Comparaison avec d'Autres Funds

```sql
-- Tous les funds qui détiennent NVDA
SELECT 
  funds.name,
  h.shares,
  h.market_value,
  f.filing_date
FROM fund_holdings h
JOIN fund_filings f ON h.filing_id = f.id
JOIN funds ON h.fund_id = funds.id
WHERE h.cusip = '67066G104'  -- CUSIP de NVDA
ORDER BY h.market_value DESC;
```

**Résultat** :
- Scion : 500K actions = $200M
- ARK : 2M actions = $800M
- Berkshire : 5M actions = $2B

**Analyse** : NVDA est largement détenu par les institutions → Titre institutionnel

---

## 🎯 Résumé

### À Quoi Sert `fund_holdings` ?

1. **Snapshot des positions** : Voir ce que chaque fund détient
2. **Détecter les changements** : Comparer les trimestres
3. **Générer des signaux** : Alertes sur mouvements importants
4. **Suivre les "smart money"** : Copier les meilleurs investisseurs
5. **Analyser les tendances** : Comprendre les stratégies

### Pour NVDA Spécifiquement

Si tu vois dans `fund_holdings` :
- **Scion a augmenté sa position NVDA** → Signal BULLISH
- **Scion a vendu NVDA** → Signal BEARISH
- **Plusieurs funds accumulent NVDA** → Tendance haussière

**C'est exactement ce que tu veux savoir pour trader !** 🎯

