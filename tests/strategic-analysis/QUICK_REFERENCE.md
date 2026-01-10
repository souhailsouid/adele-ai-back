# Référence Rapide des Tests - Backend Personamy

> Guide rapide pour retrouver et exécuter tous les tests créés aujourd'hui

## 🚀 Tests Rapides (1 commande)

### Test Complet d'Analyse Stratégique
```bash
npx tsx tests/strategic-analysis/test-strategic-analysis.ts
```
**Teste** : Structure, calculs, tri, nouvelles fonctionnalités (`all_movements`, `sector_flows_filtered`, etc.)

### Test Rapide des Routes API
```bash
./tests/routes/test-all-routes.sh <TOKEN>
```
**Teste** : Routes `/funds/{id}/diffs/strategic` et `/notifications/accumulations`

### Diagnostic d'Accumulations
```bash
npx tsx tests/accumulations/diagnose-accumulations.ts <fund_id>
```
**Teste** : Pourquoi les accumulations ne sont pas détectées pour un fund

---

## 📋 Tests par Catégorie

### ✅ Analyse Stratégique
- **Script** : `tests/strategic-analysis/test-strategic-analysis.ts`
- **Route testée** : `GET /funds/{id}/diffs/strategic`
- **Validations** :
  - ✅ `all_movements` (liste fusionnée et triée)
  - ✅ `sector_flows_filtered` (exclut "Unknown")
  - ✅ `has_only_unknown_sectors` (flag cohérent)
  - ✅ `include_low_conviction` (paramètre fonctionnel)
  - ✅ Tri par priorité (accumulations 3+ > 2+ > impact)
  - ✅ Calculs de portfolio impact
  - ✅ Détection des tendances multi-trimestres

### ✅ Notifications d'Accumulation
- **Route testée** : `GET /notifications/accumulations?only_global=true`
- **Tests manuels** :
  ```bash
  # Test de base
  curl -H "Authorization: Bearer $TOKEN" \
    "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/notifications/accumulations?only_global=true&limit=20"
  
  # Avec filtres
  curl -H "Authorization: Bearer $TOKEN" \
    "https://faq9dl95v7.execute-api.eu-west-3.amazonaws.com/prod/notifications/accumulations?only_global=true&only_strong=true&limit=10"
  ```
- **Validations** :
  - ✅ Historique complet des accumulations
  - ✅ Filtres par date/trimestre/année
  - ✅ Tri par priorité (3+ > 2+ trimestres)

### ✅ Diagnostic
- **Scripts** :
  - `tests/accumulations/diagnose-accumulations.ts` (automatisé)
  - `tests/accumulations/diagnose-accumulations.sql` (manuel, Supabase)
- **Utilisation** : Identifier pourquoi les accumulations ne sont pas détectées
- **Résultats** : 8 requêtes de diagnostic avec explications

---

## 📚 Documentation Complète

| Document | Description | Quand l'utiliser |
|----------|-------------|------------------|
| `tests/strategic-analysis/VALIDATION_GUIDE.md` | Guide complet de tous les tests | Pour comprendre en détail chaque test |
| `tests/README.md` | Vue d'ensemble des tests | Pour trouver rapidement un script |
| `tests/accumulations/diagnose-accumulations-summary.md` | Guide des diagnostics | Pour interpréter les résultats SQL |
| `FRONTEND_STRATEGIC_ANALYSIS_GUIDE.md` | Guide frontend | Pour intégrer les données côté frontend |

---

## 🎯 Checklist Rapide

Avant de considérer une fonctionnalité comme validée :

- [ ] `tests/strategic-analysis/test-strategic-analysis.ts` passe sans erreurs
- [ ] `all_movements` existe et est trié correctement
- [ ] `sector_flows_filtered` exclut "Unknown"
- [ ] `has_only_unknown_sectors` est cohérent
- [ ] Route `/notifications/accumulations?only_global=true` retourne des données
- [ ] Paramètre `include_low_conviction` fonctionne

---

## 🔧 Configuration

### Variables d'Environnement
```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_KEY="your-service-key"
```

### Token JWT
Mettre à jour `ACCESS_TOKEN` dans `tests/strategic-analysis/test-strategic-analysis.ts` ou passer en paramètre :
```bash
./tests/routes/test-all-routes.sh <TOKEN>
```

---

## 📊 Résultats Attendus

### Test Stratégique (Fund 32)
- ✅ Succès : 19+
- ⚠️ Avertissements : 0-2 (non critiques)
- ❌ Erreurs : 0
- `all_movements` : 10 mouvements (sans low), 140 (avec low)

### Notifications d'Accumulation
- Total accumulations : ~97
- Accumulations fortes (3+) : ~26
- Funds analysés : ~9

---

*Pour plus de détails, voir `tests/strategic-analysis/VALIDATION_GUIDE.md`*
