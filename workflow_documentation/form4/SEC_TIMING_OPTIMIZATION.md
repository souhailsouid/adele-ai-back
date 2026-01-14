# ⏰ Optimisation du Timing SEC

## Règle de la clôture SEC

La SEC accepte les dépôts électroniques jusqu'à **22h00 à Washington (EST/EDT)**.

- **Hiver (EST)** : 22h00 EST = **03h00 UTC**
- **Été (EDT)** : 22h00 EDT = **02h00 UTC**

## Timing optimal : 05h15 UTC

**Pourquoi 05h15 UTC ?**

1. **Marge de sécurité** : 2-3 heures après la fermeture des serveurs US
   - Garantit que tous les fichiers JSON ont été consolidés par l'API `data.sec.gov`
   - Évite les requêtes sur des données incomplètes

2. **Disponibilité pour l'Europe** :
   - Données prêtes avant l'ouverture de Paris (08h00 UTC)
   - Données prêtes avant l'ouverture de Londres (08h00 UTC)

3. **Disponibilité pour les US** :
   - Données prêtes avant le Pre-market américain (09h00 ou 13h00 UTC)
   - Idéal pour envoyer une newsletter ou notification "Morning Briefing"

## Gestion du décalage (Le problème du lundi)

**Problème** : Le lundi à 05h15 UTC, la SEC n'aura rien reçu depuis le vendredi soir.

**Solution : Delta Processing**

Au lieu de chercher juste "hier", le script fonctionne par **Delta** :

1. Récupérer le JSON à 05h15 UTC
2. Comparer les `accessionNumber` présents dans le JSON avec ceux déjà en base
3. Traiter **tous les nouveaux**, peu importe leur date

**Avantages :**
- ✅ Gère automatiquement le lundi (pas de nouveaux dépôts depuis vendredi)
- ✅ Pas de perte de données si le cron a été manqué un jour
- ✅ Plus robuste et fiable

## Rythme de la SEC

### Jours de dépôt
- **Lundi au Vendredi** : Dépôts acceptés (hors jours fériés US)
- **Samedi/Dimanche** : Pas de dépôts

### Comportement du cron
- **Week-end** : Le cron tourne mais ne trouvera généralement rien de nouveau
- **Pas d'erreur** : Le script verra simplement qu'il n'y a pas de nouveaux `accessionNumber` dans le JSON
- **Normal** : C'est le comportement attendu

## Optimisations implémentées

### 1. If-Modified-Since Header

```typescript
const headers = {
  'User-Agent': USER_AGENT,
  'If-Modified-Since': lastModified, // Date du dernier filing parsé
};

const response = await fetch(url, { headers });

// 304 Not Modified : pas de changements, skip
if (response.status === 304) {
  return [];
}
```

**Avantages :**
- ✅ Évite de télécharger le JSON si rien n'a changé
- ✅ Réduit la bande passante
- ✅ Réduit le risque de rate limiting

### 2. Delta Processing

```typescript
// Récupérer tous les Form 4 du JSON
const form4Filings = extractForm4FromJSON(data);

// Comparer avec ceux déjà en base
const existing = await getExistingAccessionNumbers(form4Filings);

// Retourner uniquement les nouveaux (delta)
return form4Filings.filter(f => !existing.has(f.accessionNumber));
```

**Avantages :**
- ✅ Gère le lundi (pas de nouveaux dépôts depuis vendredi)
- ✅ Pas de perte si le cron est manqué un jour
- ✅ Plus robuste que le filtrage par date

### 3. Rate Limiting Strict

- **100ms entre chaque requête** = 10 req/s max (limite SEC)
- **Gestion des 429** : Retry après 2 secondes
- **SQS DelaySeconds** : Espace les messages dans le temps

## Configuration actuelle

### Cron Quotidien
```terraform
schedule_expression = "cron(15 5 * * ? *)"  # 05h15 UTC tous les jours
```

### Comportement
1. **05h15 UTC** : Cron déclenché
2. **Delta Processing** : Compare `accessionNumber` avec la base
3. **If-Modified-Since** : Évite les requêtes inutiles
4. **Rate Limiting** : 100ms entre chaque requête SEC
5. **SQS Queue** : Publie les nouveaux Form 4 pour parsing

## Cas d'usage

### Lundi matin
- **05h15 UTC** : Cron déclenché
- **JSON SEC** : Contient les dépôts de vendredi (derniers dépôts)
- **Delta Processing** : Compare avec la base
- **Résultat** : Traite uniquement les nouveaux (s'il y en a)

### Mardi-Vendredi
- **05h15 UTC** : Cron déclenché
- **JSON SEC** : Contient les dépôts de la veille
- **Delta Processing** : Compare avec la base
- **Résultat** : Traite les nouveaux dépôts de la veille

### Week-end
- **05h15 UTC** : Cron déclenché
- **JSON SEC** : Pas de nouveaux dépôts (week-end)
- **Delta Processing** : Compare avec la base
- **Résultat** : Aucun nouveau (comportement normal)

## Monitoring

### Métriques à surveiller

1. **304 Not Modified** : Nombre de requêtes évitées grâce à `If-Modified-Since`
2. **Delta Size** : Nombre de nouveaux `accessionNumber` découverts
3. **Week-end Behavior** : Vérifier que le script ne génère pas d'erreurs le week-end

### Logs attendus

**Lundi :**
```
Found 0 new Form 4 filings (out of 5 total)
```

**Mardi-Vendredi :**
```
Found 3 new Form 4 filings (out of 8 total)
```

**Week-end :**
```
No changes since last check (304 Not Modified)
```
