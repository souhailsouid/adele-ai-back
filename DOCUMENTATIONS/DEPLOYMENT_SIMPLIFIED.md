# ✅ Déploiement Simplifié : Ce qui est VRAIMENT Nécessaire

## 🎯 Clarification

**Discord/Slack sont OPTIONNELS** - ils servent uniquement à notifier l'équipe backend.

**Pour le frontend**, vous n'avez PAS BESOIN de Discord. Utilisez Supabase Realtime directement.

---

## 📋 Ce qui est OBLIGATOIRE

### 1. Migration SQL (OBLIGATOIRE)

**Fichier** : `infra/supabase/migrations/018_add_data_extraction_and_alerts.sql`

**Pourquoi** :
- Ajoute la colonne `extracted_data` à `signals`
- Crée les tables `alert_keywords` et `alerts_sent` (pour le frontend aussi)
- Active Supabase Realtime pour les alertes frontend

**Action** :
```sql
-- Dans Supabase Dashboard → SQL Editor
-- Copier-coller le contenu de 018_add_data_extraction_and_alerts.sql
```

**Vérification** :
```sql
-- Vérifier que extracted_data existe
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'signals' AND column_name = 'extracted_data';

-- Vérifier que Realtime est activé
ALTER PUBLICATION supabase_realtime ADD TABLE signals;
```

---

### 2. Rebuild Collector-RSS (OBLIGATOIRE)

**Pourquoi** : L'extraction de données est intégrée dans le collector.

**Action** :
```bash
cd workers/collector-rss
npm run bundle
# Puis redéployer via Terraform (le collector existe déjà)
```

---

## ❌ Ce qui est OPTIONNEL

### Worker Alert-Sender (Discord/Slack)

**Nécessaire seulement si** :
- Vous voulez notifier l'équipe sur Discord/Slack
- Vous voulez des alertes système pour monitoring

**Si vous n'en avez pas besoin** :
- ❌ Pas besoin de build `alert-sender`
- ❌ Pas besoin de configurer `discord_webhook_url`
- ❌ Pas besoin de déployer `alert-sender.tf`

**Le frontend fonctionnera parfaitement sans ça !**

---

## 🎯 Résumé : Quoi Déployer ?

| Composant | Nécessaire ? | Pour qui ? |
|-----------|--------------|------------|
| **Migration SQL** | ✅ OUI | Frontend + Backend |
| **Rebuild collector-rss** | ✅ OUI | Backend (extraction) |
| **Worker alert-sender** | ❌ OPTIONNEL | Backend (équipe seulement) |
| **Discord webhook** | ❌ OPTIONNEL | Backend (équipe seulement) |

---

## 🚀 Déploiement Minimal (Sans Discord)

### Étape 1 : Migration SQL

```sql
-- Dans Supabase Dashboard
-- Copier-coller : infra/supabase/migrations/018_add_data_extraction_and_alerts.sql
```

### Étape 2 : Activer Realtime pour Frontend

```sql
-- Activer Realtime sur la table signals
ALTER PUBLICATION supabase_realtime ADD TABLE signals;
```

### Étape 3 : Rebuild Collector-RSS

```bash
cd workers/collector-rss
npm run bundle
# Redéployer via Terraform (collector existe déjà)
```

**C'est tout !** Le frontend peut maintenant utiliser Supabase Realtime.

---

## 📱 Pour le Frontend

**Pas besoin de déployer quoi que ce soit côté backend.**

Le frontend peut :
1. ✅ Utiliser l'API `/signals` (existe déjà)
2. ✅ Utiliser Supabase Realtime (après migration SQL)
3. ✅ Afficher les données extraites (`extracted_data`)
4. ✅ Créer des alertes en temps réel

**Voir** : `DOCUMENTATIONS/FRONTEND_ALERTES_SANS_DISCORD.md`

---

## 🎉 Conclusion

**Discord est optionnel** - c'est juste pour notifier l'équipe backend.

**Le frontend peut tout faire avec Supabase Realtime**, sans Discord !

**Déploiement minimal** :
1. Migration SQL
2. Rebuild collector-rss
3. C'est tout !


