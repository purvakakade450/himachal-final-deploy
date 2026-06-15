from contextlib import contextmanager
from pathlib import Path

import duckdb

from backend.config import DB_PATH


def db_exists() -> bool:
    return DB_PATH.exists()


@contextmanager
def read_connection():
    if not db_exists():
        raise FileNotFoundError(
            f"Database not found at {DB_PATH}. Run: python -m etl.process_forecast"
        )
    conn = duckdb.connect(str(DB_PATH), read_only=True)
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def write_connection():
    if not db_exists():
        raise FileNotFoundError(
            f"Database not found at {DB_PATH}. Run: python -m etl.process_forecast"
        )
    conn = duckdb.connect(str(DB_PATH))
    try:
        yield conn
    finally:
        conn.close()
