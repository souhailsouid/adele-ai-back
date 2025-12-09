# Correction CORS pour AWS Amplify

## ❌ Problème

Erreur CORS lors des appels API depuis :
```
https://main.d15muhyy3o82qt.amplifyapp.com
```

**Erreur**: "Erreur de connexion. Vérifiez votre connexion réseau et la configuration CORS."

## ✅ Solution

Ajouter l'origine Amplify dans `frontend_allowed_origins` dans Terraform.

---

## 📝 Étapes de correction

### 1. Vérifier la configuration actuelle

```bash
cd infra/terraform
cat terraform.tfvars
```

### 2. Ajouter l'origine Amplify

**Option A: Si `terraform.tfvars` existe déjà**

Éditez `infra/terraform/terraform.tfvars` :

```hcl
frontend_allowed_origins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://main.d15muhyy3o82qt.amplifyapp.com"  # ← Ajouter cette ligne
]
```

**Option B: Si `terraform.tfvars` n'existe pas**

Créez `infra/terraform/terraform.tfvars` basé sur `terraform.tfvars.example` :

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```

Puis éditez `terraform.tfvars` :

```hcl
frontend_allowed_origins = [
  "http://localhost:3000",
  "https://main.d15muhyy3o82qt.amplifyapp.com"
]
```

### 3. Appliquer les changements

```bash
cd infra/terraform
terraform plan  # Vérifier les changements
terraform apply # Appliquer
```

---

## 🔍 Vérification

### Test CORS depuis le navigateur

Ouvrez la console navigateur (F12) sur votre site Amplify et testez :

```javascript
fetch('https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/funds', {
  method: 'OPTIONS',
  headers: {
    'Origin': 'https://main.d15muhyy3o82qt.amplifyapp.com',
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Headers': 'authorization'
  }
})
.then(res => {
  console.log('CORS Status:', res.status);
  console.log('CORS Headers:', {
    'Access-Control-Allow-Origin': res.headers.get('Access-Control-Allow-Origin'),
    'Access-Control-Allow-Methods': res.headers.get('Access-Control-Allow-Methods'),
    'Access-Control-Allow-Headers': res.headers.get('Access-Control-Allow-Headers')
  });
});
```

**Résultat attendu**:
- Status: `204` (No Content)
- `Access-Control-Allow-Origin`: `https://main.d15muhyy3o82qt.amplifyapp.com`

---

## 📋 Configuration complète recommandée

Pour supporter à la fois le développement local et la production :

```hcl
# infra/terraform/terraform.tfvars
frontend_allowed_origins = [
  # Développement local
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  
  # Production Amplify
  "https://main.d15muhyy3o82qt.amplifyapp.com",
  
  # Autres environnements Amplify (si nécessaire)
  # "https://dev.d15muhyy3o82qt.amplifyapp.com",
  # "https://staging.d15muhyy3o82qt.amplifyapp.com",
]
```

---

## ⚠️ Notes importantes

1. **Wildcards non supportés**: AWS API Gateway ne supporte pas les wildcards (`*`) dans CORS pour la sécurité. Il faut lister chaque origine explicitement.

2. **Redéploiement nécessaire**: Après `terraform apply`, l'API Gateway est mis à jour immédiatement, mais il peut y avoir un délai de quelques secondes.

3. **Vérifier les sous-domaines**: Si vous avez plusieurs branches/environnements Amplify, ajoutez-les tous :
   - `https://main.d15muhyy3o82qt.amplifyapp.com`
   - `https://dev.d15muhyy3o82qt.amplifyapp.com`
   - etc.

4. **HTTPS obligatoire**: Les origines en production doivent utiliser HTTPS.

---

## 🧪 Test rapide après déploiement

```bash
# Test CORS preflight
curl -X OPTIONS \
  -H "Origin: https://main.d15muhyy3o82qt.amplifyapp.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  -v \
  https://tsdd1sibd1.execute-api.eu-west-3.amazonaws.com/prod/funds
```

Vérifiez que la réponse contient :
```
< HTTP/2 204
< access-control-allow-origin: https://main.d15muhyy3o82qt.amplifyapp.com
< access-control-allow-methods: GET,POST,PATCH,OPTIONS
< access-control-allow-headers: authorization,content-type
```

---

## 🔄 Workflow complet

```bash
# 1. Éditer terraform.tfvars
cd infra/terraform
nano terraform.tfvars  # ou votre éditeur préféré

# 2. Vérifier les changements
terraform plan

# 3. Appliquer
terraform apply

# 4. Vérifier dans la console AWS
# API Gateway → Votre API → CORS
# Vérifier que l'origine est bien listée

# 5. Tester depuis le frontend
# Ouvrir https://main.d15muhyy3o82qt.amplifyapp.com
# Faire une requête API
# Vérifier la console navigateur (F12)
```

---

## 📞 En cas de problème persistant

1. **Vérifier les logs CloudWatch** :
   ```bash
   aws logs tail /aws/lambda/adel-ai-dev-api --since 5m
   ```

2. **Vérifier la configuration CORS dans AWS Console** :
   - API Gateway → Votre API → CORS
   - Vérifier que `frontend_allowed_origins` est bien appliqué

3. **Vérifier les headers dans la console navigateur** :
   - Onglet Network (F12)
   - Regarder la requête OPTIONS (preflight)
   - Vérifier les headers de réponse

4. **Vérifier que l'URL API est correcte** :
   ```bash
   terraform -chdir=infra/terraform output api_gateway_url
   ```







