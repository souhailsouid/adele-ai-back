# Diagnostic SQL: Pourquoi aucune accumulation n'est détectée

Ce script SQL (`diagnose-accumulations.sql`) analyse les données pour le fund 32 (Scion Asset Management) et identifie pourquoi aucune séquence d'accumulation sur 3+ trimestres n'est détectée.

## Comment utiliser ce script

### Option 1: Script TypeScript (recommandé)

Le script TypeScript exécute automatiquement toutes les analyses :

```bash
# Avec variables d'environnement
SUPABASE_URL=https://... SUPABASE_SERVICE_KEY=... npx tsx scripts/diagnose-accumulations.ts 32

# Ou avec un fund_id différent
npx tsx scripts/diagnose-accumulations.ts 32
```

Le script affichera :
- Nombre de filings parsés
- Liste des 8 derniers filings analysés
- Nombre de diffs calculés
- Top 10 tickers avec le plus de mouvements
- Séquences d'accumulation détectées (3+ trimestres)
- Analyse des raisons si aucune séquence n'est détectée
- Exemple détaillé pour un ticker spécifique

### Option 2: Requêtes SQL manuelles

1. **Ouvrir Supabase SQL Editor** ou votre client SQL préféré
2. **Exécuter chaque requête séparément** du fichier `diagnose-accumulations.sql` pour analyser les différents aspects
3. **Analyser les résultats** pour identifier les problèmes spécifiques

## Ce que le script vérifie

### 1. Vérification des filings parsés
- Combien de filings parsés existent pour le fund 32
- Plage de dates couverte (plus ancien vs plus récent)

### 2. Liste des filings parsés
- Tous les filings avec leurs IDs et dates
- Permet de vérifier qu'il y a bien 10 filings parsés comme attendu

### 3. Vérification des diffs calculés
- Combien de diffs sont calculés pour les 8 derniers filings
- Combien de tickers distincts sont impliqués

### 4. Analyse des séquences d'achat
- Pour chaque ticker, liste tous les mouvements (achats/ventes) triés par date décroissante
- Permet de voir visuellement les séquences d'accumulation potentielles

### 5. Détection des séquences d'accumulation potentielles
- Identifie les tickers avec 3+ achats (new/increase)
- Affiche la séquence complète des accumulations
- Identifie les gaps temporels (écarts > 5 mois)

### 6. Identification des problèmes
- **GAP_TEMPOREL**: Écart de plus de 5 mois entre deux filings consécutifs
- **VENTE_INTERMEDIAIRE**: Vente détectée entre deux achats (séquence brisée)
- **ACTION_INCONNUE**: Action non attendue qui brise la séquence

### 7. Vérification des diffs entre filings consécutifs
- Vérifie que les diffs sont bien calculés entre filings consécutifs
- Permet d'identifier si des diffs manquent (filing_id_old incorrect)

### 8. Exemple détaillé pour un ticker spécifique
- Analyse détaillée pour "LULULEMON" (qui apparaît dans les données)
- Permet de voir pourquoi cette séquence n'est pas détectée comme accumulation

## Problèmes potentiels identifiés

### Problème 1: Gaps temporels
Si un fund saute un trimestre (filing manquant), la séquence est brisée car l'écart dépasse 5 mois.

**Solution**: Vérifier si tous les trimestres sont parsés, ou ajuster la tolérance temporelle.

### Problème 2: Ventes intermédiaires
Si un ticker est acheté (Q1, Q2) puis vendu (Q3), puis racheté (Q4), on a deux séquences de 2 trimestres, pas une séquence de 4 trimestres.

**Solution**: C'est le comportement attendu. La logique est correcte, il faut juste identifier les séquences continues sans ventes.

### Problème 3: Diffs non calculés
Si les diffs ne sont pas calculés entre tous les filings consécutifs, certaines séquences peuvent être manquées.

**Solution**: Vérifier que `fund_holdings_diff` contient bien tous les diffs nécessaires, sinon les recalculer.

### Problème 4: Mélange d'achats et de ventes
Si un ticker a des achats et des ventes alternés, aucune séquence continue de 3+ trimestres n'est détectée.

**Solution**: C'est le comportement attendu. Il faut identifier uniquement les accumulations continues.

## Interprétation des résultats

### Si aucune séquence n'est détectée dans la requête #5
- Vérifier la requête #6 pour identifier les problèmes spécifiques
- Vérifier la requête #7 pour voir si des diffs manquent
- Vérifier la requête #8 pour un exemple détaillé

### Si des séquences sont détectées dans #5 mais pas dans l'API
- Vérifier la logique de `detectMultiQuarterTrends` dans `fund-strategic-analysis.service.ts`
- Vérifier que les filings sont bien récupérés (limite de 8)
- Vérifier que les diffs sont bien filtrés par `filing_id_new`

## Prochaines étapes

1. **Exécuter le script SQL** et analyser les résultats
2. **Identifier les problèmes spécifiques** (gaps, ventes, diffs manquants)
3. **Ajuster la logique** si nécessaire (tolérance temporelle, logique de détection)
4. **Recalculer les diffs** si certains manquent
5. **Tester avec un autre fund** qui a plus de données historiques continues
