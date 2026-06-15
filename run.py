#!/usr/bin/env python3
"""Start the Monsoon Forecast Portal (API + frontend)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.pat
    
    h.insert(0, str(ROOT)   )

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload="--reload" in sys.argv,
    )
