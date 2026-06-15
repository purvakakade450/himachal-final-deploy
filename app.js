import {
  getForecast,
  getLiveWeather,
  getMeta,
  getVillage,
  nearestVillage,
  searchVillages,
  sendFeedback,
} from "./api.js";
import { renderDailyPrecipChart } from "./charts.js";
import { applyTranslations, getLang, setLang, t } from "./i18n.js";

const searchInput = document.getElementById("village-search");
const suggestionsEl = document.getElementById("suggestions");
const gpsBtn = document.getElementById("btn-gps");
const searchPanel = document.getElementById("search-panel");
const dashboard = document.getElementById("dashboard");
const errorEl = document.getElementById("error-box");
const dbBanner = document.getElementById("db-banner");
const feedbackFooter = document.getElementById("feedback-footer");
const metaUpdated = document.getElementById("meta-updated");

let activeVillageId = null;
let selectedOutlookIndex = 0;
let lastForecastData = null;
let debounceTimer = null;
let lastGpsCoords = null;

const TREND_ICONS = {
  clear: "☀️",
  showers: "🌦️",
  rainy: "🌧️",
  variable: "🌤️",
};
const TREND_KEYS = {
  clear: "trendClear",
  showers: "trendShowers",
  rainy: "trendRainy",
  variable: "trendVariable",
};
// Climatology anomaly categories (from backend, based on 2015-2025 IMERG
// monsoon-season percentiles for this exact village location).
const CLIM_BADGE = {
  below_normal:  { color: "#64748b", key: "climBelowNormal" },
  normal:        { color: "#22c55e", key: "climNormal" },
  above_normal:  { color: "#84cc16", key: "climAboveNormal" },
  heavy:         { color: "#f59e0b", key: "climHeavy" },
  very_heavy:    { color: "#f97316", key: "climVeryHeavy" },
  very_extreme:  { color: "#ef4444", key: "climVeryExtreme" },
  extreme:       { color: "#9c27b0", key: "climExtreme" },
};

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove("hidden");
}

function clearError() {
  errorEl.classList.add("hidden");
}

function setFeedbackEnabled(on) {
  feedbackFooter.classList.toggle("is-disabled", !on);
}

function formatUpdated(iso) {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderSuggestions(villages) {
  suggestionsEl.innerHTML = "";
  villages.forEach((v) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `${v.name}<span class="meta">${v.block}, ${v.district} · ${v.state}</span>`;
    btn.addEventListener("click", () => selectVillage(v));
    li.appendChild(btn);
    suggestionsEl.appendChild(li);
  });
}

async function onSearchInput() {
  const q = searchInput.value.trim();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      renderSuggestions(await searchVillages(q));
    } catch {
      showError(t("searchFail"));
    }
  }, 180);
}

async function selectVillage(village) {
  clearError();
  searchInput.value = village.name;
  suggestionsEl.innerHTML = "";
  history.replaceState(null, "", `?village=${village.id}`);

  document.getElementById("loading").classList.remove("hidden");
  dashboard.classList.remove("visible");
  searchPanel.classList.add("hidden");

  try {
    // Fetch ETL forecast AND live real-time weather in parallel
    const [data, liveData] = await Promise.allSettled([
      getForecast(village.id),
      getLiveWeather(village.latitude, village.longitude, village.name),
    ]);

    if (data.status === "rejected" && liveData.status === "rejected") {
      throw new Error(data.reason?.message || "Forecast unavailable");
    }

    activeVillageId = village.id;
    selectedOutlookIndex = 0;

    if (data.status === "fulfilled") {
      renderDashboard(data.value);
    }

    if (liveData.status === "fulfilled") {
      renderLiveWeather(liveData.value);
    } else {
      // Hide live weather panel if fetch failed
      const livePanel = document.getElementById("live-weather-panel");
      if (livePanel) livePanel.classList.add("hidden");
    }

    dashboard.classList.add("visible");
    setFeedbackEnabled(true);
  } catch (e) {
    showError(e.message);
    searchPanel.classList.remove("hidden");
    setFeedbackEnabled(false);
  } finally {
    document.getElementById("loading").classList.add("hidden");
  }
}

function formatDayLabel(isoDate) {
  const d = new Date(isoDate + "T12:00:00");
  const locale = getLang() === "hi" ? "hi-IN" : "en-IN";
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

function updateAlert(day) {
  const alert = document.getElementById("alert-banner");
  if (day.alert_level === "extreme_rain") {
    alert.classList.add("show");
    alert.innerHTML = `⚠️ <span><strong>${t("extremeAlert")}</strong></span>`;
  } else if (day.alert_level === "heavy_rain") {
    alert.classList.add("show");
    alert.innerHTML = `⚠️ <span><strong>${t("heavyAlert")}</strong></span>`;
  } else {
    alert.classList.remove("show");
  }
}

function renderDayStats(day, prefix) {
  const trendEl = document.getElementById(`${prefix}-trend`);
  const icon = TREND_ICONS[day.trend] || "🌡️";
  trendEl.textContent = `${icon} ${t(TREND_KEYS[day.trend] || day.trend)}`;
  document.getElementById(`${prefix}-temp-min`).textContent = `${Math.round(day.temp_min)}°`;
  document.getElementById(`${prefix}-temp-max`).textContent = `${Math.round(day.temp_max)}°`;
  document.getElementById(`${prefix}-rain`).textContent = `${day.precip_total_mm}`;

  const climEl = document.getElementById(`${prefix}-clim`);
  if (climEl) {
    const clim = day.climatology;
    const badge = clim ? CLIM_BADGE[clim.category] : null;
    if (badge) {
      climEl.style.display = "inline-flex";
      climEl.style.background = badge.color;
      climEl.textContent = t(badge.key);
      climEl.title = clim.label;
    } else {
      climEl.style.display = "none";
    }
  }
}

function renderToday(day) {
  renderDayStats(day, "today");
  updateAlert(day);
}

function renderOutlookDay(day) {
  renderDayStats(day, "outlook");
}

function renderDailyPrecipOverview(data) {
  const days = [data.today, ...(data.outlook || [])];
  renderDailyPrecipChart(document.getElementById("precip-chart"), days, "precip-daily");
}

function renderOutlookTabs(data) {
  const tabs = document.getElementById("outlook-tabs");
  tabs.innerHTML = "";
  const days = data.outlook || [];
  days.forEach((day, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = formatDayLabel(day.date);
    btn.classList.toggle("active", i === selectedOutlookIndex);
    btn.addEventListener("click", () => {
      selectedOutlookIndex = i;
      [...tabs.children].forEach((c, j) => c.classList.toggle("active", j === i));
      renderOutlookDay(days[i]);
      updateAlert(days[i]);
    });
    tabs.appendChild(btn);
  });
  if (days.length) {
    renderOutlookDay(days[selectedOutlookIndex]);
  }
}

function renderDashboard(data) {
  lastForecastData = data;
  document.getElementById("village-name").textContent = data.village.name;
  document.getElementById("village-meta").textContent =
    `${data.village.block}, ${data.village.district} · ${data.village.state}`;

  const upd = document.getElementById("forecast-updated");
  if (data.updated_at) {
    upd.textContent = `${t("updated")}: ${formatUpdated(data.updated_at)}`;
    upd.classList.remove("hidden");
  } else {
    upd.classList.add("hidden");
  }

  renderToday(data.today);
  renderOutlookTabs(data);
  renderDailyPrecipOverview(data);
  updateAlert(data.today);

  document.querySelectorAll(".feedback-buttons button").forEach((b) => {
    b.classList.remove("sent");
    b.disabled = false;
  });
  document.getElementById("feedback-status").textContent = "";
}

async function onGpsClick() {
  clearError();
  if (!navigator.geolocation) {
    showError(t("noGps"));
    return;
  }
  gpsBtn.disabled = true;
  gpsBtn.textContent = t("gpsLoading");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      lastGpsCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      try {
        const v = await nearestVillage(pos.coords.latitude, pos.coords.longitude);
        await selectVillage(v);
      } catch (e) {
        // Give a helpful message if out of coverage area
        const msg = e.message || "Location not found.";
        if (msg.includes("outside") || msg.includes("coverage") || msg.includes("too far") || msg.includes("404")) {
          showError("📍 Your location is outside our coverage area. This portal covers Himachal Pradesh & Uttarakhand only. Please search for a village manually.");
        } else {
          showError(msg);
        }
      } finally {
        gpsBtn.disabled = false;
        gpsBtn.textContent = `📍 ${t("gps")}`;
      }
    },
    () => {
      showError(t("gpsDenied"));
      gpsBtn.disabled = false;
      gpsBtn.textContent = `📍 ${t("gps")}`;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

async function onFeedback(rating, btn) {
  if (!activeVillageId) return;
  // Deselect all feedback buttons first
  document.querySelectorAll(".feedback-buttons button").forEach((b) => {
    b.classList.remove("sent");
    b.disabled = false;
  });
  btn.disabled = true;
  btn.classList.add("sent");
  try {
    await sendFeedback(activeVillageId, rating, lastGpsCoords || {});
    document.getElementById("feedback-status").textContent = t("thanks");
  } catch {
    document.getElementById("feedback-status").textContent = t("feedbackFail");
    btn.disabled = false;
    btn.classList.remove("sent");
  }
}

// ── Live real-time clock ──────────────────────────────────────────────────
let _metaVillageCount = null;
let _clockInterval = null;

function startLiveClock() {
  if (_clockInterval) return; // already running — don't create a second one
  function tick() {
    const now = new Date();
    const locale = getLang() === "hi" ? "hi-IN" : "en-IN";
    const timeStr = now.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const countPart =
      _metaVillageCount != null ? ` \u00b7 ${_metaVillageCount} ${t("villagesLabel")}` : "";
    metaUpdated.textContent = `${t("updated")}: ${timeStr}${countPart}`;
    metaUpdated.classList.remove("hidden");
  }
  tick(); // render immediately without waiting 1 s
  _clockInterval = setInterval(tick, 1000);
}

// Silently re-fetch village count every 60 s so the number stays fresh
function startMetaPolling() {
  setInterval(async () => {
    try {
      const meta = await getMeta();
      if (meta.village_count != null) _metaVillageCount = meta.village_count;
    } catch {
      /* silent — clock keeps ticking regardless */
    }
  }, 60_000);
}

async function checkMeta() {
  try {
    const meta = await getMeta();
    if (meta.village_count != null) _metaVillageCount = meta.village_count;
    dbBanner.classList.add("hidden");
    startLiveClock();   // start ticking immediately
    startMetaPolling(); // refresh count every minute
    return true;
  } catch (e) {
    dbBanner.textContent = e.message || t("dbNotReady");
    dbBanner.classList.remove("hidden");
    startLiveClock(); // still show live time even if backend is down
    return false;
  }
}

async function initFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get("village"), 10);
  if (!id) return;
  try {
    const v = await getVillage(id);
    await selectVillage(v);
  } catch {
    /* stay on search */
  }
}

function refreshDynamicText() {
  // Re-render trend labels, outlook day-tab dates, and the dashboard
  // (charts already drawn fine; only text needs to follow the new language)
  if (lastForecastData && dashboard.classList.contains("visible")) {
    renderToday(lastForecastData.today);
    renderOutlookTabs(lastForecastData);
    updateAlert(lastForecastData.today);
  }
}

function setupLangToggle() {
  const enBtn = document.getElementById("lang-en");
  const hiBtn = document.getElementById("lang-hi");

  function syncButtons() {
    const isHi = getLang() === "hi";
    enBtn.classList.toggle("active", !isHi);
    hiBtn.classList.toggle("active", isHi);
    enBtn.setAttribute("aria-pressed", String(!isHi));
    hiBtn.setAttribute("aria-pressed", String(isHi));
  }

  enBtn.addEventListener("click", () => {
    setLang("en");
    applyTranslations();
    syncButtons();
    refreshDynamicText();
    window.dispatchEvent(new Event("lang-changed"));
  });
  hiBtn.addEventListener("click", () => {
    setLang("hi");
    applyTranslations();
    syncButtons();
    refreshDynamicText();
    window.dispatchEvent(new Event("lang-changed"));
  });
  syncButtons();
}

export function initForecast() {
  searchInput.addEventListener("input", onSearchInput);
  gpsBtn.addEventListener("click", onGpsClick);
  document.getElementById("btn-change-village").addEventListener("click", () => {
    searchPanel.classList.remove("hidden");
    dashboard.classList.remove("visible");
    setFeedbackEnabled(false);
    activeVillageId = null;
    const hash = location.hash === "#reported-floods" ? "#reported-floods" : "#rainfall";
    history.replaceState(null, "", window.location.pathname + hash);
    searchInput.focus();
  });
  document.querySelectorAll(".feedback-buttons button").forEach((btn) => {
    btn.addEventListener("click", () => onFeedback(btn.dataset.rating, btn));
  });

  applyTranslations();
  setupLangToggle();
  setFeedbackEnabled(false);

  (async () => {
    const ready = await checkMeta();
    if (ready) {
      try {
        renderSuggestions(await searchVillages(""));
      } catch {
        /* ignore */
      }
    }
    await initFromUrl();
  })();
}

const ALERT_COLORS = {
  extreme: "#ef4444",
  heavy:   "#f97316",
  moderate:"#eab308",
  light:   "#60a5fa",
  none:    "#22c55e",
};

function renderLiveWeather(live) {
  let panel = document.getElementById("live-weather-panel");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "live-weather-panel";
    panel.className = "card live-weather-card";
    dashboard.parentNode.insertBefore(panel, dashboard);
  }
  panel.classList.remove("hidden");

  const cur = live.current;
  const isDay = cur.is_day;

  const wmoEmoji = (code) => {
    if (code == null) return "🌡️";
    if (code === 0) return isDay ? "☀️" : "🌙";
    if (code <= 3) return "⛅";
    if (code <= 48) return "🌫️";
    if (code <= 55) return "🌦️";
    if (code <= 65) return "🌧️";
    if (code <= 77) return "❄️";
    if (code <= 82) return "🌦️";
    if (code <= 86) return "🌨️";
    return "⛈️";
  };

  const fetchedTime = new Date(live.fetched_at).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  const dailyRows = live.daily.map(d => {
    const color = ALERT_COLORS[d.alert_level] || "#22c55e";
    const prob = d.precipitation_probability_pct != null
      ? `<span class="lw-prob">${d.precipitation_probability_pct}%</span>` : "";
    return `
      <div class="lw-day-row">
        <span class="lw-day-date">${new Date(d.date + "T12:00:00").toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short" })}</span>
        <span class="lw-day-icon">${wmoEmoji(d.weather_code)}</span>
        <span class="lw-day-desc">${d.description}</span>
        <span class="lw-day-temps">${d.temp_min_c}° – ${d.temp_max_c}°C</span>
        <span class="lw-day-rain" style="color:${color}">${d.precip_total_mm} mm ${prob}</span>
        <span class="lw-alert-dot" style="background:${color}" title="${d.alert_level}"></span>
      </div>`;
  }).join("");

  panel.innerHTML = `
    <div class="lw-header">
      <div>
        <h3 class="lw-title">${wmoEmoji(cur.weather_code)} Live Weather <span class="lw-badge">LIVE</span></h3>
        <p class="lw-subtitle">Real-time · fetched ${fetchedTime} · ${live.timezone}</p>
      </div>
    </div>
    <div class="lw-current-grid">
      <div class="lw-stat">
        <span class="lw-stat-label">Temperature</span>
        <span class="lw-stat-value">${cur.temperature_c}°C</span>
        ${cur.feels_like_c != null ? `<span class="lw-stat-sub">Feels ${cur.feels_like_c}°C</span>` : ""}
      </div>
      <div class="lw-stat">
        <span class="lw-stat-label">Condition</span>
        <span class="lw-stat-value lw-stat-desc">${cur.description}</span>
      </div>
      <div class="lw-stat">
        <span class="lw-stat-label">Rain now</span>
        <span class="lw-stat-value">${cur.precipitation_mm} mm</span>
      </div>
      ${cur.humidity_pct != null ? `<div class="lw-stat"><span class="lw-stat-label">Humidity</span><span class="lw-stat-value">${cur.humidity_pct}%</span></div>` : ""}
      ${cur.wind_speed_kmh != null ? `<div class="lw-stat"><span class="lw-stat-label">Wind</span><span class="lw-stat-value">${cur.wind_speed_kmh} km/h</span>${cur.wind_direction_deg != null ? `<span class="lw-stat-sub">${cur.wind_direction_deg}°</span>` : ""}</div>` : ""}
    </div>
    <div class="lw-daily">
      <h4 class="lw-section-title">6-Day Forecast</h4>
      <div class="lw-days">${dailyRows}</div>
    </div>
    <p class="lw-source">Source: <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo</a> — real-time, no API key, always live</p>
  `;
}