# ⚙️ Configuration Realtime : Backend vs Frontend

## 🎯 Réponse Rapide

**Non, le frontend ne définit PAS Realtime.**

- **Backend** : Active Realtime (migration SQL) ✅
- **Frontend** : Utilise Realtime (code React) ✅

---

## 📋 Répartition des Responsabilités

### 🔧 Backend : Activation Realtime (1 fois)

**Qui** : Backend (migration SQL)  
**Quand** : Une seule fois, lors du déploiement  
**Où** : `infra/supabase/migrations/018_add_data_extraction_and_alerts.sql`

```sql
-- Activer Supabase Realtime pour la table signals
ALTER PUBLICATION supabase_realtime ADD TABLE signals;
```

**Ce que ça fait** :
- Active la publication Realtime pour la table `signals`
- Permet au frontend de s'abonner aux changements
- Fait une seule fois, dans la migration SQL

**Action requise** :
```bash
# Appliquer la migration SQL dans Supabase Dashboard
# Le fichier contient déjà cette ligne (ligne 220)
```

---

### 📱 Frontend : Utilisation Realtime (Code React)

**Qui** : Frontend (développeur)  
**Quand** : Dans le code React  
**Où** : `hooks/useRealtimeAlerts.ts`, `lib/supabase.ts`

```typescript
// 1. Configuration du client Supabase (lib/supabase.ts)
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// 2. S'abonner aux changements (hooks/useRealtimeAlerts.ts)
const channel = supabase
  .channel('rss-signals')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'signals',
    filter: 'source=eq.rss',
  }, (payload) => {
    // Nouveau signal reçu !
    const signal = payload.new;
    // Afficher l'alerte
  })
  .subscribe();
```

**Ce que ça fait** :
- Configure le client Supabase pour utiliser Realtime
- S'abonne aux nouveaux signaux en temps réel
- Reçoit les notifications instantanément

**Action requise** :
- Implémenter le code React (voir guide frontend)

---

## 🔄 Flux Complet

```
┌─────────────────────────────────────────────────────────┐
│ 1. BACKEND : Migration SQL                             │
├─────────────────────────────────────────────────────────┤
│ ALTER PUBLICATION supabase_realtime ADD TABLE signals; │
│                                                         │
│ ✅ Active Realtime pour la table signals               │
│ ✅ Fait une seule fois                                  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 2. SUPABASE                                             │
├─────────────────────────────────────────────────────────┤
│ Table signals activée pour Realtime                    │
│ WebSocket disponible                                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 3. FRONTEND : Code React                                │
├─────────────────────────────────────────────────────────┤
│ const supabase = createClient(...)                     │
│ const channel = supabase.channel(...)                  │
│   .on('postgres_changes', ...)                         │
│   .subscribe()                                         │
│                                                         │
│ ✅ S'abonne aux changements                            │
│ ✅ Reçoit les notifications                            │
└─────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist

### Backend (1 fois)

- [ ] Appliquer la migration SQL `018_add_data_extraction_and_alerts.sql`
- [ ] Vérifier que Realtime est activé :
  ```sql
  SELECT * FROM pg_publication_tables WHERE tablename = 'signals';
  ```
  Doit retourner une ligne avec `signals`

### Frontend (Code React)

- [ ] Installer `@supabase/supabase-js`
- [ ] Créer `lib/supabase.ts` avec configuration Realtime
- [ ] Créer `hooks/useRealtimeAlerts.ts` pour s'abonner
- [ ] Utiliser le hook dans les composants

---

## 🐛 Dépannage

### Erreur : "Realtime subscription failed"

**Cause** : Realtime pas activé côté backend

**Solution** :
```sql
-- Vérifier
SELECT * FROM pg_publication_tables WHERE tablename = 'signals';

-- Si vide, activer
ALTER PUBLICATION supabase_realtime ADD TABLE signals;
```

### Erreur : "Permission denied"

**Cause** : RLS (Row Level Security) bloque l'accès

**Solution** :
```sql
-- Vérifier les policies
SELECT * FROM pg_policies WHERE tablename = 'signals';

-- Si nécessaire, créer une policy pour la lecture
CREATE POLICY "Allow read signals" ON signals
  FOR SELECT USING (true);
```

---

## 📝 Résumé

| Action | Qui | Où | Quand |
|-------|-----|-----|-------|
| **Activer Realtime** | Backend | Migration SQL | 1 fois |
| **Utiliser Realtime** | Frontend | Code React | Dans l'app |

**Le frontend ne configure PAS Realtime, il l'utilise seulement !**

L'activation est faite côté backend (migration SQL), le frontend s'abonne juste aux changements.


