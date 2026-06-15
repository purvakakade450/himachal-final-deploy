"""
Climatology reference (2015-2025 regridded IMERG, monsoon-season percentiles).

Provides per-pixel daily-rainfall percentile thresholds (p50/p75/p90/p95/p99/p99.9
in mm/day) used to judge whether a forecast value for a given grid cell is
"normal" or anomalously high/low for that location, based on 11 years of
observed monsoon-season precipitation climatology.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import numpy as np
from scipy.io import netcdf_file

from backend.config import DATA_DIR

CLIM_CANDIDATES = [
    DATA_DIR / "Climatology_2015_2025_regIMERG.nc",
    DATA_DIR / "Climatology_2015_2025_regIMERG (1).nc",
]

# Ordered low → high. Keys map to the variable names inside the NetCDF file.
PERCENTILE_KEYS = ["p50", "p75", "p90", "p95", "p99", "p99.9"]

# Human-readable anomaly categories, evaluated from the highest threshold down.
# Each entry: (percentile key the value must reach/exceed, code, label)
CATEGORY_LADDER = [
    ("p99.9", "extreme",      "Extreme — above 99.9th percentile (rarest, severe-event range)"),
    ("p99",   "very_extreme", "Very extreme — above 99th percentile for this location"),
    ("p95",   "very_heavy",   "Very heavy — above 95th percentile for this location"),
    ("p90",   "heavy",        "Heavy — above 90th percentile for this location"),
    ("p75",   "above_normal", "Above normal — above 75th percentile for this location"),
    ("p50",   "normal",       "Normal — around the median for this location"),
]
BELOW_NORMAL = ("below_normal", "Below normal — drier than the median for this location")


def _clim_path() -> Path:
    for path in CLIM_CANDIDATES:
        if path.exists():
            return path
    raise FileNotFoundError("Climatology NetCDF file not found.")


@lru_cache(maxsize=1)
def _load_climatology():
    path = _clim_path()
    with netcdf_file(path, "r", mmap=False) as ds:
        lat = np.array(ds.variables["lat"].data, dtype=float)
        lon = np.array(ds.variables["lon"].data, dtype=float)
        percentiles = {}
        for key in PERCENTILE_KEYS:
            arr = np.array(ds.variables[key].data, dtype=float)
            percentiles[key] = arr
    return {"path": str(path), "lat": lat, "lon": lon, "percentiles": percentiles}


def _nearest_index(values: np.ndarray, target: float) -> int:
    return int(np.argmin(np.abs(values - target)))


def nearest_climatology(lat: float, lon: float) -> dict | None:
    """Return the climatology percentile thresholds (mm/day) for the grid
    cell nearest to (lat, lon), or None if the climatology file is missing."""
    try:
        clim = _load_climatology()
    except FileNotFoundError:
        return None

    i = _nearest_index(clim["lat"], lat)
    j = _nearest_index(clim["lon"], lon)

    out = {
        "source": Path(clim["path"]).name,
        "grid_lat": round(float(clim["lat"][i]), 4),
        "grid_lon": round(float(clim["lon"][j]), 4),
        "units": "mm/day",
        "period": "2015-2025 monsoon-season climatology (regridded IMERG)",
    }
    for key in PERCENTILE_KEYS:
        value = clim["percentiles"][key][i, j]
        out[key.replace(".", "_")] = round(float(value), 2) if np.isfinite(value) else None
    return out


def classify_against_climatology(value_mm: float, clim: dict | None) -> dict:
    """Classify a forecast precipitation value (mm/day) against the local
    climatology, returning a category code + human-readable label."""
    if not clim:
        return {"category": "unknown", "label": "Climatology unavailable for this location"}

    for key, code, label in CATEGORY_LADDER:
        threshold = clim.get(key.replace(".", "_"))
        if threshold is not None and value_mm >= threshold:
            return {"category": code, "label": label, "threshold_mm": threshold, "threshold_key": key}

    p50 = clim.get("p50")
    return {
        "category": BELOW_NORMAL[0],
        "label": BELOW_NORMAL[1],
        "threshold_mm": p50,
        "threshold_key": "p50",
    }
