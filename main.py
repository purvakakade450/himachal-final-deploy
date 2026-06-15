from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.config import DB_PATH
from backend.database import db_exists
from backend.routers import feedback, flood_reports, forecast, meta, precipitation, realtime_weather, villages

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not db_exists():
        print(f"[WARN] No database at {DB_PATH}. Run: python -m etl.process_forecast")
    yield


app = FastAPI(
    title="Monsoon Forecast Portal",
    description="Village-level forecasts for HP & UK agriculture",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta.router, prefix="/api", tags=["meta"])
app.include_router(villages.router, prefix="/api", tags=["villages"])
app.include_router(forecast.router, prefix="/api", tags=["forecast"])
app.include_router(precipitation.router, prefix="/api", tags=["precipitation"])
app.include_router(feedback.router, prefix="/api", tags=["feedback"])
app.include_router(flood_reports.router, prefix="/api", tags=["flood-reports"])
app.include_router(realtime_weather.router, prefix="/api", tags=["realtime-weather"])

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
def index():
    
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "Run ETL then open this URL after starting the server."}


@app.get("/reported-floods")
def reported_floods_page():
    """Legacy URL → single-page app."""
    from fastapi.responses import RedirectResponse

    return RedirectResponse(url="/#reported-floods", status_code=302)


@app.get("/health")
def health():    
    return {
        "status": "ok",
        "database_ready": db_exists(),
    }                                                       