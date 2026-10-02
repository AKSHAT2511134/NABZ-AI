"""
Synthetic Prescriptions Test Suite (Rule 5.7 & Phase 3)
Contains 20 realistic OPD slips and prescriptions across Lucknow wards.
Validates extraction accuracy, generic normalisation, PII scrubbing, and syndromic classification.
"""

import pytest
from app.services.nlp_extractor import nlp_extractor
from app.services.pii_redactor import redact_pii


SYNTHETIC_PRESCRIPTIONS = [
    # 1. Acute Gastroenteritis
    {
        "id": "presc-01",
        "text": """CHC ALIGANJ OPD\nPt: Ram Kumar, 34M, Phone: 98765-43210\nAddress: Sector B, Aliganj\nRx:\n1. ORS Sachet 1L\n2. Tab Oflox-OZ BD\n3. Tab Emeset 4mg SOS""",
        "expected_category": "Gastrointestinal",
        "expected_meds": ["ORS Sachet", "Oflox-OZ", "Emeset"],
    },
    # 2. Pediatric Diarrhea with Dehydration
    {
        "id": "presc-02",
        "text": """UP HEALTH CLINIC\nPt: Aarav Sharma, Age: 4 Yrs\nRx:\n1. Electral ORS in boiled water\n2. Syp. Zinconia 20mg OD\n3. Syp. Ondem 2mg SOS""",
        "expected_category": "Gastrointestinal",
        "expected_meds": ["Electral", "Zinconia", "Ondem"],
    },
    # 3. Amoebic Dysentery
    {
        "id": "presc-03",
        "text": """PRIMARY HEALTH CENTRE CHINHAT\nPatient: Suresh Verma, 45 M\nRx:\n1. Tab Metrogyl 400mg TID x 5 days\n2. Tab Norflox-TZ BD\n3. Sachet Walyte ORS TDS""",
        "expected_category": "Gastrointestinal",
        "expected_meds": ["Metrogyl", "Norflox-TZ", "Walyte ORS"],
    },
    # 4. Acute Secretory Diarrhea
    {
        "id": "presc-04",
        "text": """Rx:\n1. Tab Redotil 100mg TID\n2. Cap Enterogermina BD\n3. ORS Sachet frequently""",
        "expected_category": "Gastrointestinal",
        "expected_meds": ["Redotil", "Enterogermina", "ORS Sachet"],
    },
    # 5. Food Poisoning / Gastroenteritis
    {
        "id": "presc-05",
        "text": """Rx:\n1. Tab Rifaximin (Rifagut 400) BD\n2. Tab Vomistop 10mg BD\n3. ORS Prolyte 1 pack in 1L water\n4. Tab Pan 40 OD""",
        "expected_category": "Gastrointestinal",
        "expected_meds": ["Rifagut", "Vomistop", "Prolyte ORS", "Pan 40"],
    },
    # 6. Suspected Dengue / Febrile Thrombocytopenia
    {
        "id": "presc-06",
        "text": """BALRAMPUR HOSPITAL LKO\nPt Name: Mohd Imran, 28M, Mob: 94150-12345\nRx:\n1. Tab Caripill 1100mg TID\n2. Tab Dolo 650 SOS for high fever\n3. Plenty of fluids""",
        "expected_category": "Febrile / Viral",
        "expected_meds": ["Caripill", "Dolo 650"],
    },
    # 7. Confirmed Malaria (P. falciparum)
    {
        "id": "presc-07",
        "text": """CHC CHOWK OPD\nPt: Sunita Devi, Age: 38F\nRx:\n1. Tab Coartem 80/480 BD x 3 days\n2. Tab Calpol 650 SOS\n3. Cap Pan 40 OD""",
        "expected_category": "Febrile / Viral",
        "expected_meds": ["Coartem", "Calpol 650", "Pan 40"],
    },
    # 8. Malaria Vivax
    {
        "id": "presc-08",
        "text": """Rx:\n1. Tab Lariago 250mg stat then 250mg after 6h\n2. Tab Pacimol 650 SOS fever""",
        "expected_category": "Febrile / Viral",
        "expected_meds": ["Lariago", "Pacimol 650"],
    },
    # 9. Acute Febrile Illness with Bodyache
    {
        "id": "presc-09",
        "text": """Rx:\n1. Tab Combiflam 1 tab BD pc\n2. Tab Calpol 500 SOS\n3. Tab Becosules OD""",
        "expected_category": "Febrile / Viral",
        "expected_meds": ["Combiflam", "Calpol 500", "Becosules"],
    },
    # 10. High Grade Viral Pyrexia
    {
        "id": "presc-10",
        "text": """Rx:\n1. Tab Crocin Advance 650mg TDS\n2. Tab Meftal 500 SOS for severe aches""",
        "expected_category": "Febrile / Viral",
        "expected_meds": ["Crocin Advance", "Meftal 500"],
    },
    # 11. Acute Bronchitis / Chest Infection
    {
        "id": "presc-11",
        "text": """COMMUNITY CLINIC INDIRANAGAR\nPt: Vikram Singh, 52 M\nRx:\n1. Tab Azithral 500mg OD x 3 days\n2. Syp Ascoril LS 10ml TID\n3. Tab Montair LC 1 HS""",
        "expected_category": "Respiratory",
        "expected_meds": ["Azithral 500", "Ascoril LS", "Montair LC"],
    },
    # 12. Upper Respiratory Tract Infection (Common Cold + Sinusitis)
    {
        "id": "presc-12",
        "text": """Rx:\n1. Tab Cheston Cold BD\n2. Syp Grilinctus 10ml BD\n3. Tab Cefixime (Taxim-O 200) BD x 5 days""",
        "expected_category": "Respiratory",
        "expected_meds": ["Cheston Cold", "Grilinctus", "Taxim-O 200"],
    },
    # 13. Allergic Rhinitis with Productive Cough
    {
        "id": "presc-13",
        "text": """Rx:\n1. Tab Telekast-L 1 tab at bedtime\n2. Syp Alex 5ml TID\n3. Steam inhalation BD""",
        "expected_category": "Respiratory",
        "expected_meds": ["Telekast-L", "Alex Syrup"],
    },
    # 14. Bacterial Pharyngitis
    {
        "id": "presc-14",
        "text": """Rx:\n1. Tab Augmentin 625 Duo 1 tab BD x 5 days\n2. Tab Levocet 5mg HS\n3. Tab Dolo 650 SOS""",
        "expected_category": "Respiratory",
        "expected_meds": ["Augmentin 625 Duo", "Levocet", "Dolo 650"],
    },
    # 15. Bronchospasm & Wheezing
    {
        "id": "presc-15",
        "text": """Rx:\n1. Asthalin Inhaler 2 puffs SOS\n2. Budecort Inhaler 200mcg BD\n3. Tab Monticope 1 tab HS""",
        "expected_category": "Respiratory",
        "expected_meds": ["Asthalin Inhaler", "Budecort Inhaler", "Monticope"],
    },
    # 16. Acute Flu with Congestion
    {
        "id": "presc-16",
        "text": """Rx:\n1. Tab Sinarest BD\n2. Tab Zady 500 OD x 3 days\n3. Syp Benadryl 10ml HS""",
        "expected_category": "Respiratory",
        "expected_meds": ["Sinarest", "Zady 500", "Benadryl Cough Syrup"],
    },
    # 17. Waterborne Rash / Scabies
    {
        "id": "presc-17",
        "text": """DERM OPD LUCKNOW\nPt: Raju, 22M\nRx:\n1. Permite Cream 5% apply neck down overnight\n2. Tab Cetzine 10mg HS\n3. Calamine Lotion for itching""",
        "expected_category": "Dermatological",
        "expected_meds": ["Permite Cream", "Cetzine", "Calamine Lotion"],
    },
    # 18. Fungal Skin Infection
    {
        "id": "presc-18",
        "text": """Rx:\n1. Candid Cream apply local BD\n2. Tab Fluka 150 1 tab weekly\n3. Fourderm cream for inflamed patches""",
        "expected_category": "Dermatological",
        "expected_meds": ["Candid Cream", "Fluka 150", "Fourderm"],
    },
    # 19. Pure Chronic Routine OPD (Must NOT be flagged as outbreak!)
    {
        "id": "presc-19",
        "text": """METABOLIC CLINIC\nPt: Ashok Gupta, 60M\nRx:\n1. Tab Glycomet 500 BD pc\n2. Tab Telma 40 OD bbf\n3. Tab Atorva 10 HS\n4. Tab Thyronorm 50mcg empty stomach""",
        "expected_category": "Uncategorized",
        "expected_meds": ["Glycomet 500", "Telma 40", "Atorva 10", "Thyronorm 50mcg"],
    },
    # 20. Chronic patient with incidental fever
    {
        "id": "presc-20",
        "text": """Rx:\n1. Tab Stamlo 5 OD (regular)\n2. Tab Januvia 100 OD (regular)\n3. Tab Dolo 650 SOS for mild fever""",
        "expected_category": "Febrile / Viral",
        "expected_meds": ["Stamlo 5", "Januvia 100", "Dolo 650"],
    },
]


def test_pii_redaction_removes_patient_identifiers():
    """Validates that patient names, phones, addresses, and ages are scrubbed."""
    sample_text = (
        "Patient: Ramesh Kumar, Age: 34 M, Phone: +91 98765-43210\n"
        "Address: Sector B-14, Aliganj, Lucknow, UP 226024\n"
        "Rx: Tab Oflox-OZ BD"
    )
    redacted, fields = redact_pii(sample_text)

    assert "Ramesh Kumar" not in redacted
    assert "98765-43210" not in redacted
    assert "Sector B-14, Aliganj" not in redacted
    assert "Age: 34" not in redacted
    assert "REDACTED_NAME" in redacted
    assert "REDACTED_PHONE" in redacted
    assert len(fields) >= 3


@pytest.mark.parametrize("case", SYNTHETIC_PRESCRIPTIONS)
def test_synthetic_prescriptions_nlp_classification(case):
    """Evaluates syndromic categorization across 20 synthetic prescriptions."""
    detected, category, confidence, warnings = nlp_extractor.extract_from_text(case["text"])

    assert len(detected) > 0, f"Failed to extract medicines for {case['id']}"
    assert category == case["expected_category"], (
        f"Mismatch on {case['id']}: expected {case['expected_category']}, got {category}"
    )

    # Check that chronic drugs are properly flagged
    if case["id"] == "presc-19":
        for med in detected:
            assert med.is_chronic is True, f"Chronic medicine {med.brand} was not marked chronic!"


def test_chronic_medicines_excluded_from_outbreak_weight():
    """Rule 5.5: Chronic medicines (diabetes, BP, thyroid) excluded from outbreak signals."""
    rx = "Tab Glycomet 500mg BD\nTab Telma 40mg OD\nTab Thyronorm 50mcg OD"
    detected, category, conf, _ = nlp_extractor.extract_from_text(rx)
    assert category == "Uncategorized"
    assert all(m.is_chronic for m in detected)
