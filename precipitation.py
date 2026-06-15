from __future__ import annotations

from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
import re

import h5py
import numpy as np
from fastapi import APIRouter, HTTPException, Query

from backend.config import DATA_DIR
from backend.climatology import classify_against_climatology, nearest_climatology

router = APIRouter()

NC_CANDIDATES = [
    DATA_DIR / "2026_forecast_gfs_bbox_apcp.nc",
    DATA_DIR / "2026_forecast_gfs_bbox_apcp (1).nc",
    Path.home() / "Downloads" / "2026_forecast_gfs_bbox_apcp.nc",
]


def _nc_path() -> Path:
    for path in NC_CANDIDATES:
        if path.exists():
            return path
    raise FileNotFoundError("NetCDF precipitation file not found.")


def _decode(value) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")
    if hasattr(value, "item"):
        return _decode(value.item())
    return str(value)


def _time_origin(units: str) -> datetime:
    match = re.search(r"since\s+(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}:\d{2}))?", units)
    if not match:
        return datetime(1970, 1, 1)
    text = match.group(1) + " " + (match.group(2) or "00:00:00")
    return datetime.strptime(text, "%Y-%m-%d %H:%M:%S")


@lru_cache(maxsize=1)
def _load_nc():
    path = _nc_path()
    with h5py.File(path, "r") as ds:
        lat = np.array(ds["latitude"][:], dtype=float)
        lon = np.array(ds["longitude"][:], dtype=float)
        time = np.array(ds["time"][:], dtype=float)
        tp = np.array(ds["tp"][:], dtype=float)
        fill = ds["tp"].attrs.get("_FillValue")
        if fill is not None:
            tp = np.where(tp == float(np.array(fill).ravel()[0]), np.nan, tp)
        units = _decode(ds["time"].attrs.get("units", "days since 1970-01-01 00:00:00"))

    origin = _time_origin(units)
    dates = [(origin + timedelta(days=float(t))).date().isoformat() for t in time]
    return {"path": str(path), "lat": lat, "lon": lon, "time": time, "dates": dates, "tp": tp}


def _day_precip(tp: np.ndarray, idx: int) -> np.ndarray:
    idx = max(0, min(idx, tp.shape[0] - 1))
    if idx == 0:
        daily = tp[idx]
    else:
        daily = tp[idx] - tp[idx - 1]
    return np.where(np.isfinite(daily), np.maximum(daily, 0), np.nan)


@lru_cache(maxsize=4096)
def _climatology_for(lat_r: float, lon_r: float):
    """Cached climatology lookup, rounded to ~0.01 deg to limit cache size."""
    return nearest_climatology(lat_r, lon_r)


def _classified(value_mm: float, lat: float, lon: float) -> dict:
    clim = _climatology_for(round(lat, 2), round(lon, 2))
    return classify_against_climatology(value_mm, clim)


def _nearest_cell(nc: dict, lat: float, lon: float) -> tuple[int, int]:
    i = int(np.argmin(np.abs(nc["lat"] - lat)))
    j = int(np.argmin(np.abs(nc["lon"] - lon)))
    return i, j


@router.get("/precipitation/grid")
def precipitation_grid(
    day_index: int = Query(0, ge=0, le=30),
    min_lat: float = Query(28.5),   # expanded south to cover Udham Singh Nagar (UK)
    max_lat: float = Query(33.5),
    min_lon: float = Query(75.5),
    max_lon: float = Query(81.0),   # expanded east to cover Pithoragarh / eastern UK
    stride: int = Query(1, ge=1, le=4),
):
    try:
        nc = _load_nc()
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc

    lat = nc["lat"]
    lon = nc["lon"]
    idx = min(day_index, len(nc["dates"]) - 1)
    daily = _day_precip(nc["tp"], idx)

    lat_mask = (lat >= min_lat) & (lat <= max_lat)
    lon_mask = (lon >= min_lon) & (lon <= max_lon)
    lat_idx = np.where(lat_mask)[0][::stride]
    lon_idx = np.where(lon_mask)[0][::stride]
    if not len(lat_idx) or not len(lon_idx):
        raise HTTPException(404, "No NetCDF cells found for this map area.")

    lat_step = float(abs(np.nanmedian(np.diff(lat)))) if len(lat) > 1 else 0.25
    lon_step = float(abs(np.nanmedian(np.diff(lon)))) if len(lon) > 1 else 0.25
    cells = []
    for i in lat_idx:
        for j in lon_idx:
            value = daily[i, j]
            if not np.isfinite(value):
                continue
            cell_lat = float(lat[i])
            cell_lon = float(lon[j])
            classification = _classified(value, cell_lat, cell_lon)
            cells.append({
                "lat": round(cell_lat, 5),
                "lon": round(cell_lon, 5),
                "lat_min": round(float(lat[i] - lat_step / 2), 5),
                "lat_max": round(float(lat[i] + lat_step / 2), 5),
                "lon_min": round(float(lon[j] - lon_step / 2), 5),
                "lon_max": round(float(lon[j] + lon_step / 2), 5),
                "precip_mm": round(float(value), 2),
                "climatology_category": classification["category"],
                "climatology_label": classification["label"],
            })

    values = [c["precip_mm"] for c in cells]
    return {
        "source": Path(nc["path"]).name,
        "date": nc["dates"][idx],
        "day_index": idx,
        "requested_day_index": day_index,
        "available_dates": nc["dates"],
        "units": "mm",
        "cell_count": len(cells),
        "min_precip_mm": round(min(values), 2) if values else 0,
        "max_precip_mm": round(max(values), 2) if values else 0,
        "cells": cells,
    }


@router.get("/precipitation/outlook")
def precipitation_outlook(
    lat: float = Query(..., description="Latitude of the point of interest"),
    lon: float = Query(..., description="Longitude of the point of interest"),
    start_day_index: int = Query(0, ge=0, le=30),
    days: int = Query(6, ge=1, le=10),
):
    """6-day rainfall outlook for the nearest forecast grid cell to (lat, lon),
    each day classified against the 2015-2025 monsoon-season climatology so the
    forecast can be read in its historical context (normal / above-normal /
    heavy / extreme for *that* location), rather than as a bare GFS number.
    """
    try:
        nc = _load_nc()
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc

    i, j = _nearest_cell(nc, lat, lon)
    cell_lat = float(nc["lat"][i])
    cell_lon = float(nc["lon"][j])
    clim = _climatology_for(round(cell_lat, 2), round(cell_lon, 2))

    n_avail = len(nc["dates"])
    end_idx = min(start_day_index + days, n_avail)

    daily_series = []
    for idx in range(start_day_index, end_idx):
        daily = _day_precip(nc["tp"], idx)
        value = float(daily[i, j])
        if not np.isfinite(value):
            value = 0.0
        classification = classify_against_climatology(value, clim)
        daily_series.append({
            "date": nc["dates"][idx],
            "day_index": idx,
            "precip_mm": round(value, 2),
            "category": classification["category"],
            "label": classification["label"],
        })

    return {
        "source": Path(nc["path"]).name,
        "grid_lat": round(cell_lat, 5),
        "grid_lon": round(cell_lon, 5),
        "requested_lat": lat,
        "requested_lon": lon,
        "units": "mm",
        "climatology": clim,
        "days": daily_series,
    }