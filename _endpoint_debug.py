import sys, io, os, json
sys.path.insert(0, r'c:\Users\aksha\OneDrive\Desktop\NABZ-AI\backend\.pydeps')
sys.path.insert(0, r'c:\Users\aksha\OneDrive\Desktop\NABZ-AI\backend')
import requests

BASE = 'http://127.0.0.1:8000'

print('Investigating non-200 / unexpected endpoint responses:')
print()

print('[A] /auth/login status=422 — checking schema + response body:')
try:
    schema = requests.get(BASE + '/openapi.json', timeout=10).json()
    paths = sorted(schema.get('paths', {}).keys())
    print(f'    Total registered HTTP paths: {len(paths)}')
except Exception as e:
    print(f'    schema err: {e}')
    paths = []

r = requests.post(BASE + '/auth/login', json={'username': 'demo', 'password': 'demo'}, timeout=5)
print(f'    status={r.status_code}, body[:400]={r.text[:400]}')
print()

print('[B] /wards status=404 — listing all ward-related paths in schema:')
wpaths = [p for p in paths if 'ward' in p.lower()]
print(f'    ward-like paths: {wpaths}')
for variant in ['/wards', '/wards/', '/ward']:
    try:
        rr = requests.get(BASE + variant, timeout=3)
        print(f'    GET {variant:15s} -> HTTP {rr.status_code}')
    except Exception as e:
        print(f'    GET {variant:15s} -> ERR {e}')
print()

print('[C] /prescriptions/confirm status=422 — examining model + body:')
from app.models.prescription import ConfirmPrescriptionRequest
fields = ConfirmPrescriptionRequest.model_fields
for name, fi in fields.items():
    print(f'    {name}: required={fi.is_required()}, type={fi.annotation}')
r = requests.post(BASE + '/prescriptions/confirm', json={
    'ward_id': 'w-aliganj',
    'ward': 'Aliganj Ward 3, Lucknow',
    'facility': 'CHC Aliganj',
    'source_type': 'OPD_PRESCRIPTION',
    'category': 'Acute Gastrointestinal',
    'medicines': [{
        'brand': 'Paracetamol', 'generic': 'PCM',
        'drug_class': 'Analgesic', 'category': 'Analgesic',
        'is_chronic': False, 'confidence': 95,
        'dosage': '1 tab', 'frequency': 'TDS',
    }],
}, timeout=8)
print(f'    Retry -> status={r.status_code}, body[:500]={r.text[:500]}')
print()

print('[D] Complete list of ALL registered HTTP paths + methods from OpenAPI:')
try:
    schema = requests.get(BASE + '/openapi.json', timeout=10).json()
    for p in sorted(schema.get('paths', {}).keys()):
        methods = sorted(schema['paths'][p].keys())
        print(f'    {", ".join(m.upper() for m in methods):10s} {p}')
except Exception as e:
    print(f'    ERR: {e}')
