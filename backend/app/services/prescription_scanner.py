"""
Prescription Scanner Service for NABZ AI.
Strict, safety-first extraction of structured fields from prescription images/PDFs.
No diagnosis, no hallucination, no reinterpretation. Empty = null; unclear = flagged.
"""

import os
import json
import base64
import logging
import requests
from typing import Optional, Dict, Any, Tuple
from ..models.prescription_scan import (
    PatientInfo,
    DoctorInfo,
    PrescriptionMeta,
    ExtractedMedicine,
    ExtractedPrescription,
)

logger = logging.getLogger("nabz_scanner")


def _load_local_env():
    possible_paths = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.getcwd(), "backend", ".env"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
    ]
    for p in possible_paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            except Exception:
                pass


_load_local_env()

GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

EXTRACTION_PROMPT = """You are a strict Prescription Document OCR Extraction AI.
YOUR ONLY JOB IS TO EXTRACT EXACTLY WHAT IS VISIBLY WRITTEN. YOU MUST NOT INTERPRET, DIAGNOSE, ADVISE, OR INVENT ANYTHING.

CRITICAL SAFETY RULES (VIOLATIONS ARE FATAL):
1. NO DIAGNOSIS. NO MEDICAL ADVICE. NO DRUG SUBSTITUTIONS. NO EXPLANATIONS.
2. EMPTY/MISSING FIELDS MUST BE null OR [] — NEVER INVENT A VALUE, NEVER GUESS, NEVER USE A DEFAULT.
3. IF TEXT IS UNCLEAR, PARTIAL, OR SMUDGED:
   - Keep the raw partial text exactly as it appears (e.g. "Metf... 500")
   - Set confidence LOW (0.00–0.69)
   - Set verification_required = true
   - Provide a short reason string (e.g. "Partial name, handwriting unclear")
4. FREQUENCY/DOSAGE LIKE "1-0-1" OR "BD" MUST BE LEFT VERBATIM. DO NOT TRANSLATE INTO WORDS.
5. The source_text field for each medicine must contain the VERBATIM OCR SNIPPET from which that medicine was extracted — copy it character-for-character.
6. If you cannot read a section at all, add a brief description to unreadable_sections and DO NOT fabricate fields for it.
7. Do not add any commentary, markdown, or prose. Return ONLY the JSON object.

Extract the following information in strict JSON format exactly matching this schema:
{
  "patient": {
    "name": null or string (exact visible name),
    "age": null or string (exact visible age/DOB),
    "gender": null or string (exact visible gender)
  },
  "doctor": {
    "name": null or string (exact visible doctor name),
    "registration_number": null or string (exact visible reg/MCI/NMC no.),
    "specialization": null or string (exact visible specialization)
  },
  "prescription": {
    "date": null or string (exact visible date),
    "hospital": null or string (exact visible hospital name),
    "clinic": null or string (exact visible clinic name)
  },
  "diagnosis": [],
  "medicines": [
    {
      "name": null or string (exact visible medicine name — partial if unclear),
      "strength": null or string (exact visible strength e.g. "500mg"),
      "dosage": null or string (exact visible dose per intake),
      "frequency": null or string (VERBATIM e.g. "1-0-1", "BD", "TDS", "OD", "SOS"),
      "duration": null or string (exact visible duration e.g. "5 days"),
      "route": null or string (exact visible route e.g. "Oral", "IV"),
      "instructions": null or string (exact visible extra instructions),
      "confidence": 0.0 to 1.0 (your exact confidence for THIS medicine),
      "verification_required": boolean (true if confidence < 0.70 or partial/unclear),
      "source_text": null or string (VERBATIM OCR snippet for this medicine line),
      "original_text": null or string (raw original before any light normalization),
      "normalized_name": null or string (lightly normalized brand name if high conf),
      "page": 1 or integer (page number if multi-page),
      "reason": null or string (brief reason if verification_required=true, else null)
    }
  ],
  "tests": [],
  "instructions": [],
  "warnings": [],
  "unreadable_sections": [],
  "overall_confidence": 0.0 to 1.0
}

REMINDER: ONE MORE TIME — IF IT IS NOT CLEARLY VISIBLE, USE null, [], OR FLAG IT. NEVER MAKE UP A MEDICINE, DOSAGE, OR PATIENT DETAIL."""


def _clean_and_parse_json(raw_text: str) -> Dict[str, Any]:
    clean = raw_text.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    if clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    clean = clean.strip()

    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        pass

    first = clean.find("{")
    if first == -1:
        raise ValueError("Unable to parse AI output as valid JSON after all repair passes")

    last = clean.rfind("}")
    slice_end = last + 1 if (last != -1 and last > first) else len(clean)
    attempt1 = clean[first:slice_end]
    try:
        return json.loads(attempt1)
    except json.JSONDecodeError:
        pass

    def _rebalance_braces(s: str) -> str:
        opens = s.count("{")
        closes = s.count("}")
        if opens == closes:
            return s
        if opens > closes:
            base = s.rstrip()
            trimmed = base
            for _ in range(opens - closes):
                trimmed = trimmed.rstrip()
                if trimmed.endswith(","):
                    trimmed = trimmed[:-1]
                trimmed += "}"
            return trimmed
        extra = closes - opens
        last_open = s.rfind("{")
        if last_open == -1:
            return s
        tail = s[last_open:]
        cut = 0
        for ch in reversed(tail):
            if ch == "}":
                cut += 1
                if cut >= extra:
                    break
        new_tail = tail[: len(tail) - cut] if cut > 0 else tail
        merged = s[:last_open] + new_tail
        opens2 = merged.count("{")
        closes2 = merged.count("}")
        if opens2 > closes2:
            return _rebalance_braces(merged)
        return merged

    attempt2 = _rebalance_braces(attempt1)
    if attempt2 != attempt1:
        try:
            return json.loads(attempt2)
        except json.JSONDecodeError:
            pass

    for truncate_at in range(len(attempt1) - 1, max(first, 8), -1):
        if attempt1[truncate_at] in '0123456789"}]truflsn':
            candidate = attempt1[: truncate_at + 1]
            rebalanced = _rebalance_braces(candidate)
            try:
                return json.loads(rebalanced)
            except json.JSONDecodeError:
                continue

    arr_first = attempt1.find("[")
    arr_last = attempt1.rfind("]")
    if arr_first != -1 and arr_last != -1 and arr_last > arr_first:
        attempt3 = attempt1[:arr_first] + attempt1[arr_first : arr_last + 1]
        try:
            return json.loads(attempt3)
        except json.JSONDecodeError:
            pass

    raise ValueError("Unable to parse AI output as valid JSON after all repair passes")


def validate_extraction(data: Dict[str, Any]) -> Tuple[ExtractedPrescription, list]:
    warnings: list = []

    patient_raw = data.get("patient") or {}
    doctor_raw = data.get("doctor") or {}
    meta_raw = data.get("prescription") or {}

    patient = PatientInfo(
        name=patient_raw.get("name") or None,
        age=patient_raw.get("age") or None,
        gender=patient_raw.get("gender") or None,
    )

    doctor = DoctorInfo(
        name=doctor_raw.get("name") or None,
        registration_number=doctor_raw.get("registration_number") or None,
        specialization=doctor_raw.get("specialization") or None,
    )

    prescription = PrescriptionMeta(
        date=meta_raw.get("date") or None,
        hospital=meta_raw.get("hospital") or None,
        clinic=meta_raw.get("clinic") or None,
    )

    diagnosis = [str(x) for x in (data.get("diagnosis") or []) if x]
    tests = [str(x) for x in (data.get("tests") or []) if x]
    instructions = [str(x) for x in (data.get("instructions") or []) if x]
    extract_warnings = [str(x) for x in (data.get("warnings") or []) if x]
    warnings.extend(extract_warnings)
    unreadable = [str(x) for x in (data.get("unreadable_sections") or []) if x]

    medicines: list = []
    for m in (data.get("medicines") or []):
        conf = m.get("confidence", 0.0)
        try:
            conf_f = float(conf)
        except (TypeError, ValueError):
            conf_f = 0.0
        if conf_f < 0.0:
            conf_f = 0.0
        elif conf_f > 1.0:
            conf_f = conf_f / 100.0
            if conf_f > 1.0:
                conf_f = 1.0
            if conf_f < 0.0:
                conf_f = 0.0

        needs_verify = conf_f < 0.70 or bool(m.get("verification_required"))

        reason = m.get("reason") or None
        if needs_verify and not reason:
            if conf_f < 0.70:
                reason = "Low confidence extraction"
            else:
                reason = "Field flagged for review"

        medicines.append(
            ExtractedMedicine(
                name=m.get("name") or None,
                strength=m.get("strength") or None,
                dosage=m.get("dosage") or None,
                frequency=m.get("frequency") or None,
                duration=m.get("duration") or None,
                route=m.get("route") or None,
                instructions=m.get("instructions") or None,
                confidence=conf_f,
                verification_required=needs_verify,
                source_text=m.get("source_text") or None,
                original_text=m.get("original_text") or None,
                normalized_name=m.get("normalized_name") or None,
                page=m.get("page") or None,
                reason=reason if needs_verify else None,
            )
        )

    overall = data.get("overall_confidence", 0.0)
    try:
        overall_f = float(overall)
    except (TypeError, ValueError):
        overall_f = 0.0
    if overall_f > 1.0:
        overall_f = overall_f / 100.0
    overall_f = min(max(overall_f, 0.0), 1.0)

    extracted = ExtractedPrescription(
        patient=patient,
        doctor=doctor,
        prescription=prescription,
        diagnosis=diagnosis,
        medicines=medicines,
        tests=tests,
        instructions=instructions,
        warnings=[],
        unreadable_sections=unreadable,
        overall_confidence=overall_f,
    )

    return extracted, warnings


def demo_mode_fixture() -> Tuple[ExtractedPrescription, list]:
    warnings = ["DEMO MODE: Sample extraction returned. Configure an AI API key for live scanning."]

    patient = PatientInfo(
        name=None,
        age="42",
        gender="M",
    )

    doctor = DoctorInfo(
        name="Dr. Sharma",
        registration_number=None,
        specialization="General Medicine",
    )

    prescription = PrescriptionMeta(
        date="14/09/2026",
        hospital="City Hospital",
        clinic=None,
    )

    medicines = [
        ExtractedMedicine(
            name="Pan D",
            strength="40mg",
            dosage="1 cap",
            frequency="OD",
            duration="7 days",
            route="Oral",
            instructions="Before food",
            confidence=0.96,
            verification_required=False,
            source_text="1. Cap Pan D 40mg — OD x 7 days (before food)",
            original_text="Cap Pan D 40mg — OD x 7 days (before food)",
            normalized_name="Pan D",
            page=1,
            reason=None,
        ),
        ExtractedMedicine(
            name="Amoxicillin",
            strength="500mg",
            dosage="1 tab",
            frequency="1-0-1",
            duration="5 days",
            route="Oral",
            instructions=None,
            confidence=0.92,
            verification_required=False,
            source_text="2. Tab Amoxicillin 500mg 1-0-1 x 5 days",
            original_text="Tab Amoxicillin 500mg 1-0-1 x 5 days",
            normalized_name="Amoxicillin",
            page=1,
            reason=None,
        ),
        ExtractedMedicine(
            name="Metf... 500",
            strength="500mg",
            dosage=None,
            frequency="1-0-1",
            duration=None,
            route=None,
            instructions="After food",
            confidence=0.52,
            verification_required=True,
            source_text="3. Metf... 500 1-0-1 (after food) — handwriting smudged",
            original_text="Metf... 500 1-0-1 (after food)",
            normalized_name=None,
            page=1,
            reason="Partial name, handwriting unclear / smudged",
        ),
        ExtractedMedicine(
            name="Dolo 650",
            strength="650mg",
            dosage="1 tab",
            frequency="SOS",
            duration="3 days",
            route="Oral",
            instructions="For fever >101F",
            confidence=0.98,
            verification_required=False,
            source_text="4. Tab Dolo 650 — SOS for fever >101F x 3 days",
            original_text="Tab Dolo 650 — SOS for fever >101F x 3 days",
            normalized_name="Dolo 650",
            page=1,
            reason=None,
        ),
    ]

    tests = ["Fasting Blood Sugar (FBS)"]

    instructions = [
        "Drink plenty of ORS / boiled water",
    ]

    unreadable_sections = [
        "Lower-right Rx block (below medicine 4) — heavily smudged, unreadable",
        "Top-left corner stamp — blurry, OCR returned empty",
    ]

    extracted = ExtractedPrescription(
        patient=patient,
        doctor=doctor,
        prescription=prescription,
        diagnosis=[],
        medicines=medicines,
        tests=tests,
        instructions=instructions,
        warnings=[],
        unreadable_sections=unreadable_sections,
        overall_confidence=0.78,
    )

    return extracted, warnings


class PrescriptionScannerService:
    @staticmethod
    def get_api_key(passed_key: Optional[str] = None) -> Optional[str]:
        if passed_key and passed_key.strip():
            return passed_key.strip()
        return (
            os.getenv("AI_API_KEY")
            or os.getenv("GOOGLE_CLOUD_VISION_API_KEY")
            or os.getenv("GEMINI_API_KEY")
            or os.getenv("MEDICAL_AI_API_KEY")
            or os.getenv("OPENAI_API_KEY")
        )

    @staticmethod
    def detect_provider(api_key: str) -> str:
        if api_key.startswith("sk-"):
            return "openai"
        return "gemini"

    @staticmethod
    def is_demo_mode() -> bool:
        return str(os.getenv("DEMO_MODE", "false")).lower() == "true"

    def _call_gemini_vision(self, b64_data: str, mime_type: str, api_key: str, pdf_text_hint: Optional[str] = None) -> Dict[str, Any]:
        last_error = None
        prompt_text = EXTRACTION_PROMPT
        if pdf_text_hint:
            hint_preamble = (
                "CONTEXT HINT — The following selectable text was already extracted from the PDF document. "
                "Use it as a strong reference to cross-check the OCR/visual extraction. "
                "If the visual reading conflicts with this text, prefer this text for any visible lines. "
                f"Do NOT invent information not present either in the visual or in this extracted text.\n\n"
                "----- BEGIN PRE-EXTRACTED PDF TEXT -----\n"
                f"{pdf_text_hint}\n"
                "----- END PRE-EXTRACTED PDF TEXT -----\n\n"
            )
            prompt_text = hint_preamble + EXTRACTION_PROMPT
        for model in GEMINI_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            data_mime = mime_type
            if not mime_type.startswith("image/") and not mime_type.startswith("application/pdf"):
                data_mime = "image/png"
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt_text},
                            {"inline_data": {"mime_type": data_mime, "data": b64_data}},
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.0,
                    "response_mime_type": "application/json",
                },
            }
            try:
                resp = requests.post(
                    url, json=payload, headers={"Content-Type": "application/json"}, timeout=35
                )
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [{}])
                        text_part = parts[0].get("text", "") if parts else ""
                        return _clean_and_parse_json(text_part)
                else:
                    err_json = resp.json().get("error", {})
                    last_error = f"HTTP {resp.status_code}: {err_json.get('message', resp.text[:180])}"
            except Exception as e:
                last_error = str(e)
        raise RuntimeError(f"Extraction AI unavailable. Last issue: {last_error or 'unknown'}")

    def _call_openai_vision(self, b64_data: str, mime_type: str, api_key: str, pdf_text_hint: Optional[str] = None) -> Dict[str, Any]:
        url = "https://api.openai.com/v1/chat/completions"
        prompt_text = EXTRACTION_PROMPT
        if pdf_text_hint:
            hint_preamble = (
                "CONTEXT HINT — The following selectable text was already extracted from the PDF document. "
                "Use it as a strong reference to cross-check the OCR/visual extraction. "
                "If the visual reading conflicts with this text, prefer this text for any visible lines. "
                f"Do NOT invent information not present either in the visual or in this extracted text.\n\n"
                "----- BEGIN PRE-EXTRACTED PDF TEXT -----\n"
                f"{pdf_text_hint}\n"
                "----- END PRE-EXTRACTED PDF TEXT -----\n\n"
            )
            prompt_text = hint_preamble + EXTRACTION_PROMPT
        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt_text},
                        {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_data}"}},
                    ],
                }
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
        }
        resp = requests.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=40,
        )
        if resp.status_code == 200:
            content = resp.json()["choices"][0]["message"]["content"]
            return _clean_and_parse_json(content)
        raise RuntimeError(f"Extraction AI request failed (HTTP {resp.status_code})")

    def scan_extraction(
        self,
        file_bytes: bytes,
        mime_type: str = "image/png",
        api_key: Optional[str] = None,
        provider: Optional[str] = None,
        pdf_text_hint: Optional[str] = None,
    ) -> Tuple[ExtractedPrescription, list]:
        warnings: list = []
        resolved_key = self.get_api_key(api_key)

        if not resolved_key:
            if self.is_demo_mode():
                return demo_mode_fixture()
            raise ValueError(
                "No AI API key configured. Set AI_API_KEY / GOOGLE_CLOUD_VISION_API_KEY / GEMINI_API_KEY "
                "or enable DEMO_MODE=true in .env for sample output."
            )

        prov = provider or self.detect_provider(resolved_key)
        b64_data = base64.b64encode(file_bytes).decode("utf-8")

        raw = None
        try:
            if prov == "gemini":
                raw = self._call_gemini_vision(b64_data, mime_type, resolved_key, pdf_text_hint=pdf_text_hint)
            elif prov == "openai":
                raw = self._call_openai_vision(b64_data, mime_type, resolved_key, pdf_text_hint=pdf_text_hint)
            else:
                raise ValueError(f"Unsupported AI provider: {prov}")
        except (json.JSONDecodeError, RuntimeError, ValueError, requests.RequestException):
            if self.is_demo_mode():
                warnings.append("Live extraction unavailable; DEMO_MODE sample returned.")
                demo_data, demo_warnings = demo_mode_fixture()
                return demo_data, warnings + demo_warnings
            raise

        try:
            return validate_extraction(raw)
        except Exception:
            if self.is_demo_mode():
                warnings.append("Extraction validation failed; DEMO_MODE sample returned.")
                demo_data, demo_warnings = demo_mode_fixture()
                return demo_data, warnings + demo_warnings
            raise


prescription_scanner_service = PrescriptionScannerService()
