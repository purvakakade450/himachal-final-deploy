@echo off
cd /d "%~dp0"
if not exist "data\forecasts.duckdb" (
  echo Database missing. Running ETL...
  python -m etl.process_forecast
)
echo Starting server at http://localhost:8000
python run.py
pause
