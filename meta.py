from fastapi import APIRouter, HTTPException

from backend.config import DB_PATH, VILLAGES_CSV
from backend.database import db_exists, read_connection

router = APIRouter()


@router.get("/meta")
def get_meta():
    if not db_exists():
        raise HTTPException(
            503,
            "Forecast database not ready. Administrator must run the ETL pipeline.",
        )
    with read_connection() as conn:
        row = conn.execute(
            "SELECT max(updated_at), count(*) FROM forecast_daily"
        ).fetchone()
        villages = conn.execute("SELECT count(*) FROM villages").fetchone()[0]
    return {
        "ready": True,
        "last_updated": str(row[0]) if row[0] else None,
        "forecast_rows": row[1],
        "village_count": villages,
        "db_path": str(DB_PATH.name),
        "villages_source": VILLAGES_CSV.name,
    }
