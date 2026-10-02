# NABZ AI — Architecture

## 1. Overview

```
 Doctor (React)                         Admin (React)
      │ upload                               │ view map/alerts
      ▼                                      ▼
┌──────────────────────────── Frontend (Vite + React 18) ───────────────────────────┐
│ Pages: Dashboard · Capture · PrivacyReview · SignalDetection · HealthMap · Alert  │
│ Google Maps JS API (key via VITE_GOOGLE_MAPS_API_KEY)                              │
└───────────────────────────────────────┬────────────────────────────────────────────┘
                                        │ HTTPS / JWT
                                        ▼
┌──────────────────────────── Backend API (FastAPI, Python) ────────────────────────┐
│ /auth  /prescriptions  /signals  /wards  /alerts                                  │
│                                                                                   │
│  1. OCR            → Google Cloud Vision / Tesseract                              │
│  2. PII Redaction  → regex + NER (names, phones, addresses)                       │
│  3. Medicine NLP   → extract → normalise → generic → drug class                   │
│  4. Disease Mapper → rules (dictionary) → syndrome / category                     │
│  5. Signal Writer  → anonymous signal row                                         │
│  6. Detection Job  → baseline vs today → WATCH / AMBER                            │
└───────────────────────────────────────┬────────────────────────────────────────────┘
                                        ▼
                       PostgreSQL (+ PostGIS optional) / Firestore
```

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18, Vite 6, react-router-dom 7, lucide-react | Already in `package.json` |
| Map | **Google Maps JavaScript API** via `@vis.gl/react-google-maps` | Real map, markers, circles, heatmap layer. *Alternative: Mapbox GL / Leaflet + OSM (no card needed)* |
| Backend | **FastAPI (Python)** | Fits Python/ML skills; async; auto API docs |
| OCR | Google Cloud Vision (or `pytesseract` for free) | Prescription text extraction |
| NLP | spaCy + custom medicine dictionary + RapidFuzz fuzzy match; optional LLM (Claude API) for messy text → structured JSON | Dictionary first = explainable |
| DB | PostgreSQL (Supabase) *or* Firestore | Aggregations by ward/date |
| Auth | JWT, roles: `doctor`, `admin` | |
| Hosting | Vercel (frontend), Render/Railway (backend) | Free tiers |

## 3. Data Flow (Prescription → Alert)

1. **Upload** `POST /prescriptions` (multipart image + `clinic_id`, `ward_id` from doctor profile).
2. **OCR** → raw text (kept in memory only, never stored).
3. **Redaction** → remove name/phone/address/exact age. Return preview to **PrivacyReview** page; doctor confirms.
4. **Medicine extraction** → list of `{raw, generic, dose, confidence}`.
5. **Classification** → `drug_class` and `category`.
6. **Signal** stored: `ward_id, date, category, drug_classes[], clinic_id`. Raw text + image discarded.
7. **Detection** (scheduled every 15 min or on insert): compute counts per ward × category.
8. **Alert** row created/updated → frontend polls `/alerts` and paints the map.

## 4. Data Model

```sql
users(id, email, password_hash, role, clinic_id)
clinics(id, name, ward_id, lat, lng)
wards(id, name, city, polygon_geojson, centroid_lat, centroid_lng)

medicines(id, brand_name, generic_name, drug_class, category_hint)
category_rules(id, category, required_classes[], optional_classes[], min_match)

signals(                          -- NO patient identity
  id, ward_id, clinic_id, source_type,   -- clinic | pharmacy | lab
  category, drug_classes[], created_at
)

baselines(ward_id, category, mean, std, window_days, updated_at)

alerts(
  id, ward_id, category, level,   -- NORMAL | WATCH | AMBER
  count_today, baseline_mean, z_score, source_count,
  status,                         -- open | reviewed | escalated | dismissed
  explanation_json, created_at, reviewed_by
)
audit_log(id, user_id, action, entity, created_at)
```

## 5. Detection Logic (explainable)

```
for each (ward, category):
    z = (count_today − baseline_mean) / max(baseline_std, 1)
    sources = distinct clinics/pharmacies/labs in last 48h

    if count < 3                      → suppress (privacy)
    elif z ≥ 3 and sources ≥ 3        → AMBER
    elif z ≥ 2                        → WATCH
    else                              → NORMAL
```
Also require the pattern to persist ≥ 2 consecutive days for AMBER ("Pattern persists" card on SignalDetection page). Baseline = rolling 28-day mean for same weekday/ward.

`explanation_json` example:
```json
{
  "why": "GI-class medicines in Aliganj are 3.4σ above the 28-day baseline",
  "evidence": {"clinics": 3, "pharmacies": 2, "labs": 1},
  "top_drug_classes": ["ORS", "Antiemetic", "Fluoroquinolone"],
  "disclaimer": "Supports investigation. Not a diagnosis."
}
```

## 6. API Contract (MVP)

| Method | Endpoint | Role | Purpose |
|---|---|---|---|
| POST | `/auth/login` | all | JWT |
| POST | `/prescriptions/analyze` | doctor | OCR + redact + NLP, returns preview |
| POST | `/prescriptions/confirm` | doctor | Saves anonymous signal |
| GET | `/dashboard/summary` | admin | Stat cards + weekly series |
| GET | `/wards/signals?category=&days=` | admin | Ward status for map |
| GET | `/alerts` / `/alerts/{id}` | admin | List / explanation |
| PATCH | `/alerts/{id}` | admin | Review action |

## 7. Frontend Structure (target)

```
src/
  main.jsx            (missing — add BrowserRouter)
  App.jsx             (missing — routes)
  index.css           (missing — styles for the class names used)
  components/
    Sidebar.jsx       (rename from sidebar.jsx)
    NabzMap.jsx       (Google Map wrapper)
    StatCard.jsx, AlertCard.jsx, SignalChart.jsx
  pages/
    Dashboard.jsx, Capture.jsx, PrivacyReview.jsx,
    SignalDetection.jsx, HealthMap.jsx, AlertDetails.jsx, Login.jsx
  services/api.js     (fetch wrapper)
  context/AuthContext.jsx
.env                  (VITE_GOOGLE_MAPS_API_KEY, VITE_API_URL) — gitignored
```

Routes: `/` · `/login` · `/capture` · `/privacy` · `/signals` · `/map` · `/alerts/:id`

## 8. Map Integration

- Key stored as `VITE_GOOGLE_MAPS_API_KEY` in `.env` (**never committed**; add `.env` to `.gitignore`).
- Google Cloud Console → enable **Maps JavaScript API** → create key → restrict to **HTTP referrers** (`localhost:5173/*`, your deployed domain) and to that single API.
- Render: centre on Lucknow (26.8467, 80.9462), one marker/circle per ward, colour by level, `InfoWindow` with "Review explanation →".
- AMBER wards pulse; clicking opens `/alerts/:id`.

## 9. Security & Privacy

- PII redaction **before** persistence; raw image/text deleted after analysis.
- Ward-level location only; suppress counts < 3.
- Role-based access: doctors cannot read signals/alerts; admins cannot see uploads.
- Rate-limit upload endpoint; validate file type/size (≤ 5 MB, jpg/png/pdf).
- Secrets only in env vars; CORS allow-list.

## 10. Known Issues in Current Codebase

| # | Issue | Fix |
|---|---|---|
| 1 | `package.json` `"build": "vite"` | → `"vite build"` |
| 2 | Pages import `../components/Sidebar` but file is `sidebar.jsx` (breaks on Linux/Vercel) | Rename to `Sidebar.jsx` |
| 3 | Config uploaded as `vite_config.js` | Must be `vite.config.js` |
| 4 | `main.jsx`, `App.jsx`, CSS not provided | Create (see phase.md) |
| 5 | `window.location.href` navigation reloads the app | Use `useNavigate()` / `<Link>` |
| 6 | `Capture.jsx` / `PrivacyReview.jsx` are stubs, no Sidebar | Build per Design.md |
| 7 | Map is a CSS fake; dashboard values hard-coded | Replace with API data |
| 8 | `lucide-react` installed but unused (emoji used) | Use icons consistently |
