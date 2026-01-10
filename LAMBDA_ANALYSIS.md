# 🔍 Analyse des Lambdas Actives (30 dernières minutes)

## 📊 Métriques Clés

### Concurrence Totale
- **Limite atteinte** : **10.0** exécutions simultanées (constamment)
- **Problème** : La limite de compte (10) est saturée

### Fonctions Actives

| Fonction | Invocations | Concurrence Max | Durée Moyenne | Throttles |
|----------|------------|-----------------|---------------|-----------|
| `parser-13f` | 5 | **10.0** ⚠️ | **900s (15 min)** ⚠️ | **20** |
| `api` | 1 | 1.0 | 125ms | **36** ⚠️ |
| `notification-generator` | 5 | 1.0 | 328ms | **19** ⚠️ |
| `collector-sec-watcher` | 2 | 1.0 | 11s | **7** |
| `collector-sec-company-filings` | 2 | 1.0 | 6.5s | 0 |

## 🚨 Problème Critique Identifié

### `parser-13f` bloque tout le système

1. **10 exécutions simultanées** : Occupe toute la limite de compte (10)
2. **Timeout à 15 minutes** : Chaque exécution prend 900s (timeout)
3. **Impact** : Bloque toutes les autres Lambdas (API, collectors, etc.)

### Résultat
- **API** : 36 throttles (ne peut pas s'exécuter)
- **notification-generator** : 19 throttles
- **collector-sec-watcher** : 7 throttles

## ✅ Solutions

### 1. **CRITIQUE : Augmenter la limite de compte** (2 minutes)
- Aller sur AWS Console → Lambda → Settings → Concurrency
- Supprimer la limite ou mettre **1000**
- **Impact immédiat** : Résout 100% des throttles

### 2. **SQS pour parser-13f** (déjà configuré)
- EventBridge → SQS → Lambda
- Traite 1 message à la fois (pas 10 simultanés)
- **Status** : Terraform configuré, à appliquer

### 3. **Optimiser parser-13f**
- Durée actuelle : 900s (timeout)
- RAM : 1769MB (déjà optimisé)
- **Option** : Parser par chunks si fichiers très volumineux

## 📈 Après Correction

Avec limite à 1000 :
- `parser-13f` : Peut s'exécuter sans bloquer
- `api` : Plus de throttles
- Autres collectors : Plus de throttles

Avec SQS :
- `parser-13f` : 1 exécution à la fois (lisse les pics)
- Pas de saturation même avec plusieurs filings

## 🎯 Actions Immédiates

1. **Augmenter limite compte** → AWS Console (2 min)
2. **Appliquer Terraform SQS** → `terraform apply`
3. **Rebuild parser-13f** → Si code modifié
4. **Tester** → Vérifier que les throttles disparaissent
