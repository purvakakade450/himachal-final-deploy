from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException

from backend.database import db_exists, write_connection
from backend.models import FeedbackRequest

router = APIRouter()


@router.post("/feedback")
def submit_feedback(body: FeedbackRequest):
    if not db_exists():
        raise HTTPException(503, "Database unavailable")

    with write_connection() as conn:
        exists = conn.execute(
            "SELECT 1 FROM villages WHERE id = ?", [body.village_id]
        ).fetchone()
        if not exists:
            raise HTTPException(404, "Unknown village_id")

        next_id = conn.execute(
            "SELECT COALESCE(MAX(id), 0) + 1 FROM feedback"
        ).fetchone()[0]

        conn.execute(
            """
            INSERT INTO feedback (id, village_id, rating, created_at, client_lat, client_lon)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                next_id,
                body.village_id,
                body.rating,
                datetime.now(UTC).replace(tzinfo=None),
                body.client_lat,
                body.client_lon,
            ],
        )
    return {"ok": True, "message": "Thank you — your report helps improve forecasts."}
