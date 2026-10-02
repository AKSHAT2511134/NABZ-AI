from typing import List, Optional, Dict
from pydantic import BaseModel


class SignalRecord(BaseModel):
    id: str
    ward_id: str
    ward_name: str
    facility: str
    source_type: str  # clinic | pharmacy | lab
    category: str
    drug_classes: List[str]
    created_at: str


class WardSignalSummary(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    status: str  # NORMAL | WATCH | AMBER
    category: str
    count: int
    baseline: int
    z_score: str
    sources: Dict[str, int]
    alert_id: Optional[int] = None
