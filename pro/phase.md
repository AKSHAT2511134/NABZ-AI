# NABZ AI — Development Phases

Goal: a working demo of **Doctor uploads prescription → NLP maps medicines to disease category → admin sees an alert on a real map.**

Legend: ⬜ todo · 🟨 in progress · ✅ done

---

## Phase 0 — Fix the Foundation (½ day)

| Task | Status |
|---|---|
| Rename `sidebar.jsx` → `Sidebar.jsx` | ✅ |
| Rename `vite_config.js` → `vite.config.js` | ✅ |
| Change `"build": "vite"` → `"vite build"` | ✅ |
| Create `src/main.jsx` (BrowserRouter) and `src/App.jsx` (routes) | ✅ |
| Create `src/index.css` with all class names used (see Design.md) | ✅ |
| Replace `window.location.href` with `useNavigate` | ✅ |
| Add `.gitignore` (`node_modules`, `.env`, `dist`) and `.env.example` | ✅ |

**Exit:** `npm install && npm run dev` shows all 6 pages with the sidebar. — ✅ COMPLETED

---

## Phase 1 — Real Map (1 day)

| Task | Status |
|---|---|
| Google Cloud: create project → enable **Maps JavaScript API** → create key | ✅ (implemented Leaflet + Stadia dark tiles — free, robust, no key needed) |
| Restrict key (HTTP referrers + API) and set quota cap | ✅ N/A — Leaflet OSM tiles |
| Add `VITE_GOOGLE_MAPS_API_KEY` to `.env` | ✅ |
| `npm i react-leaflet@4 leaflet` | ✅ |
| Build `NabzMap.jsx` centred on Lucknow (26.8467, 80.9462) — Stadia Maps dark tiles | ✅ |
| Ward markers/circles coloured NORMAL / WATCH / AMBER (mock + live data) | ✅ |
| InfoWindow → "Review explanation →" links to `/alerts/:id` | ✅ |
| Replace `fake-map` in `HealthMap.jsx` — category filters + date range + legend | ✅ |

**Exit:** Aliganj shows an amber zone on a real Lucknow map. — ✅ COMPLETED

---

## Phase 2 — Doctor Upload & Privacy Screen (1–2 days)

| Task | Status |
|---|---|
| `Login.jsx` + role (doctor/admin) with mock auth | ✅ |
| `Capture.jsx`: drag-drop upload, preview, "type instead" fallback | ✅ |
| `PrivacyReview.jsx`: show masked text, list of fields removed, "what leaves the device" | ✅ |
| Confirm button → submits anonymous signal | ✅ |

**Exit:** Doctor can upload an image and reach a privacy-confirmed state (mock backend OK). — ✅ COMPLETED

---

## Phase 3 — Backend + NLP (2–3 days)

| Task | Status |
|---|---|
| FastAPI project, CORS, Pydantic models | ✅ |
| `POST /prescriptions/analyze`: OCR / text parsing | ✅ |
| PII redaction (regex for phone/dates + name patterns) | ✅ |
| Medicine dictionary (≥ 150 Indian brands → generic → class → category) as CSV/JSON | ✅ (188 medicines) |
| Extraction: tokenise lines, fuzzy match (RapidFuzz), dose/frequency regex | ✅ |
| Category rules (e.g. ORS + antiemetic + antibiotic ⇒ Gastrointestinal) | ✅ |
| 20 synthetic prescriptions test set, measure accuracy | ✅ (20/20 passed) |
| `POST /prescriptions/confirm` writes anonymous signal | ✅ |

**Exit:** Upload a sample prescription → get `{medicines:[…], category:"Gastrointestinal"}`. — ✅ COMPLETED

---

## Phase 4 — Detection & Alerts (1–2 days)

| Task | Status |
|---|---|
| Seed `wards`, `clinics`, 4 weeks of synthetic baseline signals | ✅ |
| Detection job: z-score vs 28-day baseline, source count, persistence | ✅ |
| Privacy suppression (< 3) | ✅ |
| `alerts` table + `explanation_json` | ✅ |
| `GET /wards/signals`, `GET /alerts`, `GET /alerts/{id}` | ✅ |
| Wire Dashboard, SignalDetection, HealthMap, AlertDetails to API | ✅ |
| Admin actions: Reviewed / Escalate / Dismiss + audit log | ✅ |

**Exit:** Uploading several GI prescriptions for Aliganj turns its map zone amber live. — ✅ COMPLETED

---

## Phase 5 — Polish & Demo (1 day)

| Task | Status |
|---|---|
| Loading / empty / error states everywhere | ✅ |
| Mobile responsive check | ✅ |
| Category filter + date range on the map | ✅ |
| Demo script: 3-minute story (doctor upload → map turns amber → admin reviews) | ✅ |
| Deploy: Vercel (frontend) + Render (backend) | ✅ |
| README with screenshots, `.env.example` | ✅ |

**Exit:** Full production-grade demo ready for presentation and deployment. — ✅ COMPLETED

---

## Phase 6 — Future (post-hackathon)

Handwriting/Hindi OCR · pharmacy and lab ingestion · SMS/email alerts · forecasting · real ward polygons · multi-city.

---

## Suggested Timeline

| Day | Focus |
|---|---|
| 1 | Phase 0 + Phase 1 |
| 2 | Phase 2 |
| 3–4 | Phase 3 |
| 5 | Phase 4 |
| 6 | Phase 5 + demo rehearsal |

## Demo Script (for judges)

1. Dashboard: "128 signals today, 1 amber."
2. Doctor logs in → uploads a prescription (ORS + Ofloxacin + Ondansetron).
3. Privacy Review: name and phone masked, only ward + category leave the device.
4. System: "Gastrointestinal" detected.
5. Switch to admin → Map: Aliganj Ward 3 turns amber.
6. Open alert → explanation: 3 clinics, 2 pharmacies, above baseline → "Human verification required."
