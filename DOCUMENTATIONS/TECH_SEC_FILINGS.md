# 🔧 Documentation Technique : Recherche SEC et Filings 13F

## 📋 Vue d'Ensemble

Ce document explique comment le système récupère automatiquement les filings 13F depuis EDGAR (SEC) et les traite.

---

## 🔍 Étape 1 : Recherche EDGAR via API Atom

### URL de Recherche

Le SEC Watcher construit une URL Atom pour interroger EDGAR :

```
https://www.sec.gov/cgi-bin/browse-edgar?
  action=getcompany
  &CIK=0001649339          ← CIK du fund (10 chiffres)
  &type=13F-HR            ← Seulement les formulaires 13F
  &dateb=                 ← Date de fin (vide = pas de limite)
  &owner=include          ← Inclure les filings en tant que propriétaire
  &count=10               ← Nombre de résultats max
  &output=atom            ← Format Atom (XML structuré)
```

### Code Source

**Fichier** : `workers/collector-sec-watcher/src/index.ts`

```typescript
async function checkFundForNewFilings(fund: Fund) {
  // 1. Construire l'URL Atom pour ce CIK
  const rssUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${fund.cik}&type=13F-HR&dateb=&owner=include&count=10&output=atom`;

  // 2. Faire la requête HTTP avec User-Agent obligatoire
  const response = await fetch(rssUrl, {
    headers: {
      "User-Agent": "ADEL AI (contact@adel.ai)", // Obligatoire pour EDGAR
    },
  });

  if (!response.ok) {
    throw new Error(`EDGAR API error: ${response.status}`);
  }

  // 3. Récupérer le XML Atom
  const xml = await response.text();
  
  // 4. Parser le XML
  const entries = parseEDGARFeed(xml);
  
  // 5. Traiter chaque entrée
  for (const entry of entries) {
    // ...
  }
}
```

---

## 📄 Étape 2 : Format de Réponse Atom

### Exemple de Réponse EDGAR

EDGAR retourne un fichier XML au format Atom :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>EDGAR Filings</title>
  <entry>
    <title>13F-HR - Scion Asset Management, LLC</title>
    <link href="https://www.sec.gov/cgi-bin/viewer?action=view&cik=1649339&accession_number=0001649339-25-000007"/>
    <updated>2025-11-03T00:00:00Z</updated>
    <summary>Quarterly report filed by institutional managers</summary>
  </entry>
  <entry>
    <title>13F-HR - Scion Asset Management, LLC</title>
    <link href="https://www.sec.gov/cgi-bin/viewer?action=view&cik=1649339&accession_number=0001879202-25-000038"/>
    <updated>2025-08-14T00:00:00Z</updated>
  </entry>
  <!-- ... plus d'entrées ... -->
</feed>
```

### Structure Atom

Chaque `<entry>` contient :
- `<title>` : Titre du filing
- `<link href="...">` : URL du filing (contient l'accession number)
- `<updated>` : Date de soumission (format ISO 8601)
- `<summary>` : Description (optionnel)

---

## 🔧 Étape 3 : Parsing du XML Atom

### Fonction de Parsing

**Fichier** : `workers/collector-sec-watcher/src/index.ts`

```typescript
function parseEDGARFeed(xml: string): Array<{ link: string; updated: string; title: string }> {
  const entries: Array<{ link: string; updated: string; title: string }> = [];
  
  // 1. Trouver toutes les balises <entry>
  const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
  
  for (const match of entryMatches) {
    const entryXml = match[1];
    
    // 2. Extraire le <link href="...">
    const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"/);
    
    // 3. Extraire l'<updated>
    const updatedMatch = entryXml.match(/<updated>([^<]+)<\/updated>/);
    
    // 4. Extraire le <title>
    const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
    
    if (linkMatch && updatedMatch) {
      entries.push({
        link: linkMatch[1],        // URL complète du filing
        updated: updatedMatch[1],  // Date ISO 8601
        title: titleMatch?.[1] || "", // Titre
      });
    }
  }
  
  return entries;
}
```

### Exemple de Résultat

```typescript
[
  {
    link: "https://www.sec.gov/cgi-bin/viewer?action=view&cik=1649339&accession_number=0001649339-25-000007",
    updated: "2025-11-03T00:00:00Z",
    title: "13F-HR - Scion Asset Management, LLC"
  },
  {
    link: "https://www.sec.gov/cgi-bin/viewer?action=view&cik=1649339&accession_number=0001879202-25-000038",
    updated: "2025-08-14T00:00:00Z",
    title: "13F-HR - Scion Asset Management, LLC"
  }
]
```

---

## 🔑 Étape 4 : Extraction de l'Accession Number

### Qu'est-ce qu'un Accession Number ?

L'**accession number** est l'identifiant unique d'un filing SEC.

**Format** : `0001649339-25-000007`
- `0001649339` : CIK (10 chiffres, padding avec zéros)
- `25` : Année (2025)
- `000007` : Numéro séquentiel

### Fonction d'Extraction

**Fichier** : `workers/collector-sec-watcher/src/index.ts`

```typescript
function extractAccessionNumber(url: string): string | null {
  // Format d'URL EDGAR :
  // https://www.sec.gov/cgi-bin/viewer?action=view&cik=1649339&accession_number=0001649339-25-000007
  
  // Extraire l'accession number depuis le paramètre URL
  const match = url.match(/accession_number=([^&]+)/);
  return match ? match[1] : null;
}
```

### Exemple

**Input** :
```
https://www.sec.gov/cgi-bin/viewer?action=view&cik=1649339&accession_number=0001649339-25-000007
```

**Output** :
```
0001649339-25-000007
```

---

## 💾 Étape 5 : Vérification et Insertion dans Supabase

### Vérification des Doublons

Avant d'insérer, on vérifie si le filing existe déjà :

```typescript
// Vérifier si ce filing existe déjà
const { data: existing, error: checkError } = await supabase
  .from("fund_filings")
  .select("id")
  .eq("accession_number", accessionNumber)
  .single();

if (checkError && checkError.code !== "PGRST116") { 
  // PGRST116 = not found (OK, c'est nouveau)
  throw checkError;
}

if (existing) {
  // Déjà vu, skip
  continue;
}
```

**Pourquoi** : Éviter les doublons si le SEC Watcher tourne plusieurs fois.

### Insertion dans la Base

Si le filing est nouveau, on l'insère :

```typescript
// Insérer dans fund_filings
const { data: filing, error: insertError } = await supabase
  .from("fund_filings")
  .insert({
    fund_id: fund.id,                    // ID du fund (Scion)
    accession_number: accessionNumber,    // "0001649339-25-000007"
    form_type: "13F-HR",                 // Type de formulaire
    filing_date: extractDate(entry.updated), // "2025-11-03"
    status: "DISCOVERED",                 // Statut initial
  })
  .select()
  .single();

if (insertError) throw insertError;
```

### Fonction d'Extraction de Date

```typescript
function extractDate(dateStr: string): string {
  // Convertir ISO 8601 en DATE SQL
  // Input: "2025-11-03T00:00:00Z"
  // Output: "2025-11-03"
  return new Date(dateStr).toISOString().split("T")[0];
}
```

---

## 📡 Étape 6 : Publication d'Événement EventBridge

### Pourquoi EventBridge ?

Pour déclencher automatiquement le parser 13F qui va :
1. Télécharger le fichier XML depuis EDGAR
2. Parser les holdings (tickers, shares, values)
3. Insérer dans `fund_holdings`

### Code de Publication

```typescript
// Publier événement EventBridge pour déclencher le parser
await eventBridge.send(new PutEventsCommand({
  Entries: [{
    Source: "adel.signals",
    DetailType: "13F Discovered",
    Detail: JSON.stringify({
      fund_id: fund.id,                    // ID du fund
      cik: fund.cik,                       // "0001649339"
      accession_number: accessionNumber,    // "0001649339-25-000007"
      filing_url: entry.link,              // URL complète
      filing_id: filing.id,                // ID dans fund_filings
    }),
    EventBusName: EVENT_BUS_NAME,          // "adel-ai-dev-signals"
  }],
}));
```

### Structure de l'Événement

```json
{
  "Source": "adel.signals",
  "DetailType": "13F Discovered",
  "Detail": {
    "fund_id": 1,
    "cik": "0001649339",
    "accession_number": "0001649339-25-000007",
    "filing_url": "https://www.sec.gov/...",
    "filing_id": 5
  }
}
```

---

## 🔄 Cycle Automatique

### Déclenchement

Le SEC Watcher est déclenché automatiquement par EventBridge :

**Terraform** : `infra/terraform/collectors.tf`

```hcl
resource "aws_cloudwatch_event_rule" "collector_sec_watcher_cron" {
  name                = "adel-ai-dev-collector-sec-watcher-cron"
  description         = "Déclenche le collector SEC watcher toutes les 5 minutes"
  schedule_expression = "rate(5 minutes)"
}
```

### Processus Complet

```
1. EventBridge Cron (toutes les 5 min)
   ↓
2. SEC Watcher Lambda déclenché
   ↓
3. Récupère tous les funds depuis Supabase
   ↓
4. Pour chaque fund :
   a. Construit URL Atom EDGAR
   b. Fait requête HTTP
   c. Parse XML Atom
   d. Extrait accession numbers
   e. Vérifie doublons dans Supabase
   f. Insère nouveaux filings
   g. Publie événements EventBridge
   ↓
5. Parser 13F (déclenché par EventBridge)
   ↓
6. Télécharge et parse les holdings
   ↓
7. Insère dans fund_holdings
```

---

## ⚠️ Points Techniques Importants

### 1. User-Agent Obligatoire

EDGAR bloque les requêtes sans User-Agent valide :

```typescript
headers: {
  "User-Agent": "ADEL AI (contact@adel.ai)",
}
```

**Format recommandé par la SEC** : `[Nom] ([Email])`

**Sans User-Agent** :
```
Error 403: Your Request Originates from an Undeclared Automated Tool
```

### 2. Rate Limiting

EDGAR limite à **10 requêtes par seconde**.

**Notre stratégie** :
- Poll toutes les 5 minutes (pas en continu)
- Une requête par fund
- Respecte la limite automatiquement

### 3. Format Atom vs RSS

**Pourquoi Atom ?**
- ✅ Format plus structuré (XML standardisé)
- ✅ Dates en ISO 8601 (standardisé)
- ✅ Meilleure gestion des métadonnées
- ✅ Supporté nativement par EDGAR

**RSS (ancien)** :
```xml
<item>
  <pubDate>Mon, 03 Nov 2025 00:00:00 GMT</pubDate>
</item>
```

**Atom (moderne)** :
```xml
<entry>
  <updated>2025-11-03T00:00:00Z</updated>
</entry>
```

### 4. Gestion des Erreurs

```typescript
try {
  await checkFundForNewFilings(fund);
} catch (error: any) {
  console.error(`Error checking fund ${fund.name} (CIK: ${fund.cik}):`, error);
  // Continue avec les autres funds (ne bloque pas tout)
}
```

**Stratégie** : Si un fund échoue, on continue avec les autres.

### 5. Vérification des Doublons

**Pourquoi** :
- Le SEC Watcher tourne toutes les 5 minutes
- Un filing peut être détecté plusieurs fois
- On évite les insertions multiples

**Comment** :
- Vérification par `accession_number` (unique)
- Si existe → skip
- Si nouveau → insert

---

## 📊 Exemple Complet : Scion Asset Management

### 1. Fund dans Supabase

```sql
SELECT * FROM funds WHERE cik = '0001649339';
```

**Résultat** :
```
id: 1
name: "Scion Asset Management, LLC"
cik: "0001649339"
tier_influence: 5
```

### 2. Requête EDGAR

```
GET https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001649339&type=13F-HR&output=atom
```

### 3. Réponse Atom

```xml
<feed>
  <entry>
    <link href="...&accession_number=0001649339-25-000007"/>
    <updated>2025-11-03T00:00:00Z</updated>
  </entry>
</feed>
```

### 4. Parsing

```typescript
{
  link: "...&accession_number=0001649339-25-000007",
  updated: "2025-11-03T00:00:00Z"
}
```

### 5. Extraction Accession

```
0001649339-25-000007
```

### 6. Vérification Supabase

```sql
SELECT * FROM fund_filings WHERE accession_number = '0001649339-25-000007';
```

**Résultat** : Aucun (nouveau filing)

### 7. Insertion

```sql
INSERT INTO fund_filings (fund_id, accession_number, form_type, filing_date, status)
VALUES (1, '0001649339-25-000007', '13F-HR', '2025-11-03', 'DISCOVERED');
```

### 8. Événement EventBridge

```json
{
  "Source": "adel.signals",
  "DetailType": "13F Discovered",
  "Detail": {
    "fund_id": 1,
    "accession_number": "0001649339-25-000007",
    "filing_url": "..."
  }
}
```

### 9. Parser 13F Déclenché

Le parser 13F :
1. Reçoit l'événement
2. Télécharge le fichier XML depuis EDGAR
3. Parse les holdings
4. Insère dans `fund_holdings`

---

## 🔍 Debugging

### Vérifier les Logs

```bash
aws logs tail /aws/lambda/adel-ai-dev-collector-sec-watcher --follow
```

### Logs Attendus

```
SEC Watcher triggered
Checking 1 funds for new 13F filings
Checking fund Scion Asset Management, LLC (CIK: 0001649339)
Found 10 entries in EDGAR feed
New 13F filing detected for Scion Asset Management, LLC: 0001649339-25-000007
Event published for filing 0001649339-25-000007
```

### Vérifier dans Supabase

```sql
-- Voir les filings détectés
SELECT 
  f.id,
  f.accession_number,
  f.filing_date,
  f.status,
  funds.name as fund_name
FROM fund_filings f
JOIN funds ON f.fund_id = funds.id
ORDER BY f.filing_date DESC;
```

---

## 📝 Résumé Technique

1. **Requête HTTP** → EDGAR API Atom avec CIK
2. **Réponse XML** → Flux Atom avec liste des filings
3. **Parsing XML** → Extraction des liens et dates (regex)
4. **Extraction Accession** → Identifiant unique depuis l'URL
5. **Vérification DB** → Éviter les doublons (Supabase)
6. **Insertion** → Enregistrer le filing dans `fund_filings`
7. **Événement EventBridge** → Déclencher le parser automatiquement

**Résultat** : Tous les filings disponibles sont détectés et enregistrés automatiquement.

