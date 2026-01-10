# 🏛️ Configuration des Institutions Premium

## 📋 Liste des Institutions à Suivre

Ce document liste les 20 institutions premium à suivre pour le suivi institutionnel.

| Nom | CIK | Tier | Catégorie | Raison |
|-----|-----|------|-----------|--------|
| Berkshire Hathaway | 0001067983 | 5 | other | Warren Buffett (L'investisseur n°1 au monde) |
| Scion Asset Management | 0001649339 | 5 | hedge_fund | Michael Burry (Le héros de "The Big Short") |
| BlackRock Inc. | 0002012383 | 5 | mutual_fund | Le plus gros gestionnaire d'actifs au monde |
| Pershing Square | 0001336528 | 5 | hedge_fund | Bill Ackman (Investisseur activiste célèbre) |
| Bridgewater Associates | 0001350694 | 5 | hedge_fund | Ray Dalio (Plus gros Hedge Fund au monde) |
| Appaloosa LP | 0001656456 | 5 | hedge_fund | David Tepper (Expert en retournement de marché) |
| Renaissance Technologies | 0001037389 | 5 | hedge_fund | Le roi du trading algorithmique (Jim Simons) |
| Tiger Global Management | 0001167483 | 5 | hedge_fund | Ultra-puissant dans la Tech et les startups |
| ARK Investment Management | 0001697748 | 4 | mutual_fund | Spécialiste de l'innovation disruptive (Cathie Wood) |
| Icahn Carl | 0000813040 | 5 | hedge_fund | Le "raider" original (activisme pur) |
| Third Point LLC | 0001166379 | 5 | hedge_fund | Daniel Loeb (Hedge fund très influent) |
| Vanguard Group Inc | 0000102905 | 5 | mutual_fund | Le deuxième géant mondial après BlackRock |
| Tudor Investment Corp | 0000817087 | 5 | hedge_fund | Paul Tudor Jones (Légende de la macro-économie) |
| Duquesne Family Office | 0001504389 | 5 | family_office | Stanley Druckenmiller (Ancien bras droit de Soros) |
| Soros Fund Management | 0001029160 | 5 | hedge_fund | George Soros (Géopolitique et macro-économie) |
| Point72 Asset Management | 0001603466 | 5 | hedge_fund | Steve Cohen (Inspiration de la série "Billions") |
| Baupost Group | 0001061768 | 5 | hedge_fund | Seth Klarman (Le Buffett de la nouvelle génération) |
| Appaloosa Management | 0001006438 | 4 | hedge_fund | CIK secondaire de David Tepper |
| Bill & Melinda Gates Foundation Trust | 0001166559 | 4 | other | Trust de la fondation Gates (Positions massives) |
| Lone Pine Capital | 0001061393 | 5 | hedge_fund | Un des plus gros "Tiger Cubs" (Anciens de Tiger Global) |

## 🚀 Ajout des Institutions

### Méthode 1 : Script Automatique (Recommandé)

Le script vérifie automatiquement les institutions existantes et ajoute uniquement celles qui manquent.

```bash
# 1. Définir les variables d'environnement
source scripts/create-env-from-tf.sh
# ou manuellement:
export SUPABASE_URL='your-url'
export SUPABASE_SERVICE_KEY='your-key'

# 2. Exécuter le script
./scripts/add-premium-funds.sh
```

**Sortie attendue :**
```
🔍 Checking existing funds...
Found X existing funds

📝 Adding premium funds...

✅ Added: Berkshire Hathaway (0001067983) - Warren Buffett...
⏭️  BlackRock Inc. (0002012383) already exists, skipping
...

📊 Summary:
✅ Added: 15
⏭️  Skipped (already exists): 5
❌ Errors: 0
📈 Total processed: 20
```

### Méthode 2 : Via l'API REST

Vous pouvez aussi ajouter les institutions une par une via l'API :

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

### Méthode 3 : Via SQL Direct

```sql
INSERT INTO funds (name, cik, tier_influence, category)
VALUES 
  ('Berkshire Hathaway', '0001067983', 5, 'other'),
  ('Scion Asset Management', '0001649339', 5, 'hedge_fund'),
  -- ... etc
ON CONFLICT (cik) DO NOTHING;
```

## ✅ Vérification

### Vérifier les institutions ajoutées

```bash
# Via l'API
curl https://your-api.com/funds \
  -H "Authorization: Bearer YOUR_TOKEN"

# Via SQL
SELECT name, cik, tier_influence, category, created_at 
FROM funds 
ORDER BY tier_influence DESC, created_at DESC;
```

### Vérifier les filings découverts

Après l'ajout, le `collector-sec-watcher` découvrira automatiquement les filings (toutes les 5 minutes, ou 1 minute en période de pic).

```bash
# Vérifier les filings pour un fund
curl https://your-api.com/funds/1/filings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📊 Tier d'Influence

Les institutions sont classées par **tier_influence** (1-5) :

- **5** : Institutions les plus influentes (Buffett, Burry, BlackRock, etc.)
- **4** : Institutions importantes mais moins critiques
- **3** : Institutions standard (défaut)
- **2-1** : Institutions moins prioritaires

## 🎯 Catégories

- **hedge_fund** : Hedge funds (majorité des institutions)
- **mutual_fund** : Fonds mutuels (BlackRock, Vanguard, ARK)
- **family_office** : Family offices (Duquesne)
- **other** : Autres (Berkshire Hathaway, Gates Foundation)

## 🔄 Découverte Automatique des Filings

Une fois ajoutées, les institutions sont automatiquement surveillées par :

1. **collector-sec-watcher** : Détecte les nouveaux filings toutes les 5 minutes (1 min en période de pic)
2. **parser-13f** : Parse automatiquement les fichiers 13F
3. **diff engine** : Calcule les différences entre filings

## 📝 Notes Importantes

- **CIK unique** : Chaque CIK ne peut être ajouté qu'une seule fois
- **Découverte automatique** : Les filings sont découverts automatiquement après l'ajout
- **BlackRock CIK** : Le CIK a été mis à jour à `0002012383` (nouveau CIK)
- **Appaloosa** : Il y a deux CIK pour David Tepper (Appaloosa LP et Appaloosa Management)

## 🐛 Dépannage

### Erreur : "Fund with CIK already exists"
L'institution existe déjà. C'est normal, le script skip automatiquement.

### Erreur : "CIK must be 10 digits"
Vérifiez que le CIK est bien au format `0001067983` (10 chiffres avec zéros devant).

### Aucun filing découvert
- Vérifiez que le `collector-sec-watcher` tourne
- Vérifiez les logs CloudWatch
- Attendez le prochain cycle (5 minutes max)
