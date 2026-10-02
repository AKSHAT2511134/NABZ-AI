"""
Alerts Router for NABZ AI (Rule 1.2, 1.8, 4.6 & Architecture.md §6)
Delivers explainable signals for health officials and manages human review workflow.
"""

from typing import List
from fastapi import APIRouter, HTTPException, Path
from ..models.alert import AlertRecord, AlertStatusUpdate
from ..services.store import surveillance_store

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=List[AlertRecord])
def list_alerts():
    """Returns all current surveillance alerts."""
    return surveillance_store.get_alerts()


@router.get("/{alert_id}", response_model=AlertRecord)
def get_alert(alert_id: int = Path(..., description="Alert ID")):
    """Returns an explainable alert with evidence breakdown."""
    alert = surveillance_store.get_alert_by_id(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.patch("/{alert_id}", response_model=AlertRecord)
def review_alert(alert_id: int, update: AlertStatusUpdate):
    """
    Rule 1.2: Every alert ends in human review.
    Allows district health officials to mark Reviewed, Escalate for verification, or Dismiss.
    """
    valid_statuses = ["reviewed", "escalated", "dismissed", "open"]
    if update.status.lower() not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

    updated = surveillance_store.update_alert(
        alert_id=alert_id,
        status=update.status.lower(),
        notes=update.notes,
        reviewed_by=update.reviewed_by or "District Health Officer",
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found")

    return updated
