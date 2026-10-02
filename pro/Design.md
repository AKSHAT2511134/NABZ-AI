# NABZ AI — Design Specification

> Note: the stylesheet (`index.css`) was not uploaded, so the tokens below are a proposed system built around the class names already used in your JSX (`app`, `sidebar`, `main`, `topbar`, `hero`, `stats`, `panel`, `alert`, `workflow`, `safety`, `page-header`, `map-layout`, etc.). Adjust values to match your existing CSS if you have one.

## 1. Design Principles

1. **Calm, not alarming.** Signals, not sirens. Amber is the highest level in MVP.
2. **Explainable.** Every alert answers "why did this appear?"
3. **Privacy visible.** Show users what is protected (shield, "0 identity exposure").
4. **Fast for doctors.** Upload flow ≤ 3 clicks.
5. **Scannable for officials.** Status + location + count in one glance.

## 2. Design Tokens

```css
:root {
  /* surface */
  --bg: #0b1220;           --panel: #111a2e;      --panel-2: #16213a;
  --border: #223152;
  /* text */
  --text: #e8eefc;         --muted: #8fa0c4;
  /* brand */
  --brand: #3ddc97;        --brand-ink: #062b1d;
  /* status */
  --green: #3ddc97;        --yellow: #ffd166;     --amber: #ff9f1c;
  /* shape */
  --radius: 14px;          --radius-sm: 8px;
  --shadow: 0 8px 24px rgba(0,0,0,.35);
  /* type */
  --font: "Inter", system-ui, sans-serif;
  --mono: "JetBrains Mono", monospace;
}
```

Typography: H1 28/700 · H2 22/700 · H3 16/600 · body 14/400 · `small` labels 11/600, uppercase, letter-spacing .08em, colour `--muted` (matches "CITY HEALTH MONITORING" style).

Spacing scale: 4 · 8 · 12 · 16 · 24 · 32.

## 3. Layout

```
┌───────────┬──────────────────────────────────────────┐
│ Sidebar   │ main                                      │
│ 260px     │  topbar / page-header                     │
│ fixed     │  content (max-width 1200px, padding 32px) │
└───────────┴──────────────────────────────────────────┘
```
- Grid: `.app { display:grid; grid-template-columns:260px 1fr; min-height:100vh }`
- < 900px: sidebar collapses to top bar / drawer; grids become 1 column.

## 4. Components

| Component | Notes |
|---|---|
| **Sidebar** | Logo box "N", "NABZ**AI**", tagline *HEALTH SIGNAL RADAR*, group title MONITORING, NavLink items (active = brand tint + left bar), bottom: green dot "System Online" + "Synthetic demo environment". Add lucide icons per item. |
| **StatCard** | `small` label, large number, caption. Variants: default, `amber`, `green`. |
| **StatusBadge** | NORMAL (green) · WATCH (yellow) · AMBER (amber). Always text + dot. |
| **Panel** | Rounded container with header (`small` + h3 + right-side tag). |
| **BarChart** | 8 bars W1→W8; bars above baseline use `.hot` (amber). |
| **AlertCard** | Amber status line, title, 📍→`MapPin` icon location, evidence chips (3 clinics · 2 pharmacies · 1 lab trend), CTA. |
| **EvidenceTile** | Big number + label (Clinics / Pharmacies / Lab trend). |
| **SafetyNote** | Shield icon + bold title + disclaimer. Always on Dashboard + Alert pages. |
| **DemoBadge** | "● SYNTHETIC DEMO DATA" top-right. |

## 5. Screens

### 5.1 Login (new)
Centered card, logo, role toggle (Doctor / Admin), email, password, primary button.

### 5.2 Dashboard (existing — admin)
Topbar → hero ("See the signal before it gets a name.") → 4 stat cards → chart panel + amber alert panel → workflow strip (01 Capture … 05 Human Review) → safety note.
Change: hero button becomes "+ Capture a record" **for doctors only**; admins see "Open health map".

### 5.3 Record Capture (rebuild — doctor)
`01 / CAPTURE`
- Large dashed **drop zone**: "Upload prescription, pharmacy bill or lab report" (JPG / PNG / PDF, max 5 MB).
- Camera button on mobile.
- Secondary link: "Type medicines instead".
- Ward auto-filled from doctor profile (read-only).
- Primary: **Analyse record →**; shows progress: *Reading → Protecting → Extracting*.

### 5.4 Privacy Review (rebuild — doctor)
`02 / PROTECT`
Two columns:
- **Left:** prescription text with masked tokens (`█████` for name, phone, address).
- **Right:** "What leaves this device" checklist
  - ✅ Ward: Aliganj Ward 3
  - ✅ Date
  - ✅ Disease category: Gastrointestinal
  - ✅ Drug classes: ORS, Antiemetic, Fluoroquinolone
  - ❌ Patient name · phone · address · image (never sent)
- Below: **Detected medicines table** (Brand → Generic → Class → Category, confidence, edit button).
- Buttons: *Back* · **Confirm & send anonymous signal**.

### 5.5 Signal Detection (existing)
`03 / DETECTION` — three cards (Rise above baseline, Multiple sources, Pattern persists) + result banner (AMBER SIGNAL, score = sources). Add: category selector tabs (Gastro / Febrile / Respiratory…) and a small z-score sparkline per card.

### 5.6 Lucknow Health Map (rebuild with real map)
`04 / CITY MAP`
- **Left (≈ 70%): Google Map**, dark map style, centre Lucknow, zoom 11–12.
  - Ward circles/markers: green / yellow / amber; amber pulses.
  - Click → InfoWindow: ward, category, count vs baseline, "Review explanation →".
  - Optional heatmap toggle.
- **Right: ward list** (existing `area-list`): name + StatusBadge, sorted by severity.
- **Top filters:** category chips (All · Gastro · Febrile · Respiratory · Skin), date range (24h / 7d / 28d).
- **Legend** bottom-left.
- Fallback if key missing/blocked: show message "Map unavailable — check API key" instead of a blank box.

### 5.7 Explainable Alert (existing)
`05 / HUMAN REVIEW` — big AMBER status, title, place, **Why did this appear?**, evidence tiles, human-verification box.
Add: mini map pin, 8-week trend chart, top drug classes, review buttons (**Mark reviewed · Escalate · Dismiss**) with required note.

## 6. Interaction & Motion

- Hover: cards lift 2px, border brightens.
- Amber pin: soft 2s pulse (disable under `prefers-reduced-motion`).
- Upload progress: 3-step stepper.
- Page transitions: 150ms fade.

## 7. Accessibility

- Contrast ≥ 4.5:1 for text; status never colour-only.
- Focus ring 2px `--brand` on all interactive elements.
- Map has a text alternative: the ward list.
- Buttons ≥ 44px tall on mobile.

## 8. Copy Bank

| Where | Text |
|---|---|
| Disclaimer | "NABZ supports investigation. It does not diagnose individuals or declare an outbreak." |
| Privacy | "No patient identity is stored." |
| Alert CTA | "Review explanation →" |
| Review box | "Human verification required" |
| Map error | "Map unavailable. Check the API key and referrer settings." |
| Empty alerts | "No signals above baseline right now." |
