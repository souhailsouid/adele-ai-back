# 🧪 Guide : Tester en Local avec Logs

## 📋 Objectif

Tester l'API en local **sans déployer** pour voir tous les logs en temps réel et déboguer rapidement.

---

## ✅ Configuration

### 1. **Créer le fichier `.env`**

**Option A : Automatique (recommandé)**

Utilisez le script pour générer `.env` depuis `terraform.tfvars` :

```bash
./scripts/create-env-from-tf.sh
```

**Option B : Manuel**

Créez manuellement un fichier `.env` à la racine du projet avec les variables depuis `terraform.tfvars` :

```bash
OPENAI_API_KEY=sk-proj-VOTRE_CLE
OPENAI_MODEL=gpt-4o-mini

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=sb_secret_VOTRE_CLE

UNUSUAL_WHALES_API_KEY=VOTRE_CLE
FMP_API_KEY=VOTRE_CLE

NEO4J_URI=neo4j+s://0bc6b116.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=VOTRE_MOT_DE_PASSE
NEO4J_DATABASE=neo4j
```

**Important** : Le fichier `.env` est déjà dans `.gitignore` (ne sera pas commité).

### 2. **Installer les dépendances** (si pas déjà fait)

```bash
cd services/api
npm install
```

### 3. **Démarrer le serveur local**

```bash
cd services/api
npm run dev
```

Le serveur démarre sur `http://localhost:3001`

---

## 🧪 Tester les Endpoints

### Exemple : Tester `/ai/calendar-summary`

```bash
curl -X POST http://localhost:3001/ai/calendar-summary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_ACCESS_TOKEN" \
  -d '{
    "from": "2025-12-09",
    "to": "2025-12-11"
  }'
```

### Avec VS Code REST Client

Dans `api-tests.http`, changez `{{baseUrlMain}}` par `http://localhost:3001` :

```http
### Test Calendar Summary (Local)
POST http://localhost:3001/ai/calendar-summary
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "from": "2025-12-09",
  "to": "2025-12-11"
}
```

---

## 📊 Logs en Temps Réel

Quand vous lancez `npm run dev`, vous verrez :

1. **Variables d'environnement chargées** :
```
📋 Variables d'environnement chargées:
  - OPENAI_API_KEY: ✅ Définie
  - SUPABASE_URL: ✅ Définie
  - UNUSUAL_WHALES_API_KEY: ✅ Définie
  - FMP_API_KEY: ✅ Définie
  - NEO4J_URI: ✅ Définie
```

2. **Requêtes entrantes** :
```
[2025-12-09T11:22:18.000Z] POST /ai/calendar-summary
```

3. **Logs de l'application** :
```
[AI Calendar] Events collected: { economic: 45, criticalEconomic: 12, ... }
[AI Calendar] Final events: { total: 50, highImpact: 8, ... }
```

4. **Réponses** :
```
Response: 200 { "success": true, "summary": "..." }
```

---

## 🔧 Avantages du Test Local

✅ **Pas besoin de déployer** : Modifiez le code et testez immédiatement  
✅ **Logs complets** : Voir tous les `console.log()` en temps réel  
✅ **Debug facile** : Utiliser `console.log()`, `debugger`, etc.  
✅ **Rapide** : Pas d'attente de déploiement Lambda  
✅ **Variables d'environnement** : Facile à modifier dans `.env`

---

## 🐛 Debug

### Ajouter des logs

Dans votre code, ajoutez :
```typescript
console.log('[DEBUG] Variable:', variable);
console.log('[DEBUG] Data:', JSON.stringify(data, null, 2));
```

### Utiliser le debugger

1. Lancez avec `npm run debug` (au lieu de `npm run dev`)
2. Dans VS Code, allez dans "Run and Debug"
3. Attachez le debugger au processus Node.js
4. Mettez des breakpoints dans votre code

---

## 📝 Notes

- Le fichier `.env` est ignoré par Git (ajouté à `.gitignore`)
- Les variables d'environnement sont chargées automatiquement au démarrage
- Le serveur redémarre automatiquement si vous utilisez `tsx --watch` (optionnel)
- Pour tester avec un vrai token JWT, utilisez votre `accessToken` depuis Cognito

---

## ✅ Checklist

- [ ] Créer le fichier `.env` avec toutes les variables
- [ ] Vérifier que `.env` est dans `.gitignore`
- [ ] Lancer `npm run dev` dans `services/api`
- [ ] Vérifier que les variables sont chargées (message au démarrage)
- [ ] Tester un endpoint avec curl ou VS Code REST Client
- [ ] Vérifier les logs dans le terminal

**Prêt pour tester en local ! 🚀**

