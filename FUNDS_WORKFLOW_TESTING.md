# 🧪 Guide de Test - Workflow Funds Complet

## 📋 Vue d'Ensemble

Ce guide explique comment tester le workflow complet du système de suivi des funds institutionnels en utilisant le fichier `api-tests.http`.

---

## ✅ Prérequis

1. **Token d'accès valide** : Mettre à jour `@accessToken` dans `api-tests.http`
2. **API Gateway URL** : Vérifier que `@baseUrlMain` pointe vers la bonne URL
3. **Base de données** : Les migrations doivent être appliquées (008, 009)

---

## 🚀 Workflow de Test Complet

### Étape 1 : Créer un Fund

```http
POST {{baseUrlMain}}/funds
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "name": "BlackRock Inc.",
  "cik": "0001364742",
  "tier_influence": 5,
  "category": "asset_manager"
}
```

**Vérifications :**
- ✅ Status 200/201
- ✅ Retourne un `id` de fund
- ✅ Le fund est créé dans la table `funds`
- ✅ Un CIK Primary est automatiquement créé dans `fund_ciks`

---

### Étape 2 : Ajouter des CIK Supplémentaires (Multi-CIK)

```http
POST {{baseUrlMain}}/funds/{id}/ciks
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "cik": "0002012383",
  "entity_name": "BlackRock Advisors LLC",
  "is_primary": false
}
```

**Vérifications :**
- ✅ Status 200/201
- ✅ Le CIK est ajouté dans `fund_ciks`
- ✅ `is_primary` est correctement défini

**Test Transparency Mode :**
```http
GET {{baseUrlMain}}/funds/{id}/transparency
```

**Vérifications :**
- ✅ Retourne tous les CIK associés
- ✅ Statistiques par CIK (total_filings, last_filing_date)
- ✅ CIK Primary est identifié

---

### Étape 3 : Vérifier les Filings

```http
GET {{baseUrlMain}}/funds/{id}/filings
```

**Vérifications :**
- ✅ Liste tous les filings (tous CIK confondus)
- ✅ Inclut les filings des CIK secondaires

**Filtrer par type :**
```http
GET {{baseUrlMain}}/funds/{id}/filings?form_type=13F-HR
```

**Vérifications :**
- ✅ Retourne uniquement les filings 13F-HR
- ✅ Filtre correctement par `form_type`

---

### Étape 4 : Récupérer le Portefeuille (Dédupliqué)

```http
GET {{baseUrlMain}}/funds/{id}/portfolio
```

**Vérifications :**
- ✅ Retourne le portefeuille dédupliqué
- ✅ Priorise le CIK Primary pour chaque ticker
- ✅ Pas de double comptage
- ✅ Structure correcte : `{ fund_id, fund_name, total_holdings, total_market_value, holdings: [...] }`

**Test sans déduplication (compatibilité) :**
```http
GET {{baseUrlMain}}/funds/{id}/portfolio?deduplicate=false
```

---

### Étape 5 : Calculer les Différences

```http
GET {{baseUrlMain}}/funds/{id}/diffs
```

**Vérifications :**
- ✅ Liste toutes les différences entre filings
- ✅ Structure correcte : `{ id, fund_id, ticker, action, diff_shares, diff_shares_pct, ... }`
- ✅ Actions correctes : `new`, `exit`, `increase`, `decrease`

**Filtrer par ticker :**
```http
GET {{baseUrlMain}}/funds/{id}/diffs?ticker=AAPL
```

**Historique d'un ticker :**
```http
GET {{baseUrlMain}}/funds/{id}/diffs/AAPL
```

---

### Étape 6 : Changements Récents

```http
GET {{baseUrlMain}}/funds/{id}/changes
```

**Vérifications :**
- ✅ Retourne les changements récents (30 derniers jours)
- ✅ Filtre par `min_change_pct` (défaut: 10%)
- ✅ Structure : `{ total_changes, new_positions, exits, increases, decreases, changes: [...] }`

**Avec seuil personnalisé :**
```http
GET {{baseUrlMain}}/funds/{id}/changes?min_change_pct=5
```

---

### Étape 7 : Notifications

**Récupérer les préférences :**
```http
GET {{baseUrlMain}}/funds/{id}/notifications/preferences
```

**Mettre à jour les préférences :**
```http
PUT {{baseUrlMain}}/funds/{id}/notifications/preferences
Content-Type: application/json

{
  "min_change_pct": 10.0,
  "notify_on_exit": true,
  "notify_on_new": true,
  "digest_enabled": true,
  "digest_time": "09:00:00"
}
```

**Vérifications :**
- ✅ Préférences sauvegardées
- ✅ `min_change_pct` est respecté
- ✅ `digest_enabled` fonctionne

**Récupérer les notifications :**
```http
GET {{baseUrlMain}}/notifications/funds
```

**Vérifications :**
- ✅ Liste les notifications en attente
- ✅ Priorités correctes (Exit = Critical)
- ✅ Filtrage selon `min_change_pct`

**Créer un daily digest :**
```http
POST {{baseUrlMain}}/notifications/digest
Content-Type: application/json

{
  "digest_time": "09:00:00"
}
```

---

### Étape 8 : Calendrier SEC

```http
GET {{baseUrlMain}}/sec/calendar
```

**Vérifications :**
- ✅ Retourne les informations du trimestre actuel
- ✅ `is_peak_period` est correct (true si 1-15 du mois de deadline)
- ✅ `days_until_deadline` est calculé
- ✅ `recommended_polling_interval` est correct (1 ou 5 minutes)

---

## 🎯 Scénario de Test Complet : BlackRock

### 1. Créer BlackRock

```http
POST {{baseUrlMain}}/funds
{
  "name": "BlackRock Inc.",
  "cik": "0001364742",
  "tier_influence": 5,
  "category": "asset_manager"
}
```

**Notez l'`id` retourné (ex: `1`)**

### 2. Ajouter CIK Secondaire

```http
POST {{baseUrlMain}}/funds/1/ciks
{
  "cik": "0002012383",
  "entity_name": "BlackRock Advisors LLC",
  "is_primary": false
}
```

### 3. Vérifier Transparency

```http
GET {{baseUrlMain}}/funds/1/transparency
```

**Attendu :**
- `total_ciks: 2`
- CIK Primary : `0001364742`
- CIK Secondaire : `0002012383`

### 4. Vérifier les Filings

```http
GET {{baseUrlMain}}/funds/1/filings
```

**Attendu :**
- Liste des filings des 2 CIK
- Types : `13F-HR`, `SC 13G`, `SC 13D`

### 5. Portefeuille Dédupliqué

```http
GET {{baseUrlMain}}/funds/1/portfolio
```

**Attendu :**
- Portefeuille sans double comptage
- Priorise CIK Primary pour chaque ticker
- `total_holdings` et `total_market_value` corrects

### 6. Différences

```http
GET {{baseUrlMain}}/funds/1/diffs?limit=20
```

**Attendu :**
- Liste des différences entre filings
- Actions : `new`, `exit`, `increase`, `decrease`

### 7. Changements Récents

```http
GET {{baseUrlMain}}/funds/1/changes?min_change_pct=10
```

**Attendu :**
- Changements >= 10%
- Statistiques : `total_changes`, `new_positions`, `exits`

### 8. Configurer Notifications

```http
PUT {{baseUrlMain}}/funds/1/notifications/preferences
{
  "min_change_pct": 10.0,
  "notify_on_exit": true,
  "digest_enabled": true
}
```

### 9. Récupérer Notifications

```http
GET {{baseUrlMain}}/notifications/funds
```

**Attendu :**
- Notifications filtrées selon préférences
- Priorités correctes

---

## 🔍 Points de Validation Critiques

### ✅ Multi-CIK
- [ ] Plusieurs CIK peuvent être ajoutés à un fund
- [ ] Transparency Mode affiche tous les CIK
- [ ] Filings de tous les CIK sont agrégés

### ✅ Déduplication
- [ ] Portefeuille dédupliqué évite le double comptage
- [ ] CIK Primary est priorisé
- [ ] Même ticker dans plusieurs CIK = une seule position

### ✅ Différences
- [ ] Différences calculées correctement
- [ ] Actions détectées : `new`, `exit`, `increase`, `decrease`
- [ ] Pourcentages calculés correctement

### ✅ Notifications
- [ ] Préférences sauvegardées
- [ ] Filtrage par `min_change_pct` fonctionne
- [ ] Priorités correctes (Exit = Critical)
- [ ] Daily digest peut être créé

### ✅ Calendrier SEC
- [ ] Trimestre actuel correct
- [ ] Période de pic détectée
- [ ] Deadline calculée
- [ ] Intervalle de polling recommandé

---

## 🐛 Dépannage

### Erreur : "Fund not found"
- Vérifier que le fund existe : `GET /funds`
- Vérifier l'`id` utilisé dans les requêtes

### Erreur : "CIK already exists"
- Le CIK est déjà associé au fund
- Vérifier : `GET /funds/{id}/ciks`

### Portefeuille vide
- Vérifier qu'il y a des filings parsés : `GET /funds/{id}/filings`
- Vérifier le statut : `status = 'PARSED'`

### Pas de différences
- Vérifier qu'il y a au moins 2 filings parsés
- Vérifier que les filings sont successifs

### Notifications vides
- Vérifier les préférences : `GET /funds/{id}/notifications/preferences`
- Vérifier qu'il y a des différences : `GET /funds/{id}/diffs`
- Vérifier que `min_change_pct` n'est pas trop élevé

---

## 📊 Checklist de Validation

- [ ] **Création de fund** : Fonctionne
- [ ] **Multi-CIK** : CIK supplémentaires ajoutés
- [ ] **Transparency Mode** : Affiche tous les CIK
- [ ] **Filings** : Tous les CIK agrégés
- [ ] **Portefeuille** : Dédupliqué correctement
- [ ] **Différences** : Calculées correctement
- [ ] **Changements** : Détectés correctement
- [ ] **Notifications** : Préférences sauvegardées
- [ ] **Notifications** : Générées selon préférences
- [ ] **Calendrier SEC** : Informations correctes

---

## 🚀 Prochaines Étapes

Une fois tous les tests validés :

1. **Tester avec plusieurs funds** (BlackRock, Vanguard, Berkshire)
2. **Tester avec des funds réels** (CIK de grandes institutions)
3. **Vérifier les performances** (temps de réponse)
4. **Tester les cas limites** (fund sans filings, fund avec 1 seul filing)

---

**Le workflow complet est testable via `api-tests.http` !** 🎉
