import { searchVillages, nearestVillage, getForecast } from "./api.js";
import { t, getLang } from "./i18n.js";

const API = window.location.origin;
// Centre between HP and Uttarakhand so both states are visible on load
const HP_CENTER = [30.1, 78.8];
const HP_ZOOM   = 7;
const HP_BOUNDS = [[28.0, 75.0],[34.0, 81.5]];

/* ─────────────────────────────────────────────────────────────────────────
   PRECIPITATION SCALE — IMD daily-rainfall categories (same as mumbaiflood.in)
───────────────────────────────────────────────────────────────────────── */
const PRECIP_SCALE = [
  { min:0,     max:0.1,   color:"#9ca3af", label:"No Rain",             desc:"No rain",         key:"noRainLabel" },
  { min:0.1,   max:15.6,  color:"#4ade80", label:"Light Rainfall",      desc:"0.1 – 15.5 mm",   key:"levelLight" },
  { min:15.6,  max:64.5,  color:"#38bdf8", label:"Moderate Rainfall",   desc:"15.6 – 64.4 mm",  key:"levelModerate" },
  { min:64.5,  max:115.6, color:"#facc15", label:"Heavy Rainfall",      desc:"64.5 – 115.5 mm", key:"levelHeavy" },
  { min:115.6, max:204.5, color:"#fb923c", label:"Very Heavy Rainfall", desc:"115.6 – 204.4 mm",key:"levelVeryHeavy" },
  { min:204.5, max:99999, color:"#ef4444", label:"Extremely Heavy Rainfall", desc:"≥ 204.5 mm", key:"levelExtreme" },
];

function precipScaleEntry(mm) {
  for (const s of PRECIP_SCALE) if (mm >= s.min && mm < s.max) return s;
  return PRECIP_SCALE[PRECIP_SCALE.length - 1];
}

function precipColor(mm) {
  return precipScaleEntry(mm).color;
}
function precipOpacity(mm) {
  if (mm < 0.1)    return 0.12;
  if (mm < 15.6)   return 0.45;
  if (mm < 64.5)   return 0.60;
  if (mm < 115.6)  return 0.72;
  if (mm < 204.5)  return 0.82;
  return 0.9;
}

const TYPE_LABEL_KEYS = {
  flood: "tlFlood", waterlogging: "tlWaterlogging",
  landslide: "tlLandslide", road_blocked: "tlRoadBlocked", cloudburst: "tlCloudburst",
};
function typeLabel(type) { return t(TYPE_LABEL_KEYS[type]) || type; }
const SEVERITY_COLOR = { high:"#ef4444", moderate:"#f97316", low:"#94a3b8" };

/* ── State ─────────────────────────────────────────────────────────────── */
let floodMap,   floodMarkers,   floodReady   = false;
let precipMap,  precipMarkers,  precipReady  = false;
let ncGridLayer = null;
let villageLayer = null;
let villageLabels = [];
let villageLabelLayer = null;
let highlightedVillageLayer = null;
let ncData = null;
let villageGeoJSON = null;
let currentPeriod = "today";
let currentDayIndex = 0;   // index into rolling 6-day window
let reportCoords = null, selectedVillageId = null;

/* ── Rolling 6-day window ──────────────────────────────────────────────── */
function getRollingDays(anchorOffset = 0) {
  // anchorOffset: 0 = starting from today, 1 = starting from tomorrow, etc.
  const days = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setDate(d.getDate() + anchorOffset + i);
    days.push(d);
  }
  return days;
}

/* ── Tile helpers ──────────────────────────────────────────────────────── */
function satelliteTile() {
  return L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution:"© Esri, Maxar", maxZoom:19 }
  );
}
function labelOverlay() {
  return L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { attribution:"© Esri", maxZoom:19, opacity:1 }
  );
}
function streetTile() {
  return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution:"© OSM", maxZoom:19 });
}
function terrainTile() {
  return L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
    { attribution:"© Esri USGS", maxZoom:13 }
  );
}

function addIndiaBoundary(mapObj) {
  fetch("/static/india_boundary.geojson").then(r=>r.json()).then(gj=>{
    L.geoJSON(gj, { style:{ color:"#38bdf8", weight:1.5, fillOpacity:0, dashArray:"4,3" }}).addTo(mapObj);
  }).catch(()=>{});
}

// Distinct colours per state — outline + faint fill + permanent label, so
// Himachal Pradesh and Uttarakhand are immediately recognisable on the map.
const STATE_STYLES = {
  "Himachal Pradesh": { color: "#fb923c", labelKey: "stateHP", cls: "state-label-hp" }, // orange
  "Uttarakhand":      { color: "#22d3ee", labelKey: "stateUK", cls: "state-label-uk" }, // cyan
};

// References kept so labels/legend text can be re-translated on language switch.
const stateLabelTooltips = []; // { tooltip, key }
const stateLegendRows = [];    // { el, key }

function addStateBoundaries(mapObj) {
  fetch("/static/hp_uk_boundary.geojson").then(r=>r.json()).then(gj=>{
    (gj.features || []).forEach(feat => {
      const name = feat.properties?.state;
      const style = STATE_STYLES[name];
      if (!style) return;
      const layer = L.geoJSON(feat, {
        interactive: false,
        style: { color: style.color, weight: 2.5, fillColor: style.color, fillOpacity: 0.05 },
      }).addTo(mapObj);
      const center = layer.getBounds().getCenter();
      const tooltip = L.tooltip(center, {
        permanent: true,
        direction: "center",
        interactive: false,
        className: `state-label ${style.cls}`,
      }).setContent(t(style.labelKey)).addTo(mapObj);
      stateLabelTooltips.push({ tooltip, key: style.labelKey });
    });
  }).catch(()=>{});

  // Small colour-key so the two outline colours map to state names.
  const ctrl = L.control({ position: "bottomright" });
  ctrl.onAdd = () => {
    const div = L.DomUtil.create("div", "state-legend");
    Object.entries(STATE_STYLES).forEach(([name, s]) => {
      const row = L.DomUtil.create("div", "state-legend-row", div);
      row.innerHTML = `<span class="sl-swatch" style="background:${s.color}"></span><span class="sl-name">${t(s.labelKey)}</span>`;
      stateLegendRows.push({ el: row.querySelector(".sl-name"), key: s.labelKey });
    });
    return div;
  };
  ctrl.addTo(mapObj);
}

/* ── Load data ─────────────────────────────────────────────────────────── */
async function loadNcData() {
  if (ncData) return ncData;
  const r = await fetch("/static/precip_grid.json");
  ncData = await r.json();
  return ncData;
}

async function loadVillageGeo() {
  if (villageGeoJSON) return villageGeoJSON;
  // Load HP and UK village polygons in parallel and merge into one collection
  const [hpRes, ukRes] = await Promise.all([
    fetch("/static/hp_villages.geojson"),
    fetch("/static/uk_villages.geojson"),
  ]);
  const [hp, uk] = await Promise.all([hpRes.json(), ukRes.json()]);
  villageGeoJSON = {
    type: "FeatureCollection",
    features: [...(hp.features || []), ...(uk.features || [])],
  };
  return villageGeoJSON;
}

/* ── Build dark "Mumbai Flood" style legend card ───────────────────────── */
function buildColourBar() {
  const items = PRECIP_SCALE.slice().reverse().map(s =>
    `<div class="mf-row">
       <span class="mf-dot" style="background:${s.color}"></span>
       <span class="mf-lbl">${t(s.key)}${s.desc !== "No rain" ? ` (${s.desc})` : ""}</span>
     </div>`
  ).join("");
  return `<div class="mf-legend">${items}</div>`;
}

// Climatology anomaly categories (from backend, based on 2015-2025 IMERG
// monsoon-season percentiles for this exact location) — same mapping as
// the dashboard's CLIM_BADGE in app.js.
const CLIM_BADGE = {
  below_normal:  { color: "#64748b", key: "climBelowNormal" },
  normal:        { color: "#22c55e", key: "climNormal" },
  above_normal:  { color: "#84cc16", key: "climAboveNormal" },
  heavy:         { color: "#f59e0b", key: "climHeavy" },
  very_heavy:    { color: "#f97316", key: "climVeryHeavy" },
  very_extreme:  { color: "#ef4444", key: "climVeryExtreme" },
  extreme:       { color: "#9c27b0", key: "climExtreme" },
};

/* ── Shared "climate popup" — village + temperature + precip + level ───── */
function renderClimatePopup(village, mm, climatology) {
  const scale = precipScaleEntry(mm);
  const name = village?.name || t("outsideCoverage");
  const meta = village ? `${village.block}, ${village.district}` : "";
  const vfBtn = village ? `
    <button class="vf-btn" data-vid="${village.id}">${t("viewForecast")}</button>` : "";
  const badge = climatology ? CLIM_BADGE[climatology.category] : null;
  const climHtml = badge
    ? `<span class="cp-clim-badge" style="background:${badge.color}" title="${climatology.label}">${t(badge.key)}</span>`
    : "";
  return `
    <div class="climate-popup">
      <div class="cp-name">${name}</div>
      ${meta ? `<div class="cp-meta">${meta}</div>` : ""}
      <div class="cp-stats">
        <div class="cp-stat">
          <span class="cp-stat-lbl">${t("precipitation")}</span>
          <span class="cp-stat-val cp-precip">${mm.toFixed(1)} mm</span>
        </div>
      </div>
      <div class="cp-level">
        <span class="cp-dot cp-level-dot" style="background:${scale.color}"></span>
        <span class="cp-level-text">${t(scale.key)}</span>
      </div>
      ${climHtml}
      ${vfBtn}
    </div>`;
}

function wireClimatePopup(el, village) {
  if (!el) return;
  const btn = el.querySelector(".vf-btn");
  if (btn) btn.addEventListener("click", () => { window.location.href = `/?village=${btn.dataset.vid}`; });
}

/* ── Forecast day data for a village, from the SAME source as the
   dashboard: /api/forecast/{id} → today (dayIndex 0) + outlook[0..5]
   (dayIndex 1..6). This keeps the map popup and the "View forecast"
   dashboard in sync — the NetCDF grid (mmAtLatLon) is only used as a
   fallback when no village is found (outside the village coverage area). */
const forecastCache = new Map();
async function forecastDayFor(villageId, dayIndex) {
  let fc = forecastCache.get(villageId);
  if (!fc) {
    fc = await getForecast(villageId).catch(() => null);
    if (fc) forecastCache.set(villageId, fc);
  }
  if (!fc) return null;
  return dayIndex === 0 ? fc.today : fc.outlook?.[dayIndex - 1] ?? null;
}

/* ── Look up the precipitation value (mm) nearest to lat/lon for a day ──── */
async function mmAtLatLon(lat, lon, dayIndex) {
  const data = await loadNcData().catch(() => null);
  if (!data || !data.days?.length) return 0;
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + dayIndex);
  const targetStr = targetDate.toISOString().slice(0, 10);
  const dayData = data.days.find(d => d.date === targetStr) || data.days[dayIndex % data.days.length];
  if (!dayData) return 0;
  let best = 0, bestDist = Infinity;
  for (const [glat, glon, mm] of dayData.cells) {
    const dist = (glat - lat) ** 2 + (glon - lon) ** 2;
    if (dist < bestDist) { bestDist = dist; best = mm; }
  }
  return best;
}


function ensurePrecipMap() {
  if (precipReady || typeof L === "undefined") return;
  const el = document.getElementById("precip-village-map");
  if (!el) return;

  precipMap = L.map("precip-village-map", { maxBounds: HP_BOUNDS, minZoom:7 }).setView(HP_CENTER, HP_ZOOM);
  const sat = satelliteTile();
  const lbl = labelOverlay();
  sat.addTo(precipMap);
  lbl.addTo(precipMap);

  L.control.layers(
    { "🛰️ Satellite":sat, "🏔️ Terrain":terrainTile(), "🗺️ Street":streetTile() },
    { "Labels":lbl },
    { position:"topright" }
  ).addTo(precipMap);

  addIndiaBoundary(precipMap);
  addStateBoundaries(precipMap);
  precipMarkers = L.layerGroup().addTo(precipMap);

  // Whole map click → nearest village climate popup
  precipMap.on("click", async e => {
    const lat = e.latlng.lat, lon = e.latlng.lng;
    const popup = L.popup({ maxWidth: 260, className: "village-popup" })
      .setLatLng(e.latlng)
      .setContent(`<div class="cp-loading">${t("loading")}</div>`)
      .openOn(precipMap);

    let village = null;
    try { village = await nearestVillage(lat, lon); } catch(_) {}
    let mm = await mmAtLatLon(lat, lon, currentDayIndex);
    let climatology = null;
    if (village) {
      const fcDay = await forecastDayFor(village.id, currentDayIndex);
      if (fcDay?.precip_total_mm != null) mm = fcDay.precip_total_mm;
      climatology = fcDay?.climatology ?? null;
    }

    // No village polygon here (outside HP/UK boundaries) — drop a small
    // colour-matched marker so the precipitation level is still visible
    // as an overlay at the clicked point.
    if (precipMarkers) precipMarkers.clearLayers();
    const scale = precipScaleEntry(mm);
    const marker = L.circleMarker(e.latlng, {
      radius: 9, color: "#fff", weight: 2,
      fillColor: scale.color, fillOpacity: 0.85,
    }).addTo(precipMarkers);
    popup.on("remove", () => precipMarkers.removeLayer(marker));

    popup.setContent(renderClimatePopup(village, mm, climatology));
    setTimeout(() => wireClimatePopup(popup.getElement(), village), 0);
  });

  // Inject colour bar into the panel
  const bar = document.getElementById("precip-colour-bar");
  if (bar) bar.innerHTML = buildColourBar();

  precipReady = true;
  setTimeout(() => precipMap.invalidateSize(), 200);
}

/* ── NetCDF grid overlay removed ───────────────────────────────────────────
   Previously rendered 0.25° rectangles on top of village boundaries. Since
   villageLayer colors each village from the same NetCDF data (via nearest-
   cell lookup), the rectangle overlay was redundant and — because its grid
   lines don't align with village polygon edges — could visually contradict
   a village's own fill color at boundaries. Removed to keep map + popup
   colors consistent everywhere. */
async function renderNcOverlay(dayIndex) {
  if (!precipMap) return;
  if (ncGridLayer) { precipMap.removeLayer(ncGridLayer); ncGridLayer = null; }
}

/* ── Overlay village boundaries ────────────────────────────────────────── */
async function renderVillageBoundaries(dayIndex) {
  if (!precipMap) return;
  if (villageLayer) { precipMap.removeLayer(villageLayer); villageLayer = null; }
  highlightedVillageLayer = null;

  const geo = await loadVillageGeo().catch(() => null);
  if (!geo) return;
  villageLabels = [];

  const data = await loadNcData().catch(() => null);
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + dayIndex);
  const targetStr = targetDate.toISOString().slice(0, 10);
  const dayData = data ? (data.days.find(d => d.date === targetStr) || data.days[dayIndex % data.days.length]) : null;

  // Compute the precipitation value (mm) for a village feature, using the
  // nearest NetCDF grid cell to its centroid — same nearest-neighbor logic
  // as mmAtLatLon(), so the overlay colour always matches the click popup.
  function featureMm(feat) {
    if (!dayData || !dayData.cells?.length) return 0;
    try {
      const coords = feat.geometry.coordinates;
      let cx = 0, cy = 0, n = 0;
      const ring = feat.geometry.type === "Polygon" ? coords[0] : coords[0][0];
      for (const [x, y] of ring.slice(0, 10)) { cx += x; cy += y; n++; }
      cx /= n; cy /= n;
      let best = 0, bestDist = Infinity;
      for (const [glat, glon, mm] of dayData.cells) {
        const dist = (glat - cy) ** 2 + (glon - cx) ** 2;
        if (dist < bestDist) { bestDist = dist; best = mm; }
      }
      return best;
    } catch(_) { return 0; }
  }

  villageLayer = L.geoJSON(geo, {
    style: feat => {
      const mm = featureMm(feat);
      const fillColor = mm >= 0.1 ? precipColor(mm) : "#94a3b8";
      const fillOpacity = mm >= 0.1 ? precipOpacity(mm) : 0.35;
      return { color:"#475569", weight:0.4, fillColor, fillOpacity };
    },
    onEachFeature: (feat, layer) => {
      const p = feat.properties;
      const gridMm = featureMm(feat);
      // displayMm starts as the NetCDF-grid estimate (used for the initial
      // bulk render of all 2391 polygons) and gets corrected to the precise
      // per-village Open-Meteo value the first time its popup is opened —
      // so the polygon's colour always ends up matching its own popup.
      let displayMm = gridMm;
      const defaultStyle = { ...layer.options };
      const villageName = (p.village || "").replace(/@/g, "A").replace(/\|/g, "a");

      function fillFor(value) {
        return {
          fillColor: value >= 0.1 ? precipColor(value) : "#94a3b8",
          fillOpacity: value >= 0.1 ? precipOpacity(value) : 0.35,
        };
      }

      // Hover tooltip: village name + precipitation, colour-matched to the fill
      function tooltipHtml(value) {
        const scale = precipScaleEntry(value >= 0.1 ? value : 0);
        return `<div class="vt-tip"><strong>${villageName}</strong><br>${value.toFixed(1)} mm · ${t(scale.key)}</div>`;
      }
      layer.bindTooltip(tooltipHtml(displayMm), { sticky: true, direction: "top", className: "village-tooltip", opacity: 0.95 });

      // Permanent on-map label, shown only when zoomed in enough to read it
      const center = layer.getBounds().getCenter();
      const label = L.marker(center, {
        icon: L.divIcon({ className: "village-label", html: villageName, iconSize: null }),
        interactive: false,
        keyboard: false,
      });
      villageLabels.push(label);

      layer.bindPopup(`<div class="cp-loading">${t("loading")}</div>`, { maxWidth: 260, className: "village-popup" });

      layer.on("popupopen", async () => {
        let village = null;
        try {
          const c = layer.getBounds().getCenter();
          village = await nearestVillage(c.lat, c.lng);
        } catch(_) {}
        const display = village
          ? { ...village, name: village.name || p.village, block: village.block || p.tehsil, district: village.district || p.district }
          : { name: p.village, block: p.tehsil, district: p.district };
        let popupMm = displayMm;
        let climatology = null;
        if (village) {
          const fcDay = await forecastDayFor(village.id, currentDayIndex);
          if (fcDay?.precip_total_mm != null) popupMm = fcDay.precip_total_mm;
          climatology = fcDay?.climatology ?? null;
        }
        layer.getPopup().setContent(renderClimatePopup(display, popupMm, climatology));
        setTimeout(() => wireClimatePopup(layer.getPopup().getElement(), village), 0);

        // Recolour this polygon (+ its tooltip + the saved "default" style
        // used when un-highlighting) to match the popup's own value, so the
        // map no longer contradicts the figure shown in the popup.
        if (popupMm !== displayMm) {
          displayMm = popupMm;
          const fill = fillFor(displayMm);
          Object.assign(defaultStyle, fill);
          layer.setTooltipContent(tooltipHtml(displayMm));
          if (highlightedVillageLayer === layer) {
            layer.setStyle({ fillColor: fill.fillColor, fillOpacity: Math.min(fill.fillOpacity + 0.15, 1) });
          } else {
            layer.setStyle(fill);
          }
        }
      });

      // Highlight the clicked village boundary
      layer.on("click", () => {
        if (highlightedVillageLayer && highlightedVillageLayer !== layer) {
          highlightedVillageLayer.setStyle(highlightedVillageLayer._defaultStyle);
        }
        layer._defaultStyle = defaultStyle;
        const fill = fillFor(displayMm);
        layer.setStyle({ color: "#facc15", weight: 3, fillColor: fill.fillColor, fillOpacity: Math.min(fill.fillOpacity + 0.15, 1), fill: true });
        layer.bringToFront();
        highlightedVillageLayer = layer;
      });
    }
  });
  villageLayer.addTo(precipMap);

  // Permanent village-name labels: only meaningful at higher zoom, where
  // polygons are large enough to read a label inside them.
  if (villageLabelLayer) precipMap.removeLayer(villageLabelLayer);
  villageLabelLayer = L.layerGroup(villageLabels);
  const updateLabelVisibility = () => {
    if (precipMap.getZoom() >= 11) {
      if (!precipMap.hasLayer(villageLabelLayer)) villageLabelLayer.addTo(precipMap);
    } else if (precipMap.hasLayer(villageLabelLayer)) {
      precipMap.removeLayer(villageLabelLayer);
    }
  };
  precipMap.off("zoomend", updateLabelVisibility);
  precipMap.on("zoomend", updateLabelVisibility);
  updateLabelVisibility();
}

/* ── Build day bar (rolling 6-day from selected anchor) ─────────────────── */
function buildDayTabs(anchorOffset = 0) {
  const container = document.getElementById("precip-day-tabs");
  if (!container) return;
  container.innerHTML = "";
  container.className = "day-bar";

  const days = getRollingDays(anchorOffset);
  const locale = t("today") === "आज" ? "hi-IN" : "en-IN";
  days.forEach((d, i) => {
    const isToday = i === 0 && anchorOffset === 0;
    const dayName = isToday ? t("today") : i === 1 && anchorOffset === 0 ? t("tomorrow")
      : d.toLocaleDateString(locale, { weekday:"short" });
    const dateStr = d.toLocaleDateString(locale, { day:"numeric", month:"short" });

    const btn = document.createElement("button");
    btn.className = "precip-day-btn" + (i === 0 ? " active" : "");
    btn.dataset.day = i;
    btn.innerHTML = `<span class="day-name">${dayName}</span><span class="day-date">${dateStr}</span>`;
    btn.addEventListener("click", async () => {
      container.querySelectorAll(".precip-day-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentDayIndex = i;
      await refreshOverlays(i);
    });
    container.appendChild(btn);
  });
}

async function refreshOverlays(dayIndex) {
  const loading = document.getElementById("precip-loading");
  if (loading) { loading.textContent = t("updatingOverlay"); loading.classList.remove("hidden"); }
  await Promise.all([renderNcOverlay(dayIndex), renderVillageBoundaries(dayIndex)]);
  if (loading) loading.classList.add("hidden");
}

export async function initPrecipMap() {
  buildDayTabs(0);
  await new Promise(r => setTimeout(r, 120));
  ensurePrecipMap();
  if (precipMap) precipMap.invalidateSize();
  await refreshOverlays(0);
}

// Re-render translated map UI (legend + day tabs) on language switch
window.addEventListener("lang-changed", () => {
  const bar = document.getElementById("precip-colour-bar");
  if (bar) bar.innerHTML = buildColourBar();
  buildDayTabs(0);
  // restore active state on the previously-selected day
  const container = document.getElementById("precip-day-tabs");
  const btn = container?.querySelector(`[data-day="${currentDayIndex}"]`);
  if (btn) {
    container.querySelectorAll(".precip-day-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  }
  stateLabelTooltips.forEach(({ tooltip, key }) => tooltip.setContent(t(key)));
  stateLegendRows.forEach(({ el, key }) => { if (el) el.textContent = t(key); });
});

/* ═══════════════════════════════════════════════════════════════════════
   FLOOD MAP (Reported Floods panel)
═══════════════════════════════════════════════════════════════════════ */
function ensureFloodMap() {
  if (floodReady || typeof L === "undefined") return;
  floodMap = L.map("hp-map", { maxBounds:HP_BOUNDS, minZoom:7 }).setView(HP_CENTER, HP_ZOOM);
  const sat = satelliteTile(); sat.addTo(floodMap);
  labelOverlay().addTo(floodMap);
  L.control.layers(
    { "🛰️ Satellite":sat, "🏔️ Terrain":terrainTile(), "🗺️ Street":streetTile() },
    {}, { position:"topright" }
  ).addTo(floodMap);
  addIndiaBoundary(floodMap);
  addStateBoundaries(floodMap);
  floodMarkers = L.layerGroup().addTo(floodMap);
  floodMap.on("click", async e => {
    try {
      const res = await fetch(`${API}/api/villages/nearest?lat=${e.latlng.lat.toFixed(4)}&lon=${e.latlng.lng.toFixed(4)}`);
      if (res.ok) { const v = await res.json(); window.location.href = `/?village=${v.id}`; }
    } catch(_) {}
  });
  floodReady = true;
  setTimeout(() => floodMap.invalidateSize(), 200);
}

async function fetchReports(period) {
  // Fetch flood reports for both HP and Uttarakhand
  const [hp, uk] = await Promise.all([
    fetch(`${API}/api/flood-reports?period=${period}&state=Himachal%20Pradesh`).then(r => r.ok ? r.json() : []),
    fetch(`${API}/api/flood-reports?period=${period}&state=Uttarakhand`).then(r => r.ok ? r.json() : []),
  ]);
  const combined = [...(Array.isArray(hp) ? hp : []), ...(Array.isArray(uk) ? uk : [])];
  combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return combined;
}

function formatTime(iso) {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ","T")+"Z");
  const locale = getLang() === "hi" ? "hi-IN" : "en-IN";
  return d.toLocaleString(locale,{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
}
const SEVERITY_KEYS = { high:"severityHigh", moderate:"severityModerate", low:"severityLow" };

function floodPopupHtml(r) {
  const place = r.village_name ? `<strong>${r.village_name}</strong>${r.district?` · ${r.district}`:""}` : t("reportedLocation");
  return `<div style="font-size:.83rem;color:#1e293b">
    <div class="severity-${r.severity}">${typeLabel(r.report_type)} · ${t(SEVERITY_KEYS[r.severity]) || r.severity}</div>
    <div>${place}</div>
    ${r.note?`<p style="margin:.3rem 0 0">${r.note}</p>`:""}
    <small style="color:#64748b">${formatTime(r.created_at)}</small>
  </div>`;
}

function renderFloodMap(reports) {
  ensureFloodMap(); if (!floodMap) return;
  floodMarkers.clearLayers();
  reports.forEach(r => {
    const color = SEVERITY_COLOR[r.severity]||"#38bdf8";
    const marker = L.circleMarker([r.latitude,r.longitude],
      { radius:r.severity==="high"?11:7, fillColor:color, color:"#fff", weight:1.5, fillOpacity:0.88 });
    marker.bindPopup(floodPopupHtml(r));
    if (r.village_id) {
      marker.on("popupopen", () => {
        const el = marker.getPopup().getElement();
        if (el && !el.querySelector(".go-btn")) {
          const btn = document.createElement("button");
          btn.className="go-btn"; btn.textContent=t("viewForecast");
          btn.style.cssText="margin-top:6px;width:100%;padding:5px;background:#0369a1;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:.78rem;font-weight:700";
          btn.addEventListener("click",()=>{ window.location.href="/?village="+r.village_id; });
          el.querySelector(".leaflet-popup-content").appendChild(btn);
        }
      });
    }
    floodMarkers.addLayer(marker);
  });
  setTimeout(()=>floodMap.invalidateSize(),100);
}

function renderReportList(reports) {
  const list = document.getElementById("report-list");
  const count = document.getElementById("report-count");
  if (count) count.textContent = reports.length ? `${reports.length} ${t("reportsCount")}` : t("noReportsPeriod");
  if (!list) return;
  list.innerHTML="";
  reports.slice(0,15).forEach(r=>{
    const li=document.createElement("li");
    li.innerHTML=`<strong>${typeLabel(r.report_type)}</strong> · ${r.village_name||"HP"} · ${formatTime(r.created_at)}`;
    li.addEventListener("click",()=>{
      if(!floodMap) return;
      floodMap.setView([r.latitude,r.longitude],13);
      floodMarkers.eachLayer(layer=>{
        const ll=layer.getLatLng();
        if(Math.abs(ll.lat-r.latitude)<0.001&&Math.abs(ll.lng-r.longitude)<0.001) layer.openPopup();
      });
    });
    list.appendChild(li);
  });
}

async function loadReports(period) {
  currentPeriod = period;
  document.querySelectorAll("#panel-reported .filter-row button[data-period]").forEach(b=>{
    b.classList.toggle("active", b.dataset.period===period);
  });
  try {
    const reports = await fetchReports(period);
    renderFloodMap(reports); renderReportList(reports);
  } catch(e) {
    const c=document.getElementById("report-count"); if(c) c.textContent=e.message;
  }
}

/* ── GPS ────────────────────────────────────────────────────────────────── */
function useGeolocation() {
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation){reject(new Error("GPS not available"));return;}
    navigator.geolocation.getCurrentPosition(
      pos=>resolve({lat:pos.coords.latitude,lon:pos.coords.longitude}),
      ()=>reject(new Error(t("gpsDenied"))),
      {enableHighAccuracy:true,timeout:12000}
    );
  });
}

/* ── Main export ────────────────────────────────────────────────────────── */
export function initMapReports() {
  const panel = document.getElementById("panel-reported");
  if (!panel) return;

  const input = document.getElementById("report-village-search");
  const sugg  = document.getElementById("report-village-suggestions");
  let timer;
  input?.addEventListener("input",()=>{
    clearTimeout(timer);
    timer=setTimeout(async()=>{
      const vils=await searchVillages(input.value.trim());
      if(!sugg) return;
      sugg.innerHTML="";
      vils.forEach(v=>{
        const li=document.createElement("li");
        const btn=document.createElement("button"); btn.type="button";
        btn.textContent=`${v.name}, ${v.district}`;
        btn.addEventListener("click",()=>{
          selectedVillageId=v.id; input.value=v.name;
          sugg.innerHTML=""; reportCoords={lat:v.latitude,lon:v.longitude};
        });
        li.appendChild(btn); sugg.appendChild(li);
      });
    },200);
  });

  panel.querySelectorAll(".filter-row button[data-period]").forEach(btn=>{
    btn.addEventListener("click",()=>loadReports(btn.dataset.period));
  });

  document.getElementById("btn-toggle-form")?.addEventListener("click",()=>{
    const form=document.getElementById("report-form");
    const hidden=form?.classList.toggle("hidden");
    const tb=document.getElementById("btn-toggle-form");
    if(tb) tb.textContent=hidden?t("reportFlood"):t("closeForm");
    if(!hidden){ useGeolocation().then(c=>{reportCoords=c;}).catch(()=>{}); }
  });

  document.getElementById("report-form")?.addEventListener("submit",async e=>{
    e.preventDefault();
    const status=document.getElementById("report-status");
    if(status) status.textContent=t("sending");
    try {
      if(!reportCoords) reportCoords=await useGeolocation();
      const res=await fetch(`${API}/api/flood-reports`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          report_type:document.getElementById("report-type").value,
          severity:document.getElementById("report-severity").value,
          village_id:selectedVillageId||null,
          lat:reportCoords.lat, lon:reportCoords.lon,
          note:document.getElementById("report-note")?.value.trim()||null,
        }),
      });
      if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.detail||t("submitFailed"));}
      if(status) status.textContent=t("reportSubmitted");
      document.getElementById("report-form")?.classList.add("hidden");
      const tb=document.getElementById("btn-toggle-form"); if(tb) tb.textContent=t("reportFlood");
      selectedVillageId=null; reportCoords=null;
      await loadReports(currentPeriod);
    } catch(err){ if(status) status.textContent=err.message; }
  });

  window.addEventListener("hp-map-visible",()=>{
    ensureFloodMap(); loadReports(currentPeriod);
  });
  window.addEventListener("precip-map-resize",()=>{ if(precipMap) precipMap.invalidateSize(); });

  // Keep both maps correctly sized on window resize / orientation change
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (precipMap) precipMap.invalidateSize();
      if (floodMap) floodMap.invalidateSize();
    }, 150);
  });
  window.addEventListener("hashchange",()=>{
    if(location.hash==="#reported-floods") window.dispatchEvent(new Event("hp-map-visible"));
  });
}