"""
PII Redactor for NABZ AI
Strict privacy enforcement: strips patient identity before storage or display.
"""

import re
from typing import Tuple, List
from ..models.prescription import RedactedField


PHONE_PATTERN = re.compile(
    r"(?:\+91[\s\-]?)?(?:[6789]\d{4}[\s\-]?\d{5}|[6789]\d{9}|\b\d{5}[\s\-]\d{5}\b)"
)
AADHAAR_PATTERN = re.compile(r"\b\d{4}\s\d{4}\s\d{4}\b")
AGE_PATTERN = re.compile(
    r"(?:Age|Aged)\s*[:\-]?\s*(\d{1,3}\s*(?:Y(?:ears|rs)?|M(?:onths)?)?)",
    re.IGNORECASE,
)
PATIENT_NAME_PATTERNS = [
    re.compile(
        r"(?:Patient(?:\s+Name)?|Pt(?:\s+Name)?|Name)\s*[:\-]\s*([A-Za-z\.\s]{2,40}?)(?=[,\n\r]|\s+(?:Age|Sex|Gender|Phone|Mobile|Address|DOB|OPD|UHID)|$)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:Shri|Smt|Mr\.|Mrs\.|Ms\.)\s+([A-Za-z\s]{3,30}?)(?=[,\n\r]|\s+(?:Age|Sex|Gender|Phone)|$)",
        re.IGNORECASE,
    ),
]
ADDRESS_PATTERNS = [
    re.compile(
        r"(?:Address|Res(?:idence)?|Addr)\s*[:\-]\s*([^\n\r]{4,100})",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:Sector|House\s*No|H\.?\s*No|Flat\s*No|Plot\s*No|Near|Behind|Colony|Nagar|Chauraha)[^\n\r,]{3,40},[^\n\r]{3,60}",
        re.IGNORECASE,
    ),
]
ID_PATTERNS = [
    re.compile(r"(?:UHID|OPD\s*No|Reg\s*No|MRN)\s*[:\-]?\s*([A-Za-z0-9\-_/]{4,25})", re.IGNORECASE)
]


def redact_pii(text: str) -> Tuple[str, List[RedactedField]]:
    """
    Redacts personal identity markers and returns:
    (redacted_text, list_of_redacted_fields)
    """
    if not text:
        return "", []

    redacted_text = text
    fields: List[RedactedField] = []

    # 1. Names
    for pat in PATIENT_NAME_PATTERNS:
        matches = list(pat.finditer(redacted_text))
        for m in matches:
            val = m.group(1).strip()
            # Avoid masking clinical doctor names or section titles
            if val.lower() in ["dr", "dr.", "doctor", "rx", "opd", "medicine", "general", "date", "time"]:
                continue
            token = "█" * max(len(val), 8) + " [REDACTED_NAME]"
            fields.append(RedactedField(field="Patient Name", value=val, token=token))
            redacted_text = redacted_text.replace(val, token)

    # 2. Phone Numbers
    phone_matches = list(PHONE_PATTERN.finditer(redacted_text))
    for m in phone_matches:
        val = m.group(0).strip()
        token = "█" * max(len(val), 10) + " [REDACTED_PHONE]"
        fields.append(RedactedField(field="Phone Number", value=val, token=token))
        redacted_text = redacted_text.replace(val, token)

    # 3. Aadhaar / Govt ID
    aadhaar_matches = list(AADHAAR_PATTERN.finditer(redacted_text))
    for m in aadhaar_matches:
        val = m.group(0).strip()
        token = "████ ████ ████ [REDACTED_ID]"
        fields.append(RedactedField(field="National ID", value=val, token=token))
        redacted_text = redacted_text.replace(val, token)

    # 4. Address
    for pat in ADDRESS_PATTERNS:
        matches = list(pat.finditer(redacted_text))
        for m in matches:
            val = m.group(1) if len(m.groups()) > 0 else m.group(0)
            val = val.strip()
            # Do not mask city name or hospital header
            if len(val) > 4:
                token = "█" * min(len(val), 24) + " [REDACTED_ADDRESS]"
                fields.append(RedactedField(field="Residential Address", value=val, token=token))
                redacted_text = redacted_text.replace(val, token)

    # 5. Exact Age / DOB
    age_matches = list(AGE_PATTERN.finditer(redacted_text))
    for m in age_matches:
        val = m.group(0).strip()
        token = "Age: ██ [REDACTED_AGE]"
        fields.append(RedactedField(field="Patient Age", value=val, token=token))
        redacted_text = redacted_text.replace(val, token)

    # 6. OPD Slip / UHID
    for pat in ID_PATTERNS:
        matches = list(pat.finditer(redacted_text))
        for m in matches:
            val = m.group(0).strip()
            token = "OPD-█████ [REDACTED_ID]"
            fields.append(RedactedField(field="Hospital OPD ID", value=val, token=token))
            redacted_text = redacted_text.replace(val, token)

    return redacted_text, fields
