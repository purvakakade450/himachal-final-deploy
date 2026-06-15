"""
Real-time weather endpoint.

GET /api/weather/live?lat=<lat>&lon=<lon>&name=<optional>

Fetches current + 5-day forecast directly from Open-Meteo (free, no API key).
Always returns fresh data – no ETL or database required.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
TIMEOUT_S = 15

WMO_CODES: dict[int, str] = {
    0: "Clear sky",
    1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Icy fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    77: "Snow grains",
    80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
    85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm + hail", 99: "Thunderstorm + heavy hail",
}

ALERT_THRESHOLDS = {
    "extreme": 64.5,   # mm/day
    "heavy":   35.5,
    "moderate": 7.6,
    "light":    2.5,
}


def _wmo_description(code: int | None) -> str:
    if code is None:
        return "Unknown"
    return WMO_CODES.get(int(code), f"Code {code}")


def _alert_level(precip_mm: float) -> str:
    if precip_mm >= ALERT_THRESHOLDS["extreme"]:
        return "extreme"
    if precip_mm >= ALERT_THRESHOLDS["heavy"]:
        return "heavy"
    if precip_mm >= ALERT_THRESHOLDS["moderate"]:
        return "moderate"
    if precip_mm >= ALERT_THRESHOLDS["light"]:
        return "light"
    return "none"


# ── Pydantic response models ──────────────────────────────────────────────────

class CurrentWeather(BaseModel):
    time: str
    temperature_c: float
    feels_like_c: float | None
    humidity_pct: float | None
    wind_speed_kmh: float | None
    wind_direction_deg: float | None
    precipitation_mm: float
    weather_code: int | None
    description: str
    is_day: bool


class DailyForecast(BaseModel):
    date: str
    temp_min_c: float
    temp_max_c: float
    precip_total_mm: float
    precipitation_probability_pct: float | None
    weather_code: int | None
    description: str
    alert_level: str
    sunrise: str | None
    sunset: str | None


class HourlyPoint(BaseModel):
    time: str
    temp_c: float
    precip_mm: float
    humidity_pct: float | None
    weather_code: int | None
    description: str


class LiveWeatherResponse(BaseModel):
    location_name: str
    latitude: float
    longitude: float
    timezone: str
    fetched_at: str
    source: str
    current: CurrentWeather
    hourly_today: list[HourlyPoint]
    daily: list[DailyForecast]


# ── Helper ────────────────────────────────────────────────────────────────────

def _fetch_open_meteo(lat: float, lon: float) -> dict:
    params = {
        "latitude": f"{lat:.4f}",
        "longitude": f"{lon:.4f}",
        "current": (
            "temperature_2m,apparent_temperature,relative_humidity_2m,"
            "precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day"
        ),
        "hourly": (
            "temperature_2m,precipitation,relative_humidity_2m,weather_code"
        ),
        "daily": (
            "temperature_2m_max,temperature_2m_min,precipitation_sum,"
            "precipitation_probability_max,weather_code,sunrise,sunset"
        ),
        "forecast_days": 6,
        "timezone": "Asia/Kolkata",
    }
    url = f"{OPEN_METEO_URL}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_S) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise HTTPException(502, f"Open-Meteo API error: {e.code} {e.reason}")
    except (urllib.error.URLError, TimeoutError) as e:
        raise HTTPException(504, f"Could not reach Open-Meteo: {e}")
    except json.JSONDecodeError as e:
        raise HTTPException(502, f"Invalid response from Open-Meteo: {e}")


def _safe(val, default=None):
    """Return val if not None, else default."""
    return default if val is None else val


# ── Route ─────────────────────────────────────────────────────────────────────

@router.get("/weather/live", response_model=LiveWeatherResponse)
def live_weather(
    lat: float = Query(..., ge=8.0, le=37.5, description="Latitude (India range)"),
    lon: float = Query(..., ge=68.0, le=97.5, description="Longitude (India range)"),
    name: str = Query("", max_length=100, description="Optional location name"),
):
    """
    Fetch real-time weather + 6-day forecast for any lat/lon.
    Data comes live from Open-Meteo — no cache, always fresh.
    """
    data = _fetch_open_meteo(lat, lon)

    cur = data.get("current", {})
    cur_units = data.get("current_units", {})
    hourly = data.get("hourly", {})
    daily = data.get("daily", {})
    tz = data.get("timezone", "Asia/Kolkata")

    # ── Current ──────────────────────────────────────────────────────────────
    current = CurrentWeather(
        time=_safe(cur.get("time"), ""),
        temperature_c=round(_safe(cur.get("temperature_2m"), 0.0), 1),
        feels_like_c=round(cur["apparent_temperature"], 1) if cur.get("apparent_temperature") is not None else None,
        humidity_pct=cur.get("relative_humidity_2m"),
        wind_speed_kmh=cur.get("wind_speed_10m"),
        wind_direction_deg=cur.get("wind_direction_10m"),
        precipitation_mm=round(_safe(cur.get("precipitation"), 0.0), 1),
        weather_code=cur.get("weather_code"),
        description=_wmo_description(cur.get("weather_code")),
        is_day=bool(cur.get("is_day", 1)),
    )

    # ── Hourly (today only — next 24 h) ──────────────────────────────────────
    h_times = hourly.get("time", [])
    h_temps = hourly.get("temperature_2m", [])
    h_prec  = hourly.get("precipitation", [])
    h_hum   = hourly.get("relative_humidity_2m", [])
    h_wmo   = hourly.get("weather_code", [])

    today_str = cur.get("time", "")[:10]  # "YYYY-MM-DD"
    hourly_today: list[HourlyPoint] = []
    for i, t in enumerate(h_times):
        if not t.startswith(today_str):
            continue
        hourly_today.append(HourlyPoint(
            time=t,
            temp_c=round(float(h_temps[i]) if i < len(h_temps) and h_temps[i] is not None else 0, 1),
            precip_mm=round(float(h_prec[i]) if i < len(h_prec) and h_prec[i] is not None else 0, 1),
            humidity_pct=h_hum[i] if i < len(h_hum) else None,
            weather_code=h_wmo[i] if i < len(h_wmo) else None,
            description=_wmo_description(h_wmo[i] if i < len(h_wmo) else None),
        ))

    # ── Daily ─────────────────────────────────────────────────────────────────
    d_dates   = daily.get("time", [])
    d_tmax    = daily.get("temperature_2m_max", [])
    d_tmin    = daily.get("temperature_2m_min", [])
    d_prec    = daily.get("precipitation_sum", [])
    d_prob    = daily.get("precipitation_probability_max", [])
    d_wmo     = daily.get("weather_code", [])
    d_sunrise = daily.get("sunrise", [])
    d_sunset  = daily.get("sunset", [])

    daily_forecasts: list[DailyForecast] = []
    for i, dt in enumerate(d_dates):
        precip = float(d_prec[i]) if i < len(d_prec) and d_prec[i] is not None else 0.0
        daily_forecasts.append(DailyForecast(
            date=dt,
            temp_min_c=round(float(d_tmin[i]) if i < len(d_tmin) and d_tmin[i] is not None else 0, 1),
            temp_max_c=round(float(d_tmax[i]) if i < len(d_tmax) and d_tmax[i] is not None else 0, 1),
            precip_total_mm=round(precip, 1),
            precipitation_probability_pct=d_prob[i] if i < len(d_prob) else None,
            weather_code=d_wmo[i] if i < len(d_wmo) else None,
            description=_wmo_description(d_wmo[i] if i < len(d_wmo) else None),
            alert_level=_alert_level(precip),
            sunrise=d_sunrise[i] if i < len(d_sunrise) else None,
            sunset=d_sunset[i] if i < len(d_sunset) else None,
        ))

    return LiveWeatherResponse(
        location_name=name.strip() or f"{lat:.3f}°N, {lon:.3f}°E",
        latitude=lat,
        longitude=lon,
        timezone=tz,
        fetched_at=datetime.now(timezone.utc).isoformat(),
        source="Open-Meteo (https://open-meteo.com) — real-time, no cache",
        current=current,
        hourly_today=hourly_today,
        daily=daily_forecasts,
    )