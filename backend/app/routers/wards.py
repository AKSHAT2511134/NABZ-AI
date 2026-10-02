"""
Wards and Signals Router for NABZ AI
Serves ward surveillance map layers with privacy suppression (Rule 1.5).
"""

from typing import List, Optional
from fastapi import APIRouter, Query
from ..models.signal import WardSignalSummary
from ..services.store import surveillance_store

router = APIRouter(prefix="/wards", tags=["Wards"])


@router.get("", response_model=List[WardSignalSummary])
@router.get("/", response_model=List[WardSignalSummary])
def get_wards(category: Optional[str] = Query(None)):
    """
    Returns surveillance signals for all Lucknow wards.
    Alias for /wards/signals.
    """
    return get_ward_signals(category=category)


@router.get("/signals", response_model=List[WardSignalSummary])
def get_ward_signals(category: Optional[str] = Query(None)):
    """
    Returns surveillance signals per Lucknow ward.
    Suppresses counts < 3 for privacy boundary (Rule 1.5).
    """
    raw_wards = surveillance_store.get_wards(category=category)
    summaries = []

    for w in raw_wards:
        # Rule 1.5: Suppress small counts (< 3)
        reported_count = w["count"] if w["count"] >= 3 else 0
        summaries.append(
            WardSignalSummary(
                id=w["id"],
                name=w["name"],
                lat=w["lat"],
                lng=w["lng"],
                status=w["status"],
                category=w["category"],
                count=reported_count,
                baseline=w["baseline"],
                z_score=w["z_score"],
                sources=w["sources"],
                alert_id=w.get("alert_id"),
            )
        )

    return summaries
