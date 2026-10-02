"""
Dashboard Router for NABZ AI
Provides summary statistics, active review counts, and 0-identity assurance.
"""

from fastapi import APIRouter
from ..services.store import surveillance_store

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_dashboard_summary():
    """Returns city-wide surveillance overview for Lucknow."""
    return surveillance_store.get_dashboard_summary()
