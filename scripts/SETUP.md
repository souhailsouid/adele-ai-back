# Configuration des Scripts

## 🔐 Variables d'environnement requises

Tous les scripts Python nécessitent ces variables d'environnement :

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-key"
```

## 📝 Méthode 1 : Export direct (temporaire)

```bash
# Dans le terminal, avant d'exécuter le script
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-key"

# Puis exécuter le script
python3 scripts/add-ark-fund.py
```

## 📝 Méthode 2 : Fichier .env (recommandé)

### Créer un fichier `.env` à la racine du projet :

```bash
# .env (à la racine du projet)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

### Charger le .env dans le script :

Modifier les scripts pour charger le .env automatiquement :

```python
from dotenv import load_dotenv
load_dotenv()  # Charge le .env à la racine

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
```

## 📝 Méthode 3 : Script wrapper avec source

Créer un fichier `scripts/.env.local` (dans .gitignore) :

```bash
# scripts/.env.local
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-key"
```

Puis utiliser :

```bash
source scripts/.env.local
python3 scripts/add-ark-fund.py
```

## ✅ Vérification

Pour vérifier que les variables sont bien définies :

```bash
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_KEY
```

## 🔒 Sécurité

⚠️ **IMPORTANT** :
- Ne jamais commiter les credentials sur GitHub
- Le fichier `.env` est dans `.gitignore`
- Utiliser `.env.example` comme template

