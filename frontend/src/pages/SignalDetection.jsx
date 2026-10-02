import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, AlertTriangle } from "lucide-react";
import Sidebar from "../components/Sidebar";
import { apiGetWardSignals, apiGetAlerts } from "../services/api";

const TICKER_STRINGS = [
  "\u26A0 ALIGANJ \u00B7 Gastro signals rising 3.4\u03C3 above baseline \u00B7 10:42 IST",
  "\u26A0 CHINHAT \u00B7 Febrile viral cluster detected 2.1\u03C3 \u00B7 10:44 IST",
  "\u25CF GOMTI NAGAR \u00B7 Within normal baseline 0.2\u03C3 \u00B7 10:45 IST",
  "\u26A0 ALAMBAGH \u00B7 Respiratory patterns elevated 2.4\u03C3 \u00B7 10:46 IST",
];

const WARD_NAMES = ["Aliganj", "Chinhat", "Gomti Nagar", "Indira Nagar", "Hazratganj", "Alambagh", "Mahanagar", "Aashiyana"];
const SYNDROMES = ["Gastrointestinal", "Febrile / Viral", "Respiratory", "Dermatological", "Ocular", "Cardiovascular", "Renal", "Neurological"];

function makeSpark7(seed) {
  const arr = [];
  let v = 0.15 + (seed * 0.07) % 0.3;
  for (let i = 0; i < 7; i++) {
    v += ((i + seed) * 13) % 17 / 100 - 0.08;
    v = Math.max(0.08, Math.min(0.95, v));
    arr.push(v);
  }
  return arr;
}

function statusFromZ(z, watchZ, alertZ) {
  if (z >= alertZ) return "RED";
  if (z >= watchZ) return "AMBER";
  return "GREEN";
}

function SignalDetection() {
  const navigate = useNavigate();
  const [wards, setWards] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [watchZ, setWatchZ] = useState(1.5);
  const [alertZ, setAlertZ] = useState(2.5);
  const [tickerIdx, setTickerIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTickerIdx((i) => (i + 1) % TICKER_STRINGS.length), 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [wardData, alertData] = await Promise.all([
          apiGetWardSignals(),
          apiGetAlerts(),
        ]);
        let enriched = (wardData || []).map((w, i) => ({
          ...w,
          z_num: parseFloat(w.z_score || 0),
          spark1: makeSpark7((i + 1) * 3),
          spark2: makeSpark7((i + 1) * 5 + 2),
          spark3: makeSpark7((i + 1) * 7 + 4),
        }));
        if (enriched.length < 8) {
          const fallbacks = WARD_NAMES.map((name, i) => {
            const zArr = [3.4, 2.1, 0.2, 1.8, 0.4, 2.4, 1.1, 0.7];
            const z = zArr[i];
            const status = z >= alertZ ? "AMBER" : z >= watchZ ? "WATCH" : "NORMAL";
            return {
              id: "w-" + name.toLowerCase().replace(/\s+/g, "-"),
              name: name,
              status: status,
              category: SYNDROMES[i % SYNDROMES.length],
              count: Math.round(4 + z * 8),
              baseline: Math.round(5 + (i % 5)),
              z_score: String(z),
              z_num: z,
              sources: { clinics: (i % 4), pharmacies: (i % 3), labs: (i % 2) },
              alert_id: z >= watchZ ? i + 1 : null,
              spark1: makeSpark7((i + 1) * 3),
              spark2: makeSpark7((i + 1) * 5 + 2),
              spark3: makeSpark7((i + 1) * 7 + 4),
            };
          });
          enriched = [...enriched];
          for (let i = enriched.length; i < 8; i++) {
            enriched.push(fallbacks[i]);
          }
        }
        setWards(enriched);
        setAlerts(alertData || []);
      } catch (err) {
        setError("Backend unavailable \u2014 showing synthetic demo data.");
        const fallbackWards = WARD_NAMES.map((name, i) => {
          const zArr = [3.4, 2.1, 0.2, 1.8, 0.4, 2.4, 1.1, 0.7];
          const z = zArr[i];
          const status = z >= alertZ ? "AMBER" : z >= watchZ ? "WATCH" : "NORMAL";
          return {
            id: "w-" + name.toLowerCase().replace(/\s+/g, "-"),
            name: name,
            status: status,
            category: SYNDROMES[i % SYNDROMES.length],
            count: Math.round(4 + z * 8),
            baseline: Math.round(5 + (i % 5)),
            z_score: String(z),
            z_num: z,
            sources: { clinics: (i % 4), pharmacies: (i % 3), labs: (i % 2) },
            alert_id: z >= watchZ ? i + 1 : null,
            spark1: makeSpark7((i + 1) * 3),
            spark2: makeSpark7((i + 1) * 5 + 2),
            spark3: makeSpark7((i + 1) * 7 + 4),
          };
        });
        setWards(fallbackWards);
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const wardsWithStatus = useMemo(() => {
    return wards.map((w) => ({
      ...w,
      tileStatus: statusFromZ(w.z_num ?? parseFloat(w.z_score || 0), watchZ, alertZ),
    }));
  }, [wards, watchZ, alertZ]);

  const rankedSignals = useMemo(() => {
    return [...wardsWithStatus]
      .sort((a, b) => (b.z_num ?? 0) - (a.z_num ?? 0))
      .slice(0, 4);
  }, [wardsWithStatus]);

  const baselineStats = useMemo(() => {
    const zs = wardsWithStatus.map((w) => w.z_num ?? 0);
    const avg = zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : 0;
    const aboveWatch = zs.filter((z) => z >= watchZ).length;
    const peaks = zs.length ? Math.max(...zs) : 0;
    return { avg, aboveWatch, peaks, total: zs.length };
  }, [wardsWithStatus, watchZ]);

  const SparkBar = ({ data, accent }) => (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: "22px" }}>
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            minWidth: "3px",
            height: `${Math.round(v * 100)}%`,
            borderRadius: "2px 2px 0 0",
            background: `linear-gradient(180deg, var(${accent}), var(${accent}-deep) 80%)`,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );

  const StatusDot = ({ status, pulse }) => {
    const color =
      status === "RED" ? "var(--accent-rose)" :
      status === "AMBER" ? "var(--accent-amber)" :
      "var(--accent-mint)";
    return (
      <span
        className={pulse ? "use-pulse-dot" : ""}
        style={{
          display: "inline-block",
          width: "9px",
          height: "9px",
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 8px ${color}`,
          flexShrink: 0,
        }}
      />
    );
  };

  const tileDotColor = (s) =>
    s === "RED" ? "var(--accent-rose)" :
    s === "AMBER" ? "var(--accent-amber)" :
    "var(--accent-mint)";

  const tileOverlayColor = (s) =>
    s === "RED" ? "rgba(255,122,122,0.18)" :
    s === "AMBER" ? "rgba(255,178,90,0.14)" :
    "rgba(61,220,151,0.06)";

  return (
    <div className="app">
      <Sidebar />
      <main className="main">

        <div className="page-header">
          <small>03 / DETECTION</small>
          <h1>Signal Detection</h1>
          <p>NABZ checks whether anonymous signals are unusual for their locality.</p>
        </div>

        {error && (
          <div className="glass-panel use-page-reveal d-0" style={{ padding: "14px 18px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
            <AlertTriangle size={15} style={{ color: "var(--accent-amber)" }} />
            <div style={{ color: "var(--accent-amber)" }} className="t-12">{error}</div>
          </div>
        )}

        <div className="glass-panel use-page-reveal d-0" style={{ width: "100%", padding: "12px 22px", marginBottom: "18px", overflow: "hidden", whiteSpace: "nowrap" }}>
          <div
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              color: "var(--text-2)",
              fontFamily: "var(--mono-clinical)",
              fontWeight: 600,
              letterSpacing: "0.02em",
              transition: "opacity 400ms ease",
            }}
            className="mono-clinical t-13"
          >
            <span key={tickerIdx}>{TICKER_STRINGS[tickerIdx]}</span>
          </div>
        </div>

        {loading ? (
          <div className="glass-panel use-page-reveal d-80" style={{ display: "flex", alignItems: "center", gap: 10, padding: "28px", opacity: 0.7 }}>
            <RefreshCw size={18} className="spin-icon" style={{ color: "var(--accent-cyan)" }} />
            <span className="t-14" style={{ color: "var(--text-3)" }}>Fetching live ward signals\u2026</span>
          </div>
        ) : (
          <>
            <div className="use-page-reveal d-80" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "18px" }}>
              {wardsWithStatus.map((ward) => {
                const z = ward.z_num ?? 0;
                const pulse = z >= Math.min(watchZ, 1);
                const heatOpacity = Math.min(z / 3, 1);
                return (
                  <div
                    key={ward.id}
                    className={`glass-panel ${pulse ? "" : ""}`}
                    onClick={() => ward.alert_id && navigate(`/alerts/${ward.alert_id}`)}
                    style={{
                      padding: "16px 14px",
                      cursor: ward.alert_id ? "pointer" : "default",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: tileOverlayColor(ward.tileStatus),
                        opacity: heatOpacity,
                        pointerEvents: "none",
                        boxShadow: `inset 0 0 60px ${tileOverlayColor(ward.tileStatus)}`,
                      }}
                    />
                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                        <div className="t-13" style={{ fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.005em" }}>{ward.name}</div>
                        <StatusDot status={ward.tileStatus} pulse={pulse} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
                        <SparkBar data={ward.spark1} accent={ward.tileStatus === "RED" ? "--accent-rose" : ward.tileStatus === "AMBER" ? "--accent-amber" : "--accent-mint"} />
                        <SparkBar data={ward.spark2} accent="--accent-cyan" />
                        <SparkBar data={ward.spark3} accent="--accent-mint" />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span className="t-10" style={{ color: "var(--text-4)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{ward.category}</span>
                        <span className="mono-clinical t-14" style={{ fontWeight: 800, color: tileDotColor(ward.tileStatus) }}>{ward.z_score}\u03C3</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="glass-panel use-page-reveal d-160" style={{ padding: "22px 24px", marginBottom: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <div className="t-10" style={{ color: "var(--accent-cyan)", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>Threshold Controls</div>
                  <div className="t-16" style={{ color: "var(--text-1)", fontWeight: 700 }}>Detection Sensitivity</div>
                </div>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <span className="glass-panel-sm t-12 mono-clinical" style={{ padding: "6px 12px", color: "var(--accent-mint)" }}>
                    WATCH \u2265 {watchZ.toFixed(1)}\u03C3
                  </span>
                  <span className="glass-panel-sm t-12 mono-clinical" style={{ padding: "6px 12px", color: "var(--accent-amber)" }}>
                    ALERT \u2265 {alertZ.toFixed(1)}\u03C3
                  </span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <label className="t-12" style={{ color: "var(--text-3)", fontWeight: 600 }}>WATCH threshold</label>
                    <span className="mono-clinical t-14" style={{ color: "var(--accent-mint)", fontWeight: 800 }}>{watchZ.toFixed(1)}\u03C3</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.5"
                    step="0.1"
                    value={watchZ}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v < alertZ) setWatchZ(v);
                    }}
                    style={{
                      width: "100%",
                      height: "6px",
                      borderRadius: "999px",
                      appearance: "none",
                      WebkitAppearance: "none",
                      background: `linear-gradient(90deg, var(--accent-mint) 0%, var(--accent-mint) ${((watchZ - 0.5) / 3) * 100}%, rgba(5,13,21,0.6) ${((watchZ - 0.5) / 3) * 100}%, rgba(5,13,21,0.6) 100%)`,
                      border: "1px solid rgba(255,255,255,0.06)",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                    <span className="t-10" style={{ color: "var(--text-6)" }}>0.5</span>
                    <span className="t-10" style={{ color: "var(--text-6)" }}>3.5</span>
                  </div>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <label className="t-12" style={{ color: "var(--text-3)", fontWeight: 600 }}>ALERT threshold</label>
                    <span className="mono-clinical t-14" style={{ color: "var(--accent-amber)", fontWeight: 800 }}>{alertZ.toFixed(1)}\u03C3</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.1"
                    value={alertZ}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v > watchZ) setAlertZ(v);
                    }}
                    style={{
                      width: "100%",
                      height: "6px",
                      borderRadius: "999px",
                      appearance: "none",
                      WebkitAppearance: "none",
                      background: `linear-gradient(90deg, var(--accent-amber) 0%, var(--accent-amber) ${((alertZ - 1.0) / 4) * 100}%, rgba(5,13,21,0.6) ${((alertZ - 1.0) / 4) * 100}%, rgba(5,13,21,0.6) 100%)`,
                      border: "1px solid rgba(255,255,255,0.06)",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                    <span className="t-10" style={{ color: "var(--text-6)" }}>1.0</span>
                    <span className="t-10" style={{ color: "var(--text-6)" }}>5.0</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel-sm" style={{ marginTop: "20px", padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
                <div>
                  <div className="t-10" style={{ color: "var(--text-5)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>Today\u2019s Baseline</div>
                  <div className="mono-clinical t-20" style={{ color: "var(--text-1)", fontWeight: 700 }}>{baselineStats.total}</div>
                  <div className="t-11" style={{ color: "var(--text-4)" }}>wards scanned</div>
                </div>
                <div>
                  <div className="t-10" style={{ color: "var(--text-5)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>Avg \u03C3</div>
                  <div className="mono-clinical t-20" style={{ color: "var(--accent-cyan)", fontWeight: 700 }}>{baselineStats.avg.toFixed(2)}</div>
                  <div className="t-11" style={{ color: "var(--text-4)" }}>city mean</div>
                </div>
                <div>
                  <div className="t-10" style={{ color: "var(--text-5)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>Peak \u03C3</div>
                  <div className="mono-clinical t-20" style={{ color: "var(--accent-rose)", fontWeight: 700 }}>{baselineStats.peaks.toFixed(1)}</div>
                  <div className="t-11" style={{ color: "var(--text-4)" }}>max deviation</div>
                </div>
                <div>
                  <div className="t-10" style={{ color: "var(--text-5)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>Above Watch</div>
                  <div className="mono-clinical t-20" style={{ color: "var(--accent-amber)", fontWeight: 700 }}>{baselineStats.aboveWatch}/{baselineStats.total}</div>
                  <div className="t-11" style={{ color: "var(--text-4)" }}>wards elevated</div>
                </div>
              </div>
            </div>

            <div className="glass-panel use-page-reveal d-240" style={{ padding: "22px 24px", marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <div>
                  <div className="t-10" style={{ color: "var(--accent-cyan)", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "4px" }}>Top Signals</div>
                  <div className="t-16" style={{ color: "var(--text-1)", fontWeight: 700 }}>Ranked by z-score</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "50px 1fr 2fr 1fr 90px", padding: "8px 14px", borderBottom: "1px solid var(--glass-border-weak)" }}>
                  <span className="t-10" style={{ color: "var(--text-6)", fontWeight: 700, letterSpacing: "0.06em" }}>#</span>
                  <span className="t-10" style={{ color: "var(--text-6)", fontWeight: 700, letterSpacing: "0.06em" }}>WARD</span>
                  <span className="t-10" style={{ color: "var(--text-6)", fontWeight: 700, letterSpacing: "0.06em" }}>SYNDROME CONFIDENCE</span>
                  <span className="t-10" style={{ color: "var(--text-6)", fontWeight: 700, letterSpacing: "0.06em" }}>CATEGORY</span>
                  <span className="t-10" style={{ color: "var(--text-6)", fontWeight: 700, letterSpacing: "0.06em", textAlign: "right" }}>Z-SCORE</span>
                </div>

                {rankedSignals.map((ward, idx) => {
                  const z = ward.z_num ?? 0;
                  const confA = Math.min(z / 3.5, 1) * 40 + 20;
                  const confB = Math.min(Math.max(z - 0.4, 0) / 3, 1) * 30 + 15;
                  const confC = 100 - confA - confB;
                  return (
                    <div
                      key={ward.id}
                      onClick={() => ward.alert_id && navigate(`/alerts/${ward.alert_id}`)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "50px 1fr 2fr 1fr 90px",
                        padding: "14px 14px",
                        alignItems: "center",
                        borderRadius: "var(--r-md)",
                        cursor: ward.alert_id ? "pointer" : "default",
                        transition: "background var(--dur-fast)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(67,203,210,0.05)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span className="mono-clinical t-14" style={{ color: "var(--text-5)", fontWeight: 800 }}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <StatusDot status={ward.tileStatus} pulse={z >= Math.min(watchZ, 1)} />
                        <span className="t-14" style={{ color: "var(--text-1)", fontWeight: 700 }}>{ward.name}</span>
                      </div>
                      <div>
                        <div style={{ display: "flex", gap: "4px", height: "14px", borderRadius: "4px", overflow: "hidden", width: "100%", maxWidth: "320px" }}>
                          <div style={{ width: `${confA}%`, background: "var(--accent-mint)", borderRadius: "3px 0 0 3px" }} />
                          <div style={{ width: `${confB}%`, background: "var(--accent-cyan)" }} />
                          <div style={{ width: `${confC}%`, background: "var(--accent-amber)", borderRadius: "0 3px 3px 0" }} />
                        </div>
                        <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                          <span className="t-10" style={{ color: "var(--accent-mint)" }}>mint {Math.round(confA)}%</span>
                          <span className="t-10" style={{ color: "var(--accent-cyan)" }}>cyan {Math.round(confB)}%</span>
                          <span className="t-10" style={{ color: "var(--accent-amber)" }}>amber {Math.round(confC)}%</span>
                        </div>
                      </div>
                      <span className="t-12" style={{ color: "var(--text-3)" }}>{ward.category}</span>
                      <span className="mono-clinical t-18" style={{
                        fontWeight: 800,
                        textAlign: "right",
                        color: ward.tileStatus === "RED" ? "var(--accent-rose)" :
                               ward.tileStatus === "AMBER" ? "var(--accent-amber)" :
                               "var(--accent-mint)",
                      }}>+{ward.z_score}\u03C3</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="choreo-cta-strip use-page-reveal d-320">
              <div className="choreo-cta-left">
                <div className="choreo-cta-label">TOP EXPLAINABLE ALERT</div>
                <div className="choreo-cta-text">
                  {rankedSignals[0]
                    ? `${rankedSignals[0].name} — ${rankedSignals[0].category} at ${rankedSignals[0].z_score}\u03C3. Open the top Explainable Alert`
                    : "Open the top Explainable Alert"}
                </div>
              </div>
              <button className="choreo-cta-btn" onClick={() => navigate("/alerts/1")}>
                <span className="choreo-cta-arrow">\u25B6</span>
                Review Alert
              </button>
            </div>
          </>
        )}

      </main>
    </div>
  );
}

export default SignalDetection;
