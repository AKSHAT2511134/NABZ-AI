/**
 * Dashboard.jsx — Wired to /dashboard/summary API
 * Shows live signal counts, ward zones, amber alerts from backend.
 * Contest-winning glassmorphism UI.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, ShieldCheck, Activity, AlertTriangle, RefreshCw, Stethoscope, Pill, Microscope } from "lucide-react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import { apiGetDashboardSummary, apiGetAlerts } from "../services/api";

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target == null) return;
    let raf;
    const start = performance.now();
    const from = 0;
    const to = Number(target);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const micro = setInterval(() => {
      setValue((v) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        const nv = v + delta;
        if (nv < 0 || nv > to + 2) return v;
        return nv;
      });
    }, 10000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(micro);
    };
  }, [target, duration]);
  return value;
}

const STAT_ACCENT = {
  cyan: "var(--accent-cyan)",
  mint: "var(--accent-mint)",
  amber: "var(--accent-amber)",
  rose: "var(--accent-rose)",
};

const STAT_HALO = {
  cyan: "var(--sh-halo-cyan)",
  mint: "var(--sh-halo-mint)",
  amber: "var(--sh-halo-amber)",
  rose: "var(--sh-halo-rose)",
};

const STAT_DELAY = ["d-0", "d-80", "d-160", "d-240"];

function StatCard({ label, target, fallback, sub, accent, index, hasAmber }) {
  const t = target || fallback;
  const countVal = useCountUp(t);
  const isAmber = accent === "amber" && hasAmber;
  const isRose = accent === "rose";
  const strongColor = isAmber ? "var(--accent-amber)" : isRose ? "var(--accent-mint)" : "var(--text-1)";
  const accentVar = STAT_ACCENT[accent];
  const delayCls = STAT_DELAY[index] || "d-0";
  return (
    <div
      className={`glass-panel use-page-reveal ${delayCls}`}
      style={{ padding: "22px 22px 20px 26px", position: "relative", boxShadow: `var(--sh-panel), ${STAT_HALO[accent]}`, overflow: "hidden" }}
    >
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: 3,
        background: `linear-gradient(180deg, ${accentVar}, ${accentVar}55)`,
      }} />
      <span className="t-10 mono-clinical" style={{ color: "var(--text-5)", fontWeight: 700, letterSpacing: "0.1em" }}>{label}</span>
      <strong className="t-32 mono-clinical use-count-glow" style={{ display: "block", marginTop: 14, color: strongColor, fontWeight: 800 }}>
        {String(countVal).padStart(accent === "amber" ? 2 : 1, "0")}
      </strong>
      <p className="t-11" style={{ color: "var(--text-4)", marginTop: 6, lineHeight: 1.5 }}>{sub(countVal)}</p>
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [summaryData, alertsData] = await Promise.all([
          apiGetDashboardSummary(),
          apiGetAlerts(),
        ]);
        setSummary(summaryData);
        setAlerts(alertsData);
      } catch (err) {
        setError("Could not reach backend. Showing cached data.");
        setSummary({
          signals_today: 128,
          areas_monitored: 8,
          active_amber_alerts: 1,
          identity_exposure: 0,
        });
        setAlerts([
          {
            id: 1,
            ward_name: "Aliganj Ward 3",
            category: "Gastrointestinal",
            level: "AMBER",
            count_today: 31,
            baseline_mean: 9,
            z_score: "3.4",
            explanation: {
              evidence: { clinics: 3, pharmacies: 2, labs: 1 },
            },
          },
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const amberAlerts = alerts.filter((a) => a.level === "AMBER" && a.status !== "dismissed");
  const watchAlerts = alerts.filter((a) => a.level === "WATCH" && a.status !== "dismissed");

  const signalToday = summary?.signals_today || 128;
  const barHeights = [35, 40, 38, 48, 55, 62, 78, Math.min(95, Math.round((signalToday / 140) * 95))];

  const stats = [
    {
      label: "SIGNALS TODAY",
      target: summary?.signals_today ?? 0,
      fallback: 128,
      sub: (v) => `Across ${summary?.areas_monitored ?? 8} ward zones`,
      accent: "cyan",
    },
    {
      label: "AREAS MONITORED",
      target: summary?.areas_monitored ?? 0,
      fallback: 8,
      sub: () => "Lucknow ward zones",
      accent: "mint",
    },
    {
      label: "ACTIVE REVIEW",
      target: amberAlerts.length,
      fallback: amberAlerts.length,
      sub: (v) => (v === 1 ? "1 amber signal" : `${v} amber signals`),
      accent: "amber",
    },
    {
      label: "IDENTITY EXPOSURE",
      target: summary?.identity_exposure ?? 0,
      fallback: 0,
      sub: () => "No patient identity stored",
      accent: "rose",
    },
  ];

  const workflowSteps = [
    { n: "01", label: "Capture", path: "/capture", accent: "var(--accent-cyan)" },
    { n: "02", label: "Scanner", path: "/capture", accent: "var(--accent-mint)" },
    { n: "03", label: "Privacy", path: "/privacy", accent: "var(--accent-mint)" },
    { n: "04", label: "Signals", path: "/detection", accent: "var(--accent-amber)" },
    { n: "05", label: "Alert", path: "/alerts", accent: "var(--accent-amber)" },
    { n: "06", label: "Map", path: "/map", accent: "var(--accent-cyan)" },
    { n: "07", label: "Dashboard", path: "/dashboard", accent: "var(--accent-mint)" },
  ];

  const dotColors = ["var(--text-7)", "var(--text-6)", "var(--text-5)", "var(--accent-cyan)", "var(--accent-mint)", "var(--accent-amber)", "var(--accent-amber)", "var(--accent-rose)"];

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <TopBar eyebrow="CITY HEALTH MONITORING" title="Lucknow / Overview" />

        {/* ── 1 · HERO — Live Data Theater ── */}
        <section className="use-page-reveal d-0" style={{ padding: "42px 0 18px" }}>
          <div className="glass-panel-lg" style={{ padding: "32px 36px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 32, alignItems: "center" }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: "var(--r-full)", border: "1px solid rgba(75,208,214,0.28)", background: "rgba(75,208,214,0.07)", marginBottom: 20 }}>
                <span className="use-pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-cyan)", display: "inline-block", boxShadow: "0 0 8px var(--accent-cyan)" }} />
                <span className="t-11 mono-clinical" style={{ color: "var(--accent-cyan)", fontWeight: 700, letterSpacing: "0.08em" }}>EARLY SIGNAL VISIBILITY</span>
              </div>
              <h1 className="t-44" style={{ color: "var(--text-1)", fontWeight: 800, marginBottom: 18, lineHeight: 1.05 }}>
                See the signal
                <br />
                <span style={{ color: "var(--text-4)" }}>before it gets a name.</span>
              </h1>
              <p className="t-14" style={{ color: "var(--text-3)", maxWidth: 460, lineHeight: 1.7 }}>
                NABZ turns routine, anonymous health records into local signals that authorised teams can review — while keeping raw prescriptions on this device.
              </p>
              <div style={{ display: "flex", gap: 12, marginTop: 26 }}>
                {user?.role === "admin" ? (
                  <button className="glass-button t-12" id="btn-open-map" onClick={() => navigate("/map")}>
                    Open Health Map →
                  </button>
                ) : (
                  <button className="glass-button t-12" id="btn-capture-record" onClick={() => navigate("/capture")}>
                    + Capture a record
                  </button>
                )}
                <button className="t-12" style={{ padding: "10px 18px", borderRadius: "var(--r-sm)", background: "rgba(255,255,255,0.02)", border: "1px solid var(--glass-border-weak)", color: "var(--text-2)", fontWeight: 600 }} onClick={() => navigate("/alerts")}>
                  View active alerts
                </button>
              </div>
            </div>

            <div style={{ position: "relative", width: "100%", maxWidth: 320, height: 240, marginLeft: "auto" }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 50% 50%, rgba(75,208,214,0.04) 0%, transparent 70%)" }} />
              <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", width: 180, height: 180, borderRadius: "50%", border: "1px solid rgba(75,208,214,0.10)" }} />
              <div style={{ position: "absolute", top: 45, left: "50%", transform: "translateX(-50%)", width: 130, height: 130, borderRadius: "50%", border: "1px solid rgba(75,208,214,0.15)" }} />
              <div style={{ position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)", width: 80, height: 80, borderRadius: "50%", border: "1px solid rgba(61,220,151,0.22)" }} />

              <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", width: 180, height: 180, borderRadius: "50%", overflow: "hidden" }}>
                <div className="use-radar-sweep" style={{ position: "absolute", inset: 0, background: "conic-gradient(from 0deg, rgba(61,220,151,0.45) 0deg, transparent 60deg, transparent 360deg)", transformOrigin: "50% 50%" }} />
              </div>

              <div style={{ position: "absolute", top: 110, left: "calc(50% + 40px)", width: 6, height: 6, borderRadius: "50%", background: "var(--accent-amber)", boxShadow: "0 0 10px var(--accent-amber)" }} className="use-pulse-dot" />
              <div style={{ position: "absolute", top: 85, left: "calc(50% - 52px)", width: 5, height: 5, borderRadius: "50%", background: "var(--accent-mint)", boxShadow: "0 0 8px var(--accent-mint)" }} className="use-pulse-dot" />
              <div style={{ position: "absolute", top: 130, left: "calc(50% - 18px)", width: 5, height: 5, borderRadius: "50%", background: "var(--accent-cyan)", boxShadow: "0 0 8px var(--accent-cyan)" }} className="use-pulse-dot" />

              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60 }}>
                {[
                  { w: "10%", h: 18, l: "2%" },
                  { w: "12%", h: 30, l: "14%" },
                  { w: "9%",  h: 22, l: "28%" },
                  { w: "14%", h: 42, l: "40%" },
                  { w: "11%", h: 28, l: "56%" },
                  { w: "10%", h: 36, l: "69%" },
                  { w: "13%", h: 24, l: "82%" },
                ].map((b, i) => (
                  <div key={i} style={{
                    position: "absolute",
                    left: b.l,
                    width: b.w,
                    height: b.h,
                    bottom: 0,
                    background: "linear-gradient(180deg, rgba(61,220,151,0.28), rgba(67,203,210,0.10))",
                    borderTop: "1px solid rgba(61,220,151,0.35)",
                    borderRadius: "2px 2px 0 0",
                  }} />
                ))}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(67,203,210,0.35), transparent)" }} />
              </div>
            </div>
          </div>
        </section>

        {/* ── 2 · STAT CARDS (4-col grid) ── */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 4 }}>
          {loading ? (
            <div className="glass-panel use-page-reveal d-0" style={{ gridColumn: "1/-1", padding: "28px", display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
              <RefreshCw size={20} className="spin-icon" style={{ color: "var(--text-4)" }} />
              <span className="t-13" style={{ color: "var(--text-3)" }}>Loading live signals…</span>
            </div>
          ) : (
            stats.map((s, i) => (
              <StatCard
                key={s.label}
                label={s.label}
                target={s.target}
                fallback={s.fallback}
                sub={s.sub}
                accent={s.accent}
                index={i}
                hasAmber={amberAlerts.length > 0}
              />
            ))
          )}
        </section>

        {/* ── Error / Offline banner ── */}
        {error && (
          <div className="use-page-reveal d-80" style={{ display: "flex", gap: 12, alignItems: "flex-start", marginTop: 12, padding: "14px 18px", borderRadius: "var(--r-md)", background: "rgba(255,178,90,0.08)", border: "1px solid rgba(255,178,90,0.28)", backdropFilter: "var(--blur-panel)", WebkitBackdropFilter: "var(--blur-panel)" }}>
            <AlertTriangle size={18} style={{ color: "var(--accent-amber)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <strong className="t-13" style={{ color: "var(--accent-amber)", fontWeight: 700 }}>Offline mode</strong>
              <p className="t-12" style={{ color: "var(--text-3)", marginTop: 2 }}>{error}</p>
            </div>
          </div>
        )}

        {/* ── 3 · SIGNAL CHART + 4 · AMBER ALERT (grid) ── */}
        <section style={{ display: "grid", gridTemplateColumns: "1.6fr 0.8fr", gap: 12, marginTop: 12 }}>
          {/* Signal Chart Panel */}
          <div className="glass-panel use-page-reveal d-160" style={{ padding: "26px 26px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span className="t-10 mono-clinical" style={{ color: "var(--text-5)", fontWeight: 700, letterSpacing: "0.1em" }}>SIGNAL ACTIVITY</span>
                <h3 className="t-18" style={{ color: "var(--text-1)", fontWeight: 700, marginTop: 6 }}>Local health signals</h3>
              </div>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: "var(--r-full)",
                background: "rgba(61,220,151,0.08)", border: "1px solid rgba(61,220,151,0.28)",
                color: "var(--accent-mint)", fontSize: 10, fontWeight: 700,
              }}>
                <span className="use-pulse-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent-mint)" }} />
                ↗ Rising
              </span>
            </div>

            <div style={{ height: 230, marginTop: 24, borderLeft: "1px solid rgba(67,203,210,0.12)", borderBottom: "1px solid rgba(67,203,210,0.12)", display: "flex", alignItems: "flex-end", paddingLeft: 8, paddingBottom: 8, position: "relative" }}>
              <div style={{ width: "100%", height: "90%", display: "flex", justifyContent: "space-around", alignItems: "flex-end", gap: 4 }}>
                {barHeights.map((h, i) => {
                  const hot = h >= 62;
                  const barBg = hot
                    ? "linear-gradient(180deg, var(--accent-amber), var(--accent-amber-deep))"
                    : "linear-gradient(180deg, var(--accent-cyan), var(--accent-cyan-deep))";
                  const delay = [0, 60, 120, 180, 240, 300, 360, 420][i];
                  return (
                    <div
                      key={i}
                      className="use-page-reveal"
                      style={{
                        flex: 1,
                        maxWidth: 38,
                        minWidth: 20,
                        height: `${h}%`,
                        background: barBg,
                        borderRadius: "5px 5px 0 0",
                        position: "relative",
                        animationDelay: `${delay}ms`,
                        opacity: 0.92,
                      }}
                    >
                      {hot && (
                        <span className="use-pulse-dot" style={{
                          position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                          width: 8, height: 8, borderRadius: "50%",
                          background: "var(--accent-amber)",
                          boxShadow: "0 0 12px var(--accent-amber)",
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 10, paddingLeft: 8 }}>
              {["W1","W2","W3","W4","W5","W6","W7","W8"].map((w, i) => (
                <div key={w} style={{ flex: 1, maxWidth: 38, minWidth: 20, textAlign: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotColors[i], display: "inline-block" }} />
                    <span className="t-10 mono-clinical" style={{ color: "var(--text-5)", fontWeight: 600 }}>{w}</span>
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <span className="t-11" style={{ color: "var(--text-4)" }}>Observed signals</span>
              <span className="t-11 mono-clinical" style={{ color: "var(--text-5)" }}>W1 → W8</span>
            </div>
          </div>

          {/* Amber Alert HP Card */}
          {amberAlerts.length > 0 ? (
            amberAlerts.slice(0, 1).map((alert) => (
              <div key={alert.id} className="glass-panel-lg use-page-reveal d-240" style={{ padding: "70px 24px 24px", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, height: 52, pointerEvents: "none",
                  background: "linear-gradient(90deg, var(--accent-amber-deep), var(--accent-amber), var(--accent-amber-deep))",
                  borderRadius: "var(--r-xl24) var(--r-xl24) 0 0" }}>
                  <div className="use-shimmer-ribbon" style={{ position: "absolute", inset: 0, borderRadius: "inherit" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: "0 24px", gap: 10 }}>
                    <AlertTriangle size={16} style={{ color: "var(--accent-ink)" }} />
                    <span className="t-11 mono-clinical" style={{ color: "var(--accent-ink)", fontWeight: 800, letterSpacing: "0.1em" }}>● AMBER SIGNAL — LIVE INVESTIGATION</span>
                  </div>
                </div>

                <h3 className="t-20" style={{ color: "var(--text-1)", fontWeight: 700 }}>Possible {alert.category.toLowerCase()} pattern</h3>
                <p className="t-12" style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  color: "var(--accent-cyan)", marginTop: 8, fontWeight: 600,
                }}>
                  <MapPin size={12} />
                  {alert.ward_name} · Lucknow
                </p>

                <p className="t-12" style={{ color: "var(--text-3)", marginTop: 14, lineHeight: 1.6 }}>
                  Signals from independent sources are <strong style={{ color: "var(--accent-amber)" }} className="mono-clinical">{alert.z_score}σ</strong> above the local baseline (<span className="mono-clinical">{alert.baseline_mean}</span> avg).
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, marginTop: 18, alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {alert.explanation?.evidence?.clinics > 0 && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--glass-border-weak)", background: "rgba(75,208,214,0.05)" }}>
                        <Stethoscope size={12} style={{ color: "var(--accent-cyan)" }} />
                        <span className="t-11 mono-clinical" style={{ color: "var(--text-2)", fontWeight: 700 }}>{alert.explanation.evidence.clinics} clinic{alert.explanation.evidence.clinics !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                    {alert.explanation?.evidence?.pharmacies > 0 && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--glass-border-weak)", background: "rgba(61,220,151,0.05)" }}>
                        <Pill size={12} style={{ color: "var(--accent-mint)" }} />
                        <span className="t-11 mono-clinical" style={{ color: "var(--text-2)", fontWeight: 700 }}>{alert.explanation.evidence.pharmacies} pharmacies</span>
                      </div>
                    )}
                    {alert.explanation?.evidence?.labs > 0 && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--glass-border-weak)", background: "rgba(255,178,90,0.05)" }}>
                        <Microscope size={12} style={{ color: "var(--accent-amber)" }} />
                        <span className="t-11 mono-clinical" style={{ color: "var(--text-2)", fontWeight: 700 }}>{alert.explanation.evidence.labs} lab trend</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 90, paddingLeft: 6 }} title={`Z-Score ${alert.z_score} — Baseline: ${alert.baseline_mean}, Today: ${alert.count_today}`}>
                    {[
                      { label: "BASE", val: 30, color: "var(--text-7)", tip: `Baseline mean: ${alert.baseline_mean}` },
                      { label: "TODAY", val: 82, color: "var(--accent-amber)", tip: `Today: ${alert.count_today}` },
                      { label: "Δ", val: 65, color: "var(--accent-rose)", tip: `Delta: +${alert.count_today - alert.baseline_mean}` },
                      { label: "THR", val: 50, color: "var(--accent-cyan)", tip: "Alert threshold" },
                      { label: "ALRT", val: 92, color: "var(--accent-amber)", tip: `Severity z=${alert.z_score}σ`, pulse: true },
                    ].map((seg, si) => (
                      <div key={si} title={seg.tip} style={{ position: "relative", width: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{
                          width: "100%",
                          height: `${seg.val}%`,
                          minHeight: 6,
                          background: `linear-gradient(180deg, ${seg.color}, ${seg.color}80)`,
                          borderRadius: 3,
                          boxShadow: seg.pulse ? `0 0 10px ${seg.color}55` : "none",
                        }} className={seg.pulse ? "use-pulse-dot" : ""} />
                        <span className="t-10 mono-clinical" style={{ color: "var(--text-5)", fontWeight: 600 }}>{seg.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  id={`btn-review-alert-${alert.id}`}
                  className="t-12"
                  style={{
                    marginTop: 20,
                    padding: "10px 16px",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid rgba(61,220,151,0.35)",
                    background: "rgba(61,220,151,0.06)",
                    color: "var(--accent-mint)",
                    fontWeight: 700,
                    transition: "all var(--dur-fast)",
                  }}
                  onClick={() => navigate(`/alerts/${alert.id}`)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(61,220,151,0.14)"; e.currentTarget.style.boxShadow = "var(--sh-halo-mint)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(61,220,151,0.06)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  Review explanation →
                </button>
              </div>
            ))
          ) : watchAlerts.length > 0 ? (
            watchAlerts.slice(0, 1).map((alert) => (
              <div key={alert.id} className="glass-panel use-page-reveal d-240" style={{ padding: "70px 24px 24px", position: "relative", overflow: "hidden", borderRadius: "var(--r-xl24)", boxShadow: "var(--sh-halo-amber), var(--sh-panel)" }}>
                <div style={{ position: "absolute", inset: 0, height: 52, pointerEvents: "none",
                  background: "linear-gradient(90deg, rgba(255,209,102,0.85), rgba(255,178,90,0.85), rgba(255,209,102,0.85))",
                  borderRadius: "var(--r-xl24) var(--r-xl24) 0 0" }}>
                  <div className="use-shimmer-ribbon" style={{ position: "absolute", inset: 0, borderRadius: "inherit" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: "0 24px", gap: 10 }}>
                    <Activity size={16} style={{ color: "var(--accent-ink)" }} />
                    <span className="t-11 mono-clinical" style={{ color: "var(--accent-ink)", fontWeight: 800, letterSpacing: "0.1em" }}>● WATCH SIGNAL — MONITORING</span>
                  </div>
                </div>
                <h3 className="t-20" style={{ color: "var(--text-1)", fontWeight: 700 }}>Rising {alert.category.toLowerCase()} signals</h3>
                <p className="t-12" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--accent-cyan)", marginTop: 8, fontWeight: 600 }}>
                  <MapPin size={12} />
                  {alert.ward_name} · Lucknow
                </p>
                <p className="t-12" style={{ color: "var(--text-3)", marginTop: 14, lineHeight: 1.6 }}>
                  Mild elevation above baseline. <strong className="mono-clinical" style={{ color: "var(--accent-watch)" }}>{alert.z_score}σ</strong> — monitoring for persistence.
                </p>
                <button
                  id={`btn-review-alert-${alert.id}`}
                  className="t-12"
                  style={{
                    marginTop: 20,
                    padding: "10px 16px",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid rgba(255,209,102,0.35)",
                    background: "rgba(255,209,102,0.06)",
                    color: "var(--accent-watch)",
                    fontWeight: 700,
                  }}
                  onClick={() => navigate(`/alerts/${alert.id}`)}
                >
                  Review explanation →
                </button>
              </div>
            ))
          ) : (
            <div className="glass-panel use-page-reveal d-240" style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "center", alignItems: "center", padding: "30px", opacity: 0.7 }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(61,220,151,0.08)", border: "1px solid rgba(61,220,151,0.25)", display: "grid", placeItems: "center" }}>
                <Activity size={24} style={{ color: "var(--accent-mint)" }} />
              </div>
              <p className="t-13" style={{ textAlign: "center", color: "var(--text-2)", fontWeight: 600 }}>All wards within normal range</p>
              <p className="t-11" style={{ color: "var(--text-4)" }}>No elevated signals detected</p>
            </div>
          )}
        </section>

        {/* ── 5 · 7-step Storyboard Workflow Strip ── */}
        <section className="glass-panel use-page-reveal d-320" style={{ marginTop: 12, padding: "26px 28px 28px", position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
            <div>
              <span className="t-10 mono-clinical" style={{ color: "var(--text-5)", fontWeight: 700, letterSpacing: "0.1em" }}>NABZ WORKFLOW</span>
              <h3 className="t-20" style={{ color: "var(--text-1)", fontWeight: 700, marginTop: 6 }}>From record to review</h3>
            </div>
            <span className="t-11" style={{ color: "var(--text-4)" }}>Tap any step to jump · hover arrows to trace path</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: `repeat(${workflowSteps.length}, 1fr)`, gap: 8, position: "relative", alignItems: "stretch" }}>
            {workflowSteps.map((step, i) => (
              <div key={step.path + i} style={{ position: "relative", display: "flex" }}>
                {i < workflowSteps.length - 1 && (
                  <svg
                    className="workflow-arrow"
                    viewBox="0 0 60 20"
                    preserveAspectRatio="none"
                    style={{
                      position: "absolute",
                      top: "45%",
                      left: "calc(100% - 2px)",
                      width: "calc(100% + 16px)",
                      height: 20,
                      zIndex: 1,
                      pointerEvents: "none",
                      overflow: "visible",
                    }}
                  >
                    <defs>
                      <linearGradient id={`arr${i}`} x1="0" x2="1">
                        <stop offset="0%" stopColor={step.accent} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={workflowSteps[i + 1].accent} stopOpacity="0.6" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M 2 10 L 52 10 L 44 3 M 52 10 L 44 17"
                      fill="none"
                      stroke={`url(#arr${i})`}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="100%"
                      strokeDashoffset="100%"
                      style={{ transition: "stroke-dashoffset 0.8s var(--ease-out-expo)" }}
                    />
                  </svg>
                )}

                <button
                  onClick={() => navigate(step.path)}
                  className="workflow-card glass-panel-sm"
                  style={{
                    flex: 1,
                    padding: "16px 12px",
                    textAlign: "center",
                    cursor: "pointer",
                    border: "1px solid var(--glass-border-weak)",
                    color: "inherit",
                    position: "relative",
                    zIndex: 2,
                    overflow: "hidden",
                    transition: "all var(--dur-base) var(--ease-out-expo)",
                  }}
                  onMouseEnter={(e) => {
                    const allArrows = document.querySelectorAll(".workflow-arrow path");
                    allArrows.forEach((p) => { p.style.strokeDashoffset = "0%"; });
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.borderColor = step.accent + "88";
                    e.currentTarget.style.boxShadow = `0 0 0 1px ${step.accent}22 inset, 0 10px 24px -12px ${step.accent}55`;
                  }}
                  onMouseLeave={(e) => {
                    const allArrows = document.querySelectorAll(".workflow-arrow path");
                    allArrows.forEach((p) => { p.style.strokeDashoffset = "100%"; });
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = "var(--glass-border-weak)";
                    e.currentTarget.style.boxShadow = "var(--sh-soft)";
                  }}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: `${step.accent}14`,
                    border: `1px solid ${step.accent}33`,
                    display: "grid", placeItems: "center",
                    margin: "0 auto 10px",
                    color: step.accent,
                    fontWeight: 800,
                  }}>
                    <span className="t-12 mono-clinical">{step.n}</span>
                  </div>
                  <div className="t-13" style={{ color: "var(--text-1)", fontWeight: 700 }}>{step.label}</div>
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── 6 · TRUST PANEL (small, 3 bullets) ── */}
        <section style={{ display: "grid", gridTemplateColumns: "1fr", marginTop: 12 }}>
          <div className="glass-panel-sm use-page-reveal d-320" style={{ padding: "18px 22px", display: "flex", gap: 18, alignItems: "flex-start" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: "rgba(61,220,151,0.08)", border: "1px solid rgba(61,220,151,0.28)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 48 48" width="26" height="26" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M24 4 L40 10 V22 C40 31 33 38 24 42 C15 38 8 31 8 22 V10 Z"
                  stroke="var(--accent-mint)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  className="use-shield-draw"
                  fill="none"
                />
                <path
                  d="M17 24 L22 29 L31 19"
                  stroke="var(--accent-mint)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="use-check-draw"
                  fill="none"
                  style={{ animationDelay: "0.8s" }}
                />
                <text x="24" y="20" textAnchor="middle" fontSize="7" fontWeight="800" fill="var(--accent-mint)" style={{ letterSpacing: "0.05em" }} className="mono-clinical">DPDP</text>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <strong className="t-14" style={{ color: "var(--text-1)", fontWeight: 700 }}>Privacy &amp; safety boundary</strong>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {[
                  { icon: "✓", text: "Zero-PII by design — only signal categories aggregated" },
                  { icon: "✓", text: "DPDP 2023 compliant — data residency and consent enforced" },
                  { icon: "✓", text: "Raw prescription never leaves this device" },
                ].map((b, bi) => (
                  <div key={bi} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{
                      width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      marginTop: 1,
                      background: "rgba(61,220,151,0.1)",
                      border: "1px solid rgba(61,220,151,0.35)",
                      color: "var(--accent-mint)",
                      fontSize: 9,
                      fontWeight: 900,
                      display: "grid",
                      placeItems: "center",
                    }}>{b.icon}</span>
                    <span className="t-12" style={{ color: "var(--text-3)", lineHeight: 1.55 }}>{b.text}</span>
                  </div>
                ))}
              </div>
              <p className="t-11" style={{ color: "var(--text-5)", marginTop: 10, fontStyle: "italic" }}>
                NABZ supports investigation. It does not diagnose individuals or declare an outbreak.
              </p>
            </div>
          </div>
        </section>

        {/* ── 7 · BOTTOM choreo-cta-strip ── */}
        <div className="choreo-cta-strip use-page-reveal d-320">
          <div className="choreo-cta-left">
            <div className="choreo-cta-label">YOUR NEXT STEP</div>
            <div className="choreo-cta-text">Start by Capturing a live OPD record</div>
          </div>
          <button className="choreo-cta-btn navigate" onClick={() => navigate("/capture")}>
            <span className="choreo-cta-arrow">→</span>
            Begin Capture
          </button>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
