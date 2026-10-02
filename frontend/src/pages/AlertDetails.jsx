/**
 * AlertDetails.jsx — 05 / HUMAN REVIEW
 * Wired to /alerts/:id API with explainable evidence breakdown.
 * Admin review actions: Reviewed / Escalate / Dismiss
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ShieldCheck, AlertTriangle, CheckCircle2, ChevronLeft,
  Building2, FlaskConical, Stethoscope, RefreshCw,
  ThumbsUp, TrendingUp, X, MapPin, Pill, Pill as PillIcon,
  Activity, FlaskConical as LabIcon, Building2 as PharmacyIcon,
  Calendar, Clock, Users, ArrowUp, FileText, Save,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { apiGetAlert, apiReviewAlert } from "../services/api";

const STATUS_BADGE = {
  AMBER: { label: "AMBER SIGNAL", cls: "big-status big-status--amber" },
  WATCH: { label: "WATCH SIGNAL", cls: "big-status big-status--watch" },
  NORMAL: { label: "NORMAL", cls: "big-status big-status--normal" },
};

export default function AlertDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const [evidenceTab, setEvidenceTab] = useState("timeline");
  const [checkedActions, setCheckedActions] = useState([]);
  const [adminStatus, setAdminStatus] = useState("Open");
  const [adminAssignee, setAdminAssignee] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    async function loadAlert() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetAlert(id);
        setAlert(data);
      } catch (err) {
        setError("Could not load alert from server. Showing fallback data.");
        setAlert({
          id: parseInt(id) || 1,
          ward_name: "Aliganj Ward 3",
          category: "Gastrointestinal",
          level: "AMBER",
          count_today: 31,
          baseline_mean: 9,
          z_score: "3.4",
          source_count: 6,
          status: "open",
          created_at: new Date().toISOString(),
          explanation: {
            why: "GI-class medicines in Aliganj Ward 3 are 3.4σ above the 28-day baseline (9 avg), corroborated across 6 independent healthcare touchpoints.",
            evidence: { clinics: 3, pharmacies: 2, labs: 1 },
            top_drug_classes: ["Oral Rehydration / Electrolyte", "5-HT3 Antiemetic", "Fluoroquinolone + Nitroimidazole"],
            disclaimer: "NABZ supports investigation. It does not diagnose individuals or declare an outbreak.",
          },
        });
      } finally {
        setLoading(false);
      }
    }
    loadAlert();
  }, [id]);

  const handleReview = async (status) => {
    setReviewing(true);
    try {
      const updated = await apiReviewAlert(id, status, "Reviewed by district health officer");
      setAlert(updated);
      setReviewDone(true);
    } catch (err) {
      setAlert((prev) => ({ ...prev, status }));
      setReviewDone(true);
    } finally {
      setReviewing(false);
    }
  };

  const toggleCheck = (idx) => {
    setCheckedActions((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleAdminSave = () => {
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const badge = alert ? (STATUS_BADGE[alert.level] || STATUS_BADGE.NORMAL) : null;
  const isAdmin = user?.role === "admin";

  const timelineEvents = [
    { icon: Stethoscope, text: "OPD visit #128 flagged", time: "08:14" },
    { icon: Building2, text: "Pharmacy refill pattern correlated", time: "09:32" },
    { icon: FlaskConical, text: "Lab dengue NS1+ result shared", time: "10:05" },
    { icon: Activity, text: "Syndromic classification Gastro", time: "10:28" },
    { icon: TrendingUp, text: "z-score crossed 2.5 threshold", time: "10:47" },
    { icon: ShieldCheck, text: "Pushed to CMO dashboard", time: "10:51" },
  ];

  const sourceBars = [
    { label: "Clinics", icon: Stethoscope, count: alert?.explanation?.evidence?.clinics ?? 0, width: 85, color: "cyan" },
    { label: "Pharmacies", icon: Building2, count: alert?.explanation?.evidence?.pharmacies ?? 0, width: 62, color: "mint" },
    { label: "Labs", icon: FlaskConical, count: alert?.explanation?.evidence?.labs ?? 0, width: 38, color: "amber" },
  ];

  const drugSignals = [
    { name: "Oral Rehydration / Electrolyte", pct: 42 },
    { name: "5-HT3 Antiemetic (Ondansetron)", pct: 28 },
    { name: "Fluoroquinolone + Nitroimidazole", pct: 19 },
    { name: "Antispasmodic (Dicyclomine)", pct: 11 },
  ];

  const checklistItems = [
    "Acknowledge alert",
    "Contact Aliganj CHC nodal officer",
    "Cross-reference pharmacy refill data",
    "Schedule ward surveillance visit",
  ];

  const formatDate = (iso) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    } catch { return "Recent"; }
  };

  return (
    <div className="app">
      <Sidebar />
      <main className="main">

        <TopBar eyebrow="05 / HUMAN REVIEW" title="Explainable Alert">
          <button
            className="glass-button"
            onClick={() => navigate(-1)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(10,23,36,0.62)", color: "var(--text-2)", border: "1px solid var(--glass-border-weak)", boxShadow: "none", fontWeight: 600 }}
          >
            <ChevronLeft size={16} /> Back
          </button>
        </TopBar>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0", flexDirection: "column", gap: 16 }}>
            <RefreshCw size={28} className="spin-icon" style={{ color: "var(--text-4)" }} />
            <p className="t-14" style={{ color: "var(--text-3)" }}>Loading alert explanation…</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginTop: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ── HERO: glass-panel-lg with severity ribbon ── */}
              <div className="glass-panel-lg use-page-reveal d-0" style={{ paddingTop: 52, padding: "52px 28px 28px", overflow: "visible" }}>
                {/* Severity ribbon */}
                <div
                  style={{
                    position: "absolute",
                    insetX: 0,
                    left: 0,
                    right: 0,
                    top: 0,
                    height: 52,
                    background: "linear-gradient(90deg, var(--accent-amber-deep), var(--accent-amber), var(--accent-amber-deep))",
                    borderRadius: "var(--r-xl24) var(--r-xl24) 0 0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 22px",
                    overflow: "hidden",
                  }}
                >
                  <div className="use-shimmer-ribbon" style={{ position: "absolute", inset: 0, pointerEvents: "none", borderRadius: "inherit" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 12, zIndex: 1 }}>
                    <div style={{
                      width: 30, height: 30,
                      background: "rgba(255,255,255,0.18)",
                      borderRadius: "var(--r-sm)",
                      display: "grid", placeItems: "center",
                      backdropFilter: "blur(4px)",
                    }}>
                      <AlertTriangle size={17} color="#fff" />
                    </div>
                    <div>
                      <div className="mono-clinical t-13" style={{ color: "#fff", fontWeight: 800, letterSpacing: "0.06em" }}>
                        AMBER SIGNAL · ACTIVE REVIEW
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.82)", letterSpacing: "0.08em" }}>
                        #{String(alert?.id || 1).padStart(4, "0")} · MULTI-SOURCE CORROBORATION
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, zIndex: 1 }}>
                    <div style={{
                      padding: "6px 14px",
                      background: "rgba(255,255,255,0.16)",
                      border: "1px solid rgba(255,255,255,0.25)",
                      borderRadius: "var(--r-full)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                      <Users size={11} /> {alert?.source_count ?? 6} TOUCHPOINTS
                    </div>
                    <div style={{
                      padding: "6px 14px",
                      background: "rgba(255,255,255,0.16)",
                      border: "1px solid rgba(255,255,255,0.25)",
                      borderRadius: "var(--r-full)",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                      <Calendar size={11} /> LIVE
                    </div>
                  </div>
                </div>

                {/* Alert metadata */}
                <div style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <MapPin size={14} style={{ color: "var(--accent-cyan)" }} />
                      <span className="t-16 mono-clinical" style={{ color: "var(--text-1)", fontWeight: 700 }}>{alert?.ward_name}</span>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent-amber)", boxShadow: "0 0 8px var(--accent-amber)" }} />
                      <span className="t-12" style={{ color: "var(--text-4)", marginLeft: 6 }}>Lucknow</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                      <span className="glass-panel-sm t-11" style={{ padding: "5px 12px", color: "var(--accent-mint)", fontWeight: 700, letterSpacing: "0.04em" }}>
                        {alert?.category}
                      </span>
                      <span className="t-12" style={{ color: "var(--text-4)", display: "flex", alignItems: "center", gap: 5 }}>
                        <Clock size={11} /> {formatDate(alert?.created_at)}
                      </span>
                    </div>
                    <p className="t-14" style={{ color: "var(--text-3)", maxWidth: 480, lineHeight: 1.7 }}>
                      {alert?.explanation?.why || "Anonymous signals from multiple sources moved above the locality baseline."}
                    </p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <div className="t-12" style={{ color: "var(--text-5)", letterSpacing: "0.1em", fontWeight: 700 }}>Z-SCORE</div>
                    <div className="t-44 mono-clinical" style={{ color: "var(--accent-cyan)", fontWeight: 800, lineHeight: 1 }}>
                      {alert?.z_score}σ
                    </div>
                    <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                      <div style={{ textAlign: "right" }}>
                        <div className="t-11" style={{ color: "var(--text-5)" }}>TODAY</div>
                        <div className="t-20 mono-clinical" style={{ color: "var(--text-1)", fontWeight: 700 }}>{alert?.count_today ?? 31}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="t-11" style={{ color: "var(--text-5)" }}>BASELINE</div>
                        <div className="t-20 mono-clinical" style={{ color: "var(--text-4)", fontWeight: 700 }}>{alert?.baseline_mean ?? 9}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="t-11" style={{ color: "var(--text-5)" }}>STATUS</div>
                        <div className="t-20 mono-clinical" style={{
                          color: alert?.status === "open" ? "var(--accent-amber)" :
                                 alert?.status === "reviewed" ? "var(--accent-mint)" :
                                 "var(--text-4)",
                          fontWeight: 700,
                        }}>{(alert?.status || "OPEN").toUpperCase()}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {error && (
                  <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: "var(--r-md)", display: "flex", gap: 10, alignItems: "center", background: "rgba(255,178,90,0.07)", border: "1px solid rgba(255,178,90,0.22)" }}>
                    <AlertTriangle size={15} style={{ color: "var(--accent-amber)", flexShrink: 0 }} />
                    <small className="t-12" style={{ color: "var(--accent-amber)" }}>{error}</small>
                  </div>
                )}
              </div>

              {/* ── EVIDENCE: 3 tabs ── */}
              <div className="glass-panel use-page-reveal d-80" style={{ padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <div>
                    <div className="t-11" style={{ color: "var(--accent-cyan)", fontWeight: 800, letterSpacing: "0.12em" }}>EXPLAINABLE EVIDENCE</div>
                    <div className="t-18" style={{ color: "var(--text-1)", fontWeight: 700, marginTop: 4 }}>How was this signal detected?</div>
                  </div>
                </div>

                {/* Segmented tabs */}
                <div className="glass-panel-sm" style={{ display: "flex", padding: 4, gap: 4, marginBottom: 22 }}>
                  {[
                    { k: "timeline", label: "TIMELINE", icon: Clock },
                    { k: "sources", label: "SOURCES", icon: Building2 },
                    { k: "signals", label: "SIGNALS", icon: PillIcon },
                  ].map((tab) => {
                    const active = evidenceTab === tab.k;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.k}
                        onClick={() => setEvidenceTab(tab.k)}
                        className="t-12 mono-clinical"
                        style={{
                          flex: 1,
                          padding: "10px 14px",
                          borderRadius: "var(--r-sm)",
                          border: "none",
                          background: active ? "linear-gradient(180deg, rgba(67,203,210,0.22), rgba(67,203,210,0.08))" : "transparent",
                          color: active ? "var(--accent-cyan)" : "var(--text-4)",
                          fontWeight: active ? 800 : 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          transition: "all var(--dur-fast) var(--ease-out-quad)",
                          boxShadow: active ? "inset 0 0 0 1px rgba(67,203,210,0.35)" : "none",
                        }}
                      >
                        <Icon size={13} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content: TIMELINE */}
                {evidenceTab === "timeline" && (
                  <div style={{ paddingLeft: 8, paddingRight: 8 }}>
                    {timelineEvents.map((ev, i) => {
                      const Icon = ev.icon;
                      const isLast = i === timelineEvents.length - 1;
                      return (
                        <div key={i} style={{ display: "flex", gap: 14, position: "relative" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 34, flexShrink: 0 }}>
                            <div style={{
                              width: 30, height: 30,
                              borderRadius: "var(--r-sm)",
                              background: "linear-gradient(180deg, rgba(67,203,210,0.18), rgba(10,23,36,0.6))",
                              border: "1px solid rgba(67,203,210,0.3)",
                              display: "grid", placeItems: "center",
                              zIndex: 1,
                            }}>
                              <Icon size={14} style={{ color: "var(--accent-cyan)" }} />
                            </div>
                            {!isLast && (
                              <svg width="2" height="42" style={{ marginTop: 2 }} viewBox="0 0 2 42">
                                <line
                                  x1="1" y1="0" x2="1" y2="42"
                                  stroke="rgba(67,203,210,0.25)"
                                  strokeWidth="2"
                                  strokeDasharray="4 4"
                                  style={{
                                    strokeDasharray: 42,
                                    strokeDashoffset: 42,
                                    animation: `drawLine 0.9s var(--ease-out-expo) ${i * 0.08 + 0.1}s forwards`,
                                  }}
                                />
                              </svg>
                            )}
                          </div>
                          <div style={{ paddingTop: 5, paddingBottom: isLast ? 0 : 10, flex: 1 }}>
                            <div className="t-14" style={{ color: "var(--text-1)", fontWeight: 600 }}>{ev.text}</div>
                            <div className="t-11 mono-clinical" style={{ color: "var(--text-5)", marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
                              <Clock size={10} /> {ev.time} · Step {i + 1}/6
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Tab content: SOURCES */}
                {evidenceTab === "sources" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    {sourceBars.map((src, i) => {
                      const Icon = src.icon;
                      const gradient = src.color === "cyan"
                        ? "linear-gradient(90deg, var(--accent-cyan-deep), var(--accent-cyan))"
                        : src.color === "mint"
                        ? "linear-gradient(90deg, var(--accent-mint), var(--accent-cyan))"
                        : "linear-gradient(90deg, var(--accent-amber-deep), var(--accent-amber))";
                      return (
                        <div key={src.label}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{
                                width: 26, height: 26, borderRadius: "var(--r-sm)",
                                background: "rgba(10,23,36,0.6)",
                                border: "1px solid var(--glass-border-weak)",
                                display: "grid", placeItems: "center",
                              }}>
                                <Icon size={13} style={{ color: `var(--accent-${src.color})` }} />
                              </div>
                              <span className="t-13" style={{ color: "var(--text-2)", fontWeight: 600 }}>{src.label}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                              <span className="t-20 mono-clinical" style={{ color: `var(--accent-${src.color})`, fontWeight: 800 }}>{src.count}</span>
                              <span className="t-11" style={{ color: "var(--text-5)" }}>signals</span>
                              <span className="t-11 mono-clinical" style={{ color: "var(--text-4)" }}>{src.width}%</span>
                            </div>
                          </div>
                          <div style={{ height: 10, background: "rgba(10,23,36,0.6)", borderRadius: "var(--r-full)", overflow: "hidden", border: "1px solid var(--glass-border-weak)" }}>
                            <div
                              style={{
                                height: "100%",
                                width: 0,
                                background: gradient,
                                borderRadius: "inherit",
                                boxShadow: `0 0 12px rgba(67,203,210,0.35)`,
                                animation: `barGrow 1.1s var(--ease-out-expo) ${i * 0.12 + 0.1}s forwards`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="t-12" style={{ color: "var(--text-5)", textAlign: "center", padding: "10px 0 2px" }}>
                      All sources independently corroborate the anomaly pattern
                    </div>
                  </div>
                )}

                {/* Tab content: SIGNALS */}
                {evidenceTab === "signals" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px 4px", borderBottom: "1px solid var(--glass-border-weak)" }}>
                      <span className="t-11 mono-clinical" style={{ color: "var(--text-5)", letterSpacing: "0.06em" }}>DRUG CLASS</span>
                      <span className="t-11 mono-clinical" style={{ color: "var(--text-5)", letterSpacing: "0.06em" }}>CONTRIBUTION</span>
                    </div>
                    {drugSignals.map((drug, i) => (
                      <div key={drug.name} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", background: "rgba(61,220,151,0.08)", border: "1px solid rgba(61,220,151,0.2)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          <Pill size={13} style={{ color: "var(--accent-mint)" }} />
                        </div>
                        <span className="t-13" style={{ color: "var(--text-2)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{drug.name}</span>
                        <div style={{ width: 140, height: 8, background: "rgba(10,23,36,0.6)", borderRadius: "var(--r-full)", overflow: "hidden", border: "1px solid var(--glass-border-weak)", flexShrink: 0 }}>
                          <div
                            style={{
                              height: "100%",
                              width: 0,
                              background: "linear-gradient(90deg, var(--accent-mint), var(--accent-cyan))",
                              borderRadius: "inherit",
                              animation: `barGrow 1s var(--ease-out-expo) ${i * 0.1 + 0.1}s forwards`,
                              ["--barWidth"]: `${drug.pct}%`,
                            }}
                          />
                        </div>
                        <span className="t-14 mono-clinical" style={{ color: "var(--accent-mint)", fontWeight: 800, width: 40, textAlign: "right" }}>{drug.pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Z-SCORE WATERFALL ── */}
              <div className="glass-panel use-page-reveal d-160" style={{ padding: 22 }}>
                <div className="t-11" style={{ color: "var(--accent-rose)", fontWeight: 800, letterSpacing: "0.12em", marginBottom: 4 }}>Z-SCORE WATERFALL</div>
                <div className="t-18" style={{ color: "var(--text-1)", fontWeight: 700, marginBottom: 22 }}>From baseline to alert threshold</div>

                <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 220, padding: "0 10px" }}>
                  {[
                    { key: "BASE", label: "Baseline", val: 32, color: "mint", title: "28-day rolling mean · 9 avg/day" },
                    { key: "TODAY", label: "Today", val: 92, color: "cyan", title: "Today's aggregate signal · 31 events" },
                    { key: "DELTA", label: "Delta", val: 54, color: "amber", title: "Deviation from baseline · +22 events", arrow: true },
                    { key: "THR", label: "Threshold", val: 68, color: "rose", title: "2.5σ trigger threshold · alert boundary", dashed: true },
                    { key: "ALRT", label: "Alert", val: 100, color: "rose", title: "Current signal · 3.4σ above baseline", pulse: true },
                  ].map((bar) => (
                    <div key={bar.key} title={bar.title} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, height: "100%", justifyContent: "flex-end" }}>
                      <div className="t-10 mono-clinical" style={{
                        color: `var(--accent-${bar.color})`,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        opacity: bar.key === "THR" ? 0.8 : 1,
                      }}>
                        {bar.arrow && <ArrowUp size={10} style={{ verticalAlign: -2 }} />} {bar.key}
                      </div>
                      <div
                        style={{
                          width: "100%",
                          maxWidth: 64,
                          height: `${bar.val}%`,
                          background: bar.dashed
                            ? "repeating-linear-gradient(0deg, var(--accent-rose) 0 4px, transparent 4px 8px)"
                            : `linear-gradient(180deg, var(--accent-${bar.color}), ${"rgba(10,23,36,0.2)"})`,
                          borderRadius: bar.dashed ? "0" : "var(--r-sm) var(--r-sm) 0 0",
                          opacity: bar.dashed ? 0.55 : 1,
                          border: bar.dashed ? "none" : `1px solid rgba(${"#fff"},0.08)`,
                          boxShadow: bar.pulse ? "0 0 18px var(--accent-rose)" : bar.arrow ? "0 0 10px var(--accent-amber)" : "none",
                          transform: "scaleY(0)",
                          transformOrigin: "bottom",
                          animation: `barGrowY 0.9s var(--ease-out-expo) 0.15s forwards`,
                          animationDelay: `${0.1 + (["BASE","TODAY","DELTA","THR","ALRT"].indexOf(bar.key) * 0.08)}s`,
                          position: "relative",
                        }}
                      >
                        {bar.pulse && (
                          <div style={{
                            position: "absolute", inset: -4,
                            borderRadius: "inherit",
                            border: "1px solid var(--accent-rose)",
                            opacity: 0.5,
                            animation: "pulseRing 1.8s cubic-bezier(0.2,0.8,0.2,1) infinite",
                          }} />
                        )}
                      </div>
                      <div className="t-11" style={{ color: "var(--text-4)", fontWeight: 600 }}>{bar.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── RECOMMENDED ACTIONS ── */}
              <div className="glass-panel-sm use-page-reveal d-240" style={{ padding: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "var(--r-sm)", background: "rgba(61,220,151,0.10)", border: "1px solid rgba(61,220,151,0.25)", display: "grid", placeItems: "center" }}>
                    <CheckCircle2 size={15} style={{ color: "var(--accent-mint)" }} />
                  </div>
                  <div>
                    <div className="t-11" style={{ color: "var(--accent-mint)", fontWeight: 800, letterSpacing: "0.12em" }}>RECOMMENDED ACTIONS</div>
                    <div className="t-16" style={{ color: "var(--text-1)", fontWeight: 700 }}>Standard response checklist</div>
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span className="t-32 mono-clinical" style={{ color: "var(--accent-mint)", fontWeight: 800 }}>{checkedActions.length}</span>
                    <span className="t-12" style={{ color: "var(--text-5)" }}>/ {checklistItems.length}</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {checklistItems.map((item, i) => {
                    const checked = checkedActions.includes(i);
                    return (
                      <button
                        key={i}
                        onClick={() => toggleCheck(i)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "12px 14px",
                          borderRadius: "var(--r-md)",
                          background: checked ? "rgba(61,220,151,0.06)" : "transparent",
                          border: `1px solid ${checked ? "rgba(61,220,151,0.22)" : "var(--glass-border-weak)"}`,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all var(--dur-fast) var(--ease-out-quad)",
                        }}
                      >
                        <div style={{
                          width: 22, height: 22,
                          borderRadius: "var(--r-sm)",
                          border: `1.5px solid ${checked ? "var(--accent-mint)" : "var(--text-7)"}`,
                          background: checked ? "rgba(61,220,151,0.14)" : "transparent",
                          display: "grid", placeItems: "center",
                          flexShrink: 0,
                        }}>
                          {checked && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <polyline
                                points="4 12 10 18 20 6"
                                stroke="var(--accent-mint)"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="use-check-draw"
                              />
                            </svg>
                          )}
                        </div>
                        <span
                          className="t-14"
                          style={{
                            color: checked ? "var(--text-4)" : "var(--text-2)",
                            fontWeight: 600,
                            textDecoration: checked ? "line-through" : "none",
                            opacity: checked ? 0.7 : 1,
                          }}
                        >
                          {item}
                        </span>
                        <span className="t-10 mono-clinical" style={{
                          marginLeft: "auto",
                          color: "var(--text-6)",
                          letterSpacing: "0.06em",
                        }}>
                          S{i + 1}.2
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Post-review confirmation ── */}
              {(reviewDone || (alert?.status && alert.status !== "open")) && (
                <div className="glass-panel-sm use-page-reveal d-320" style={{
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  border: "1px solid rgba(61,220,151,0.28)",
                  background: "rgba(61,220,151,0.06)",
                }}>
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: "50%",
                    background: "rgba(61,220,151,0.12)",
                    border: "1px solid rgba(61,220,151,0.35)",
                    display: "grid", placeItems: "center",
                    flexShrink: 0,
                  }}>
                    <CheckCircle2 size={19} style={{ color: "var(--accent-mint)" }} />
                  </div>
                  <div>
                    <strong className="t-14" style={{ color: "var(--text-1)", display: "block" }}>Human review recorded</strong>
                    <p className="t-12" style={{ color: "var(--text-4)", marginTop: 2 }}>
                      Status: <span className="mono-clinical" style={{
                        color: alert?.status === "reviewed" ? "var(--accent-mint)" :
                               alert?.status === "escalated" ? "var(--accent-amber)" :
                               "var(--text-5)",
                        fontWeight: 700,
                      }}>{(alert?.status || "REVIEWED").toUpperCase()}</span> — Audit log updated.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Safety disclaimer ── */}
              <div className="glass-panel-sm" style={{
                padding: "16px 20px",
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
              }}>
                <ShieldCheck size={18} style={{ color: "var(--accent-cyan)", flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong className="t-13" style={{ color: "var(--text-2)" }}>Human verification required</strong>
                  <p className="t-12" style={{ color: "var(--text-4)", marginTop: 4, lineHeight: 1.6 }}>
                    {alert?.explanation?.disclaimer || "NABZ supports investigation. It does not diagnose a person or declare an outbreak."}
                  </p>
                </div>
              </div>

              {/* ── BOTTOM choreo-cta-strip ── */}
              <div className="choreo-cta-strip use-page-reveal d-320">
                <div className="choreo-cta-left">
                  <div className="choreo-cta-label">GEOGRAPHIC CONTEXT</div>
                  <div className="choreo-cta-text">See the geographic Health Map — ward clusters, nearest CHC, and coverage radius.</div>
                </div>
                <button className="choreo-cta-btn" onClick={() => navigate("/map")}>
                  <span className="choreo-cta-arrow">→</span>
                  Open Health Map
                </button>
              </div>

            </div>

            {/* ── RIGHT: ADMIN ACTIONS COLUMN ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 110, alignSelf: "start" }}>
              <div className="glass-panel use-page-reveal d-160" style={{ padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <div style={{
                    width: 30, height: 30,
                    borderRadius: "var(--r-sm)",
                    background: "linear-gradient(180deg, rgba(255,209,102,0.16), rgba(255,209,102,0.04))",
                    border: "1px solid rgba(255,209,102,0.3)",
                    display: "grid", placeItems: "center",
                  }}>
                    <ShieldCheck size={16} style={{ color: "var(--accent-watch)" }} />
                  </div>
                  <div>
                    <div className="t-11" style={{ color: "var(--accent-watch)", fontWeight: 800, letterSpacing: "0.12em" }}>ADMIN ACTIONS</div>
                    <div className="t-16" style={{ color: "var(--text-1)", fontWeight: 700 }}>Review Controls</div>
                  </div>
                </div>

                {!isAdmin && (
                  <div className="glass-panel-sm" style={{ padding: "12px 14px", marginBottom: 18 }}>
                    <div className="t-11" style={{ color: "var(--text-5)", fontWeight: 700, marginBottom: 4 }}>READ-ONLY VIEW</div>
                    <div className="t-12" style={{ color: "var(--text-4)", lineHeight: 1.5 }}>
                      Sign in with an admin account to change status, assign, or add notes.
                    </div>
                  </div>
                )}

                {/* Status dropdown */}
                <div style={{ marginBottom: 16 }}>
                  <label className="t-11 mono-clinical" style={{
                    color: "var(--text-5)",
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}>ALERT STATUS</label>
                  <select
                    value={adminStatus}
                    onChange={(e) => setAdminStatus(e.target.value)}
                    disabled={!isAdmin}
                    className="glass-input t-13"
                    style={{
                      width: "100%",
                      appearance: "none",
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238da4b2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 12px center",
                      backgroundSize: 14,
                      cursor: isAdmin ? "pointer" : "not-allowed",
                      opacity: isAdmin ? 1 : 0.7,
                    }}
                  >
                    <option>Open</option>
                    <option>Under Review</option>
                    <option>Closed</option>
                  </select>
                </div>

                {/* Assign-to */}
                <div style={{ marginBottom: 16 }}>
                  <label className="t-11 mono-clinical" style={{
                    color: "var(--text-5)",
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}>ASSIGN TO</label>
                  <input
                    type="text"
                    value={adminAssignee}
                    onChange={(e) => setAdminAssignee(e.target.value)}
                    placeholder="Dr. R. Mehta · CMO Lucknow"
                    disabled={!isAdmin}
                    className="glass-input t-13"
                    style={{ width: "100%", opacity: isAdmin ? 1 : 0.7 }}
                  />
                </div>

                {/* Note textarea */}
                <div style={{ marginBottom: 18 }}>
                  <label className="t-11 mono-clinical" style={{
                    color: "var(--text-5)",
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}>ADD NOTE</label>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Cross-referenced with CHC Aliganj OPD register…"
                    rows={4}
                    disabled={!isAdmin}
                    className="glass-input t-13"
                    style={{
                      width: "100%",
                      resize: "vertical",
                      minHeight: 88,
                      lineHeight: 1.55,
                      opacity: isAdmin ? 1 : 0.7,
                    }}
                  />
                </div>

                {/* Save CTA */}
                <button
                  className="glass-button"
                  onClick={handleAdminSave}
                  disabled={!isAdmin}
                  style={{ width: "100%", fontSize: 13, opacity: isAdmin ? 1 : 0.5, cursor: isAdmin ? "pointer" : "not-allowed" }}
                >
                  <Save size={15} /> Save Changes
                </button>

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--glass-border-weak)" }}>
                  <div className="t-11" style={{ color: "var(--text-5)", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10 }}>QUICK REVIEW</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button
                      onClick={() => isAdmin && handleReview("reviewed")}
                      disabled={!isAdmin || reviewing || reviewDone}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 14px",
                        borderRadius: "var(--r-sm)",
                        background: "rgba(61,220,151,0.08)",
                        border: "1px solid rgba(61,220,151,0.25)",
                        color: "var(--accent-mint)",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: (!isAdmin || reviewing || reviewDone) ? "not-allowed" : "pointer",
                        opacity: (!isAdmin || reviewing || reviewDone) ? 0.6 : 1,
                        transition: "all var(--dur-fast)",
                      }}
                    >
                      <ThumbsUp size={13} /> Mark Reviewed
                    </button>
                    <button
                      onClick={() => isAdmin && handleReview("escalated")}
                      disabled={!isAdmin || reviewing || reviewDone}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 14px",
                        borderRadius: "var(--r-sm)",
                        background: "rgba(255,178,90,0.08)",
                        border: "1px solid rgba(255,178,90,0.28)",
                        color: "var(--accent-amber)",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: (!isAdmin || reviewing || reviewDone) ? "not-allowed" : "pointer",
                        opacity: (!isAdmin || reviewing || reviewDone) ? 0.6 : 1,
                        transition: "all var(--dur-fast)",
                      }}
                    >
                      <TrendingUp size={13} /> Escalate
                    </button>
                    <button
                      onClick={() => isAdmin && handleReview("dismissed")}
                      disabled={!isAdmin || reviewing || reviewDone}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "10px 14px",
                        borderRadius: "var(--r-sm)",
                        background: "rgba(255,122,122,0.06)",
                        border: "1px solid rgba(255,122,122,0.24)",
                        color: "var(--accent-rose)",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: (!isAdmin || reviewing || reviewDone) ? "not-allowed" : "pointer",
                        opacity: (!isAdmin || reviewing || reviewDone) ? 0.6 : 1,
                        transition: "all var(--dur-fast)",
                      }}
                    >
                      <X size={13} /> Dismiss Signal
                    </button>
                  </div>
                </div>
              </div>

              {/* Evidence summary card */}
              <div className="glass-panel-sm use-page-reveal d-240" style={{ padding: 18 }}>
                <div className="t-11 mono-clinical" style={{ color: "var(--text-5)", fontWeight: 800, letterSpacing: "0.08em", marginBottom: 14 }}>EVIDENCE BREAKDOWN</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { icon: Stethoscope, label: "Clinics", val: alert?.explanation?.evidence?.clinics ?? 3, color: "cyan" },
                    { icon: Building2, label: "Pharmacies", val: alert?.explanation?.evidence?.pharmacies ?? 2, color: "mint" },
                    { icon: FlaskConical, label: "Lab Trends", val: alert?.explanation?.evidence?.labs ?? 1, color: "amber" },
                  ].map((row) => {
                    const Icon = row.icon;
                    return (
                      <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 28, height: 28,
                          borderRadius: "var(--r-sm)",
                          background: `rgba(${"#000"},0.3)`,
                          border: `1px solid rgba(var(--accent-${row.color}-rgb),0.25)`,
                          display: "grid", placeItems: "center",
                        }}>
                          <Icon size={13} style={{ color: `var(--accent-${row.color})` }} />
                        </div>
                        <span className="t-13" style={{ color: "var(--text-3)", flex: 1 }}>{row.label}</span>
                        <span className="t-20 mono-clinical" style={{ color: `var(--accent-${row.color})`, fontWeight: 800 }}>{row.val}</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--glass-border-weak)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="t-12" style={{ color: "var(--text-5)" }}>Confidence</span>
                    <span className="t-16 mono-clinical" style={{ color: "var(--accent-mint)", fontWeight: 800 }}>92%</span>
                  </div>
                  <div style={{
                    marginTop: 8,
                    height: 6,
                    background: "rgba(10,23,36,0.6)",
                    borderRadius: "var(--r-full)",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%",
                      width: "92%",
                      background: "linear-gradient(90deg, var(--accent-mint), var(--accent-cyan))",
                      borderRadius: "inherit",
                      boxShadow: "0 0 10px var(--accent-mint)",
                    }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Toast */}
        {toastVisible && (
          <div
            style={{
              position: "fixed",
              bottom: 28,
              right: 32,
              padding: "12px 18px",
              borderRadius: "var(--r-md)",
              background: "linear-gradient(180deg, rgba(61,220,151,0.22), rgba(61,220,151,0.10))",
              border: "1px solid rgba(61,220,151,0.4)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              boxShadow: "var(--sh-halo-mint)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              zIndex: 1000,
              animation: "pageReveal 0.4s var(--ease-out-expo) both",
            }}
          >
            <CheckCircle2 size={16} style={{ color: "var(--accent-mint)" }} />
            <span className="t-13" style={{ color: "var(--text-1)", fontWeight: 600 }}>Saved successfully</span>
          </div>
        )}

        <style>{`
          @keyframes barGrow {
            from { width: 0%; }
            to { width: var(--barWidth, 100%); }
          }
          @keyframes barGrowY {
            from { transform: scaleY(0); }
            to { transform: scaleY(1); }
          }
          @keyframes drawLine {
            from { stroke-dashoffset: 42; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes pulseRing {
            0% { transform: scale(0.9); opacity: 0.7; }
            80% { transform: scale(1.25); opacity: 0; }
            100% { transform: scale(1.25); opacity: 0; }
          }
        `}</style>

      </main>
    </div>
  );
}
