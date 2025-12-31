# Correction : Marqueurs Vides Empêchant le Refetch

## Problème Identifié

La route `/ai/options-flow-analysis` fonctionne et retourne des données d'options flow pour NVDA, mais `/ai/ticker-activity-analysis` retourne toujours des données manquantes.

**Cause** :
- `/ai/options-flow-analysis` appelle directement `uw.getUWRecentFlows()` sans passer par le cache
- `/ai/ticker-activity-analysis` utilise `TickerDataPersistenceService` qui :
  1. Vérifie d'abord le cache
  2. Si un marqueur vide existe et a < 1h, retourne `[]` **sans appeler l'API**
  3. Les marqueurs vides créés précédemment (0.27h pour options flow) empêchent donc le refetch

## Corrections Appliquées

### 1. Réduction du TTL des Marqueurs Vides pour Options Flow

**Avant** : Les marqueurs vides avaient un TTL de 1h, même si `maxAgeHours` était plus grand.

**Après** :
- ✅ TTL des marqueurs vides réduit à **15 minutes** pour les options flow
- ✅ TTL effectif : `effectiveMaxAge = 0.25` (15 min) pour les marqueurs vides d'options flow
- ✅ Les marqueurs vides sont maintenant refetch après **15 minutes maximum**

**Fichier modifié** : `services/api/src/services/ticker-data-persistence.service.ts`

### 2. Nettoyage Automatique des Marqueurs Vides Expirés

**Ajout** : Suppression automatique des marqueurs vides expirés (> 15 min) avant de vérifier le cache.

**Avantages** :
- ✅ Les marqueurs vides anciens sont automatiquement supprimés
- ✅ Force un refetch si les marqueurs vides sont > 15 min
- ✅ Pas besoin d'attendre l'expiration du TTL

**Code ajouté** :
```typescript
// Nettoyer les marqueurs vides expirés (> 15 min) pour forcer un refetch
const fifteenMinutesAgo = new Date();
fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
await supabase
  .from('options_flow')
  .delete()
  .eq('ticker', upperTicker)
  .eq('is_empty_marker', true)
  .lt('cached_at', fifteenMinutesAgo.toISOString());
```

## Résultats Attendus

1. **Marqueurs vides** : Les marqueurs vides sont maintenant refetch après 15 minutes maximum (au lieu de 1h).

2. **Nettoyage automatique** : Les marqueurs vides expirés sont supprimés automatiquement, forçant un refetch.

3. **Données fraîches** : Les données d'options flow seront maintenant récupérées depuis l'API si les marqueurs vides sont > 15 min.

## Test

1. **Tester avec NVDA** : Faire une nouvelle requête à `/ai/ticker-activity-analysis` pour NVDA
   - Si les marqueurs vides existants sont > 15 min, ils seront supprimés et un refetch sera effectué
   - Les données d'options flow devraient maintenant être récupérées

2. **Vérifier les logs** : Les logs devraient maintenant indiquer :
   - "Fetching fresh options_flow data" au lieu de "Using cached empty options_flow marker"
   - Les données d'options flow devraient être présentes dans la réponse

## Note

Si les marqueurs vides existants dans Supabase sont récents (< 15 min), il faudra attendre 15 minutes ou supprimer manuellement les marqueurs vides pour NVDA dans Supabase.

Pour supprimer manuellement :
```sql
DELETE FROM options_flow 
WHERE ticker = 'NVDA' AND is_empty_marker = true;
```





