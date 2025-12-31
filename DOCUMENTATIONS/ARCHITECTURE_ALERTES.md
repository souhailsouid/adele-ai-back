# 🏗️ Architecture des Alertes : Backend vs Frontend

## 🎯 Deux Types d'Alertes

### 1. Alertes Backend (Discord/Slack) - OPTIONNEL

**Objectif** : Notifier l'équipe backend/devops quand quelque chose d'important arrive.

**Utilisation** :
- Pour l'équipe technique
- Monitoring et debugging
- Alertes système

**Implémentation** :
- Worker Lambda `alert-sender`
- Webhooks Discord/Slack
- Déclenché par trigger Supabase

**⚠️ Optionnel** : Vous pouvez ne pas déployer `alert-sender` si vous n'en avez pas besoin.

---

### 2. Alertes Frontend (Supabase Realtime) - RECOMMANDÉ

**Objectif** : Notifier l'utilisateur final dans l'application web.

**Utilisation** :
- Pour les utilisateurs de l'application
- Alertes dans l'UI
- Notifications browser

**Implémentation** :
- Supabase Realtime (WebSocket)
- Hook React `useRealtimeAlerts`
- Notifications browser natives

**✅ Recommandé** : C'est ce que le frontend doit implémenter.

---

## 📊 Comparaison

| Critère | Backend (Discord) | Frontend (Realtime) |
|---------|-------------------|---------------------|
| **Cible** | Équipe backend | Utilisateurs finaux |
| **Latence** | ~1 minute (cron) | < 1 seconde |
| **Où** | Discord/Slack | Application web |
| **Nécessaire** | ❌ Optionnel | ✅ Recommandé |
| **Déploiement** | Lambda + Terraform | Frontend uniquement |

---

## 🚀 Recommandation

### Pour le Frontend

**Utilisez Supabase Realtime** directement dans le frontend :
- ✅ Pas besoin de Discord
- ✅ Alertes instantanées
- ✅ Meilleure expérience utilisateur
- ✅ Pas de déploiement backend supplémentaire

### Pour le Backend (Optionnel)

**Discord/Slack** seulement si vous voulez :
- Notifier l'équipe sur un canal dédié
- Monitoring et debugging
- Alertes système

**Si vous n'en avez pas besoin, vous pouvez ignorer complètement le worker `alert-sender`.**

---

## 📝 Résumé

| Composant | Nécessaire ? | Pour qui ? |
|-----------|--------------|------------|
| **Extraction de données** | ✅ Oui | Frontend + Backend |
| **Supabase Realtime** | ✅ Oui | Frontend (utilisateurs) |
| **Discord/Slack** | ❌ Optionnel | Backend (équipe) |
| **Worker alert-sender** | ❌ Optionnel | Backend (équipe) |

**Le frontend peut fonctionner 100% avec Supabase Realtime, sans Discord !**


