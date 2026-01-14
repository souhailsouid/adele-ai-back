# 📅 Stratégie de Synchronisation SEC Smart Money

## Fréquence recommandée

### 1. **`--insiders-only`** (Form 4 des top companies)
**Fréquence : Quotidienne**

**Pourquoi :**
- Les Form 4 sont déposés quotidiennement
- Permet de détecter rapidement les transactions importantes
- Découvre de nouveaux CIK de dirigeants

**Commande :**
```bash
npx tsx scripts/sync_sec_smart_money.ts --insiders-only
```

**Schedule recommandé :** Tous les jours à 9h UTC (après les dépôts SEC)

---

### 2. **`--track-insiders`** (Cross-company tracking)
**Fréquence : Hebdomadaire ou Mensuelle**

**Pourquoi :**
- Les dirigeants ne changent pas d'entreprise tous les jours
- Les nouvelles corrélations cross-company sont rares
- Plus coûteux en requêtes API (1 requête par CIK de dirigeant)

**Commande :**
```bash
npx tsx scripts/sync_sec_smart_money.ts --track-insiders
```

**Schedule recommandé :** 
- **Hebdomadaire** (dimanche soir) si vous voulez être réactif
- **Mensuelle** (1er du mois) si vous voulez optimiser les coûts

**Intérêt :**
- ✅ Découvrir de nouvelles entreprises où un dirigeant est actif
- ✅ Détecter des corrélations cross-company
- ✅ Compléter l'historique des transactions d'un dirigeant

---

### 3. **`--funds-only`** (13F-HR des Investment Managers)
**Fréquence : Quotidienne ou Hebdomadaire**

**Pourquoi :**
- Les 13F-HR sont déposés trimestriellement (mais peuvent être mis à jour)
- Important pour suivre les mouvements des fonds

**Schedule recommandé :** Quotidien à 10h UTC

---

### 4. **`--earnings-only`** (XBRL 10-Q/10-K)
**Fréquence : Quotidienne**

**Pourquoi :**
- Les 10-Q/10-K sont déposés régulièrement
- Données financières importantes pour l'analyse

**Schedule recommandé :** Quotidien à 11h UTC

---

## Stratégie complète recommandée

### Quotidien (9h-11h UTC)
```bash
# 1. Form 4 des top companies (découvre nouveaux CIK de dirigeants)
npx tsx scripts/sync_sec_smart_money.ts --insiders-only

# 2. 13F-HR des Investment Managers
npx tsx scripts/sync_sec_smart_money.ts --funds-only

# 3. Données XBRL (10-Q/10-K)
npx tsx scripts/sync_sec_smart_money.ts --earnings-only
```

### Hebdomadaire (Dimanche 22h UTC)
```bash
# Tracking cross-company des dirigeants
npx tsx scripts/sync_sec_smart_money.ts --track-insiders
```

---

## Automatisation avec EventBridge

### Option 1: Lambda + EventBridge (Recommandé)

Créer une Lambda qui appelle le script :

```typescript
// workers/sec-smart-money-sync/index.ts
export const handler = async (event: any) => {
  const mode = event.mode || 'all'; // 'insiders-only', 'track-insiders', etc.
  
  // Exécuter le script avec le mode approprié
  await exec(`npx tsx scripts/sync_sec_smart_money.ts --${mode}`);
};
```

**EventBridge Rules :**
- `rate(1 day)` à 9h UTC → `--insiders-only`
- `rate(1 day)` à 10h UTC → `--funds-only`
- `rate(1 day)` à 11h UTC → `--earnings-only`
- `cron(0 22 ? * SUN *)` → `--track-insiders` (dimanche 22h UTC)

### Option 2: CRON local (Développement)

```bash
# Crontab
0 9 * * * cd /path/to/backend && npx tsx scripts/sync_sec_smart_money.ts --insiders-only
0 10 * * * cd /path/to/backend && npx tsx scripts/sync_sec_smart_money.ts --funds-only
0 11 * * * cd /path/to/backend && npx tsx scripts/sync_sec_smart_money.ts --earnings-only
0 22 * * 0 cd /path/to/backend && npx tsx scripts/sync_sec_smart_money.ts --track-insiders
```

---

## Coûts et Optimisations

### Coûts estimés (par jour)

- **`--insiders-only`** : ~100 companies × 1 requête = **100 requêtes/jour**
- **`--track-insiders`** : ~50 dirigeants × 1 requête = **50 requêtes/semaine**
- **`--funds-only`** : ~50 funds × 1 requête = **50 requêtes/jour**
- **`--earnings-only`** : ~50 filings × 1 requête = **50 requêtes/jour**

**Total : ~250 requêtes/jour** (sans `--track-insiders`)

### Optimisations

1. **Cache des CIK de dirigeants** : Ne tracker que les nouveaux CIK découverts
2. **Limiter le nombre de dirigeants** : Top 50 au lieu de tous
3. **Batch processing** : Grouper les requêtes quand possible

---

## Monitoring

Utiliser `cron_registry` pour suivre l'exécution :

```sql
SELECT 
  id,
  last_status,
  last_run_at,
  last_success_at,
  run_count,
  success_count,
  failure_count
FROM cron_registry
WHERE id LIKE 'sec-smart-money%'
ORDER BY last_run_at DESC;
```

---

## Réponse à la question

**Dois-je lancer `--track-insiders` chaque jour ?**

**Non, pas nécessaire.** Voici pourquoi :

1. **Les dirigeants ne changent pas d'entreprise quotidiennement**
2. **Les Form 4 sont déjà synchronisés** via `--insiders-only`
3. **Le tracking cross-company est pour découvrir de nouvelles corrélations**, pas pour suivre les transactions quotidiennes

**Fréquence recommandée :**
- **Hebdomadaire** (dimanche soir) si vous voulez être réactif
- **Mensuelle** (1er du mois) si vous voulez optimiser les coûts

**Intérêt :**
- ✅ Découvrir des corrélations cross-company
- ✅ Compléter l'historique des transactions d'un dirigeant
- ✅ Détecter de nouvelles entreprises où un dirigeant est actif
