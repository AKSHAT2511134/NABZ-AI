"""
API Endpoints Integration Test for NABZ AI
Tests full pipeline: Auth -> Analyze Prescription -> Confirm Anonymous Signal -> Detection -> Alerts
"""

import sys
import os
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["zero_pii"] is True
    print("[OK] Health check endpoint passed")


def test_auth():
    # Doctor login
    res_dr = client.post("/auth/login", json={"email": "doctor@nabz.ai", "password": "demo"})
    assert res_dr.status_code == 200
    assert res_dr.json()["user"]["role"] == "doctor"

    # Admin login
    res_adm = client.post("/auth/login", json={"email": "admin@nabz.ai", "password": "demo"})
    assert res_adm.status_code == 200
    assert res_adm.json()["user"]["role"] == "admin"
    print("[OK] Auth endpoints passed")


def test_prescription_analyze_and_confirm():
    # 1. Analyze GI prescription
    rx_payload = {
        "rawText": (
            "COMMUNITY HEALTH CENTER ALIGANJ, LUCKNOW\n"
            "Pt: Rajesh Kumar, Phone: 98765-43210\n"
            "Address: Sector B, Aliganj\n"
            "Rx:\n"
            "1. ORS Sachet 1L\n"
            "2. Tab Oflox-OZ BD\n"
            "3. Tab Emeset 4mg SOS"
        ),
        "ward_id": "w-aliganj",
        "ward": "Aliganj Ward 3, Lucknow"
    }

    res_analyze = client.post("/prescriptions/analyze", json=rx_payload)
    assert res_analyze.status_code == 200
    analyzed = res_analyze.json()

    assert analyzed["suggested_category"] == "Gastrointestinal"
    assert len(analyzed["detected_medicines"]) >= 3
    assert "Rajesh Kumar" not in analyzed["raw_text_redacted"]
    assert "98765-43210" not in analyzed["raw_text_redacted"]
    assert len(analyzed["redacted_fields"]) >= 2
    print("[OK] Prescription analyze (OCR + Redact + NLP) passed")

    # 2. Confirm anonymous signal
    confirm_payload = {
        "ward_id": "w-aliganj",
        "ward": "Aliganj Ward 3, Lucknow",
        "facility": "Aliganj CHC",
        "category": analyzed["suggested_category"],
        "medicines": analyzed["detected_medicines"],
        "source_type": "clinic"
    }

    res_confirm = client.post("/prescriptions/confirm", json=confirm_payload)
    assert res_confirm.status_code == 200
    confirmed = res_confirm.json()
    assert confirmed["status"] == "transmitted"
    assert "SIG-" in confirmed["signal_id"]
    print("[OK] Prescription confirm (Anonymous transmission) passed")


def test_wards_and_alerts():
    # Get ward signals
    res_wards = client.get("/wards/signals")
    assert res_wards.status_code == 200
    wards = res_wards.json()
    assert len(wards) >= 8
    aliganj = next(w for w in wards if w["id"] == "w-aliganj")
    assert aliganj["status"] == "AMBER"

    # Get alerts
    res_alerts = client.get("/alerts")
    assert res_alerts.status_code == 200
    alerts = res_alerts.json()
    assert len(alerts) >= 1

    # Get single alert with explanation
    res_alert_1 = client.get("/alerts/1")
    assert res_alert_1.status_code == 200
    alert_1 = res_alert_1.json()
    assert alert_1["level"] == "AMBER"
    assert "explanation" in alert_1
    assert "why" in alert_1["explanation"]
    assert "diagnose" in alert_1["explanation"]["disclaimer"].lower()

    # Review action (Rule 1.2: Human review)
    res_patch = client.patch("/alerts/1", json={"status": "reviewed", "notes": "Local CHC team deployed"})
    assert res_patch.status_code == 200
    assert res_patch.json()["status"] == "reviewed"
    print("[OK] Wards and explainable alerts endpoints passed")


def test_dashboard_summary():
    res = client.get("/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["signals_today"] >= 30
    assert data["identity_exposure"] == 0
    assert data["active_amber_alerts"] >= 1
    print("[OK] Dashboard summary endpoint passed")


if __name__ == "__main__":
    test_health()
    test_auth()
    test_prescription_analyze_and_confirm()
    test_wards_and_alerts()
    test_dashboard_summary()
    print("\n==========================================")
    print("ALL API INTEGRATION TESTS PASSED CLEANLY!")
    print("==========================================")
