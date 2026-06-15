const API_BASE = window.location.origin;

function parseApiError(payload, fallback) {
  if (!payload || !payload.detail) return fallback;
  const d = payload.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
  return fallback;
}

async function parseResponse(res, fallback) {
  if (res.ok) return res.json();
  const err = await res.json().catch(() => ({}));
  throw new Error(parseApiError(err, fallback));
}

export async function getMeta() {
  const res = await fetch(`${API_BASE}/api/meta`);
  return parseResponse(res, "Service unavailable");
}

export async function searchVillages(query, state = null) {
  const q = encodeURIComponent(query || "");
  const st = state ? `&state=${encodeURIComponent(state)}` : "";
  const res = await fetch(`${API_BASE}/api/villages/search?q=${q}${st}`);
  return parseResponse(res, "Search failed");
}

export async function getVillage(villageId) {
  const res = await fetch(`${API_BASE}/api/villages/${villageId}`);
  return parseResponse(res, "Village not found");
}

export async function nearestVillage(lat, lon) {
  const res = await fetch(
    `${API_BASE}/api/villages/nearest?lat=${lat}&lon=${lon}`
  );
  return parseResponse(res, "Could not find nearest village");
}

export async function getForecast(villageId) {
  const res = await fetch(`${API_BASE}/api/forecast/${villageId}`);
  return parseResponse(res, "Forecast unavailable");
}

export async function sendFeedback(villageId, rating, coords = {}) {
  const res = await fetch(`${API_BASE}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      village_id: villageId,
      rating,
      client_lat: coords.lat ?? null,
      client_lon: coords.lon ?? null,
    }),
  });
  return parseResponse(res, "Could not save feedback");
}

/**
 * Fetch LIVE real-time weather directly from Open-Meteo (no ETL needed).
 * @param {number} lat
 * @param {number} lon
 * @param {string} [name]  Optional display name
 */
export async function getLiveWeather(lat, lon, name = "") {
  const n = name ? `&name=${encodeURIComponent(name)}` : "";
  const res = await fetch(
    `${API_BASE}/api/weather/live?lat=${lat}&lon=${lon}${n}`
  );
  return parseResponse(res, "Real-time weather unavailable");
}