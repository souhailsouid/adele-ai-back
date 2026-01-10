# Convergence & Risque de Liquidation - Explication Trader

## 🎯 En 3 Lignes

**Ce que c'est** : Un indicateur qui calcule où les institutions (baleines) ont accumulé leurs positions et où elles visent, pour identifier les zones de convergence et les risques de liquidation.

**Données utilisées** :
- **Dark Pool Trades** (Unusual Whales) → Prix moyen pondéré où les institutions ont acheté
- **Options Flow Alerts** (Unusual Whales) → Strike moyen pondéré par premium (où elles visent)
- **Stock State** (Unusual Whales) → Prix actuel du marché

**Ce que ça te donne** :
1. **Support Dark Pool** : Prix moyen où les baleines sont entrées (ex: $186.53)
2. **Objectif d'Expiration** : Strike moyen où elles visent (ex: $187.80)
3. **Risque de Liquidation** : Si le prix est proche du support (< 0.5%) → Risque HIGH

**Pourquoi c'est utile** : Si le prix tombe sous le support Dark Pool, les institutions peuvent être forcées de liquider → Amplification de la baisse. Si le prix converge vers l'objectif d'expiration → Potentiel haussier.

---

## 📊 Exemple Concret (NVDA)

```
Prix Actuel: $186.54
Support Dark Pool: $186.53  ← Les baleines ont acheté ici
Objectif Expiration: $187.80 ← Elles visent ici
Risque: HIGH (prix à 0.0048% du support)

→ Le prix est dans une zone critique. Si ça casse $186.53, 
  risque de liquidations en cascade.
```

---

## 🔑 Points Clés

- **100% déterministe** : Pas d'IA, juste des calculs mathématiques (moyennes pondérées)
- **Sources Unusual Whales uniquement** : Dark Pools + Options Flow
- **Interprétation automatique** : Le système génère des scénarios et recommandations basés sur des règles de trading pro

