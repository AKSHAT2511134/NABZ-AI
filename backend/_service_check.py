import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '.pydeps'))
sys.path.insert(0, os.path.dirname(__file__))

from app.services.prescription_scanner import (
    validate_extraction, demo_mode_fixture, EXTRACTION_PROMPT
)
from app.models.prescription_scan import (
    PatientInfo, DoctorInfo, PrescriptionMeta, ExtractedMedicine,
    ExtractedPrescription, ScanPrescriptionResponse
)
import json

results = {}

# --- Prompt safety ---
safety_rules = [
    'null OR []', 'NEVER INVENT', '1-0-1', 'source_text', 'verification_required',
    'confidence', 'CRITICAL SAFETY RULES'
]
prompt_safe = all(
    (needle.lower() in EXTRACTION_PROMPT.lower()) for needle in safety_rules
)
results['EXTRACTION_PROMPT has all 7 safety keywords'] = prompt_safe

# --- Validator edge cases ---
# E1: empty {} everywhere -> all nulls, empty lists
ext, w = validate_extraction({})
e1_ok = (ext.patient.name is None and ext.patient.age is None
         and ext.patient.gender is None and ext.doctor.registration_number is None
         and len(ext.diagnosis)==0 and len(ext.tests)==0
         and len(ext.medicines)==0 and len(ext.unreadable_sections)==0
         and len(ext.instructions)==0)
results['Validator E1: empty input => all nulls, all []'] = e1_ok

# E2: empty string "" -> converted to None
ext, w = validate_extraction({
    'patient': {'name':'', 'age':'', 'gender':''},
    'doctor':  {'name':'', 'registration_number':'', 'specialization':''},
    'prescription': {'date':'', 'hospital':'', 'clinic':''},
    'diagnosis': ['', None, 'Gastro', ''],
    'tests':     ['', '', 'FBS'],
    'instructions': ['', '', ''],
    'unreadable_sections': ['', None, 'smudged'],
    'medicines': [],
    'overall_confidence': 0.92,
})
e2_ok = (ext.patient.name is None and ext.patient.age is None
         and ext.patient.gender is None
         and len(ext.diagnosis)==1 and ext.diagnosis[0]=='Gastro'
         and len(ext.tests)==1 and ext.tests[0]=='FBS'
         and len(ext.instructions)==0
         and len(ext.unreadable_sections)==1 and ext.unreadable_sections[0]=='smudged'
         and ext.overall_confidence == 0.92)
results['Validator E2: ""/None filtered from lists + coerced to None in scalars'] = e2_ok

# E3: integer percent confidences (52, 96, 100) normalized to 0.52/0.96/1.00
ext, w = validate_extraction({
    'medicines': [
        {'name':'A','confidence':52},           # 0.52, verify
        {'name':'B','confidence':96},           # 0.96, high
        {'name':'C','confidence':100},          # 1.0, high
        {'name':'D','confidence':150},          # 1.50 -> /100 = 1.50, clip -> 1.0
        {'name':'E','confidence':'0.90'},       # string 0.90 -> float 0.90
    ],
    'overall_confidence': '78',                 # string integer percent -> 0.78
})
meds = ext.medicines
e3_ok = (len(meds)==5
         and meds[0].confidence==0.52 and meds[0].verification_required==True
         and meds[1].confidence==0.96 and meds[1].verification_required==False
         and meds[2].confidence==1.00 and meds[2].verification_required==False
         and meds[3].confidence==1.00 and meds[3].verification_required==False
         and meds[4].confidence==0.90 and meds[4].verification_required==False
         and ext.overall_confidence==0.78)
results['Validator E3: integer percent normalized, strings coerced, >1 clipped'] = e3_ok

# E4: reason populated correctly
has_reason_A = (meds[0].reason is not None and len(meds[0].reason)>0)
e4_ok = has_reason_A and meds[1].reason is None and meds[2].reason is None
results['Validator E4: verify meds get reason, high-confidence meds reason=None'] = e4_ok

# E5: negative confidence clipped to 0.0
ext, w = validate_extraction({
    'medicines': [{'name':'F','confidence':-0.25}],
    'overall_confidence': -1.0
})
e5_ok = (ext.medicines[0].confidence==0.0 and ext.medicines[0].verification_required==True
         and ext.overall_confidence==0.0)
results['Validator E5: negative confidence clipped to 0.0'] = e5_ok

# E6: invalid garbage confidence (non-numeric string) falls through to 0.0, verify True
ext, w = validate_extraction({
    'medicines': [{'name':'G','confidence':'not-a-number'}],
})
e6_ok = (ext.medicines[0].confidence==0.0 and ext.medicines[0].verification_required==True)
results['Validator E6: garbage confidence -> 0.0 + verify'] = e6_ok

# E7: manually set verification_required even if high confidence -> stays True + reason
ext, w = validate_extraction({
    'medicines': [{'name':'H','confidence':0.95,'verification_required':True,
                   'reason':'Handwriting doctor signature uncertain'}]
})
med = ext.medicines[0]
e7_ok = (med.confidence==0.95 and med.verification_required==True
         and med.reason=='Handwriting doctor signature uncertain')
results['Validator E7: user-set verify=True (conf high) preserved + reason kept'] = e7_ok

# E8: "1-0-1" preserved verbatim
ext, w = validate_extraction({
    'medicines': [{'name':'Metformin','strength':'500mg','frequency':'1-0-1','source_text':'Metformin 500mg 1-0-1 x 30 days','confidence':0.92}],
})
e8_ok = (ext.medicines[0].frequency=='1-0-1' and ext.medicines[0].source_text=='Metformin 500mg 1-0-1 x 30 days')
results['Validator E8: "1-0-1" preserved verbatim in frequency + source_text'] = e8_ok

# E9: Source text preserved even for low-confidence medicine, not overwritten by validator
ext, w = validate_extraction({
    'medicines': [{'name':'Metf... 500','source_text':'Metf... 500 1-0-1 -- handwriting smudged','confidence':48}],
})
m = ext.medicines[0]
e9_ok = (m.name=='Metf... 500' and m.confidence==0.48
         and m.verification_required==True
         and m.source_text=='Metf... 500 1-0-1 -- handwriting smudged'
         and m.reason is not None and len(m.reason)>0)
results['Validator E9: partial name "Metf... 500" NOT invented, source preserved, verify'] = e9_ok

# --- Demo fixture shape ---
fixt, warn = demo_mode_fixture()
fm = fixt.medicines
flag_count = sum(1 for m in fm if m.verification_required)
metf_in = any(('Metf' in str(m.name) and m.verification_required) for m in fm)
d101_count = sum(1 for m in fm if '1-0-1' in str(m.frequency))
has_dolo = any('Dolo' in str(m.name) for m in fm)
has_pan = any('Pan D' == str(m.name) for m in fm)
demo_ok = (len(fm)>=4 and flag_count>=1 and len(fixt.unreadable_sections)>=1
           and len(fixt.tests)>=1 and len(fixt.instructions)>=1
           and metf_in and d101_count>=1 and has_dolo and has_pan
           and fixt.overall_confidence>=0.0 and fixt.overall_confidence<=1.0
           and fixt.patient.name is None and len(fixt.diagnosis)==0
           and any('DEMO MODE' in str(w) for w in warn))
results['demo_mode_fixture: 4 meds, 1 verify, 2 unreadable, 1 test, 1 instr, Metf flagged, 1-0-1, Dolo+Pan, nulls preserved, DEMO banner'] = demo_ok

# --- All 6 Pydantic models instantiate and roundtrip JSON ---
med = ExtractedMedicine(
    name='Amoxicillin', strength='500mg', dosage='1 tab', frequency='1-0-1',
    duration='5 days', route='Oral', instructions=None,
    confidence=0.92, verification_required=False,
    source_text='2. Tab Amoxicillin 500mg 1-0-1 x 5 days',
    original_text='Tab Amoxicillin 500mg 1-0-1 x 5 days',
    normalized_name='Amoxicillin', page=1, reason=None
)
ep = ExtractedPrescription(
    patient=PatientInfo(name=None, age='42', gender='M'),
    doctor=DoctorInfo(name='Dr. Sharma', registration_number=None, specialization='General Medicine'),
    prescription=PrescriptionMeta(date='14/09/2026', hospital='City Hospital', clinic=None),
    diagnosis=[], medicines=[med], tests=['FBS'], instructions=['Plenty of water'],
    warnings=[], unreadable_sections=['stamp blurry'], overall_confidence=0.82
)
spr = ScanPrescriptionResponse(success=True, data=ep, error=None, warnings=['demo'])
j = spr.model_dump_json()
back = json.loads(j)
keys_ok = set(back.keys())=={'success','data','error','warnings'}
med_ok = set(back['data']['medicines'][0].keys()) >= {
    'name','strength','dosage','frequency','duration','route','instructions',
    'confidence','verification_required','source_text','original_text','normalized_name','page','reason'}
nulls_ok = (back['data']['patient']['name'] is None
            and back['data']['doctor']['registration_number'] is None
            and back['data']['prescription']['clinic'] is None
            and back['data']['medicines'][0]['instructions'] is None
            and back['data']['medicines'][0]['reason'] is None
            and back['error'] is None)
model_ok = keys_ok and med_ok and nulls_ok
results['Pydantic models JSON roundtrip: keys correct, nulls preserved, 14 med fields'] = model_ok

# --- Summary ---
print()
print('='*70)
print('SERVICE LAYER + VALIDATOR EDGE-CASE CHECKLIST (15 checks)')
print('='*70)
for k, v in results.items():
    mark = 'PASS' if v else 'FAIL'
    print(f'  [{mark}]  {k}')
total = sum(1 for v in results.values() if v)
print()
print(f'  TOTAL: {total}/{len(results)} checks passed')
