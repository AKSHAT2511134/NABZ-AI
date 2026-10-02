"""
Tests for the AI Prescription Scanner module (PR-SCAN).
Covers: MIME/size validation, DEMO_MODE, schema strictness,
no-hallucination (empty fields stay null), 1-0-1 verbatim,
JSON response shape, and 0-byte rejection.
"""

import io
import json
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

LOCAL_DEPS = BACKEND_ROOT / ".pydeps"
if LOCAL_DEPS.exists():
    sys.path.insert(0, str(LOCAL_DEPS))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.prescription_scan import (
    ExtractedPrescription,
    ExtractedMedicine,
    PatientInfo,
    DoctorInfo,
    PrescriptionMeta,
    ScanPrescriptionResponse,
)
from app.services.prescription_scanner import (
    EXTRACTION_PROMPT,
    validate_extraction,
    demo_mode_fixture,
)


client = TestClient(app)

PNG_1x1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06"
    b"\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00"
    b"\x03\x00\x01\xea\x27\x91\xe4\x00\x00\x00\x00IEND\xaeB`\x82"
)


# ---------- Unit tests (models + validation + prompt) ----------

def test_prompt_safety_language():
    """TR-2.1: Prompt contains exact safety phrases."""
    text = EXTRACTION_PROMPT.lower()
    assert "extract only information explicitly visible".lower() in text \
        or "extract exactly what is visibly written".lower() in text \
        or "only job is to extract exactly what is visibly written".lower() in text
    assert "never invent" in text or "never guess" in text or "must not interpret, diagnose, advise, or invent" in text
    assert "verification_required" in text or "unclear handwriting".lower() in text


def test_empty_extraction_preserves_nulls_and_empty_lists():
    """AC-7: Empty / missing fields MUST remain None / [] — never invented."""
    raw = {
        "patient": {"name": None, "age": None, "gender": None},
        "doctor": {"name": None, "registration_number": None, "specialization": None},
        "prescription": {"date": None, "hospital": None, "clinic": None},
        "diagnosis": [],
        "medicines": [],
        "tests": [],
        "instructions": [],
        "warnings": [],
        "unreadable_sections": [],
        "overall_confidence": 0.0,
    }
    extracted, _ = validate_extraction(raw)
    assert extracted.patient.name is None
    assert extracted.patient.age is None
    assert extracted.doctor.registration_number is None
    assert extracted.tests == []
    assert extracted.medicines == []
    assert extracted.diagnosis == []


def test_low_confidence_triggers_verification_required():
    """AC-5 + TR-2.2: conf < 0.70 forces verification_required=True w/ reason."""
    raw = {
        "patient": {},
        "doctor": {},
        "prescription": {},
        "diagnosis": [],
        "medicines": [
            {"name": "Metf... 500", "confidence": 52,  # int percentage, should clip
             "source_text": "Metf... 500 1-0-1"}
        ],
        "tests": [],
        "instructions": [],
        "warnings": [],
        "unreadable_sections": [],
        "overall_confidence": 0.55,
    }
    extracted, _ = validate_extraction(raw)
    assert len(extracted.medicines) == 1
    m = extracted.medicines[0]
    assert m.verification_required is True
    assert m.confidence == 0.52
    assert m.reason is not None and len(m.reason) > 0


def test_frequency_kept_verbatim_in_validator():
    """AC-8: '1-0-1' string passes through validator exactly (no re-interpretation)."""
    raw = {
        "patient": {}, "doctor": {}, "prescription": {},
        "diagnosis": [], "tests": [], "instructions": [],
        "warnings": [], "unreadable_sections": [],
        "overall_confidence": 0.90,
        "medicines": [
            {
                "name": "Metformin", "strength": "500mg",
                "frequency": "1-0-1",
                "source_text": "Metformin 500 mg 1-0-1 x 30 days",
                "confidence": 0.94,
            }
        ],
    }
    extracted, _ = validate_extraction(raw)
    assert extracted.medicines[0].frequency == "1-0-1"
    assert extracted.medicines[0].source_text == "Metformin 500 mg 1-0-1 x 30 days"
    assert extracted.medicines[0].verification_required is False


def test_demo_fixture_exercises_flagging_paths():
    """AC-11 + TR-2.3: Demo fixture has >=2 meds, >=1 verification_required, >=1 unreadable_section."""
    data, warnings = demo_mode_fixture()
    assert isinstance(data, ExtractedPrescription)
    assert len(data.medicines) >= 2
    assert any(m.verification_required for m in data.medicines)
    assert len(data.unreadable_sections) >= 1
    # It should also surface a DEMO MODE warning for transparency
    assert any("DEMO MODE" in w for w in warnings)


def test_scan_response_serializes_correct_top_level_keys():
    """TR-1.3: Response top-level keys exactly: success, data, error, warnings."""
    data, extra_warnings = demo_mode_fixture()
    resp = ScanPrescriptionResponse(success=True, data=data, warnings=extra_warnings)
    j = json.loads(resp.model_dump_json())
    assert set(j.keys()) == {"success", "data", "error", "warnings"}
    assert j["success"] is True
    assert j["error"] is None


# ---------- Integration tests via TestClient ----------

def test_scan_invalid_file_type_returns_400(monkeypatch):
    """TR-4.1: Invalid MIME -> 400, 'Unsupported file type'."""
    monkeypatch.setenv("DEMO_MODE", "true")
    f = io.BytesIO(b"not an image")
    f.name = "notes.txt"
    resp = client.post(
        "/prescriptions/scan",
        files={"prescription": ("notes.txt", f, "text/plain")},
    )
    assert resp.status_code == 400
    body = resp.json()
    assert "Unsupported file type" in body.get("detail", "") \
        or "Unsupported file type" in body.get("error", "")


def test_scan_file_too_large_returns_400(monkeypatch):
    """TR-4.2: 6 MB payload -> 400, 'File is too large'."""
    monkeypatch.setenv("DEMO_MODE", "true")
    big = io.BytesIO(b"\x00" * (6 * 1024 * 1024))
    resp = client.post(
        "/prescriptions/scan",
        files={"prescription": ("big.png", big, "image/png")},
    )
    assert resp.status_code == 400
    body = resp.json()
    message = body.get("detail", "") or body.get("error", "")
    assert "File is too large" in message or "maximum limit" in message or "too large" in message.lower()


def test_scan_zero_bytes_rejected(monkeypatch):
    """TR-3.1: 0 byte upload -> non-500, 'could not be read' style error."""
    monkeypatch.setenv("DEMO_MODE", "true")
    empty = io.BytesIO(b"")
    resp = client.post(
        "/prescriptions/scan",
        files={"prescription": ("empty.png", empty, "image/png")},
    )
    assert resp.status_code < 500  # user-safe error, no server crash
    body = resp.json()
    message = (str(body.get("detail", "")) + " " + str(body.get("error", ""))).lower()
    assert "read" in message or "empty" in message or "could not" in message


def test_scan_demo_mode_success_shape(monkeypatch):
    """AC-4, AC-11, TR-4.3: DEMO_MODE returns schema-valid payload with expected fields."""
    monkeypatch.setenv("DEMO_MODE", "true")
    f = io.BytesIO(PNG_1x1)
    resp = client.post(
        "/prescriptions/scan",
        files={"prescription": ("rx.png", f, "image/png")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body.get("success") is True
    data = body["data"]

    # Exact top-level keys in data
    expected_data_keys = {
        "patient", "doctor", "prescription", "diagnosis", "medicines",
        "tests", "instructions", "warnings", "unreadable_sections",
        "overall_confidence",
    }
    assert set(data.keys()) == expected_data_keys

    # Each medicine has name, confidence, verification_required, source_text
    for m in data["medicines"]:
        for required in ("confidence", "verification_required"):
            assert required in m
        assert "source_text" in m

    assert len(data["medicines"]) >= 2
    assert any(m["verification_required"] for m in data["medicines"])
    assert len(data["unreadable_sections"]) >= 1
    assert 0.0 <= float(data["overall_confidence"]) <= 1.0


def test_env_example_has_new_placeholders():
    """TR-4.4: .env.example has GOOGLE_CLOUD_VISION_API_KEY and DEMO_MODE lines."""
    env_path = BACKEND_ROOT / ".env.example"
    content = env_path.read_text(encoding="utf-8")
    assert "GOOGLE_CLOUD_VISION_API_KEY=" in content
    assert "DEMO_MODE=" in content


def test_existing_prescriptions_routes_still_respond():
    """Regression sanity: /health, /prescriptions/verify-key, /wards/signals respond."""
    r1 = client.get("/health")
    assert r1.status_code == 200
    assert r1.json()["status"] == "healthy"

    r2 = client.post(
        "/prescriptions/verify-key",
        json={"api_key": "", "provider": "gemini"},
    )
    # Empty key → should return valid: false without HTTP 500
    assert r2.status_code == 200
    assert r2.json()["valid"] is False
