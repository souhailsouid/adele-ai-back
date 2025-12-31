# Analyse des Coûts Lambda - Séparation vs Monolithique

## 💰 Coûts Lambda AWS (Prix US East, décembre 2024)

### Facturation Lambda
- **Requêtes** : $0.20 par million de requêtes
- **GB-seconde** : $0.0000166667 par GB-seconde
- **Provisioned Concurrency** : $0.0000041667 par GB-seconde (en plus du coût normal)

### Exemple de Calcul

#### Scénario : 100,000 requêtes/mois

**Option A : Lambda Monolithique (actuelle)**
- Timeout : 20s, Memory : 512MB
- Durée moyenne : 15s (routes lourdes), 2s (routes rapides)
- Mix : 20% routes lourdes, 80% routes rapides

**Coûts :**
- Requêtes : 100,000 × $0.20 / 1,000,000 = **$0.02**
- GB-seconde :
  - Routes lourdes (20,000) : 20,000 × 15s × 0.5GB = 150,000 GB-s
  - Routes rapides (80,000) : 80,000 × 2s × 0.5GB = 80,000 GB-s
  - Total : 230,000 GB-s × $0.0000166667 = **$3.83**
- **Total : $3.85/mois**

**Option B : Lambdas Séparées**

**Lambda Fast (80,000 requêtes)**
- Timeout : 10s, Memory : 256MB
- Durée moyenne : 2s
- Requêtes : 80,000 × $0.20 / 1,000,000 = **$0.016**
- GB-seconde : 80,000 × 2s × 0.25GB = 40,000 GB-s × $0.0000166667 = **$0.67**
- **Total Fast : $0.69/mois**

**Lambda Heavy (20,000 requêtes)**
- Timeout : 30s, Memory : 1024MB
- Durée moyenne : 15s
- Requêtes : 20,000 × $0.20 / 1,000,000 = **$0.004**
- GB-seconde : 20,000 × 15s × 1GB = 300,000 GB-s × $0.0000166667 = **$5.00**
- **Total Heavy : $5.00/mois**

**Total Séparé : $5.69/mois**

### Comparaison

| Métrique | Monolithique | Séparée | Différence |
|----------|-------------|---------|------------|
| Coût/mois | $3.85 | $5.69 | +$1.84 (+48%) |
| Timeout routes lourdes | 20s (limite) | 30s (flexible) | ✅ |
| Isolation | ❌ | ✅ | ✅ |
| Cold start impact | Toutes routes | Isolé | ✅ |

## 🚀 Cold Start : Impact et Coûts

### Qu'est-ce qu'un Cold Start ?
- **Définition** : Temps d'initialisation Lambda après inactivité (chargement du code, initialisation)
- **Durée** : 1-3s pour Node.js 20.x avec 512MB
- **Coût** : **GRATUIT** (pas de facturation supplémentaire)
- **Impact** : Latence perçue par l'utilisateur

### Cold Start par Configuration

| Mémoire | Durée Cold Start | CPU Alloué |
|---------|------------------|------------|
| 256MB | ~2-3s | 0.25 vCPU |
| 512MB | ~1-2s | 0.5 vCPU |
| 1024MB | ~0.5-1s | 1 vCPU |
| 2048MB | ~0.3-0.5s | 2 vCPU |

**Plus de mémoire = CPU plus rapide = Cold start plus court**

### Réduction des Cold Starts

#### Option 1 : Provisioned Concurrency (Coûteux)
- **Coût** : $0.0000041667 par GB-seconde
- **Exemple** : 1 instance 1024MB = $0.0042/heure = **$3.02/mois**
- **Bénéfice** : Cold start = 0ms (toujours chaud)
- **Recommandation** : Seulement pour routes critiques avec trafic élevé

#### Option 2 : Augmenter Mémoire (Gratuit)
- **Coût** : Aucun coût supplémentaire si durée réduite
- **Bénéfice** : CPU plus rapide = exécution plus rapide = moins de GB-seconde
- **Exemple** : 512MB → 1024MB peut réduire durée de 15s à 10s
  - Avant : 15s × 0.5GB = 7.5 GB-s
  - Après : 10s × 1GB = 10 GB-s
  - **Mais** : Si durée réduit de 50%, coût reste similaire

#### Option 3 : Warm-up (Gratuit mais complexe)
- CloudWatch Events pour appeler Lambda toutes les 5 minutes
- Coût : Requêtes de warm-up (minimal)
- Bénéfice : Réduction des cold starts

## 💡 Recommandations par Scénario

### Scénario 1 : Trafic Faible (< 10,000 req/mois)
**Recommandation** : **Monolithique optimisée**
- Timeout : 30s, Memory : 1024MB
- Coût : ~$0.50/mois
- Pas besoin de séparation

### Scénario 2 : Trafic Moyen (10,000 - 100,000 req/mois)
**Recommandation** : **Séparée si problèmes de timeout**
- Lambda Fast : 256MB, 10s
- Lambda Heavy : 1024MB, 30s
- Coût : ~$5-6/mois
- Bénéfice : Isolation, timeout flexible

### Scénario 3 : Trafic Élevé (> 100,000 req/mois)
**Recommandation** : **Séparée + Provisioned Concurrency pour routes critiques**
- Lambda Fast : 256MB, 10s
- Lambda Heavy : 1024MB, 30s + 1 instance provisioned
- Coût : ~$8-10/mois
- Bénéfice : Pas de cold start pour routes critiques

## 📊 Coûts CPU

### CPU Proportionnel à Mémoire
- **256MB** = 0.25 vCPU
- **512MB** = 0.5 vCPU
- **1024MB** = 1 vCPU
- **2048MB** = 2 vCPU

### Impact CPU sur Performance
- **Plus de CPU** = Exécution plus rapide
- **Exemple** : Traitement de données
  - 512MB : 15s
  - 1024MB : 10s (50% plus rapide)
  - **Coût similaire** si durée réduite proportionnellement

## 🎯 Décision Recommandée

### Court Terme (Maintenant)
1. ✅ **Optimiser monolithique** : Timeout 30s, Memory 1024MB
2. ✅ **Timeouts stricts** : Déjà fait
3. ✅ **Logs de timing** : Déjà fait
4. **Coût estimé** : ~$4-5/mois

### Moyen Terme (Si problèmes persistent)
1. **Séparer en 2 Lambdas** : Fast + Heavy
2. **Coût estimé** : ~$6/mois (+20-30%)
3. **Bénéfice** : Isolation, timeout flexible

### Long Terme (Si trafic élevé)
1. **Provisioned Concurrency** pour routes critiques
2. **Coût estimé** : ~$10/mois
3. **Bénéfice** : Pas de cold start

## 💰 Résumé Coûts

| Option | Coût/mois | Cold Start | Isolation | Flexibilité |
|--------|-----------|------------|-----------|-------------|
| Monolithique 512MB | $3.85 | 1-2s | ❌ | ❌ |
| Monolithique 1024MB | $4-5 | 0.5-1s | ❌ | ❌ |
| Séparée (Fast + Heavy) | $5.69 | 0.5-3s | ✅ | ✅ |
| Séparée + Provisioned | $8-10 | 0ms (critique) | ✅ | ✅ |

**Conclusion** : La séparation coûte ~20-30% de plus mais offre isolation et flexibilité. Pour un trafic moyen, c'est un bon investissement.





