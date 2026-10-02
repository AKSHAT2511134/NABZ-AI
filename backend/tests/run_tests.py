import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tests.test_nlp_accuracy import (
    test_pii_redaction_removes_patient_identifiers,
    test_chronic_medicines_excluded_from_outbreak_weight,
    SYNTHETIC_PRESCRIPTIONS
)
from app.services.nlp_extractor import nlp_extractor

def main():
    print("Running PII Redaction Tests...")
    test_pii_redaction_removes_patient_identifiers()
    print("[OK] test_pii_redaction_removes_patient_identifiers passed!")

    print("Running Chronic Exclusion Tests...")
    test_chronic_medicines_excluded_from_outbreak_weight()
    print("[OK] test_chronic_medicines_excluded_from_outbreak_weight passed!")

    print("\nRunning 20 Synthetic Prescriptions Syndromic Classification...")
    passed = 0
    for case in SYNTHETIC_PRESCRIPTIONS:
        detected, cat, conf, warn = nlp_extractor.extract_from_text(case["text"])
        cid = case["id"]
        assert len(detected) > 0, f"No meds in {cid}"
        assert cat == case["expected_category"], f"Mismatch in {cid}: expected {case['expected_category']}, got {cat}"
        passed += 1
        med_brands = [m.brand for m in detected]
        print(f"  [OK] [{cid}] {case['expected_category']} (conf: {int(conf*100)}%) -> {med_brands}")

    print(f"\n==========================================")
    print(f"RESULT: ALL {passed}/20 SYNTHETIC PRESCRIPTIONS PASSED WITH 100% ACCURACY!")
    print(f"==========================================")

if __name__ == "__main__":
    main()
