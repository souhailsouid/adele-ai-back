# Dossier Tests - Backend Personamy

> Tous les tests et scripts de validation sont organisés ici pour faciliter le tri et la maintenance

## 📁 Structure

```
tests/
├── strategic-analysis/     # Tests d'analyse stratégique
│   ├── test-strategic-analysis.ts    # Test complet de validation
│   ├── VALIDATION_GUIDE.md           # Guide complet
│   ├── QUICK_REFERENCE.md            # Référence rapide
│   └── SUMMARY.md                    # Résumé des tests
├── accumulations/          # Tests de détection d'accumulations
│   ├── diagnose-accumulations.ts     # Diagnostic automatisé
│   ├── diagnose-accumulations.sql    # Requêtes SQL
│   ├── diagnose-accumulations-summary.md  # Guide d'utilisation
│   └── accumulation-detection.test.ts     # Test de détection
└── routes/                 # Tests des routes API
    ├── test-all-routes.sh            # Test rapide
    └── test-all-routes-with-report.sh # Test avec rapport
```

## 🚀 Utilisation Rapide

### Test d'Analyse Stratégique
```bash
npx tsx tests/strategic-analysis/test-strategic-analysis.ts
```

### Diagnostic d'Accumulations
```bash
npx tsx tests/accumulations/diagnose-accumulations.ts <fund_id>
```

### Test Rapide des Routes
```bash
./tests/routes/test-all-routes.sh <TOKEN>
```

## 📚 Documentation

- **Guide complet** : `strategic-analysis/VALIDATION_GUIDE.md`
- **Référence rapide** : `strategic-analysis/QUICK_REFERENCE.md`
- **Résumé** : `strategic-analysis/SUMMARY.md`

## 📝 Note

Ce dossier contient tous les tests créés aujourd'hui (2026-01-09).  
Les scripts utilitaires d'opération restent dans `scripts/`.  
Les tests unitaires/integration iront dans `tests/unit/` et `tests/integration/` lors du tri futur.
