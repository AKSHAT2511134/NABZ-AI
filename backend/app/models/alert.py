from typing import Dict, List, Optional
from pydantic import BaseModel


class AlertEvidence(BaseModel):
    clinics: int
    pharmacies: int
    labs: int


class AlertExplanation(BaseModel):
    why: str
    evidence: AlertEvidence
    top_drug_classes: List[str]
    disclaimer: str = "Supports investigation. Not a diagnosis."


class AlertRecord(BaseModel):
    id: int
    ward_id: str
    ward_name: str
    category: str
    level: str  # NORMAL | WATCH | AMBER
    count_today: int
    baseline_mean: int
    z_score: str
    source_count: int
    status: str = "open"  # open | reviewed | escalated | dismissed
    explanation: AlertExplanation
    created_at: str
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None


class AlertStatusUpdate(BaseModel):
    status: str  # reviewed | escalated | dismissed
    notes: Optional[str] = None
    reviewed_by: Optional[str] = None
