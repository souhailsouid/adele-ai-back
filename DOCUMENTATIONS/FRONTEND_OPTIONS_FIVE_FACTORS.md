## Frontend Guide — Options “Five Factors” (EN)

### Product intent
- **Goal**: Display a **qualitative, non-directional** options market read for advanced users.
- **Non-goals**: This feature is **not** a trade signal, not a screener, not a prediction engine.
- **Frontend role**: **Render, prioritize, warn**. No business logic or interpretation on the frontend.

### Endpoint
- **Method**: `POST`
- **Path**: `/ai/options-five-factors`
- **Auth**: `Authorization: Bearer <ACCESS_TOKEN>`
- **Content-Type**: `application/json`

### Related endpoint (rendered report)
- **Method**: `POST`
- **Path**: `/ai/options-analysis`
- **Purpose**: Turns the consolidated JSON (typically the full `/ai/options-five-factors` response) into a **French A→I report** with explicit metric citations and contradiction handling.

### Request body
```json
{
  "ticker": "NVDA",
  "refresh": true
}
```

- **ticker**: required, string (case-insensitive; backend normalizes to uppercase)
- **refresh**: optional boolean (default `true`)
  - `true`: backend will best-effort refresh required ingestion modules (bounded timeout)
  - `false`: uses existing data only (may be stale / incomplete, but faster)

### Response shape (success)
```json
{
  "success": true,
  "ticker": "NVDA",
  "data": { "... five factors dataset (raw) ..." },
  "analysis": { "... qualitative analysis object ..." },
  "timestamp": "2025-12-17T11:49:59.875Z"
}
```

- **data**: raw, structured inputs used by the model (recent flows, OI change, OI by strike, IV rank, max pain, greeks, price context, catalysts, dark pool, etc.)
- **analysis**: the UI-facing qualitative output (see below)

### Response shape (failure / missing data)
```json
{
  "success": false,
  "ticker": "NVDA",
  "message": "Aucune donnée d'options disponible ...",
  "hint": "Essayez d'abord: POST /ingest/all?...",
  "modules": [
    { "module": "options_flow", "state": { "... status ..." } }
  ]
}
```

Frontend guidance:
- If `success=false`, show a **non-blocking empty state** with `message` + `hint`.
- Optionally show module states in a “debug” accordion for power users.

### `analysis` contract (UI-facing)
`analysis` is an `OptionsFiveFactorsResponse`-like object:

- **observation** *(string)*: factual summary (3–6 lines)
- **interpretation** *(string)*: professional interpretation (no trade recommendations)
- **signal_quality** *(enum)*: `high | medium | low`
  - **Meaning**: exploitability/clarity of the options signal (not a direction)
  - **Note**: `high` is intentionally rare (mechanically gated)
- **dominant_intent** *(enum)*: `hedging | speculation | gamma_management | mixed`
  - **Important**: when `mixed`, the wording avoids “primarily/mostly/mainly” to reduce bias.
- **evidence** *(string[3])*: always **exactly 3 items**, in order:
  - `flow: ...` (1 flow metric)
  - `structure: ...` (1 OI/gamma structure)
  - `context: ...` (1 context item: max pain / vol / trend)
- **data_quality**:
  - `missing: string[]`
  - `staleness: { as_of: string, days_old: number }`
- **risks** *(string[])*: user-facing cautions
- **zones_to_watch** *(array)*: each item has `{ label, zone, reason }`
- **why_this_is_not_a_clear_signal** *(string[])*: “anti-overconfidence” list
- **timestamp** *(string)*: analysis time
- **cached** *(boolean, optional)*: whether analysis came from cache

### Recommended UI hierarchy
- **Header**
  - Ticker
  - Badge `signal_quality`:
    - `high` → green (“Clear”)
    - `medium` → orange (“Caution / Mixed”)
    - `low` → neutral/grey (“Not exploitable”)
  - Badge `dominant_intent` (Hedging / Speculation / Gamma / Mixed)

- **Section 1 — Summary**
  - `observation` (primary, 1–3 lines)
  - `interpretation` (secondary)

- **Section 2 — Warnings (critical)**
  - Render `why_this_is_not_a_clear_signal` and `risks` prominently if non-empty.
  - Style as caution/warning (avoid aggressive “error” styling).

- **Section 3 — Zones**
  - List `zones_to_watch` (label + zone + reason)
  - If empty: show “No clear option-driven zones identified”

- **Section 4 — Evidence (collapsible)**
  - Render the 3 evidence lines as a compact audit trail for power users.

- **Footer — Data freshness**
  - Show `data_quality.staleness.as_of` and `days_old`
  - Discreet “cached” badge if `analysis.cached === true`
  - If `data_quality.missing.length > 0`: show “Partial data”

### UX guardrails (must-follow)
- **Do not show**: buy/sell language, “bullish/bearish probability”, targets, trade recommendations.
- **Do show**: signal_quality, dominant_intent, warnings, and data freshness.

### Example `curl` (token redacted)
```bash
curl -X POST \
  '<BASE_URL>/ai/options-five-factors' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"ticker":"NVDA","refresh":true}'
```

---

## Guide Frontend — Options “Five Factors” (FR)

### Intention produit
- **But** : afficher une lecture **qualitative et non directionnelle** du marché options.
- **Ce que ce n’est pas** : pas un signal de trade, pas une prédiction, pas un conseil financier.
- **Rôle du frontend** : **rendre lisible, hiérarchiser, mettre en garde**. Pas de logique métier côté front.

### Endpoint
- **Méthode** : `POST`
- **Chemin** : `/ai/options-five-factors`
- **Auth** : `Authorization: Bearer <ACCESS_TOKEN>`
- **Content-Type** : `application/json`

### Endpoint lié (rapport lisible)
- **Méthode** : `POST`
- **Chemin** : `/ai/options-analysis`
- **But** : transforme le JSON consolidé (typiquement la réponse complète de `/ai/options-five-factors`) en **rapport FR A→I** avec traçabilité des métriques et gestion des contradictions.

### Body (request)
```json
{
  "ticker": "NVDA",
  "refresh": true
}
```

- **ticker** *(obligatoire)* : string (insensible à la casse; normalisé en uppercase)
- **refresh** *(optionnel, défaut `true`)* :
  - `true` : tentative de refresh best-effort des modules d’ingestion requis (timeout borné)
  - `false` : utilise uniquement les données déjà présentes (peut être incomplet/ancien, mais plus rapide)

### Retour (succès)
```json
{
  "success": true,
  "ticker": "NVDA",
  "data": { "... dataset 5 facteurs (brut) ..." },
  "analysis": { "... analyse qualitative ..." },
  "timestamp": "2025-12-17T11:49:59.875Z"
}
```

- **data** : inputs bruts structurés (flows, OI change, OI par strike, IV rank, max pain, greeks, price context, catalysts, dark pool…)
- **analysis** : sortie qualitative “UI-ready” (voir ci-dessous)

### Retour (échec / pas de données)
```json
{
  "success": false,
  "ticker": "NVDA",
  "message": "Aucune donnée d'options disponible ...",
  "hint": "Essayez d'abord: POST /ingest/all?...",
  "modules": [
    { "module": "options_flow", "state": { "... status ..." } }
  ]
}
```

Recommandation frontend :
- Si `success=false`, afficher un **empty state non bloquant** avec `message` + `hint`.
- Optionnel : afficher l’état des modules (accordion “debug”) pour les power users.

### Contrat `analysis` (UI-facing)
- **observation** *(string)* : constat factuel (3–6 lignes)
- **interpretation** *(string)* : interprétation pro (sans recommandation de trade)
- **signal_quality** *(enum)* : `high | medium | low`
  - **Sens** : exploitabilité/qualité (pas une direction)
  - **Note** : `high` est volontairement rare (règles mécaniques)
- **dominant_intent** *(enum)* : `hedging | speculation | gamma_management | mixed`
  - **Important** : si `mixed`, éviter toute formulation biaisée type “principalement”.
- **evidence** *(string[3])* : **toujours exactement 3 items**, dans cet ordre :
  - `flow: ...` (1 métrique flow)
  - `structure: ...` (1 structure OI/gamma)
  - `context: ...` (1 contexte: max pain / vol / trend)
- **data_quality** :
  - `missing: string[]`
  - `staleness: { as_of: string, days_old: number }`
- **risks** *(string[])* : points de vigilance
- **zones_to_watch** *(array)* : `{ label, zone, reason }`
- **why_this_is_not_a_clear_signal** *(string[])* : liste “anti-surconfiance”
- **timestamp** *(string)* : date/heure analyse
- **cached** *(boolean, optionnel)* : analyse servie depuis cache

### Hiérarchie d’affichage recommandée
- **Header**
  - Ticker
  - Badge `signal_quality` :
    - `high` → vert (“Clair”)
    - `medium` → orange (“Prudence / Mixte”)
    - `low` → neutre/gris (“Non exploitable”)
  - Badge `dominant_intent` (Hedging / Speculation / Gamma / Mixed)

- **Section 1 — Résumé**
  - `observation` (texte principal, 1–3 lignes)
  - `interpretation` (texte secondaire)

- **Section 2 — Warnings (critique)**
  - Afficher `why_this_is_not_a_clear_signal` et `risks` si non vides.
  - Style warning/caution (éviter “error” agressif).

- **Section 3 — Zones**
  - Liste `zones_to_watch` (label + zone + reason)
  - Si vide : “Aucune zone options claire identifiée”

- **Section 4 — Evidence (repliable)**
  - Liste courte des 3 items pour transparence (power users).

- **Footer — Fraîcheur des données**
  - `data_quality.staleness.as_of` + `days_old`
  - Badge discret si `analysis.cached === true`
  - Si `data_quality.missing.length > 0` : “Données partielles”

### Garde-fous UX (obligatoires)
- **Ne pas afficher** : buy/sell, probabilités directionnelles, targets, recommandations de trade.
- **Toujours afficher** : `signal_quality`, `dominant_intent`, warnings, fraîcheur des données.

### Exemple `curl` (token masqué)
```bash
curl -X POST \
  '<BASE_URL>/ai/options-five-factors' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"ticker":"NVDA","refresh":true}'
```


