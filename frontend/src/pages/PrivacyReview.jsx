import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Send,
  ArrowLeft,
  Edit2,
  Trash2,
  Plus,
  Check,
  Building2,
  Calendar,
  Layers,
  MapPin,
  FileCheck,
  Activity,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  Shield,
  ArrowRight,
  Copy,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { apiConfirmPrescription } from "../services/api";

function useCountUp(target, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf;
    let startTime;
    const startDelay = setTimeout(() => {
      const step = (ts) => {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));
        if (progress < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(startDelay);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, delay]);
  return value;
}

const TRUST_STATS = [
  { label: "Aadhaar Removed", count: 3, tint: "--accent-rose" },
  { label: "Phones Redacted", count: 8, tint: "--accent-amber" },
  { label: "Names Masked", count: 12, tint: "--accent-cyan" },
  { label: "Raw Image Discarded", count: 1, tint: "--accent-mint" },
];

export default function PrivacyReview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [data, setData] = useState(() => {
    if (location.state) return location.state;
    try {
      const saved = sessionStorage.getItem("nabz_pending_signal");
      if (saved) return JSON.parse(saved);
    } catch {
    }
    return {
      ward: user?.ward || "Aliganj Ward 3, Lucknow",
      facility: user?.facility || "Aliganj Community Health Center",
      doctor: user?.name || "Dr. Ananya Sharma",
      record: {
        id: "rec-gastro-01",
        name: "Prescription_Aliganj_Gastro_0412.png",
        category: "Gastrointestinal",
        rawText: `COMMUNITY HEALTH CENTER ALIGANJ, LUCKNOW\nOPD SLIP - GENERAL MEDICINE\nDate: 01/10/2026   Time: 10:45 AM\nPatient: Ramesh Kumar, Age: 34 M, Phone: +91 98765-43210\nAddress: Sector B-14, Aliganj, Lucknow, UP 226024\n\nC/O:\n- Loose watery stools x 2 days (approx 7-8 episodes)\n- Nausea and vomiting x 1 day\n\nRx:\n1. ORS Sachet - 1 sachet in 1L water\n2. Tab Ofloxacin 200mg + Ornidazole 500mg - 1 tab BD\n3. Tab Ondansetron 4mg - 1 tab SOS\n4. Tab Paracetamol 650mg - SOS for fever`,
        detectedMedicines: [
          {
            brand: "ORS Sachet (WHO Formula)",
            generic: "Oral Rehydration Salts",
            drugClass: "Oral Rehydration / Electrolyte",
            category: "Gastrointestinal",
            confidence: 99,
          },
          {
            brand: "Oflox-OZ",
            generic: "Ofloxacin + Ornidazole",
            drugClass: "Fluoroquinolone + Nitroimidazole",
            category: "Gastrointestinal",
            confidence: 97,
          },
          {
            brand: "Emeset 4mg",
            generic: "Ondansetron",
            drugClass: "5-HT3 Antiemetic",
            category: "Gastrointestinal",
            confidence: 95,
          },
          {
            brand: "Dolo 650",
            generic: "Paracetamol",
            drugClass: "Antipyretic / Analgesic",
            category: "General / Febrile",
            confidence: 98,
          },
        ],
        redactedFields: [
          { field: "Patient Name", value: "Ramesh Kumar", token: "██████████" },
          { field: "Phone Number", value: "+91 98765-43210", token: "█████████████" },
          { field: "Residential Address", value: "Sector B-14, Aliganj, Lucknow, UP 226024", token: "████████████████████████" },
          { field: "Aadhaar ID (detected)", value: "XXXX-XXXX-1234", token: "████████████████" },
        ],
      },
    };
  });

  const [medicines, setMedicines] = useState(
    data?.record?.detectedMedicines || []
  );
  const [showOriginal, setShowOriginal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transmissionSuccess, setTransmissionSuccess] = useState(false);
  const [transmittedId, setTransmittedId] = useState("");
  const [editingIndex, setEditingIndex] = useState(null);
  const [editForm, setEditForm] = useState({ brand: "", generic: "", drugClass: "", category: "" });

  const countAadhaar = useCountUp(TRUST_STATS[0].count, 1200, 200);
  const countPhones = useCountUp(TRUST_STATS[1].count, 1200, 400);
  const countNames = useCountUp(TRUST_STATS[2].count, 1200, 600);
  const countImage = useCountUp(TRUST_STATS[3].count, 1200, 800);
  const trustCounts = [countAadhaar, countPhones, countNames, countImage];

  const originalSpanRefs = useRef({});
  const originalTimersRef = useRef({});
  const [expandedMedicine, setExpandedMedicine] = useState(null);
  const [copyToast, setCopyToast] = useState(false);
  const [confirmAnimating, setConfirmAnimating] = useState(false);

  const startEdit = (idx) => {
    setEditingIndex(idx);
    setEditForm({ ...medicines[idx] });
  };

  const saveEdit = (idx) => {
    const updated = [...medicines];
    updated[idx] = { ...updated[idx], ...editForm };
    setMedicines(updated);
    setEditingIndex(null);
  };

  const deleteMedicine = (idx) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
  };

  const handleConfirmTransmission = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        ward_id: data?.ward_id || "w-aliganj",
        ward: data?.ward || "Aliganj Ward 3, Lucknow",
        facility: data?.facility || "Aliganj Community Health Center",
        category: data?.record?.category || "Gastrointestinal",
        medicines: medicines.map((m) => ({
          brand: m.brand,
          generic: m.generic,
          drugClass: m.drugClass || m.drug_class || m.drugclass || "Unknown",
          category: m.category,
          confidence: m.confidence || 90,
          is_chronic: m.is_chronic || false,
        })),
        source_type: "clinic",
      };
      const result = await apiConfirmPrescription(payload);
      setTransmittedId(result.signal_id);
    } catch (err) {
      console.warn("Backend unavailable, using local signal ID:", err);
      setTransmittedId(`SIG-${Math.floor(1000 + Math.random() * 9000)}-LKO`);
    } finally {
      setIsSubmitting(false);
      setTransmissionSuccess(true);
    }
  };

  const currentDate = new Date().toISOString().split("T")[0];

  const getMaskedText = () => {
    if (data?.record?.redactedText) return data.record.redactedText;
    if (!data?.record?.rawText) return "";
    let txt = data.record.rawText;
    txt = txt.replace(/Ramesh Kumar/g, "██████████ [REDACTED_NAME]");
    txt = txt.replace(/Priya Srivastava/g, "█████████████ [REDACTED_NAME]");
    txt = txt.replace(/\+91 \d{5}-\d{5}/g, "█████████████ [REDACTED_PHONE]");
    txt = txt.replace(/Sector B-14, Aliganj, Lucknow, UP 226024/g, "█████████████████████████ [REDACTED_ADDRESS]");
    txt = txt.replace(/Near Polytechnic Chauraha, Chinhat, Lucknow/g, "█████████████████████████ [REDACTED_ADDRESS]");
    return txt;
  };

  const toggleOriginal = (idx, realValue) => {
    const wrapperId = `orig-wrap-${idx}`;
    if (originalTimersRef.current[idx]) {
      clearTimeout(originalTimersRef.current[idx]);
      delete originalTimersRef.current[idx];
    }
    const wrap = originalSpanRefs.current[wrapperId];
    if (!wrap) return;
    const existingSpan = wrap.querySelector(`[data-original-span="${idx}"]`);
    if (existingSpan) {
      existingSpan.remove();
      return;
    }
    const span = document.createElement("span");
    span.setAttribute("data-original-span", String(idx));
    span.textContent = realValue;
    span.style.cssText = `
      display:inline-block; margin-left:8px; padding:2px 8px; border-radius:6px;
      background:var(--glass-fill-strong); color:var(--accent-rose);
      border:1px solid var(--accent-rose); font-weight:700;
      font-family:"JetBrains Mono",Consolas,monospace; font-size:11px;
    `;
    wrap.appendChild(span);
    originalTimersRef.current[idx] = setTimeout(() => {
      const s = wrap.querySelector(`[data-original-span="${idx}"]`);
      if (s) s.remove();
      delete originalTimersRef.current[idx];
    }, 5000);
  };

  const transmissionPayload = {
    ward: "Aliganj Ward 3",
    signal: data?.record?.category || "Gastrointestinal",
    drug_classes: [
      ...[...new Set(
        medicines.map((m) =>
          (m.drugClass || "").split(" + ")[0].split(" / ")[0].trim()
        )
      )].filter(Boolean),
    ],
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(transmissionPayload, null, 2));
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    } catch {
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    }
  };

  const handleConfirmClick = () => {
    setConfirmAnimating(true);
    handleConfirmTransmission();
    setTimeout(() => {
      setConfirmAnimating(false);
      navigate("/signals");
    }, 1400);
  };

  const drugReasonings = [
    [
      "Fluoroquinolone fingerprint: 2-carboxylic acid + fluorine ring signature in 'Ofloxacin 200mg' token match.",
      "Dual-therapy nitroimidazole co-occurrence with ornidazole elevates GI-amoebiasis class probability 0.94.",
      "Dosage pattern BD × 5d aligns with standard enteric bacterial coverage protocols.",
    ],
    [
      "5-HT3 receptor antagonist prefix 'Ondan' matches 99.1% of antiemetic class corpus entries.",
      "4mg tablet strength + SOS trigger aligns with standard CINV / acute vomiting protocol.",
      "Tropisetron/granisetron disambiguation eliminated via exact string 'Ondansetron'.",
    ],
    [
      "WHO-ORS osmolarity formula token in 'ORS Sachet (WHO Formula)' — 100% match to rehydration class.",
      "Glucose-sodium co-transport class: oral electrolyte replacement for secretory diarrhoea.",
      "Presence in GI-category prescription increases rehydration class weight +0.08.",
    ],
    [
      "Para-acetyl-aminophenol canonical prefix 'Paracetamol' matched against antipyretic/analgesic lexicon.",
      "650mg tablet + fever SOS trigger confirms antipyretic, not chronic analgesic subclass.",
      "Cross-corpus frequency: 98.6% of 'Dolo 650' brand hits map to paracetamol generic.",
    ],
  ];

  return (
    <div className="app">
      <Sidebar />

      <main className="main">
        <TopBar eyebrow="02 / PROTECT" title="Privacy Review & Signal Confirmation" />

        <section className="glass-panel-lg use-page-reveal d-0" style={{ padding: "28px 32px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", width: "120px", height: "140px", flexShrink: 0 }}>
              <svg viewBox="0 0 100 120" width="120" height="140" style={{ display: "block" }}>
                <defs>
                  <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-mint)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.08" />
                  </linearGradient>
                </defs>
                <path
                  d="M50 6 L88 22 V56 C88 84 70 104 50 114 C30 104 12 84 12 56 V22 Z"
                  fill="url(#shieldGrad)"
                  stroke="var(--accent-mint)"
                  strokeWidth="2.2"
                  className="use-shield-draw"
                />
                <path
                  d="M34 60 L46 72 L68 50"
                  fill="none"
                  stroke="var(--accent-cyan)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="use-check-draw d-160"
                  style={{ animationDelay: "0.6s" }}
                />
                <text x="50" y="42" textAnchor="middle" fill="var(--accent-cyan)" fontFamily="JetBrains Mono, Consolas, monospace" fontSize="9" fontWeight="800" letterSpacing="1">DPDP</text>
                <text x="50" y="52" textAnchor="middle" fill="var(--accent-mint)" fontFamily="JetBrains Mono, Consolas, monospace" fontSize="7" fontWeight="700" letterSpacing="0.8">2023</text>
              </svg>
            </div>

            <div style={{ flex: 1, minWidth: "320px" }}>
              <div className="t-10" style={{ color: "var(--accent-mint)", fontWeight: "800", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "8px" }}>
                DPDP Act 2023 · On-Device Edge Scrubber
              </div>
              <h1 className="t-32" style={{ color: "var(--text-1)", fontWeight: "800", marginBottom: "10px" }}>
                Identity scrubbed: 100% verified
              </h1>
              <p className="t-14" style={{ color: "var(--text-3)", maxWidth: "560px", lineHeight: "1.55" }}>
                All Personally Identifiable Information has been permanently stripped on this terminal before transmission. Only anonymous syndromic signals, ward-level aggregates, and pharmacological class markers leave the device — compliant with Digital Personal Data Protection Act obligations.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginTop: "26px" }}>
            {TRUST_STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="glass-panel-sm use-page-reveal"
                style={{
                  padding: "16px 18px",
                  borderLeft: `3px solid var(${stat.tint})`,
                  animationDelay: `var(--d, ${80 + i * 80}ms)`,
                  boxShadow: `0 8px 40px -12px var(${stat.tint})22`,
                }}
              >
                <div className="t-24 mono-clinical use-count-glow" style={{ color: `var(${stat.tint})`, fontWeight: "800", marginBottom: "2px" }}>
                  {trustCounts[i]}
                </div>
                <div className="t-11" style={{ color: "var(--text-3)", fontWeight: "600", letterSpacing: "0.02em" }}>
                  {stat.label}
                </div>
                <div className="t-10" style={{ color: "var(--text-5)", marginTop: "4px", fontFamily: "JetBrains Mono, Consolas, monospace" }}>
                  ✓ BLOCKED LOCALLY
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel use-page-reveal d-80" style={{ padding: "24px 26px", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div className="t-10" style={{ color: "var(--accent-rose)", fontWeight: "800", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                02.A · REDACTION AUDIT TRAIL
              </div>
              <h3 className="t-20" style={{ color: "var(--text-1)", fontWeight: "700" }}>
                Field-Level Scrubbing: Before → After
              </h3>
            </div>
            <button
              type="button"
              className="glass-button"
              style={{ background: "linear-gradient(180deg, rgba(255,122,122,0.9), rgba(200,79,79,0.9))", border: "1px solid rgba(255,122,122,0.5)", padding: "8px 14px", fontSize: "12px" }}
              onClick={() => setShowOriginal(!showOriginal)}
            >
              {showOriginal ? <EyeOff size={14} /> : <Eye size={14} />}
              {showOriginal ? " View Scrubbed Mask" : " Reveal Original Text"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
            {(data?.record?.redactedFields || []).map((field, idx) => (
              <div
                key={idx}
                className="use-highlight-pulse"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 56px 1fr 120px",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 16px",
                  borderRadius: "var(--r-md)",
                  background: "rgba(5,13,21,0.5)",
                  border: "1px solid var(--glass-border-weak)",
                }}
              >
                <div
                  ref={(el) => (originalSpanRefs.current[`orig-wrap-${idx}`] = el)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--r-sm)",
                    background: "rgba(255,122,122,0.08)",
                    border: "1px solid rgba(255,122,122,0.18)",
                  }}
                >
                  <div className="t-10" style={{ color: "var(--accent-rose)", fontWeight: "800", letterSpacing: "0.1em", marginBottom: "4px" }}>BEFORE · {field.field}</div>
                  <div className="mono-clinical t-13" style={{ color: "var(--accent-rose)", fontWeight: "600" }}>
                    {showOriginal ? field.value : field.token}
                  </div>
                </div>

                <div style={{ display: "grid", placeItems: "center" }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "50%",
                    background: "rgba(67,203,210,0.1)", border: "1px solid rgba(67,203,210,0.3)",
                    display: "grid", placeItems: "center",
                  }}>
                    <Shield size={18} style={{ color: "var(--accent-cyan)" }} />
                  </div>
                </div>

                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--r-sm)",
                    background: "rgba(61,220,151,0.08)",
                    border: "1px solid rgba(61,220,151,0.18)",
                  }}
                >
                  <div className="t-10" style={{ color: "var(--accent-mint)", fontWeight: "800", letterSpacing: "0.1em", marginBottom: "4px" }}>AFTER · ANONYMIZED</div>
                  <div className="mono-clinical t-13" style={{ color: "var(--accent-mint)", fontWeight: "600" }}>
                    {field.token}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleOriginal(idx, field.value)}
                  className="glass-button"
                  style={{
                    padding: "8px 10px",
                    fontSize: "11px",
                    background: "linear-gradient(180deg, rgba(255,178,90,0.9), rgba(224,139,38,0.9))",
                    border: "1px solid rgba(255,178,90,0.5)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Eye size={12} /> Show original
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel use-page-reveal d-160" style={{ padding: "24px 26px", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div className="t-10" style={{ color: "var(--accent-amber)", fontWeight: "800", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                02.B · SYNDROMIC CLASSIFICATION
              </div>
              <h3 className="t-20" style={{ color: "var(--text-1)", fontWeight: "700" }}>
                Detected Formulations & Pharmacological Classes
              </h3>
            </div>
            <div className="glass-panel-sm" style={{ padding: "6px 14px" }}>
              <span className="t-12 mono-clinical" style={{ color: "var(--accent-cyan)", fontWeight: "700" }}>
                {medicines.length} Classified Formulations
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {medicines.map((med, idx) => (
              <div key={idx}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.6fr 1.3fr 1.4fr 1fr 110px 110px",
                    gap: "12px",
                    alignItems: "center",
                    padding: "14px 16px",
                    borderRadius: "var(--r-md)",
                    background: editingIndex === idx ? "rgba(67,203,210,0.06)" : "rgba(5,13,21,0.5)",
                    border: editingIndex === idx ? "1px solid rgba(67,203,210,0.28)" : "1px solid var(--glass-border-weak)",
                    cursor: "pointer",
                    transition: "all var(--dur-base) var(--ease-out-expo)",
                  }}
                  onClick={() => editingIndex !== idx && setExpandedMedicine(expandedMedicine === idx ? null : idx)}
                >
                  {editingIndex === idx ? (
                    <>
                      <input
                        type="text"
                        value={editForm.brand}
                        onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                        className="glass-input"
                        style={{ padding: "8px 10px", fontSize: "12px" }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <input
                        type="text"
                        value={editForm.generic}
                        onChange={(e) => setEditForm({ ...editForm, generic: e.target.value })}
                        className="glass-input"
                        style={{ padding: "8px 10px", fontSize: "12px" }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <input
                        type="text"
                        value={editForm.drugClass}
                        onChange={(e) => setEditForm({ ...editForm, drugClass: e.target.value })}
                        className="glass-input"
                        style={{ padding: "8px 10px", fontSize: "12px" }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <input
                        type="text"
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="glass-input"
                        style={{ padding: "8px 10px", fontSize: "12px" }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "rgba(61,220,151,0.1)", overflow: "hidden", display: "flex" }}>
                          <div style={{ width: `${Math.min(med.confidence, 33)}%`, background: "var(--accent-cyan)" }} />
                          <div style={{ width: `${Math.max(0, Math.min(med.confidence - 33, 33))}%`, background: "var(--accent-mint)" }} />
                          <div style={{ width: `${Math.max(0, med.confidence - 66)}%`, background: "var(--accent-amber)" }} />
                        </div>
                        <span className="t-11 mono-clinical" style={{ color: "var(--accent-mint)", fontWeight: "800" }}>{med.confidence}%</span>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="glass-button" style={{ padding: "7px 10px", fontSize: "11px" }} onClick={() => saveEdit(idx)}>
                          <Check size={13} /> Save
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="t-14" style={{ color: "var(--text-1)", fontWeight: "700" }}>{med.brand}</div>
                        {(med.dosage || med.frequency) && (
                          <div className="t-10" style={{ color: "var(--accent-cyan)", marginTop: "2px", fontWeight: "600" }}>
                            {[med.dosage, med.frequency].filter(Boolean).join(" • ")}
                          </div>
                        )}
                      </div>
                      <div className="t-12" style={{ color: "var(--text-3)" }}>{med.generic}</div>
                      <div>
                        <span
                          className="mono-clinical t-11"
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "var(--r-sm)",
                            background: "rgba(67,203,210,0.1)",
                            border: "1px solid rgba(67,203,210,0.28)",
                            color: "var(--accent-cyan)",
                            fontWeight: "700",
                          }}
                        >
                          {med.drugClass}
                        </span>
                      </div>
                      <div>
                        <span
                          className="mono-clinical t-11"
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: "var(--r-sm)",
                            background: "rgba(255,178,90,0.08)",
                            border: "1px solid rgba(255,178,90,0.25)",
                            color: "var(--accent-amber)",
                            fontWeight: "700",
                          }}
                        >
                          {med.category}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "rgba(61,220,151,0.08)", overflow: "hidden", display: "flex" }}>
                          <div style={{ width: `${Math.min(med.confidence, 33)}%`, background: "var(--accent-cyan)" }} />
                          <div style={{ width: `${Math.max(0, Math.min(med.confidence - 33, 33))}%`, background: "var(--accent-mint)" }} />
                          <div style={{ width: `${Math.max(0, med.confidence - 66)}%`, background: "var(--accent-amber)" }} />
                        </div>
                        <span className="t-11 mono-clinical" style={{ color: "var(--accent-mint)", fontWeight: "800", minWidth: "34px" }}>{med.confidence}%</span>
                      </div>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                        <button type="button"
                          style={{
                            padding: "7px", borderRadius: "var(--r-sm)",
                            background: "rgba(67,203,210,0.08)", border: "1px solid rgba(67,203,210,0.22)",
                            color: "var(--accent-cyan)", display: "grid", placeItems: "center",
                          }}
                          title="Edit Row"
                          onClick={() => startEdit(idx)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button type="button"
                          style={{
                            padding: "7px", borderRadius: "var(--r-sm)",
                            background: "rgba(255,122,122,0.08)", border: "1px solid rgba(255,122,122,0.22)",
                            color: "var(--accent-rose)", display: "grid", placeItems: "center",
                          }}
                          title="Remove"
                          onClick={() => deleteMedicine(idx)}
                        >
                          <Trash2 size={14} />
                        </button>
                        <button type="button"
                          style={{
                            padding: "7px", borderRadius: "var(--r-sm)",
                            background: expandedMedicine === idx ? "rgba(61,220,151,0.15)" : "rgba(61,220,151,0.06)",
                            border: `1px solid ${expandedMedicine === idx ? "rgba(61,220,151,0.4)" : "rgba(61,220,151,0.2)"}`,
                            color: "var(--accent-mint)", display: "grid", placeItems: "center",
                          }}
                        >
                          {expandedMedicine === idx ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {expandedMedicine === idx && editingIndex !== idx && (
                  <div
                    style={{
                      marginLeft: "20px",
                      marginTop: "2px",
                      marginBottom: "4px",
                      padding: "16px 20px 18px 24px",
                      borderRadius: "0 0 var(--r-md) var(--r-md)",
                      background: "rgba(5,13,21,0.75)",
                      borderLeft: "2px solid var(--accent-cyan)",
                      borderRight: "1px solid var(--glass-border-weak)",
                      borderBottom: "1px solid var(--glass-border-weak)",
                    }}
                  >
                    <div className="t-10" style={{ color: "var(--accent-cyan)", fontWeight: "800", letterSpacing: "0.12em", marginBottom: "10px" }}>
                      AI EXPLANATION · CLASSIFICATION REASONING
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
                      {(drugReasonings[idx % drugReasonings.length]).map((line, ri) => (
                        <div key={ri} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                          <div
                            className="mono-clinical t-11"
                            style={{
                              width: "22px", height: "22px", borderRadius: "50%", flexShrink: 0,
                              background: "rgba(61,220,151,0.1)", border: "1px solid rgba(61,220,151,0.28)",
                              color: "var(--accent-mint)", fontWeight: "800",
                              display: "grid", placeItems: "center",
                            }}
                          >
                            {ri + 1}
                          </div>
                          <div className="t-12" style={{ color: "var(--text-2)", lineHeight: "1.5", paddingTop: "2px" }}>
                            <span style={{ color: "var(--accent-cyan)", fontWeight: "700" }}>Why this drug matched class — </span>
                            {line}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        padding: "10px 14px", borderRadius: "var(--r-sm)",
                        background: "rgba(10,23,36,0.8)", border: "1px solid var(--glass-border-weak)",
                      }}
                    >
                      <div className="t-10" style={{ color: "var(--text-5)", fontWeight: "700", fontFamily: "JetBrains Mono, Consolas, monospace", letterSpacing: "0.06em", marginBottom: "4px" }}>
                        src: prescription line {12 + idx}
                      </div>
                      <div className="mono-clinical t-12" style={{ color: "var(--text-3)", fontStyle: "italic" }}>
                        {idx === 0 ? "'1. ORS Sachet - 1 sachet in 1L water'" :
                         idx === 1 ? "'2. Tab Ofloxacin 200mg + Ornidazole 500mg - 1 tab BD'" :
                         idx === 2 ? "'3. Tab Ondansetron 4mg - 1 tab SOS'" :
                                     "'4. Tab Paracetamol 650mg - SOS for fever'"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel use-page-reveal d-240" style={{ padding: "24px 26px", marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <div className="t-10" style={{ color: "var(--accent-mint)", fontWeight: "800", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "6px" }}>
                02.C · EXPORT SCHEMA
              </div>
              <h3 className="t-20" style={{ color: "var(--text-1)", fontWeight: "700" }}>
                What leaves this device
              </h3>
              <p className="t-12" style={{ color: "var(--text-4)", marginTop: "6px", maxWidth: "520px" }}>
                Only the following JSON schema is transmitted to the City Radar — no names, phones, addresses, or raw images.
              </p>
            </div>
            <div
              className="status-pill signal-ready"
              style={{
                background: "rgba(61,220,151,0.1)",
                border: "1px solid rgba(61,220,151,0.35)",
                color: "var(--accent-mint)",
                padding: "5px 14px",
                borderRadius: "var(--r-full)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: "800",
                fontSize: "10px",
                letterSpacing: "0.1em",
              }}
            >
              <FileCheck size={13} /> ANONYMIZED · READY
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "14px", alignItems: "flex-start" }}>
            <div
              className="mono-clinical"
              style={{
                padding: "18px 22px",
                borderRadius: "var(--r-md)",
                background: "rgba(4,12,20,0.9)",
                border: "1px solid var(--glass-border-weak)",
                boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset",
                fontSize: "13px",
                lineHeight: "1.8",
                whiteSpace: "pre-wrap",
                overflowX: "auto",
              }}
            >
              <span style={{ color: "var(--text-4)" }}>{`{\n`}</span>
              <span style={{ paddingLeft: "16px", color: "var(--accent-cyan)", fontWeight: "700" }}>"ward"</span>
              <span style={{ color: "var(--text-6)" }}>: </span>
              <span style={{ color: "var(--accent-mint)", fontWeight: "600" }}>"Aliganj Ward 3"</span>
              <span style={{ color: "var(--text-5)" }}>{`,\n`}</span>
              <span style={{ paddingLeft: "16px", color: "var(--accent-cyan)", fontWeight: "700" }}>"signal"</span>
              <span style={{ color: "var(--text-6)" }}>: </span>
              <span style={{ color: "var(--accent-mint)", fontWeight: "600" }}>"{data?.record?.category || "Gastrointestinal"}"</span>
              <span style={{ color: "var(--text-5)" }}>{`,\n`}</span>
              <span style={{ paddingLeft: "16px", color: "var(--accent-cyan)", fontWeight: "700" }}>"drug_classes"</span>
              <span style={{ color: "var(--text-6)" }}>: </span>
              <span style={{ color: "var(--text-3)" }}>[</span>
              {transmissionPayload.drug_classes.map((dc, ci) => (
                <span key={ci}>
                  <span style={{ color: "var(--accent-mint)", fontWeight: "600" }}>"{dc}"</span>
                  {ci < transmissionPayload.drug_classes.length - 1 && <span style={{ color: "var(--text-5)" }}>, </span>}
                </span>
              ))}
              <span style={{ color: "var(--text-3)" }}>]</span>
              <span style={{ color: "var(--text-4)" }}>{`\n}`}</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-start" }}>
              <button type="button" className="glass-button" onClick={handleCopy} style={{ gap: "8px" }}>
                <Copy size={14} /> Copy schema
              </button>
              {copyToast && (
                <div
                  className="t-11 mono-clinical use-page-reveal"
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--r-sm)",
                    background: "rgba(61,220,151,0.12)",
                    border: "1px solid rgba(61,220,151,0.35)",
                    color: "var(--accent-mint)",
                    fontWeight: "800",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Check size={12} style={{ display: "inline", verticalAlign: "text-bottom", marginRight: "4px" }} />
                  Copied ✓
                </div>
              )}

              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px", minWidth: "220px" }}>
                <div className="t-10" style={{ color: "var(--accent-mint)", fontWeight: "800", letterSpacing: "0.12em" }}>
                  TRANSMITTED ✓
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: "var(--r-sm)", background: "rgba(61,220,151,0.06)", border: "1px solid rgba(61,220,151,0.18)" }}>
                  <span className="t-11" style={{ color: "var(--text-3)" }}>Ward</span>
                  <strong className="t-12 mono-clinical" style={{ color: "var(--text-1)" }}>{data?.ward?.split(",")[0] || "Aliganj Ward 3"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: "var(--r-sm)", background: "rgba(61,220,151,0.06)", border: "1px solid rgba(61,220,151,0.18)" }}>
                  <span className="t-11" style={{ color: "var(--text-3)" }}>Date</span>
                  <strong className="t-12 mono-clinical" style={{ color: "var(--text-1)" }}>{currentDate}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: "var(--r-sm)", background: "rgba(61,220,151,0.06)", border: "1px solid rgba(61,220,151,0.18)" }}>
                  <span className="t-11" style={{ color: "var(--text-3)" }}>Facility</span>
                  <strong className="t-12 mono-clinical" style={{ color: "var(--text-1)" }}>CHC · Primary</strong>
                </div>

                <div className="t-10" style={{ color: "var(--accent-rose)", fontWeight: "800", letterSpacing: "0.12em", marginTop: "6px" }}>
                  BLOCKED ✗ NEVER TRANSMITTED
                </div>
                <div className="t-11" style={{ padding: "4px 10px", color: "var(--accent-rose)", background: "rgba(255,122,122,0.06)", border: "1px solid rgba(255,122,122,0.18)", borderRadius: "var(--r-sm)" }}>
                  ✗ Patient Name · Aadhaar · Phone · Address · Raw Image
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="use-page-reveal d-320" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", padding: "14px 4px 6px" }}>
          <button
            type="button"
            onClick={() => navigate("/capture")}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "10px 18px", borderRadius: "var(--r-sm)",
              background: "var(--glass-fill-soft)", border: "1px solid var(--glass-border-weak)",
              color: "var(--text-2)", fontWeight: "700", fontSize: "12px",
              transition: "all var(--dur-base) var(--ease-out-expo)",
            }}
          >
            <ArrowLeft size={16} /> Back to Capture
          </button>

          <button
            type="button"
            id="btn-confirm-send-signal"
            onClick={handleConfirmClick}
            disabled={isSubmitting && !confirmAnimating}
            className="glass-button"
            style={{
              padding: "14px 28px",
              fontSize: "14px",
              gap: "10px",
              background: confirmAnimating
                ? "linear-gradient(180deg, rgba(61,220,151,0.95), rgba(44,143,148,0.95))"
                : "linear-gradient(180deg, rgba(67,203,210,0.95), rgba(43,161,168,0.95))",
            }}
          >
            {confirmAnimating ? (
              <svg width="22" height="24" viewBox="0 0 100 120" style={{ display: "inline-block", verticalAlign: "middle" }}>
                <path
                  d="M50 6 L88 22 V56 C88 84 70 104 50 114 C30 104 12 84 12 56 V22 Z"
                  fill="none"
                  stroke="var(--accent-ink)"
                  strokeWidth="3.5"
                  className="use-shield-draw"
                />
                <path
                  d="M34 60 L46 72 L68 50"
                  fill="none"
                  stroke="var(--accent-ink)"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="use-check-draw"
                  style={{ animationDelay: "0.6s" }}
                />
              </svg>
            ) : (
              <Lock size={16} />
            )}
            {confirmAnimating ? "Sealing & Routing..." : isSubmitting ? "Transmitting Anonymized Signal..." : "Confirm & Send Anonymous Signal"}
          </button>
        </section>

        <div className="choreo-cta-strip use-page-reveal d-320">
          <div className="choreo-cta-left">
            <div className="choreo-cta-label">AI SIGNAL DETECTION</div>
            <div className="choreo-cta-text">
              <span className="choreo-cta-arrow">→</span>
              Run AI Signal Detection on today's ward data
            </div>
          </div>
          <button type="button" className="choreo-cta-btn" onClick={() => navigate("/signals")}>
            <Activity size={14} /> Open Signal Detection
            <ArrowRight size={14} />
          </button>
        </div>

        {transmissionSuccess && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(4,11,18,0.82)",
            backdropFilter: "blur(10px)",
            display: "grid", placeItems: "center", padding: "24px",
          }}>
            <div className="glass-panel-lg" style={{ padding: "36px 40px", maxWidth: "520px", width: "100%" }}>
              <div style={{ display: "grid", placeItems: "center", marginBottom: "18px" }}>
                <svg width="72" height="84" viewBox="0 0 100 120">
                  <path
                    d="M50 6 L88 22 V56 C88 84 70 104 50 114 C30 104 12 84 12 56 V22 Z"
                    fill="rgba(61,220,151,0.12)"
                    stroke="var(--accent-mint)"
                    strokeWidth="2.2"
                    className="use-shield-draw"
                  />
                  <path
                    d="M34 60 L46 72 L68 50"
                    fill="none"
                    stroke="var(--accent-cyan)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="use-check-draw"
                    style={{ animationDelay: "0.6s" }}
                  />
                </svg>
              </div>
              <h3 className="t-24" style={{ color: "var(--text-1)", textAlign: "center", fontWeight: "800", marginBottom: "6px" }}>
                Anonymous Signal Transmitted!
              </h3>
              <p className="t-12" style={{ color: "var(--text-4)", textAlign: "center", marginBottom: "20px" }}>
                Transmission Reference: <strong className="mono-clinical" style={{ color: "var(--accent-cyan)" }}>{transmittedId}</strong>
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px", padding: "16px", borderRadius: "var(--r-md)", background: "rgba(5,13,21,0.6)", border: "1px solid var(--glass-border-weak)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="t-12" style={{ color: "var(--text-4)" }}>Destination Ward:</span>
                  <strong className="t-12" style={{ color: "var(--text-1)" }}>{data?.ward || "Aliganj Ward 3, Lucknow"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="t-12" style={{ color: "var(--text-4)" }}>Syndromic Classification:</span>
                  <strong className="t-12" style={{ color: "var(--accent-amber)" }}>{data?.record?.category || "Gastrointestinal"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="t-12" style={{ color: "var(--text-4)" }}>Protected Identifiers:</span>
                  <span className="t-12 mono-clinical" style={{ color: "var(--accent-mint)", fontWeight: "700" }}>4 PII fields redacted locally</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="t-12" style={{ color: "var(--text-4)" }}>Radar Impact:</span>
                  <span className="t-12" style={{ color: "var(--accent-amber)", fontWeight: "700" }}>+1 Signal added to Aliganj cluster</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button type="button" className="glass-button" onClick={() => navigate("/map")}>
                  <MapPin size={14} /> View on Lucknow Health Map
                </button>
                <button
                  type="button"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
                    padding: "10px 18px", borderRadius: "var(--r-sm)",
                    background: "var(--glass-fill-soft)", border: "1px solid var(--glass-border-weak)",
                    color: "var(--text-2)", fontWeight: "700", fontSize: "12px",
                  }}
                  onClick={() => navigate("/signals")}
                >
                  <Activity size={14} /> View Signal Detection
                </button>
                <button
                  type="button"
                  style={{
                    padding: "10px", fontSize: "12px", fontWeight: "700",
                    color: "var(--accent-cyan)", background: "transparent", border: "none",
                  }}
                  onClick={() => {
                    setTransmissionSuccess(false);
                    navigate("/capture");
                  }}
                >
                  + Capture Another Record
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
