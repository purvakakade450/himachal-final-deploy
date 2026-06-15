from pydantic import BaseModel, Field


class VillageSummary(BaseModel):
    id: int
    name: str
    block: str
    district: str
    state: str
    latitude: float
    longitude: float


class PrecipBlock(BaseModel):
    block_index: int
    block_start_hour: int
    precip_mm: float


class TempHourly(BaseModel):
    hour: int
    temp_c: float


class ClimatologyInfo(BaseModel):
    """How a day's forecast precipitation compares to 11 years (2015-2025)
    of observed monsoon-season rainfall (regridded IMERG) for this exact
    location — grounds the live model forecast in real climate-study data."""
    category: str
    label: str
    threshold_mm: float | None = None
    threshold_key: str | None = None
    p50: float | None = None
    p90: float | None = None
    p99: float | None = None


class DayForecast(BaseModel):
    date: str
    temp_min: float
    temp_max: float
    precip_total_mm: float
    trend: str
    alert_level: str
    precip_blocks: list[PrecipBlock]
    temp_hourly: list[TempHourly]
    climatology: ClimatologyInfo | None = None


class ForecastResponse(BaseModel):
    village: VillageSummary
    updated_at: str | None
    today: DayForecast
    outlook: list[DayForecast]


class FeedbackRequest(BaseModel):
    village_id: int = Field(..., ge=1)
    rating: str = Field(..., pattern="^(accurate|too_dry|too_wet)$")
    client_lat: float | None = None
    client_lon: float | None = None


class FloodReportCreate(BaseModel):
    report_type: str = Field(
        ...,
        pattern="^(flood|waterlogging|landslide|road_blocked|cloudburst)$",
    )
    severity: str = Field(default="moderate", pattern="^(low|moderate|high)$")
    village_id: int | None = None
    lat: float = Field(..., ge=30.2, le=33.5)
    lon: float = Field(..., ge=75.5, le=79.6)
    note: str | None = Field(None, max_length=280)


class FloodReportOut(BaseModel):
    id: int
    report_type: str
    severity: str
    village_id: int | None
    village_name: str | None
    district: str | None
    latitude: float
    longitude: float
    note: str | None
    created_at: str