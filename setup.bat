@echo off
cd /d "%~dp0"
echo Installing Python dependencies...
python -m pip install -r requirements.txt
echo.
echo Building forecast database (sample data)...
python -m etl.process_forecast
echo.
echo Setup complete. Run: run.bat
pause
