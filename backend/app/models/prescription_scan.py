from typing import List, Optional
from pydantic import BaseModel, Field


class PatientInfo(BaseModel):
    name: Optional[str] = None
    age: Optional[str] = None
    gender: Optional[str] = None


class DoctorInfo(BaseModel):
    name: Optional[str] = None
    registration_number: Optional[str] = None
    specialization: Optional[str] = None


class PrescriptionMeta(BaseModel):
    date: Optional[str] = None
    hospital: Optional[str] = None
    clinic: Optional[str] = None


class ExtractedMedicine(BaseModel):
    name: Optional[str] = None
    strength: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    route: Optional[str] = None
    instructions: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=1.0)
    verification_required: bool = False
    source_text: Optional[str] = None
    original_text: Optional[str] = None
    normalized_name: Optional[str] = None
    page: Optional[int] = None
    reason: Optional[str] = None


class ExtractedPrescription(BaseModel):
    patient: PatientInfo
    doctor: DoctorInfo
    prescription: PrescriptionMeta
    diagnosis: List[str] = []
    medicines: List[ExtractedMedicine] = []
    tests: List[str] = []
    instructions: List[str] = []
    warnings: List[str] = []
    unreadable_sections: List[str] = []
    overall_confidence: float = Field(..., ge=0.0, le=1.0)


class ScanPrescriptionResponse(BaseModel):
    success: bool
    data: Optional[ExtractedPrescription] = None
    error: Optional[str] = None
    warnings: List[str] = []
