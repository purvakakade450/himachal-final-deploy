from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DB_PATH = DATA_DIR / "forecasts.duckdb"
VILLAGES_CSV = DATA_DIR / "villages.csv"
