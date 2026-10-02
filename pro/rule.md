# NABZ AI — Project Rules

Rules for anyone (human or AI assistant) writing code or content for NABZ AI. Follow them on every change.

## 1. Product & Safety Rules (non-negotiable)

1. **Never diagnose.** NABZ shows *signals for investigation*. Never write "X has dengue" or "outbreak confirmed". Allowed: "Possible gastrointestinal pattern".
2. **Every alert ends in human review.** No automatic escalation.
3. **No patient identity is stored** — no name, phone, address, ID, exact age, photo of prescription. Store only `ward, date, category, drug classes, clinic`.
4. **Redact before save.** PII removal happens before any DB write; raw OCR text and image are discarded after analysis.
5. **Suppress small counts** (< 3) on any admin-visible view.
6. **Location precision = ward level only.**
7. **Demo uses synthetic data.** Keep the "● SYNTHETIC DEMO DATA" badge visible until real data is used.
8. Keep the footer message on Dashboard/Alert pages: *"NABZ supports investigation. It does not diagnose individuals or declare an outbreak."*

## 2. Secrets & API Keys

1. API keys live only in `.env` (`VITE_GOOGLE_MAPS_API_KEY`, backend: `OCR_KEY`, `JWT_SECRET`, `DATABASE_URL`).
2. `.env` is in `.gitignore`. Commit `.env.example` with empty values.
3. Restrict the Google Maps key by **HTTP referrer** and by **API (Maps JavaScript only)**; set a daily quota cap.
4. Never paste keys in chat, code, screenshots, or README. If leaked → delete and regenerate immediately.
5. Remember: `VITE_` variables are public in the browser; that is why the referrer restriction is mandatory. Server keys (OCR, LLM) must never use the `VITE_` prefix.

## 3. Frontend Rules

1. **React function components + hooks only.** One component per file, `PascalCase.jsx`, file name = component name (`Sidebar.jsx`, not `sidebar.jsx`).
2. Folder layout: `components/` (reusable), `pages/` (routes), `services/` (API), `context/`, `utils/`.
3. Navigation with `react-router-dom` (`<Link>`, `<NavLink>`, `useNavigate`). **Never** `window.location.href`.
4. No hard-coded data in pages once the API exists; use `services/api.js`. Mock data lives in `src/mock/` and is clearly named.
5. Every data screen has **loading**, **empty**, and **error** states.
6. Use class names from the shared stylesheet; avoid inline styles except dynamic values (e.g. bar height).
7. Icons from `lucide-react`; no emoji icons in production UI.
8. Status is never colour-only: show the label (NORMAL / WATCH / AMBER) too.
9. Keep components under ~150 lines; extract when larger.
10. `build` script must be `vite build`.

## 3b. Status Colour Contract

| Status | Meaning | Colour token |
|---|---|---|
| NORMAL | Within baseline | `--green` |
| WATCH | Mild rise, monitor | `--yellow` |
| AMBER | Significant rise + multiple sources, needs review | `--amber` |

(No RED level in MVP — only humans declare outbreaks.)

## 4. Backend Rules

1. Python 3.11+, FastAPI, Pydantic models for every request/response.
2. Type hints and docstrings on public functions.
3. Business logic in `services/`, routes stay thin.
4. Medicine → category mapping is **data-driven** (table/JSON), not hard-coded in `if` chains.
5. Detection thresholds are config constants (`Z_WATCH=2`, `Z_AMBER=3`, `MIN_COUNT=3`, `MIN_SOURCES=3`).
6. Every alert stores an `explanation_json` — if you cannot explain it, do not raise it.
7. Validate uploads: type (jpg/png/pdf), size ≤ 5 MB.
8. Log actions to `audit_log`; never log PII or raw prescription text.
9. Role checks on every route (`doctor` vs `admin`).

## 5. NLP Rules

1. **Dictionary first, ML second.** Exact/fuzzy match against the medicine table; use an LLM only for ambiguous text and require JSON output.
2. Normalise brand → generic (e.g. *Dolo 650* → Paracetamol 650 mg) before classification.
3. Store a `confidence` per medicine; below 0.7 → send to doctor confirmation.
4. Single non-specific medicines (Paracetamol alone) → low weight. Use **combinations** (e.g. ORS + antiemetic + antibiotic ⇒ GI).
5. Chronic medicines (diabetes, BP, thyroid) are **excluded** from outbreak signals.
6. Unknown medicines go to an "unrecognised" queue, not silently dropped.
7. Maintain a test set of ≥ 20 synthetic prescriptions with expected output.

## 6. Git & Workflow Rules

1. Branches: `main` (stable), `feat/<name>`, `fix/<name>`.
2. Commit format: `feat: add prescription upload`, `fix: sidebar import case`.
3. Small commits; one purpose each. Never commit `node_modules`, `.env`, build output.
4. Run `npm run build` before merging to `main`.
5. Update `memory.md` at the end of every working session.

## 7. Writing / UX Copy Rules

- Tone: calm, clear, non-alarmist. Use "signal", "pattern", "review" — avoid "outbreak", "epidemic", "infected".
- Section labels in small caps style (e.g. `05 / HUMAN REVIEW`) as in existing pages.
- Keep sentences short; a district health officer should understand each alert in 10 seconds.

## 8. Definition of Done

- [ ] Works on desktop and mobile width
- [ ] Loading / empty / error states handled
- [ ] No PII, no secrets in code
- [ ] Builds without warnings
- [ ] Matches Design.md
- [ ] `memory.md` updated
