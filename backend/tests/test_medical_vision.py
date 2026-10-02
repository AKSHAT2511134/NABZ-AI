import sys
import os
import io
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.main import app

client = TestClient(app)


def test_verify_key_endpoint_empty():
    response = client.post("/prescriptions/verify-key", json={"api_key": ""})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False


def test_verify_key_endpoint_invalid():
    response = client.post("/prescriptions/verify-key", json={"api_key": "fake_invalid_key_123", "provider": "gemini"})
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is False


def test_upload_fallback_when_no_key():
    # 1x1 transparent png
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    file_obj = io.BytesIO(png_bytes)
    
    response = client.post(
        "/prescriptions/upload",
        files={"file": ("test_prescription.png", file_obj, "image/png")},
        data={"ward_id": "w-aliganj", "ward": "Aliganj Ward 3, Lucknow"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert len(data["detected_medicines"]) > 0
    assert len(data["redacted_fields"]) > 0
    assert any("No Medical AI API Key detected" in w for w in data["warnings"])
