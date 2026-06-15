import math

from fastapi import APIRouter, HTTPException, Query

from backend.database import read_connection
from backend.models import VillageSummary

router = APIRouter()


def _row_to_village(row) -> VillageSummary:
    return VillageSummary(
        id=row[0],
        name=row[1],
        block=row[2],
        district=row[3],
        state=row[4],
        latitude=row[5],
        longitude=row[6],
    )


@router.get("/villages/search", response_model=list[VillageSummary])
def search_villages(
    q: str = Query("", min_length=0, max_length=80),
    state: str | None = Query(None, max_length=40),
):
    q = q.strip().lower()
    with read_connection() as conn:
        if not q:
            if state:
                rows = conn.execute(
                    """
                    SELECT id, name, block, district, state, latitude, longitude
                    FROM villages WHERE state = ? ORDER BY name LIMIT 20
                    """,
                    [state],
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT id, name, block, district, state, latitude, longitude
                    FROM villages ORDER BY name LIMIT 15
                    """
                ).fetchall()
        else:
            like = f"%{q}%"
            prefix = f"{q}%"
            if state:
                rows = conn.execute(
                    """
                    SELECT id, name, block, district, state, latitude, longitude
                    FROM villages
                    WHERE state = ?
                      AND (lower(name) LIKE ? OR lower(block) LIKE ?
                           OR lower(district) LIKE ? OR lower(name || ' ' || block) LIKE ?)
                    ORDER BY
                        CASE WHEN lower(name) = ? THEN 0
                             WHEN lower(name) LIKE ? THEN 1
                             ELSE 2 END,
                        name
                    LIMIT 20
                    """,
                    [state, like, like, like, like, q, prefix],
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT id, name, block, district, state, latitude, longitude
                    FROM villages
                    WHERE lower(name) LIKE ?
                       OR lower(block) LIKE ?
                       OR lower(district) LIKE ?
                       OR lower(state) LIKE ?
                       OR lower(name || ' ' || block) LIKE ?
                    ORDER BY
                        CASE WHEN lower(name) = ? THEN 0
                             WHEN lower(name) LIKE ? THEN 1
                             WHEN lower(block) LIKE ? THEN 2
                             ELSE 3 END,
                        name
                    LIMIT 20
                    """,
                    [like, like, like, like, like, q, prefix, prefix],
                ).fetchall()
        return [_row_to_village(r) for r in rows]


@router.get("/villages/all", response_model=list[VillageSummary])
def all_villages(state: str | None = Query(None, max_length=40)):
    """Return all villages for map overlay — no search filter."""
    with read_connection() as conn:
        if state:
            rows = conn.execute(
                "SELECT id, name, block, district, state, latitude, longitude FROM villages WHERE state = ? ORDER BY name",
                [state],
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, name, block, district, state, latitude, longitude FROM villages ORDER BY name"
            ).fetchall()
    return [_row_to_village(r) for r in rows]


@router.get("/villages/nearest", response_model=VillageSummary)
def nearest_village(
    lat: float = Query(..., ge=6.0, le=37.5),
    lon: float = Query(..., ge=68.0, le=97.5),
):
    # Bounding box: Himachal Pradesh + Uttarakhand only
    HP_UK_LAT_MIN, HP_UK_LAT_MAX = 28.5, 33.5
    HP_UK_LON_MIN, HP_UK_LON_MAX = 75.0, 81.5
    if not (HP_UK_LAT_MIN <= lat <= HP_UK_LAT_MAX and HP_UK_LON_MIN <= lon <= HP_UK_LON_MAX):
        raise HTTPException(
            404,
            "📍 Your location is outside the coverage area. "
            "This portal covers Himachal Pradesh and Uttarakhand only. "
            "Please search for a village manually.",
        )
    with read_connection() as conn:
        rows = conn.execute(
            "SELECT id, name, block, district, state, latitude, longitude FROM villages"
        ).fetchall()
        if not rows:
            raise HTTPException(404, "No villages in registry")
        best = min(rows, key=lambda r: (r[5] - lat) ** 2 + (r[6] - lon) ** 2)
        dist_km = _haversine_km(lat, lon, best[5], best[6])
        if dist_km > 80:
            raise HTTPException(
                404,
                f"No village found within 80 km of your location. "
                "Try searching manually for the nearest HP/Uttarakhand village.",
            )
        return _row_to_village(best)


@router.get("/villages/{village_id}", response_model=VillageSummary)
def get_village(village_id: int):
    with read_connection() as conn:
        row = conn.execute(
            """
            SELECT id, name, block, district, state, latitude, longitude
            FROM villages WHERE id = ?
            """,
            [village_id],
        ).fetchone()
        if not row:
            raise HTTPException(404, "Village not found")
        return _row_to_village(row)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))