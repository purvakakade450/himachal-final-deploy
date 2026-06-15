import { nearestVillage, searchVillages } from "./api.js";

const API = window.location.origin;
const HP_CENTER = [31.85, 77.2];
const HP_ZOOM = 8;
const HP_BOUNDS = [
  [30.2, 75.5],
  [33.5, 79.6],
];

const TYPE_LABELS = {
  flood: "Flood",
  waterlogging: "Waterlogging",
  landslide: "Landslide",
  road_blocked: "Road blocked",
  cloudburst: "Cloudburst",
};

const SEVERITY_COLOR = {
  high: "#f87171",
  moderate: "#fbbf24",
  low: "#94a3b8",
};

let map;
let markersLayer;
let currentPeriod = "today";
let reportCoords = null;
let selectedVillageId = null;

function formatTime(iso) {
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchReports(period) {
  const res = await fetch(`${API}/api/flood-reports?period=${period}&state=Himachal%20Pradesh`);
  if (!res.ok) throw new Error("Could not load reports");
  return res.json();
}

function popupHtml(r) {
  const place = r.village_name
    ? `<strong>${r.village_name}</strong>${r.district ? ` · ${r.district}` : ""}`
    : "Reported location";
  return `
    <div>
      <div class="severity-${r.severity}">${TYPE_LABELS[r.report_type] || r.report_type} · ${r.severity}</div>
      <div>${place}</div>
      ${r.note ? `<p style="margin:0.35rem 0 0">${r.note}</p>` : ""}
      <small style="color:#64748b">${formatTime(r.created_at)}</small>
    </div>
  `;
}

function renderMap(reports) {
  if (!map) {
    map = L.map("hp-map", { maxBounds: HP_BOUNDS, minZoom: 7 }).setView(HP_CENTER, HP_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 18,
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
  }
  markersLayer.clearLayers();
  reports.forEach((r) => {
    const color = SEVERITY_COLOR[r.severity] || "#38bdf8";
    const marker = L.circleMarker([r.latitude, r.longitude], {
      radius: r.severity === "high" ? 10 : 7,
      fillColor: color,
      color: "#0f172a",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85,
    });
    marker.bindPopup(popupHtml(r));
    markersLayer.addLayer(marker);
  });
  if (reports.length === 1) {
    map.setView([reports[0].latitude, reports[0].longitude], 11);
  }
}

function renderList(reports) {
  const list = document.getElementById("report-list");
  const count = document.getElementById("report-count");
  count.textContent =
    reports.length === 0
      ? "No reports for this period yet. Be the first to report."
      : `${reports.length} report(s) on map`;
  list.innerHTML = "";
  reports.slice(0, 12).forEach((r) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${TYPE_LABELS[r.report_type]}</strong> · ${r.village_name || "HP"} · ${formatTime(r.created_at)}`;
    li.addEventListener("click", () => {
      map.setView([r.latitude, r.longitude], 13);
      markersLayer.eachLayer((layer) => {
        const latlng = layer.getLatLng();
        if (
          Math.abs(latlng.lat - r.latitude) < 0.001 &&
          Math.abs(latlng.lng - r.longitude) < 0.001
        ) {
          layer.openPopup();
        }
      });
    });
    list.appendChild(li);
  });
}

async function loadReports(period) {
  currentPeriod = period;
  document.querySelectorAll(".filter-row button").forEach((b) => {
    b.classList.toggle("active", b.dataset.period === period);
  });
  try {
    const reports = await fetchReports(period);
    renderMap(reports);
    renderList(reports);
  } catch (e) {
    document.getElementById("report-count").textContent = e.message;
  }
}

function useGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => reject(new Error("Allow location to report")),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });
}

async function setupVillageSearch() {
  const input = document.getElementById("report-village-search");
  const suggestions = document.getElementById("report-village-suggestions");
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = input.value.trim();
      const hpOnly = await searchVillages(q, "Himachal Pradesh");
      suggestions.innerHTML = "";
      hpOnly.forEach((v) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = `${v.name}, ${v.district}`;
        btn.addEventListener("click", () => {
          selectedVillageId = v.id;
          document.getElementById("report-village-id").value = v.id;
          input.value = v.name;
          suggestions.innerHTML = "";
          reportCoords = { lat: v.latitude, lon: v.longitude };
        });
        li.appendChild(btn);
        suggestions.appendChild(li);
      });
    }, 200);
  });
}

document.querySelectorAll(".filter-row button").forEach((btn) => {
  btn.addEventListener("click", () => loadReports(btn.dataset.period));
});

document.getElementById("btn-toggle-form").addEventListener("click", () => {
  const form = document.getElementById("report-form");
  const open = form.classList.toggle("hidden");
  document.getElementById("btn-toggle-form").textContent = open
    ? "Report incident"
    : "Close form";
  if (!open) {
    useGeolocation()
      .then((c) => {
        reportCoords = c;
      })
      .catch(() => {
        document.getElementById("report-status").textContent =
          "Turn on GPS or pick a village below.";
      });
  }
});

document.getElementById("report-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = document.getElementById("report-status");
  status.textContent = "Sending…";
  try {
    if (!reportCoords) {
      reportCoords = await useGeolocation();
    }
    const body = {
      report_type: document.getElementById("report-type").value,
      severity: document.getElementById("report-severity").value,
      village_id: selectedVillageId || null,
      lat: reportCoords.lat,
      lon: reportCoords.lon,
      note: document.getElementById("report-note").value.trim() || null,
    };
    const res = await fetch(`${API}/api/flood-reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Submit failed");
    }
    status.textContent = "Thank you — report added to the map.";
    document.getElementById("report-form").reset();
    selectedVillageId = null;
    await loadReports(currentPeriod);
  } catch (err) {
    status.textContent = err.message;
  }
});

setupVillageSearch();
loadReports("today");
