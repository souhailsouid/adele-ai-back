# 🚀 Guide d'Initialisation des Funds

## 📋 Vue d'Ensemble

Ce guide explique comment initialiser tous les funds institutionnels premium en une seule commande.

---

## 🎯 Méthode 1 : Script Automatique (Recommandé)

### Prérequis

1. **Variables d'environnement** :
   ```bash
   export API_BASE_URL='https://xxx.execute-api.eu-west-3.amazonaws.com/prod'
   export API_TOKEN='your-jwt-token'
   ```

   Ou utilisez les variables alternatives :
   ```bash
   export NEXT_PUBLIC_API_MAIN_URL='https://xxx.execute-api.eu-west-3.amazonaws.com/prod'
   export ACCESS_TOKEN='your-jwt-token'
   ```

2. **ts-node installé** :
   ```bash
   npm install -g ts-node typescript
   ```

### Exécution

**Option A : Script Shell (plus simple)**
```bash
./scripts/init-all-funds.sh
```

**Option B : Script TypeScript direct**
```bash
ts-node scripts/init-all-funds.ts
```

### Sortie Attendue

```
🚀 Initialisation des funds institutionnels premium

📍 API Base URL: https://xxx.execute-api.eu-west-3.amazonaws.com/prod

🔍 Vérification des funds existants...
✅ 0 fund(s) existant(s) trouvé(s)

📝 Ajout des funds premium...

✅ Berkshire Hathaway (0001067983) créé (ID: 1)
✅ Scion Asset Management (0001649339) créé (ID: 2)
✅ BlackRock Inc. (0001364742) créé (ID: 3)
   ✅ CIK supplémentaire ajouté: 0002012383 (BlackRock Advisors LLC)
...
⏭️  BlackRock Inc. (0001364742) existe déjà (ID: 3), skip

📊 Résumé:
✅ Funds ajoutés: 18
⏭️  Funds skip (déjà existants): 2
❌ Erreurs: 0
📈 Total traité: 20

🔗 CIK supplémentaires:
   ✅ Ajoutés: 2
   ⏭️  Skip: 0

🎉 Initialisation terminée avec succès !

💡 Les filings seront découverts automatiquement par le collector-sec-watcher
   (toutes les 5 minutes, ou 1 minute en période de pic)
```

---

## 📋 Liste des Funds Initialisés

Le script initialise **20 funds institutionnels premium** :

| Nom | CIK Primary | CIK Secondaires | Tier | Catégorie |
|-----|------------|-----------------|------|-----------|
| Berkshire Hathaway | 0001067983 | - | 5 | other |
| Scion Asset Management | 0001649339 | - | 5 | hedge_fund |
| BlackRock Inc. | 0001364742 | 0002012383 | 5 | mutual_fund |
| Pershing Square | 0001336528 | - | 5 | hedge_fund |
| Bridgewater Associates | 0001350694 | - | 5 | hedge_fund |
| Appaloosa LP | 0001656456 | 0001006438 | 5 | hedge_fund |
| Renaissance Technologies | 0001037389 | - | 5 | hedge_fund |
| Tiger Global Management | 0001167483 | - | 5 | hedge_fund |
| ARK Investment Management | 0001697748 | - | 4 | mutual_fund |
| Icahn Carl | 0000813040 | - | 5 | hedge_fund |
| Third Point LLC | 0001166379 | - | 5 | hedge_fund |
| Vanguard Group Inc | 0000102909 | - | 5 | mutual_fund |
| Tudor Investment Corp | 0000817087 | - | 5 | hedge_fund |
| Duquesne Family Office | 0001504389 | - | 5 | family_office |
| Soros Fund Management | 0001029160 | - | 5 | hedge_fund |
| Point72 Asset Management | 0001603466 | - | 5 | hedge_fund |
| Baupost Group | 0001061768 | - | 5 | hedge_fund |
| Bill & Melinda Gates Foundation Trust | 0001166559 | - | 4 | other |
| Lone Pine Capital | 0001061393 | - | 5 | hedge_fund |

**Total : 20 funds, 2 avec CIK supplémentaires**

---

## 🔄 Comportement Idempotent

Le script est **idempotent** : vous pouvez l'exécuter plusieurs fois sans problème.

- ✅ **Funds existants** : Skip automatiquement
- ✅ **CIK supplémentaires** : Ajoutés même si le fund existe déjà
- ✅ **Pas de doublons** : Vérifie avant d'ajouter

---

## 🎯 Méthode 2 : Via API REST (Manuel)

Si vous préférez créer les funds manuellement :

```bash
curl -X POST https://your-api.com/funds \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Berkshire Hathaway",
    "cik": "0001067983",
    "tier_influence": 5,
    "category": "other"
  }'
```

Puis ajouter les CIK supplémentaires :

```bash
curl -X POST https://your-api.com/funds/1/ciks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cik": "0002012383",
    "entity_name": "BlackRock Advisors LLC",
    "is_primary": false
  }'
```

---

## 🎯 Méthode 3 : Via SQL Direct

```sql
INSERT INTO funds (name, cik, tier_influence, category)
VALUES 
  ('Berkshire Hathaway', '0001067983', 5, 'other'),
  ('Scion Asset Management', '0001649339', 5, 'hedge_fund'),
  ('BlackRock Inc.', '0001364742', 5, 'mutual_fund'),
  -- ... etc
ON CONFLICT (cik) DO NOTHING;

-- Ajouter les CIK supplémentaires pour BlackRock
INSERT INTO fund_ciks (fund_id, cik, entity_name, is_primary)
SELECT id, '0002012383', 'BlackRock Advisors LLC', false
FROM funds
WHERE cik = '0001364742'
ON CONFLICT (fund_id, cik) DO NOTHING;
```

---

## ✅ Vérification

### Vérifier les funds créés

```bash
# Via l'API
curl https://your-api.com/funds \
  -H "Authorization: Bearer YOUR_TOKEN"

# Via SQL
SELECT name, cik, tier_influence, category, created_at 
FROM funds 
ORDER BY tier_influence DESC, created_at DESC;
```

### Vérifier les CIK supplémentaires

```bash
# Via l'API
curl https://your-api.com/funds/3/ciks \
  -H "Authorization: Bearer YOUR_TOKEN"

# Via SQL
SELECT f.name, fc.cik, fc.entity_name, fc.is_primary
FROM funds f
JOIN fund_ciks fc ON fc.fund_id = f.id
ORDER BY f.name, fc.is_primary DESC;
```

### Vérifier Transparency Mode

```bash
curl https://your-api.com/funds/3/transparency \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🔄 Découverte Automatique des Filings

Une fois les funds créés, les filings sont **automatiquement découverts** par :

1. **collector-sec-watcher** : Polling SEC EDGAR toutes les 5 minutes (1 min en période de pic)
2. **parser-13f** : Parse automatiquement les fichiers 13F
3. **diff engine** : Calcule les différences entre filings

**Aucune action manuelle requise !**

---

## 🐛 Dépannage

### Erreur : "API_BASE_URL must be defined"
```bash
export API_BASE_URL='https://xxx.execute-api.eu-west-3.amazonaws.com/prod'
```

### Erreur : "API_TOKEN must be defined"
```bash
export API_TOKEN='your-jwt-token'
```

### Erreur : "ts-node not found"
```bash
npm install -g ts-node typescript
```

### Erreur : "Fund with CIK already exists"
✅ **Normal** : Le script skip automatiquement les funds existants.

### Erreur : "CIK must be 10 digits"
Vérifiez que le CIK est au format `0001067983` (10 chiffres avec zéros devant).

---

## 📊 Statistiques

Après l'initialisation, vous devriez avoir :

- ✅ **20 funds** créés
- ✅ **2 CIK supplémentaires** ajoutés (BlackRock, Appaloosa)
- ✅ **Tous les funds** prêts pour la découverte automatique

---

## 🚀 Prochaines Étapes

1. ✅ Exécuter le script d'initialisation
2. ⏳ Attendre la découverte automatique des filings (5 min max)
3. 🔍 Vérifier les filings : `GET /funds/{id}/filings`
4. 📊 Vérifier le portefeuille : `GET /funds/{id}/portfolio`
5. 🔔 Configurer les notifications : `PUT /funds/{id}/notifications/preferences`

---

**Le script est prêt à être utilisé !** 🎉
