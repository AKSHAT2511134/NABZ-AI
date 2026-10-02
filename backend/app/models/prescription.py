from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class DetectedMedicine(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    brand: str
    generic: str
    drug_class: str = Field(alias="drugClass")
    category: str = "General"
    confidence: int = 90
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    is_chronic: bool = False


class RedactedField(BaseModel):
    field: str
    value: str
    token: str


class AnalyzePrescriptionRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    raw_text: Optional[str] = Field(None, alias="rawText")
    mode: Optional[str] = "upload"  # upload | manual
    symptoms: Optional[str] = None
    medicines: Optional[str] = None
    category: Optional[str] = None
    ward_id: Optional[str] = "w-aliganj"
    ward: Optional[str] = "Aliganj Ward 3, Lucknow"
    facility: Optional[str] = "Aliganj Community Health Center"


class AnalyzePrescriptionResponse(BaseModel):
    id: str
    raw_text_redacted: str
    detected_medicines: List[DetectedMedicine]
    suggested_category: str
    confidence_score: float
    redacted_fields: List[RedactedField]
    what_leaves_device: dict
    warnings: List[str] = []


class ConfirmPrescriptionRequest(BaseModel):
    ward_id: str = "w-aliganj"
    ward: str = "Aliganj Ward 3, Lucknow"
    facility: str = "Aliganj Community Health Center"
    category: str
    medicines: List[DetectedMedicine]
    symptoms: Optional[str] = None
    source_type: str = "clinic"  # clinic | pharmacy | lab


class ConfirmPrescriptionResponse(BaseModel):
    signal_id: str
    status: str = "transmitted"
    ward_id: str
    category: str
    drug_classes: List[str]
    timestamp: str
    privacy_notice: str
    detection_updated: bool


class VerifyKeyRequest(BaseModel):
    api_key: str
    provider: Optional[str] = "gemini"


class VerifyKeyResponse(BaseModel):
    valid: bool
    message: str
    provider: str

