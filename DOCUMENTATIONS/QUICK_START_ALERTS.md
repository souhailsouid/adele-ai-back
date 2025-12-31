# 🚀 Quick Start : Alertes Temps Réel

## ⚡ Démarrage Rapide (5 minutes)

### 1. Appliquer la Migration SQL

```bash
# Dans Supabase Dashboard → SQL Editor
# Copier-coller le contenu de :
infra/supabase/migrations/018_add_data_extraction_and_alerts.sql
```

### 2. Créer un Webhook Discord

1. Ouvrez votre serveur Discord
2. Paramètres du serveur → Intégrations → Webhooks
3. Créer un webhook → Copier l'URL

### 3. Configurer Terraform

Dans `infra/terraform/terraform.tfvars` :

```hcl
discord_webhook_url = "https://discord.com/api/webhooks/..."
```

### 4. Déployer

```bash
cd infra/terraform
terraform plan
terraform apply
```

### 5. Tester

```sql
-- Insérer un signal de test avec "Trump"
INSERT INTO signals (source, type, raw_data)
VALUES (
  'rss',
  'macro',
  '{"title": "FinancialJuice: Trump announces new policy", "feed": "financial-juice"}'
);

-- Vérifier que l'alerte a été créée
SELECT * FROM alerts_sent WHERE status = 'pending' ORDER BY sent_at DESC LIMIT 1;
```

L'alerte sera envoyée dans la minute qui suit (cron toutes les minutes).

---

## ✅ Checklist

- [ ] Migration SQL appliquée
- [ ] Webhook Discord créé
- [ ] Variable `discord_webhook_url` dans `terraform.tfvars`
- [ ] Terraform déployé
- [ ] Test avec un signal contenant "Trump"
- [ ] Alerte reçue sur Discord

---

## 📊 Vérifier que ça fonctionne

```sql
-- Voir les dernières alertes
SELECT 
  a.*,
  s.raw_data->>'title' as signal_title
FROM alerts_sent a
JOIN signals s ON a.signal_id = s.id
ORDER BY a.sent_at DESC
LIMIT 10;
```

---

## 🎯 Keywords par Défaut

Les keywords suivants sont déjà configurés :
- Trump (priorité 10)
- Zelenskiy (priorité 9)
- CPI (priorité 9)
- Musk (priorité 8)
- BTC, Bitcoin (priorité 7)
- TSLA, Tesla (priorité 7)
- AI (priorité 6)
- GDP, NFP, Fed (priorité 9-10)

Vous pouvez en ajouter/modifier dans la table `alert_keywords`.


