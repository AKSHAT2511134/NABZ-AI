import requests, json, io, os

URL = 'http://localhost:8000'
def HIT(label, method, path, **kw):
    try:
        r = requests.request(method, URL+path, timeout=15, **kw)
        ct = r.headers.get('content-type','')
        if 'json' in ct:
            body = r.json()
            body_print = json.dumps(body, default=str)[:500]
        else:
            body = r.text[:500]
            body_print = body
        print(f'[{label}] HTTP {r.status_code} | {method} {path}')
        print(f'    body-head: {body_print}')
        return r.status_code, body
    except Exception as e:
        print(f'[{label}] EXC: {type(e).__name__}: {str(e)[:300]}')
        return None, None

results = {}

# 1. Health
s, b = HIT('health', 'GET', '/health')
health_ok = (s==200 and isinstance(b,dict) and b.get('status')=='healthy' and b.get('zero_pii')==True)
results['health (200, status healthy)'] = health_ok

# 2. Verify-key regression
s, b = HIT('verify-key-empty', 'POST', '/prescriptions/verify-key', json={'api_key':'','provider':'gemini'})
vk_ok = (s==200 and isinstance(b,dict) and b.get('valid')==False)
results['/prescriptions/verify-key (200 valid=False)'] = vk_ok

# 3. Scan SUCCESS (DEMO_MODE)
png_path = '../rx_check.png'
scan_ok = False
med_field_ok = False
if os.path.exists(png_path):
    with open(png_path,'rb') as pf:
        files = {'prescription': ('rx_check.png', pf, 'image/png')}
        s, b = HIT('scan-DEMO-PNG', 'POST', '/prescriptions/scan', files=files)
    if s==200 and isinstance(b,dict) and b.get('success') is True and 'data' in b:
        d = b['data']
        meds = d.get('medicines',[])
        over = d.get('overall_confidence',-1)
        flag_count = sum(1 for m in meds if m.get('verification_required'))
        unr = len(d.get('unreadable_sections',[]))
        has_101 = any('1-0-1' in str(m.get('frequency','')) for m in meds)
        has_metf = any(('Metf' in str(m.get('name','')) and m.get('verification_required')) for m in meds)
        scan_ok = (len(meds)>=4 and 0.0<=over<=1.0 and flag_count>=1 and unr>=1 and has_101 and has_metf)
        req_keys = {'name','strength','dosage','frequency','duration','route','instructions',
                    'confidence','verification_required','source_text','original_text','normalized_name','page','reason'}
        med_field_ok = all(req_keys.issubset(set(m.keys())) for m in meds)
        results['/scan SUCCESS (>=4 meds, conf in [0,1], >=1 flagged, >=1 unreadable, has 1-0-1, Metf partial flagged)'] = scan_ok
        results['/scan MED FIELD COVERAGE (14 schema keys/medicine)'] = med_field_ok
        results['/scan data schema keys completeness (10 fields)'] = (
            set(d.keys()) >= {'patient','doctor','prescription','diagnosis','medicines','tests','instructions','warnings','unreadable_sections','overall_confidence'})
        results['/scan top-level keys (success/data/error/warnings)'] = (
            set(b.keys()) == {'success','data','error','warnings'})
        results['/scan DEMO_MODE warning in warnings[]'] = any('DEMO MODE' in str(w) for w in b.get('warnings',[]))

# 4. bad mime 400
files_bad_mime = {'prescription': ('notes.txt', io.BytesIO(b'hello'), 'text/plain')}
s, b = HIT('scan-bad-mime', 'POST', '/prescriptions/scan', files=files_bad_mime)
bad_mime_ok = (s==400) and ( ('Unsupported file type' in str(b.get('detail',''))) or ('Unsupported file type' in str(b.get('error',''))) )
results['/scan bad mime (text/plain -> 400)'] = bad_mime_ok

# 5. oversized 400
big = io.BytesIO(b'\x00'*(6*1024*1024))
files_big = {'prescription': ('big.png', big, 'image/png')}
s, b = HIT('scan-too-big', 'POST', '/prescriptions/scan', files=files_big)
big_ok = (s==400) and ('too large' in str(b).lower() or 'maximum' in str(b).lower())
results['/scan 6MB -> 400 (too large)'] = big_ok

# 6. 0 bytes
empty = io.BytesIO(b'')
files_empty = {'prescription': ('empty.png', empty, 'image/png')}
s, b = HIT('scan-zero', 'POST', '/prescriptions/scan', files=files_empty)
zero_ok = (s==400) and ('empty' in str(b).lower() or 'could not' in str(b).lower() or '0 byte' in str(b).lower())
results['/scan 0 bytes -> 400 (empty)'] = zero_ok

# 7. bad ext (.txt named but wrong ext)
files_bad_ext = {'prescription': ('notes.txt', io.BytesIO(b'fake'), 'image/jpeg')}
s, b = HIT('scan-bad-ext', 'POST', '/prescriptions/scan', files=files_bad_ext)
bad_ext_ok = (s==400)
results['/scan .txt ext (jpeg mime but .txt name) -> 400'] = bad_ext_ok

print()
print('='*70)
print('LIVE HTTP CHECKLIST (all against real server on port 8000)')
print('='*70)
for k, v in results.items():
    mark = 'PASS' if v else 'FAIL'
    print(f'  [{mark}]  {k}')
total = sum(1 for v in results.values() if v)
print()
print(f'  TOTAL: {total}/{len(results)} checks passed')
