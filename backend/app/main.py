"""
NABZ AI — Health Signal Radar Backend (FastAPI)
Anonymous epidemiological early-warning platform for Lucknow.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, prescriptions, wards, alerts, dashboard

app = FastAPI(
    title="NABZ AI — Health Signal Radar API",
    description=(
        "FastAPI backend for early disease surveillance. "
        "Transforms anonymous prescription patterns into explainable signals. "
        "No patient identity stored. Disclaimer: Supports investigation; does not diagnose."
    ),
    version="1.0.0",
)

# CORS configuration (Rule 2.1 & Architecture.md)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(prescriptions.router)
app.include_router(wards.router)
app.include_router(alerts.router)
app.include_router(dashboard.router)


import os

@app.get("/")
def root():
    return {
        "message": "Welcome to NABZ AI — Health Signal Radar API",
        "docs": "/docs",
        "health": "/health",
        "zero_pii": True,
        "city": "Lucknow",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "system": "NABZ AI Early Signal Radar",
        "city": "Lucknow",
        "zero_pii": True,
        "mode": "SYNTHETIC DEMO DATA",
    }


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("ENVIRONMENT", "development").lower() != "production"
    app_target = "app.main:app" if os.path.exists("app") else "backend.app.main:app"
    uvicorn.run(app_target, host=host, port=port, reload=reload)
