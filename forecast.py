"""
Forecast router — always returns LIVE data from Open-Meteo.
Falls back to DB only if Open-Meteo is unreachable.
"""
from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException

from backend.database import read_connection
from backend.climatology import classify_against_climatology, nearest_climatology
from backend.models import (
    ClimatologyInfo,
    DayForecast,
    ForecastResponse,
    PrecipBlock,
    TempHourly,
    VillageSummary,
)

router = APIRouter()

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
TIMEOUT_S = 15

WMO_TREND = {
    0: "clear", 1: "clear", 2: "clear", 3: "clear",
    45: "clear", 48: "clear",
    51: "showers", 53: "showers", 55: "showers",
    61: "showers", 63: "rainy", 65: "rainy",
    71: "clear", 73: "clear", 75: "clear", 77: "clear",
    80: "showers", 81: "rainy", 82: "rainy",
    85: "clear", 86: "clear",
    95: "rainy", 96: "rainy", 99: "rainy",
}


def _fetch_live(lat: float, lon: float, days: int = 7) -> dict:
    params = {
        "latitude": f"{lat:.4f}",
        "longitude": f"{lon:.4f}",
        "hourly": "temperature_2m,precipitation,weather_code",
        "daily": (
            "temperature_2m_max,temperature_2m_min,precipitation_sum,"
            "precipitation_probability_max,weather_code"
        ),
        "forecast_days": days,
        "timezone": "Asia/Kolkata",
    }
    url = f"{OPEN_METEO_URL}?{urllib.parse.urlencode(params)}"
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_S) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return {}


def _alert_level(precip_mm: float) -> str:
    if precip_mm >= 64.5:
        return "extreme_rain"
    if precip_mm >= 35.5:
        return "heavy_rain"
    return "none"


def _build_day_from_live(data: dict, day_index: int) -> DayForecast | None:
    daily = data.get("daily", {})
    hourly = data.get("hourly", {})
    dates = daily.get("time", [])
    if day_index >= len(dates):
        return None

    fdate = dates[day_index]
    tmax = daily.get("temperature_2m_max", [])[day_index]
    tmin = daily.get("temperature_2m_min", [])[day_index]
    precip = daily.get("precipitation_sum", [])[day_index] or 0.0
    wmo = daily.get("weather_code", [])[day_index]

    trend = WMO_TREND.get(int(wmo) if wmo is not None else 0, "clear")
    alert = _alert_level(float(precip))

    # Hourly data for this day
    h_times = hourly.get("time", [])
    h_temps = hourly.get("temperature_2m", [])
    h_prec  = hourly.get("precipitation", [])

    temp_hourly = []
    precip_3h_blocks = []
    block_acc = 0.0
    block_start = 0

    for i, t in enumerate(h_times):
        if not t.startswith(fdate):
            continue
        hour = int(t[11:13])
        tc = float(h_temps[i]) if i < len(h_temps) and h_temps[i] is not None else 0.0
        pr = float(h_prec[i]) if i < len(h_prec) and h_prec[i] is not None else 0.0
        temp_hourly.append(TempHourly(hour=hour, temp_c=round(tc, 1)))
        block_acc += pr
        if (hour + 1) % 3 == 0:
            precip_3h_blocks.append(PrecipBlock(
                block_index=hour // 3,
                block_start_hour=block_start,
                precip_mm=round(block_acc, 1),
            ))
            block_acc = 0.0
            block_start = hour + 1

    return DayForecast(
        date=fdate,
        temp_min=round(float(tmin) if tmin is not None else 0, 1),
        temp_max=round(float(tmax) if tmax is not None else 0, 1),
        precip_total_mm=round(float(precip), 1),
        trend=trend,
        alert_level=alert,
        precip_blocks=precip_3h_blocks,
        temp_hourly=temp_hourly,
    )


def _climatology_for_day(lat: float, lon: float, precip_mm: float) -> ClimatologyInfo | None:
    """Ground a forecast day's precipitation in the 2015-2025 IMERG monsoon
    climatology for this village's location, so the displayed value can be
    read in its real-world historical context rather than as a bare number."""
    clim = nearest_climatology(lat, lon)
    if not clim:
        return None
    result = classify_against_climatology(precip_mm, clim)
    return ClimatologyInfo(
        category=result["category"],
        label=result["label"],
        threshold_mm=result.get("threshold_mm"),
        threshold_key=result.get("threshold_key"),
        p50=clim.get("p50"),
        p90=clim.get("p90"),
        p99=clim.get("p99"),
    )


@router.get("/forecast/{village_id}", response_model=ForecastResponse)
def get_forecast(village_id: int):
    with read_connection() as conn:
        vrow = conn.execute(
            "SELECT id, name, block, district, state, latitude, longitude FROM villages WHERE id = ?",
            [village_id],
        ).fetchone()
        if not vrow:
            raise HTTPException(404, "Village not found")

    village = VillageSummary(
        id=vrow[0], name=vrow[1], block=vrow[2],
        district=vrow[3], state=vrow[4],
        latitude=vrow[5], longitude=vrow[6],
    )

    # Fetch live data from Open-Meteo
    live = _fetch_live(village.latitude, village.longitude, days=7)

    updated_at = datetime.now(timezone.utc).isoformat()

    if live and live.get("daily", {}).get("time"):
        today_fc = _build_day_from_live(live, 0)
        if not today_fc:
            raise HTTPException(503, "Forecast data unavailable. Try again.")
        outlook = []
        for i in range(1, 7):
            day = _build_day_from_live(live, i)
            if day:
                outlook.append(day)
    else:
        # Fallback to DB if Open-Meteo unreachable
        with read_connection() as conn:
            today = date.today()
            today_fc = _load_day_db(conn, village_id, today)
            if not today_fc:
                raise HTTPException(503, "No forecast data available. Run ETL or check internet.")
            outlook = []
            for offset in range(1, 7):
                d = today + timedelta(days=offset)
                day = _load_day_db(conn, village_id, d)
                if day:
                    outlook.append(day)
            updated_at = None

    # Ground each day's precipitation in the 2015-2025 monsoon climatology
    # for this village's exact location (real observed IMERG percentiles —
    # not a model guess), so the UI can show whether today's/each outlook
    # day's rainfall is normal / above-normal / heavy / extreme here.
    today_fc.climatology = _climatology_for_day(village.latitude, village.longitude, today_fc.precip_total_mm)
    for day in outlook:
        day.climatology = _climatology_for_day(village.latitude, village.longitude, day.precip_total_mm)

    return ForecastResponse(
        village=village,
        updated_at=updated_at,
        today=today_fc,
        outlook=outlook,
    )


def _load_day_db(conn, village_id: int, fdate: date) -> DayForecast | None:
    daily = conn.execute(
        """
        SELECT forecast_date, temp_min, temp_max, precip_total_mm, trend, alert_level
        FROM forecast_daily WHERE village_id = ? AND forecast_date = ?
        """,
        [village_id, fdate],
    ).fetchone()
    if not daily:
        return None
    blocks = conn.execute(
        """
        SELECT block_index, block_start_hour, precip_mm
        FROM forecast_precip_blocks WHERE village_id = ? AND forecast_date = ?
        ORDER BY block_index
        """,
        [village_id, fdate],
    ).fetchall()
    hourly = conn.execute(
        """
        SELECT hour, temp_c FROM forecast_temp_hourly
        WHERE village_id = ? AND forecast_date = ? ORDER BY hour
        """,
        [village_id, fdate],
    ).fetchall()
    return DayForecast(
        date=str(daily[0]),
        temp_min=daily[1], temp_max=daily[2],
        precip_total_mm=round(daily[3], 1),
        trend=daily[4], alert_level=daily[5],
        precip_blocks=[PrecipBlock(block_index=b[0], block_start_hour=b[1], precip_mm=round(b[2], 1)) for b in blocks],
        temp_hourly=[TempHourly(hour=h[0], temp_c=round(h[1], 1)) for h in hourly],
    )