from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query

from backend.database import read_connection, write_connection
from backend.models import FloodReportCreate, FloodReportOut

router = APIRouter()

PERIOD_SQL = {
    "today": "CAST(fr.created_at AS DATE) >= current_date",
    "7d": "fr.created_at >= current_timestamp - INTERVAL '7' DAY",
    "all": "1=1",
}


@router.get("/flood-reports", response_model=list[FloodReportOut])
def list_flood_reports(
    period: str = Query("today", pattern="^(today|7d|all)$"),
    state: str = Query("Himachal Pradesh", max_length=40),
):
    where_time = PERIOD_SQL.get(period, PERIOD_SQL["today"])
    with read_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT
                fr.id, fr.report_type, fr.severity,
                fr.village_id, v.name, v.district,
                fr.latitude, fr.longitude, fr.note, fr.created_at
            FROM flood_reports fr
            LEFT JOIN villages v ON v.id = fr.village_id
            WHERE {where_time}
              AND (v.state = ? OR (fr.village_id IS NULL AND fr.latitude BETWEEN 30.2 AND 33.5))
            ORDER BY fr.created_at DESC
            LIMIT 500
            """,
            [state],
        ).fetchall()

    return [
        FloodReportOut(
            id=r[0],
            report_type=r[1],
            severity=r[2],
            village_id=r[3],
            village_name=r[4],
            district=r[5],
            latitude=r[6],
            longitude=r[7],
            note=r[8],
            created_at=str(r[9]),
        )
        for r in rows
    ]


@router.post("/flood-reports", response_model=FloodReportOut)
def create_flood_report(body: FloodReportCreate):
    if not (30.2 <= body.lat <= 33.5 and 75.5 <= body.lon <= 79.6):
        raise HTTPException(400, "Location must be within Himachal Pradesh.")

    with write_connection() as conn:
        if body.village_id:
            v = conn.execute(
                "SELECT id, name, district, state FROM villages WHERE id = ?",
                [body.village_id],
            ).fetchone()
            if not v:
                raise HTTPException(404, "Village not found")
            if v[3] != "Himachal Pradesh":
                raise HTTPException(400, "This map is for Himachal Pradesh villages only.")

        next_id = conn.execute(
            "SELECT COALESCE(MAX(id), 0) + 1 FROM flood_reports"
        ).fetchone()[0]
        created = datetime.now(UTC).replace(tzinfo=None)

        conn.execute(
            """
            INSERT INTO flood_reports
            (id, report_type, severity, village_id, latitude, longitude, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                next_id,
                body.report_type,
                body.severity,
                body.village_id,
                body.lat,
                body.lon,
                body.note,
                created,
            ],
        )

        village_name = district = None
        if body.village_id:
            row = conn.execute(
                "SELECT name, district FROM villages WHERE id = ?", [body.village_id]
            ).fetchone()
            if row:
                village_name, district = row[0], row[1]

    return FloodReportOut(
        id=next_id,
        report_type=body.report_type,
        severity=body.severity,
        village_id=body.village_id,
        village_name=village_name,
        district=district,
        latitude=body.lat,
        longitude=body.lon,
        note=body.note,
        created_at=str(created),
    )
