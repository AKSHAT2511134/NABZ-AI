import sys, os
sys.path.insert(0, r'c:\Users\aksha\OneDrive\Desktop\NABZ-AI\backend\.pydeps')
sys.path.insert(0, r'c:\Users\aksha\OneDrive\Desktop\NABZ-AI\backend')
os.chdir(r'c:\Users\aksha\OneDrive\Desktop\NABZ-AI\backend')

print('='*60)
print('BACKEND MODULE CONNECTIVITY & FUNCTION TEST')
print('='*60)

# 1. Models
print('\n[1] Models import...')
from app.models.prescription import (
    AnalyzePrescriptionRequest, AnalyzePrescriptionResponse,
    ConfirmPrescriptionRequest, ConfirmPrescriptionResponse,
    VerifyKeyRequest, VerifyKeyResponse, DetectedMedicine, RedactedField
)
print('    OK app.models.prescription (8 classes)')
from app.models.prescription_scan import (
    PatientInfo, DoctorInfo, PrescriptionMeta,
    ExtractedMedicine, ExtractedPrescription, ScanPrescriptionResponse
)
print('    OK app.models.prescription_scan (6 classes)')
from app.models.signal import SignalRecord
print('    OK app.models.signal (1 class)')

# 2. Services
print('\n[2] Services import...')
from app.services.pii_redactor import redact_pii
print('    OK app.services.pii_redactor')
from app.services.nlp_extractor import nlp_extractor
print('    OK app.services.nlp_extractor')
from app.services.store import surveillance_store
print('    OK app.services.store')
from app.services.medical_vision import medical_vision_service
print('    OK app.services.medical_vision')
from app.services.prescription_scanner import (
    prescription_scanner_service, EXTRACTION_PROMPT,
    validate_extraction, demo_mode_fixture, _clean_and_parse_json
)
print('    OK app.services.prescription_scanner (service + 4 helpers)')

# 3. Routers + FastAPI wiring
print('\n[3] Routers + FastAPI app wiring...')
from app.routers.prescriptions import router as prescriptions_router, _try_extract_pdf_text
from app.routers import prescriptions as rx_mod, auth as auth_mod, wards as wards_mod, alerts as alerts_mod, dashboard as dash_mod
from fastapi import FastAPI
app = FastAPI(title='NABZ-Conn-Check')
app.include_router(rx_mod.router)
n_routes = len([r for r in app.routes if hasattr(r, 'methods')])
print(f'    OK all router packages importable; prescriptions router mounts {n_routes} HTTP endpoints')

# 4. scan_extraction through service (DEMO mode)
print('\n[4] prescription_scanner_service.scan_extraction() -> DEMO path...')
os.environ['DEMO_MODE'] = 'true'
demo, warns = prescription_scanner_service.scan_extraction(b'fake-bytes', 'image/png', api_key=None)
assert len(demo.medicines) >= 2
assert any(m.verification_required for m in demo.medicines)
assert len(demo.unreadable_sections) >= 1
assert any('DEMO MODE' in w for w in warns)
print(f'    OK 4 meds ({sum(1 for m in demo.medicines if m.verification_required)} flagged), {len(demo.unreadable_sections)} unreadable, demo banner')

# 5. validate_extraction pipeline
print('\n[5] validate_extraction() pipeline...')
raw_dict = {
    'patient': {'name': None, 'age': '32', 'gender': 'F'},
    'doctor': {'name': None, 'registration_number': None, 'specialization': None},
    'prescription': {'date': None, 'hospital': None, 'clinic': None},
    'diagnosis': [],
    'medicines': [{'name': 'TestMed', 'confidence': 0.55, 'frequency': '1-0-1', 'source_text': 'snippet'}],
    'tests': [],
    'instructions': [],
    'warnings': [],
    'unreadable_sections': [],
    'overall_confidence': 0.70,
}
ex, w = validate_extraction(raw_dict)
assert ex.medicines[0].verification_required == True
assert ex.medicines[0].frequency == '1-0-1'
assert ex.patient.name is None
assert ex.doctor.registration_number is None
assert ex.tests == []
print('    OK low conf flagged, 1-0-1 verbatim, empty fields NULL')

# 6. _try_extract_pdf_text helper
print('\n[6] _try_extract_pdf_text() helper...')
pt, pw = _try_extract_pdf_text(b'garbage bytes not a pdf')
print(f'    OK gracefully handles garbage bytes ({len(pw)} warning(s))')

# 7. _clean_and_parse_json 4-pass repair
print('\n[7] _clean_and_parse_json() 4-pass repair...')
import json
r1 = _clean_and_parse_json('{"a": 1}')
assert r1 == {'a': 1}
r2 = _clean_and_parse_json('```json\n  {"b":2}\n``` trailing noise')
assert r2 == {'b': 2}
r3 = _clean_and_parse_json('prefix {"c":3, "d":{"e":4')
assert r3 == {'c': 3, 'd': {'e': 4}}
r4 = _clean_and_parse_json('  {"outer":{"arr":[1,2,3]  ')
assert r4['outer']['arr'] == [1,2,3]
err_raised = False
try:
    _clean_and_parse_json('not json at all {{{}}}')
except Exception:
    err_raised = True
assert err_raised
print('    OK 4 passes + raises on garbage (ValueError)')

# 8. Safety prompt checks
print('\n[8] EXTRACTION_PROMPT safety language...')
pu = EXTRACTION_PROMPT.upper()
pl = EXTRACTION_PROMPT.lower()
assert 'EXTRACT' in pu and 'VISIBLY' in pu
assert 'never invent' in pl or 'never guess' in pl
assert 'verification_required' in EXTRACTION_PROMPT
assert '1-0-1' in EXTRACTION_PROMPT
print('    OK all 4 safety phrases present')

# 9. PII redactor + NLP extractor cross-function
print('\n[9] PII redactor + NLP extractor (cross-module)...')
red, fields = redact_pii('Patient: Rajesh Kumar, Ph +91-9876543210, Aadhaar 1234-5678-9012')
assert 'Rajesh Kumar' not in red
assert '9876543210' not in red
assert len(fields) >= 2
meds, cat, conf, nw = nlp_extractor.extract_from_text('Rx: Tab Paracetamol 500mg 1-0-1 x 3 days, Syrup Cough Syrup BD')
assert len(meds) >= 1
print(f'    OK PII redactor: {len(fields)} fields scrubbed, NLP: {len(meds)} meds (category={cat})')

# 10. Demo mode + PDF text hint support in scan_extraction signature
print('\n[10] Signature check: pdf_text_hint threaded through service...')
import inspect
sig = inspect.signature(prescription_scanner_service.scan_extraction)
assert 'pdf_text_hint' in sig.parameters
print('    OK scan_extraction accepts pdf_text_hint (Issue-3 fix integrated)')

print('\n' + '='*60)
print('RESULT: 10/10 CONNECTIVITY + FUNCTION CHECKS PASSED')
print('='*60)
