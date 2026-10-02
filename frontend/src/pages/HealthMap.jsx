/**
 * HealthMap.jsx — 04 / CITY MAP
 * Wired to /wards/signals API with live category filtering.
 * Falls back to mock data if backend unavailable.
 */

import { useState, useEffect } from "react";
import { MapPin, RefreshCw, AlertTriangle } from "lucide-react";
import Sidebar from "../components/Sidebar";
import NabzMap from "../components/NabzMap";
import mockWards from "../mock/wards";
import { apiGetWardSignals } from "../services/api";
import { useNavigate } from "react-router-dom";

const CATEGORIES = ["All", "Gastrointestinal", "Febrile / Viral", "Respiratory", "Skin"];
const DATE_RANGES = ["24h", "7d", "28d"];
const STATUS_ORDER = { AMBER: 0, WATCH: 1, NORMAL: 2 };
const STAGGER_CLASSES = ["d-0", "d-80", "d-160", "d-240"];

/* ── Deterministic 7-day sparkline heights (0–10) per ward ── */
function sparkHeightsFor(wardId) {
  const seed = Number(String(wardId).replace(/\D/g, "")) || 7;
  const heights = [];
  let s = seed;
  for (let i = 0; i < 7; i++) {
    s = (s * 9301 + 49297) % 233280;
    heights.push(1 + Math.floor(((s / 233280) * 9) + 1));
  }
  return heights;
}

function heatColorForZ(z) {
  const num = Number(z);
  if (z == null || isNaN(num)) return "var(--accent-mint)";
  if (num < 1) return "var(--accent-mint)";
  if (num < 1.5) return "var(--accent-cyan)";
  if (num < 2) return "var(--accent-amber)";
  return "var(--accent-rose)";
}

function HealthMap() {
  const navigate = useNavigate();
  const [category, setCategory] = useState("All");
  const [dateRange, setDateRange] = useState("7d");
  const [selected, setSelected] = useState(null);
  const [wards, setWards] = useState(mockWards);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredWardId, setHoveredWardId] = useState(null);

  useEffect(() => {
    async function loadWards() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGetWardSignals(category !== "All" ? category : null);
        if (!Array.isArray(data)) {
          throw new Error("Invalid response format");
        }
        // Normalise API response to match frontend shape
        const normalised = data.map((w) => ({
          id: w.id,
          name: w.name,
          lat: w.lat,
          lng: w.lng,
          status: w.status,
          category: w.category,
          count: w.count,
          baseline: w.baseline,
          zScore: w.z_score,
          sources: w.sources,
          alertId: w.alert_id,
        }));
        setWards(normalised);
      } catch (err) {
        console.warn("Using fallback ward data:", err.message);
        setError("Live data unavailable — showing synthetic baseline.");
        setWards(mockWards);
      } finally {
        setLoading(false);
      }
    }
    loadWards();
  }, [category]);

  const sorted = [...wards].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );

  return (
    <div className="app">
      <Sidebar />
      <main className="main">

        {/* Page header */}
        <div className="page-header use-page-reveal">
          <small>04 / CITY MAP</small>
          <h1>Lucknow Health Map</h1>
          <p>Ward-level signals derived from anonymous prescription data. No patient identity is stored.</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="safety" style={{ background: "rgba(255,200,50,0.07)", borderColor: "var(--accent-amber)", marginBottom: 8 }}>
            <AlertTriangle size={16} color="var(--accent-amber)" />
            <div><small style={{ color: "var(--accent-amber)" }}>{error}</small></div>
          </div>
        )}

        {/* Filter bar */}
        <div className="map-filters use-page-reveal d-80">
          <div className="filter-chips">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                id={`filter-cat-${cat.replace(/[\s/]+/g, "-").toLowerCase()}`}
                className={`chip ${category === cat ? "chip--active" : ""}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="filter-date">
            {DATE_RANGES.map((r) => (
              <button
                key={r}
                id={`filter-date-${r}`}
                className={`chip chip--date ${dateRange === r ? "chip--active" : ""}`}
                onClick={() => setDateRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Map + Ward list */}
        <div className="map-layout use-page-reveal d-160">

          {/* Leaflet map */}
          <div className="map-container-wrap" style={{ position: "relative" }}>

            {/* ── A1) Radar sweep overlay (above tiles, below popups) ── */}
            <div
              className="radar-overlay"
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 500,
                overflow: "hidden",
              }}
            >
              <div
                className="radar-stage"
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "600px",
                  height: "600px",
                }}
              >
                {/* 3 concentric radial-gradient rings */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background:
                      "radial-gradient(circle, transparent 0%, transparent 16%, rgba(67,203,210,0.18) 16.5%, rgba(67,203,210,0.18) 17.5%, transparent 18%, transparent 38%, rgba(67,203,210,0.12) 38.5%, rgba(67,203,210,0.12) 39.5%, transparent 40%, transparent 62%, rgba(67,203,210,0.08) 62.5%, rgba(67,203,210,0.08) 63.5%, transparent 64%)",
                  }}
                />
                {/* Center crosshair */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "600px",
                    height: "600px",
                    pointerEvents: "none",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: 0,
                      width: "1px",
                      height: "100%",
                      background:
                        "linear-gradient(180deg, transparent, rgba(67,203,210,0.22) 20%, rgba(67,203,210,0.35) 50%, rgba(67,203,210,0.22) 80%, transparent)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: 0,
                      height: "1px",
                      width: "100%",
                      background:
                        "linear-gradient(90deg, transparent, rgba(67,203,210,0.22) 20%, rgba(67,203,210,0.35) 50%, rgba(67,203,210,0.22) 80%, transparent)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--accent-cyan)",
                      boxShadow: "0 0 12px var(--accent-cyan), 0 0 24px var(--accent-cyan)",
                    }}
                  />
                </div>
                {/* Conic-gradient sweep beam */}
                <div
                  className="use-radar-sweep"
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background:
                      "conic-gradient(from 0deg, transparent 0deg, transparent 300deg, rgba(67,203,210,0.42) 345deg, rgba(61,220,151,0.55) 358deg, transparent 360deg)",
                    maskImage:
                      "radial-gradient(circle, black 0%, black 63%, transparent 64%)",
                    WebkitMaskImage:
                      "radial-gradient(circle, black 0%, black 63%, transparent 64%)",
                  }}
                />
              </div>
            </div>

            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, gap: 12, opacity: 0.5 }}>
                <RefreshCw size={22} className="spin-icon" />
                <span>Loading ward signals…</span>
              </div>
            ) : (
              <NabzMap
                wards={wards}
                category={category}
                onWardClick={setSelected}
                highlightedWardId={hoveredWardId}
              />
            )}

            {/* ── A3) Legend glass-card: .glass-panel-sm + 4 swatches + pulse-sample ── */}
            <div className="map-legend glass-panel-sm" style={{ padding: "10px 14px", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div className="t-10" style={{ color: "var(--text-4)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Heat tiers</div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span className="legend-dot" style={{ background: "var(--accent-mint)", boxShadow: "0 0 6px var(--accent-mint)" }} />
                    <span className="t-10 mono-clinical" style={{ color: "var(--text-3)" }}>z&lt;1</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span className="legend-dot" style={{ background: "var(--accent-cyan)", boxShadow: "0 0 6px var(--accent-cyan)" }} />
                    <span className="t-10 mono-clinical" style={{ color: "var(--text-3)" }}>1–1.5</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span className="legend-dot" style={{ background: "var(--accent-amber)", boxShadow: "0 0 6px var(--accent-amber)" }} />
                    <span className="t-10 mono-clinical" style={{ color: "var(--text-3)" }}>1.5–2</span>
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <span className="legend-dot" style={{ background: "var(--accent-rose)", boxShadow: "0 0 6px var(--accent-rose)" }} />
                    <span className="t-10 mono-clinical" style={{ color: "var(--text-3)" }}>z&gt;2</span>
                  </span>
                </div>
              </div>
              {/* Pulse sample: 2 expanding rings */}
              <div
                className="pulse-sample"
                style={{
                  position: "relative",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  className="use-pulse-ring"
                  style={{
                    position: "absolute",
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    border: "2px solid var(--accent-cyan)",
                  }}
                />
                <div
                  className="use-pulse-ring delay-1"
                  style={{
                    position: "absolute",
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    border: "2px solid var(--accent-cyan)",
                  }}
                />
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "var(--accent-cyan)",
                    boxShadow: "0 0 8px var(--accent-cyan)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Ward list */}
          <div className="area-list">
            <h3>Ward signals</h3>

            {loading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.5, padding: "12px 0" }}>
                <RefreshCw size={14} className="spin-icon" />
                <small>Refreshing…</small>
              </div>
            ) : sorted.length === 0 ? (
              <div style={{ opacity: 0.5, padding: "12px 0" }}>
                <small>No wards match this filter.</small>
              </div>
            ) : (
              sorted.map((ward, idx) => {
                const heights = sparkHeightsFor(ward.id);
                const heatColor = heatColorForZ(ward.zScore);
                const staggerClass = STAGGER_CLASSES[idx % STAGGER_CLASSES.length];
                return (
                  <div
                    key={ward.id}
                    className={`area-row use-page-reveal ${staggerClass} ${selected?.id === ward.id ? "area-row--selected" : ""}`}
                    onClick={() => setSelected(ward)}
                    onMouseEnter={() => setHoveredWardId(ward.id)}
                    onMouseLeave={() => setHoveredWardId(null)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="area-row-info">
                      <span className="area-row-name">
                        <MapPin size={10} style={{ marginRight: 4, verticalAlign: "middle" }} />
                        {ward.name}
                      </span>
                      <span className="area-row-cat">{ward.category}</span>
                      {/* ── A2) Mini CSS sparkline: 7 bars gradient heights ── */}
                      <div
                        className="ward-sparkline"
                        style={{
                          display: "flex",
                          alignItems: "flex-end",
                          gap: "2px",
                          width: "20px",
                          height: "10px",
                          marginTop: "4px",
                        }}
                      >
                        {heights.map((h, i) => {
                          const hue = i < 4 ? "var(--accent-cyan)" : heatColor;
                          return (
                            <div
                              key={i}
                              style={{
                                flex: 1,
                                minWidth: "2px",
                                height: `${h * 10}%`,
                                borderRadius: "1px",
                                background: `linear-gradient(180deg, ${hue}, ${i === 6 ? heatColor : "rgba(67,203,210,0.5)"})`,
                                opacity: 0.35 + (h / 12),
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <div className="area-row-right">
                      <strong className={ward.status.toLowerCase()}>{ward.status}</strong>
                      <span className="area-row-count">{ward.count} signals</span>
                    </div>
                  </div>
                );
              })
            )}

            {/* Selected ward detail */}
            {selected && !loading && (
              <div className="selected-ward-detail">
                <div className="swd-header">
                  <MapPin size={13} color="var(--accent-cyan)" />
                  <strong>{selected.name}</strong>
                  <span className={`status-pill status-${selected.status.toLowerCase()}`}>{selected.status}</span>
                </div>
                <div className="swd-stats">
                  <div><small>Signals today</small><strong>{selected.count}</strong></div>
                  <div><small>Baseline</small><strong>{selected.baseline}</strong></div>
                  <div><small>Z-score</small><strong>{selected.zScore}σ</strong></div>
                </div>
                {selected.alertId && (
                  <button
                    className="primary-button"
                    style={{ width: "100%", marginTop: 10, fontSize: 12, padding: "8px 12px" }}
                    onClick={() => navigate(`/alerts/${selected.alertId}`)}
                  >
                    Review explanation →
                  </button>
                )}
              </div>
            )}

            <div className="area-list-footer">
              <span className="demo-badge">● SYNTHETIC DEMO DATA</span>
            </div>
          </div>

        </div>

        {/* ── A4) Choreo CTA strip (below map+grid) ── */}
        <div className="choreo-cta-strip use-page-reveal d-240">
          <div className="choreo-cta-left">
            <span className="choreo-cta-label">DASHBOARD OVERVIEW</span>
            <span className="choreo-cta-text">Back to Dashboard Overview</span>
          </div>
          <button
            className="choreo-cta-btn"
            onClick={() => navigate("/")}
          >
            <span className="choreo-cta-arrow">←</span>
            Go to Dashboard
          </button>
        </div>

        {/* Safety note */}
        <div className="safety" style={{ marginTop: 12 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-mint)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <strong>Location precision: ward level only</strong>
            <p>NABZ supports investigation. It does not diagnose individuals or declare an outbreak.</p>
          </div>
        </div>

      </main>
    </div>
  );
}

export default HealthMap;
