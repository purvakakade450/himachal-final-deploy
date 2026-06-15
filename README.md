# Monsoon Forecast Web Portal

Mobile-first village-level **temperature** and **precipitation** forecasts for farmers in **Himachal Pradesh** and **Uttarakhand**, with one-tap ground-truth feedback during monsoon 2026.

## Quick start (Windows)

```bat
setup.bat    REM install deps + build database
run.bat      REM open http://localhost:8000
```

## Quick start (Linux / macOS)

```bash
cd monsoon-forecast-portal
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m etl.process_forecast
python run.py
```

Open **http://localhost:8000** — no login required.

By default the ETL pulls **real-time** hourly forecasts from the free
[Open-Meteo](https://open-meteo.com) API (no API key needed) for every village.
Use `python -m etl.process_forecast --sample` for synthetic offline demo data.

## Architecture

```
[Open-Meteo API] ─┐
[NetCDF model]   ─┼→ [etl/process_forecast.py] → [data/forecasts.duckdb]
[Mobile browser] ← [FastAPI] ←────────────────────────────────────────┘
```

Data source priority: `--nc` NetCDF (if given) → live Open-Meteo (default) →
synthetic sample (fallback when offline or `--sample`).

## Features

- **Reported Floods map** ([like Mumbai Flood](https://www.mumbaiflood.in/reported-floods)): crowd reports on OpenStreetMap, filters Today / 7 Days / All — **Himachal Pradesh** at `/reported-floods`
- Village / block search with autocomplete (65 demo villages; replace CSV for production — see `data/VILLAGES_IMPORT.md`)
- GPS “Find My Village”
- Today: trend, min/max °C, daily rain, 3-hour rain chart, hourly temperature chart
- Extreme / heavy rain alerts
- 4-day outlook with per-day charts
- Feedback: accurate / too dry / too wet
- English + Hindi UI toggle
- Deep link: `?village=1`

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/meta` | DB status and last ETL time |
| GET | `/api/villages/search?q=` | Search villages |
| GET | `/api/villages/nearest?lat=&lon=` | GPS nearest village |
| GET | `/api/villages/{id}` | Village details |
| GET | `/api/forecast/{id}` | Full forecast payload |
| POST | `/api/feedback` | `{ village_id, rating }` |

## Real-time data (default)

```bash
python -m etl.process_forecast            # live Open-Meteo forecasts
python -m etl.process_forecast --days 7   # longer horizon
python -m etl.process_forecast --sample   # synthetic demo data (offline)
```

Live temperature and precipitation are fetched per village by lat/lon and
refreshed on every ETL run — schedule it with cron (see `scripts/cron.example`).

## Real model data (NetCDF)

```bash
pip install xarray netCDF4
python -m etl.process_forecast --nc /path/to/forecast.nc --days 5
```

Set `ETL_NC_PRECIP` / `ETL_NC_TEMP` env vars if variable names differ (see ETL script).

## Production checklist

1. Replace `data/villages.csv` with the full official registry.
2. Cron ETL after each model run (`scripts/cron.example`).
3. Deploy with `deploy/nginx.conf.example` and `deploy/monsoon-forecast.service`.
4. Enable HTTPS on the VPS.

## License

Internal / project use.
