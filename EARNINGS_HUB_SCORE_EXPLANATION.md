# Explication des Règles de Score - Earnings Hub

## 🎯 Vue d'ensemble

Le **Score Earnings Hub** (A, B, C, D, F) évalue la performance d'une entreprise sur sa capacité à **battre les estimations d'EPS** (Earnings Per Share) des analystes.

**Principe** : Plus une entreprise bat régulièrement les estimations, plus elle est considérée comme performante et fiable.

---

## 📊 Comment le Score est Calculé

Le système analyse les **4 derniers trimestres** et l'**historique complet** pour déterminer le score.

### Critères Principaux

1. **Performance récente** : Combien de beats sur les 4 derniers trimestres ?
2. **Taux de beat historique** : Pourcentage de beats sur tous les trimestres analysés
3. **Amplitude des surprises** : À quel point l'entreprise surpasse-t-elle les attentes ?

---

## 🏆 Détail des Scores

### Score A (Excellent) 🟢

**Conditions** (une des deux doit être remplie) :

1. **Beat parfait** : L'entreprise a battu les estimations sur **les 4 derniers trimestres consécutifs**
   - Exemple : Q1, Q2, Q3, Q4 → Tous beats ✅

2. **Performance exceptionnelle** :
   - Taux de beat ≥ **75%** sur l'historique complet
   - ET Surprise moyenne ≥ **10%**

**Interprétation** :
- Entreprise très performante et fiable
- Dépasse régulièrement les attentes des analystes
- Signale une gestion solide et une croissance soutenue

**Exemple** :
```
Beats récents : 4/4 ✅
Taux de beat : 80% (12 beats sur 15 trimestres)
Surprise moyenne : +12.5%
→ Score A
```

---

### Score B (Bon) 🔵

**Conditions** (une des deux doit être remplie) :

1. **Performance solide** : L'entreprise a battu les estimations sur **3 des 4 derniers trimestres**
   - Exemple : Q1 ✅, Q2 ✅, Q3 ❌, Q4 ✅

2. **Performance régulière** :
   - Taux de beat ≥ **60%** sur l'historique complet
   - ET Surprise moyenne ≥ **5%**

**Interprétation** :
- Entreprise performante avec quelques ratés occasionnels
- Dépasse généralement les attentes
- Signale une gestion compétente

**Exemple** :
```
Beats récents : 3/4 ✅
Taux de beat : 65% (11 beats sur 17 trimestres)
Surprise moyenne : +6.2%
→ Score B
```

---

### Score C (Moyen) 🟠

**Conditions** (une des deux doit être remplie) :

1. **Performance mitigée** : L'entreprise a battu les estimations sur **2 des 4 derniers trimestres**
   - Exemple : Q1 ✅, Q2 ❌, Q3 ✅, Q4 ❌

2. **Performance acceptable** :
   - Taux de beat ≥ **50%** sur l'historique complet

**Interprétation** :
- Entreprise avec une performance irrégulière
- Bat les estimations environ une fois sur deux
- Nécessite une surveillance plus attentive

**Exemple** :
```
Beats récents : 2/4 ✅
Taux de beat : 52% (9 beats sur 17 trimestres)
Surprise moyenne : +2.1%
→ Score C
```

---

### Score D (Faible) 🔴

**Conditions** (une des deux doit être remplie) :

1. **Performance faible** : L'entreprise a battu les estimations sur **1 seul des 4 derniers trimestres**
   - Exemple : Q1 ❌, Q2 ❌, Q3 ✅, Q4 ❌

2. **Performance sous la moyenne** :
   - Taux de beat ≥ **30%** mais < 50%

**Interprétation** :
- Entreprise qui manque régulièrement les estimations
- Signale des difficultés ou une gestion défaillante
- Nécessite une vigilance accrue

**Exemple** :
```
Beats récents : 1/4 ✅
Taux de beat : 35% (6 beats sur 17 trimestres)
Surprise moyenne : -1.5%
→ Score D
```

---

### Score F (Très Faible) ⚫

**Conditions** :

- Taux de beat < **30%** sur l'historique complet
- ET Moins de 1 beat sur les 4 derniers trimestres

**Interprétation** :
- Entreprise en difficulté
- Manque systématiquement les estimations
- Signale des problèmes structurels ou une gestion problématique

**Exemple** :
```
Beats récents : 0/4 ✅
Taux de beat : 18% (3 beats sur 17 trimestres)
Surprise moyenne : -5.2%
→ Score F
```

---

## 📈 Exemples Concrets

### Exemple 1 : Entreprise Tech Performante

```
Historique (16 trimestres) :
- Beats : 12/16 (75%)
- Surprise moyenne : +11.5%
- 4 derniers trimestres : 4/4 beats ✅

Score : A (Excellent)
Raison : Beat parfait sur les 4 derniers trimestres
```

### Exemple 2 : Entreprise Cyclique

```
Historique (16 trimestres) :
- Beats : 10/16 (62.5%)
- Surprise moyenne : +6.8%
- 4 derniers trimestres : 3/4 beats ✅

Score : B (Bon)
Raison : 3/4 beats récents ET taux > 60% + surprise > 5%
```

### Exemple 3 : Entreprise en Difficulté

```
Historique (16 trimestres) :
- Beats : 5/16 (31.25%)
- Surprise moyenne : -2.1%
- 4 derniers trimestres : 1/4 beats ✅

Score : D (Faible)
Raison : Seulement 1/4 beats récents, taux < 50%
```

---

## 🎓 Pourquoi c'est Important ?

### Pour les Investisseurs

1. **Fiabilité** : Une entreprise qui bat régulièrement les estimations montre une gestion prévisible
2. **Croissance** : Les beats indiquent souvent une croissance supérieure aux attentes
3. **Confiance** : Les beats répétés renforcent la confiance des investisseurs

### Pour les Traders

1. **Momentum** : Les beats peuvent déclencher des mouvements de prix positifs
2. **Volatilité** : Les misses peuvent créer de la volatilité (opportunités de trading)
3. **Patterns** : Identifier les patterns de beats/misses aide à anticiper les prochains résultats

---

## ⚠️ Limitations

1. **Pas de garantie** : Un score A ne garantit pas que les prochains résultats seront bons
2. **Contexte sectoriel** : Certains secteurs sont plus volatils que d'autres
3. **Changements structurels** : Une entreprise peut changer de stratégie (nouveau CEO, restructuration, etc.)

---

## 🔄 Évolution du Score

Le score peut changer à chaque nouveau trimestre :

```
Trimestre 1 : Score B (3/4 beats)
↓
Nouveau trimestre : Beat ✅
→ Score A (4/4 beats) 🎉

OU

Nouveau trimestre : Miss ❌
→ Score C (2/4 beats) ⚠️
```

---

## 💡 Conseils d'Utilisation

1. **Ne pas se fier uniquement au score** : Analyser aussi les tendances, le secteur, et les fondamentaux
2. **Surveiller les changements** : Un passage de A à C peut signaler un problème
3. **Contextualiser** : Un score C dans un secteur difficile peut être acceptable
4. **Combiner avec d'autres métriques** : Revenue growth, margins, guidance, etc.

---

## 📝 Résumé Visuel

```
Score A : ████████████ 4/4 beats OU 75%+ avec surprise 10%+
Score B : ██████████░░ 3/4 beats OU 60%+ avec surprise 5%+
Score C : ████████░░░░ 2/4 beats OU 50%+
Score D : ██████░░░░░░ 1/4 beats OU 30-50%
Score F : ████░░░░░░░░ < 30% de beats
```

---

**Note** : Ce système de scoring est basé sur des règles déterministes (pas d'IA). Les seuils peuvent être ajustés selon vos besoins.

