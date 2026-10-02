/**
 * NabzMap.jsx — Leaflet + OpenStreetMap interactive ward map for Lucknow
 *
 * Shows ward-level NORMAL / WATCH / AMBER signals as coloured circles.
 * AMBER circles pulse. Clicking a circle opens an InfoWindow-style popup
 * that links to /alerts/:id.
 *
 * Props:
 *   wards              – array of ward data objects (see mockWards below for shape)
 *   category           – active filter string ('All' | 'Gastrointestinal' | …)
 *   onWardClick        – optional callback(ward)
 *   highlightedWardId   – optional ward.id that should get pop-scale halo
 */

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ── Dark tile style — OpenStreetMap (completely free, no API key ever needed)
   A CSS invert+hue-rotate filter is applied via the pane to give a dark look ── */
const TILE_URL =
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors';

/* ── Centre on Lucknow ── */
const LUCKNOW = [26.8467, 80.9462];
const DEFAULT_ZOOM = 12;

/* ── Heat-tier colour via zScore (CSS tokens only ── */
function getHeatColor(z) {
  const num = Number(z);
  if (z == null || isNaN(num)) return "var(--accent-mint)";
  if (num < 1) return "var(--accent-mint)";
  if (num < 1.5) return "var(--accent-cyan)";
  if (num < 2) return "var(--accent-amber)";
  return "var(--accent-rose)";
}

/* ── Build a single L.divIcon for a ward heat-tier dot + 2 expanding pulse rings ── */
function buildWardIcon(heatColor) {
  return L.divIcon({
    className: "nabz-heat-icon",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -14],
    html: `
      <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
        <div class="nabz-marker-halo" style="position:absolute;inset:0;border-radius:50%;"></div>
        <div class="use-pulse-ring" style="position:absolute;width:16px;height:16px;border-radius:50%;border:2px solid ${heatColor};"></div>
        <div class="use-pulse-ring delay-1" style="position:absolute;width:16px;height:16px;border-radius:50%;border:2px solid ${heatColor};"></div>
        <div style="width:16px;height:16px;border-radius:50%;background:${heatColor};box-shadow:0 0 12px ${heatColor},0 0 24px ${heatColor};position:relative;z-index:2;"></div>
      </div>
    `,
  });
}

/* ──────────────────────────────────────────────
   Sub-component: resets view when wards change
────────────────────────────────────────────── */
function MapController() {
  const map = useMap();
  useEffect(() => {
    map.setView(LUCKNOW, DEFAULT_ZOOM);
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

/* ──────────────────────────────────────────────
   Main component
────────────────────────────────────────────── */
function NabzMap({ wards = [], category = "All", onWardClick, highlightedWardId }) {
  const navigate = useNavigate();
  const markerRefs = useRef(new Map());

  const filtered = category === "All"
    ? wards
    : wards.filter((w) => w.category === category || w.status === "NORMAL");

  /* Apply pop-scale halo effect on highlighted ward marker */
  useEffect(() => {
    markerRefs.current.forEach((markerEl, id) => {
      const inner = markerEl?.firstElementChild;
      if (!inner) return;
      if (String(id) === String(highlightedWardId)) {
        inner.classList.add("nabz-marker-pop");
        const halo = inner.querySelector(".nabz-marker-halo");
        if (halo) {
          halo.style.boxShadow = "0 0 0 3px currentColor, 0 0 20px currentColor";
        }
        inner.style.transform = "scale(1.25)";
        inner.style.transition = "transform 220ms cubic-bezier(0.16,1,0.3,1)";
      } else {
        inner.classList.remove("nabz-marker-pop");
        const halo = inner.querySelector(".nabz-marker-halo");
        if (halo) {
          halo.style.boxShadow = "";
        }
        inner.style.transform = "";
        inner.style.transition = "transform 220ms cubic-bezier(0.16,1,0.3,1)";
      }
    });
  }, [highlightedWardId, filtered]);

  return (
    <MapContainer
      center={LUCKNOW}
      zoom={DEFAULT_ZOOM}
      className="nabz-map"
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <MapController />

      <TileLayer
        url={TILE_URL}
        attribution={TILE_ATTR}
        className="nabz-dark-tiles"
      />

      {filtered.map((ward) => {
        const heatColor = getHeatColor(ward.zScore);
        const icon = buildWardIcon(heatColor);
        return (
          <Marker
            key={ward.id}
            ref={(m) => {
              if (m) {
                const el = m.getElement();
                if (el) {
                  el.style.color = heatColor;
                  markerRefs.current.set(ward.id, el);
                }
              } else {
                markerRefs.current.delete(ward.id);
              }
            }}
            position={[ward.lat, ward.lng]}
            icon={icon}
            eventHandlers={{
              click: () => onWardClick && onWardClick(ward),
            }}
          >
            <Popup className="nabz-popup">
              <div className="popup-inner">
                <span
                  className={`popup-badge popup-badge--${ward.status.toLowerCase()}`}
                >
                  ● {ward.status}
                </span>

                <strong className="popup-name">{ward.name}</strong>

                <p className="popup-meta">
                  {ward.category} · {ward.count} signals today
                </p>

                <p className="popup-baseline">
                  Baseline avg: {ward.baseline} · z = {ward.zScore}σ
                </p>

                {ward.status !== "NORMAL" && (
                  <button
                    className="popup-cta"
                    onClick={() => navigate(`/alerts/${ward.alertId ?? 1}`)}
                  >
                    Review explanation →
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

export default NabzMap;
