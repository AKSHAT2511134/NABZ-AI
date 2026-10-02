import sys, io, os
sys.path.insert(0, r'c:\Users\aksha\OneDrive\Desktop\NABZ-AI\backend\.pydeps')
sys.path.insert(0, r'c:\Users\aksha\OneDrive\Desktop\NABZ-AI\backend')

print('=' * 65)
print('BACKEND LIVE HTTP ENDPOINT TEST (port 8000)')
print('=' * 65)

import requests
BASE = 'http://127.0.0.1:8000'

def check(label, method, path, expected_status=None, **kwargs):
    try:
        r = requests.request(method, BASE + path, timeout=15, **kwargs)
        code_ok = (
            expected_status is None
            or (isinstance(expected_status, list) and r.status_code in expected_status)
            or r.status_code == expected_status
        )
        status = 'OK' if code_ok else f'WARN(s={r.status_code})'
        print(f'  [{status}] {method:6s} {path:42s} HTTP {r.status_code}')
        return r, code_ok
    except Exception as e:
        print(f'  [FAIL] {method:6s} {path:42s} ERR: {e}')
        return None, False

ok_total = 0
total = 0

print('\n[1] Root /health ...')
r, ok = check('', 'GET', '/health')
if ok and r:
    d = r.json()
    assert d.get('status') == 'healthy'
    assert d.get('zero_pii') is True
    ok_total += 1
total += 1

print('\n[2] Auth router ...')
r, ok = check('', 'POST', '/auth/login', json={'username': 'demo', 'password': 'demo'})
if ok and r and r.status_code < 500:
    ok_total += 1
total += 1

print('\n[3] Wards router ...')
r, ok = check('', 'GET', '/wards')
if ok and r and r.status_code == 200:
    ok_total += 1
total += 1

print('\n[4] Alerts router ...')
r, ok = check('', 'GET', '/alerts')
if ok and r and r.status_code == 200:
    ok_total += 1
total += 1
r, ok = check('', 'GET', '/alerts/1', [200, 404])
if ok and r:
    ok_total += 1
total += 1

print('\n[5] Dashboard router ...')
r, ok = check('', 'GET', '/dashboard/summary')
if ok and r and r.status_code == 200:
    ok_total += 1
total += 1

print('\n[6] Prescriptions router ...')

r, ok = check('verify-key', 'POST', '/prescriptions/verify-key', json={'api_key': ''})
if ok and r and r.status_code == 200:
    ok_total += 1
total += 1

r, ok = check('analyze text', 'POST', '/prescriptions/analyze',
    expected_status=200,
    json={'mode': 'manual', 'symptoms': 'Fever 102F, cough', 'medicines': 'Paracetamol 500mg'})
if ok and r:
    d = r.json()
    assert 'detected_medicines' in d
    assert 'suggested_category' in d
    assert d['what_leaves_device']['patient_identity_stored'] is False
    ok_total += 1
total += 1

png_header = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
r, ok = check('upload image', 'POST', '/prescriptions/upload',
    expected_status=200,
    files={'file': ('rx.png', io.BytesIO(png_header + b'\x00' * 64), 'image/png')},
    data={'ward_id': 'w-aliganj'})
if ok and r:
    d = r.json()
    assert 'raw_text_redacted' in d
    assert 'detected_medicines' in d
    ok_total += 1
total += 1

r, ok = check('confirm signal', 'POST', '/prescriptions/confirm',
    expected_status=200,
    json={
        'ward_id': 'w-aliganj', 'ward': 'Aliganj', 'facility': 'CHC Aliganj',
        'source_type': 'OPD_PRESCRIPTION', 'category': 'Acute Gastrointestinal',
        'medicines': [{'brand': 'Paracetamol', 'generic': 'PCM', 'drug_class': 'Analgesic', 'is_chronic': False}],
    })
if ok and r:
    d = r.json()
    assert d['status'] == 'transmitted'
    ok_total += 1
total += 1

r, ok = check('scan invalid type', 'POST', '/prescriptions/scan',
    expected_status=400,
    files={'prescription': ('rx.txt', io.BytesIO(b'not a prescription'), 'text/plain')})
if ok and r is not None:
    ok_total += 1
total += 1

big = b'X' * (6 * 1024 * 1024)
r, ok = check('scan too large', 'POST', '/prescriptions/scan',
    expected_status=400,
    files={'prescription': ('big.png', io.BytesIO(big), 'image/png')})
if ok and r is not None:
    ok_total += 1
total += 1

r, ok = check('scan zero bytes', 'POST', '/prescriptions/scan',
    expected_status=400,
    files={'prescription': ('empty.png', io.BytesIO(b''), 'image/png')})
if ok and r is not None:
    ok_total += 1
total += 1

os.environ['DEMO_MODE'] = 'true'
small_png = bytes([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]) + b'\x00' * 256
r, ok = check('scan DEMO_MODE success', 'POST', '/prescriptions/scan',
    expected_status=200,
    files={'prescription': ('rx.png', io.BytesIO(small_png), 'image/png')})
if ok and r:
    d = r.json()
    assert d.get('success') is True
    data = d['data']
    assert len(data['medicines']) >= 2
    assert any(m.get('verification_required') for m in data['medicines'])
    assert len(data['unreadable_sections']) >= 1
    assert any('DEMO MODE' in w for w in d.get('warnings', []))
    assert '1-0-1' in [m.get('frequency') for m in data['medicines']]
    assert data['patient'].get('name') is None
    assert len(data.get('diagnosis') or []) == 0
    ok_total += 1
total += 1

print('\n' + '=' * 65)
print(f'HTTP ENDPOINT TEST: {ok_total}/{total} PASSED')
if ok_total == total:
    print('ALL LIVE ENDPOINTS RESPONDED CORRECTLY — ZERO FAILURES')
else:
    print(f'WARNING: {total - ok_total} ENDPOINT(S) HAD ISSUES')
print('=' * 65)
