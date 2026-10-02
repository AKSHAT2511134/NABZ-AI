# NABZ AI — Product Requirements Document (PRD)

**Product:** NABZ AI — Health Signal Radar
**Version:** 1.0 (Hackathon MVP)
**Demo city:** Lucknow, Uttar Pradesh (demo ward: Aliganj Ward 3)

---

## 1. Problem

Disease outbreaks (gastro, dengue, flu-like illness) are usually noticed only after hospitals fill up. Prescriptions, however, are written every day and quietly reveal what people in an area are being treated for. Today this data is paper-based, scattered, and never aggregated.

## 2. Vision

> "See the signal before it gets a name."

NABZ turns routine, **anonymous** prescription data into **local early-warning signals** that authorised health officials can review on a map. NABZ supports investigation. It never diagnoses a person and never declares an outbreak.

## 3. Users

| Role | Who | Goal |
|---|---|---|
| **Doctor** | Clinic / hospital doctor | Upload a prescription in under 30 seconds |
| **Admin (Health Officer)** | City/ward health official | See rising disease signals per area and review alerts |
| **System** | NLP + detection engine | Extract, classify, aggregate, alert |

(Patients do not log in. Patient identity is never stored.)

## 4. Core User Flow (the feature to build now)

1. Patient visits doctor → doctor writes a prescription.
2. Doctor logs in and **uploads** the prescription (photo/PDF) or types it.
3. **Privacy step (on-device/pre-upload):** patient name, phone, age-exact, address are detected and masked. Doctor reviews what leaves the device.
4. **NLP pipeline** reads the prescription → extracts medicines → normalises to generic name → maps each medicine to a **drug class** and a **likely disease category (syndrome)**.
   - Example: Paracetamol + Cetirizine → *Fever / Headache / Cold* → category **Febrile / Respiratory**.
   - Example: ORS + Ofloxacin + Ondansetron → category **Gastrointestinal**.
5. Only an **anonymous signal** is saved: `{ward, date, syndrome, drug_classes, clinic_id}`.
6. Detection engine compares today's count with the ward's baseline.
7. If it is unusually high → **WATCH / AMBER** alert appears as a **pin/heat zone on the real map**.
8. Admin opens the alert → sees the **explanation** (why, how many sources, trend) → marks *Reviewed / Escalate / Dismiss*.

## 5. Functional Requirements

### P0 — Must have (MVP demo)
| ID | Requirement |
|---|---|
| F1 | Doctor login (role-based) |
| F2 | Prescription upload (image/PDF) + manual text fallback |
| F3 | OCR + NLP medicine extraction |
| F4 | Medicine → generic → drug class → disease category mapping (dictionary-first) |
| F5 | PII redaction + Privacy Review screen before submit |
| F6 | Anonymous signal storage with ward-level location |
| F7 | Baseline vs current detection per ward × syndrome |
| F8 | **Real map** (Google Maps JS API) showing ward markers/zones coloured NORMAL / WATCH / AMBER |
| F9 | Alert details page with explanation + evidence (sources, trend) |
| F10 | Admin dashboard: stats, signal chart, active alerts |

### P1 — Should have
- Filter map by disease category and date range
- Admin review actions (Reviewed / Escalate / Dismiss) + audit log
- Medicine confidence score and "unrecognised medicine" queue
- Pharmacy bill and lab report as extra sources (Capture page already mentions them)

### P2 — Later
- Hindi / handwritten prescription support
- SMS/email alerts to officers
- Forecasting, multi-city

## 6. Disease Category Mapping (seed)

| Category | Typical medicines (generic) | Example symptoms |
|---|---|---|
| Febrile / Viral | Paracetamol, Ibuprofen | Fever, headache, body ache |
| Respiratory | Cetirizine, Levocetirizine, Montelukast, Azithromycin, Cough syrups | Cold, cough |
| Gastrointestinal | ORS, Ondansetron, Ofloxacin, Metronidazole, Racecadotril, Zinc | Diarrhoea, vomiting |
| Vector-borne (suspect) | Paracetamol + platelet monitoring notes, Doxycycline | Dengue/malaria-like fever |
| Skin | Antifungals, Antihistamine creams | Rashes |
| Other / Chronic | Metformin, Amlodipine etc. | **Ignored for signals** |

> A single medicine is **not** a diagnosis (Paracetamol is non-specific). Signals use **combinations** and **counts over baseline**, and always end in human review.

## 7. Non-Functional Requirements

- **Privacy first:** zero patient identity stored; location only at ward level; suppress counts < 3 (k-anonymity).
- **Explainable:** every alert shows *why* it fired.
- **Performance:** upload → signal in < 10 s (demo); map loads < 3 s.
- **Security:** API keys in env vars only, restricted by HTTP referrer; JWT auth; HTTPS.
- **Accessibility:** colour is never the only indicator (labels + icons).

## 8. Success Metrics (hackathon)

- Demo end-to-end: upload → alert on map in < 1 minute
- Medicine extraction accuracy ≥ 85% on 20 sample prescriptions
- 0 PII fields reaching the database
- Alert explanation understandable by a non-technical judge

## 9. Out of Scope

Individual diagnosis, treatment advice, outbreak declaration, patient-facing app, real patient data (demo uses synthetic data).

## 10. Risks

| Risk | Mitigation |
|---|---|
| OCR errors on handwriting | Manual correction + text input fallback |
| Non-specific medicines cause false alerts | Combination rules + multi-source requirement + human review |
| Privacy concern | Redaction, ward-level only, k-anonymity, synthetic demo data |
| Map key abuse | Referrer restriction, quota cap, env var, never commit |
