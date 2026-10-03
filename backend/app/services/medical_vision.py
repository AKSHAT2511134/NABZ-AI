"""
Medical Vision AI Service for NABZ AI.
Scans prescription images, OPD slips, and clinical records using multimodal AI (Google Gemini / OpenAI).
Extracts verbatim text, patient demographics (for redaction), and exact medicines, dosages, and syndromic signals.
"""

import os
import json
import base64
import requests
from typing import Optional, Dict, Any, Tuple, List
from ..models.prescription import DetectedMedicine, RedactedField
from .pii_redactor import redact_pii
from .nlp_extractor import nlp_extractor

# Try loading .env if available
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
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash",
    "gemini-3-flash",
]

PRESCRIPTION_AI_PROMPT = """You are an expert Clinical Pharmacist and Medical Document OCR AI.
Your task is to transcribe and extract all clinical and pharmacological information from this prescription or OPD slip image, paying special attention to doctor handwriting, standard abbreviations (BD, TDS, OD, SOS, etc.), dosages, and Indian pharmaceutical trade/generic names.

Extract the following information in strict JSON format:
{
  "full_transcription": "Verbatim transcript of everything legible on the document, preserving lines and clinical sections (Hospital/Clinic header, Patient details, Complaints/Diagnosis, Rx medicines, Doctor info)",
  "patient": {
    "name": "Full patient name if present or null",
    "age": "Patient age or null",
    "gender": "M/F/Other or null",
    "phone": "Phone number or null",
    "address": "Residential address or locality or null",
    "opd_number": "OPD slip or UHID or serial number or null",
    "date": "Prescription date if visible or null"
  },
  "doctor": {
    "name": "Doctor name or null",
    "registration_no": "Doctor license/MCI/NMC registration number or null",
    "clinic_or_hospital": "Hospital/Clinic name or null"
  },
  "clinical_symptoms": "Chief complaints, symptoms (e.g. loose watery stools x 2 days, vomiting, high fever, cough) and clinical diagnosis notes",
  "medicines": [
    {
      "brand": "Exact brand name as written on the slip (e.g. Oflox-OZ, Dolo 650, Pan 40, Azithral 500, ORS Sachet)",
      "generic": "Scientific generic active chemical name (e.g. Ofloxacin + Ornidazole, Paracetamol, Pantoprazole)",
      "dosage": "Exact strength/dosage (e.g. 650mg, 200mg, 1 sachet, 5ml)",
      "form": "Dosage form (Tablet, Capsule, Syrup, Sachet, Injection, Drops, IV)",
      "frequency": "Prescribed frequency (e.g. OD, BD, TDS, QID, SOS, 1-0-1)",
      "duration": "Duration of course (e.g. 3 days, 5 days, 1 week)",
      "drug_class": "Pharmacological class (e.g. Fluoroquinolone + Nitroimidazole, Antipyretic / Analgesic, Proton Pump Inhibitor, Oral Rehydration)",
      "category": "One of: Gastrointestinal, Febrile Illness, Respiratory, Vector-Borne, Dermatological, or General",
      "confidence": 95,
      "is_chronic": false
    }
  ],
  "suggested_category": "Dominant epidemiological syndromic category: Gastrointestinal, Febrile Illness, Respiratory, Vector-Borne, Dermatological, or General",
  "confidence_score": 0.95
}

CRITICAL RULES:
- Transcribe doctor handwriting with extreme care.
- Never invent medications that are not visible.
- If a medicine name is partially illegible, provide your best clinical match and note a realistic confidence score (60-90).
- Return ONLY the JSON object. Do not wrap in markdown or include conversational text."""


class MedicalVisionService:
    @staticmethod
    def get_api_key(passed_key: Optional[str] = None) -> Optional[str]:
        if passed_key and passed_key.strip():
            return passed_key.strip()
        return (
            os.getenv("GEMINI_API_KEY")
            or os.getenv("MEDICAL_AI_API_KEY")
            or os.getenv("OPENAI_API_KEY")
        )

    @staticmethod
    def detect_provider(api_key: str) -> str:
        if api_key.startswith("sk-"):
            return "openai"
        return "gemini"

    def verify_key(self, api_key: str, provider: Optional[str] = None) -> Dict[str, Any]:
        """Validates if the provided Medical AI key is functional."""
        if not api_key or not api_key.strip():
            return {"valid": False, "message": "API key cannot be empty", "provider": "unknown"}

        key = api_key.strip()
        prov = provider or self.detect_provider(key)

        try:
            if prov == "gemini":
                # Quick test against Google Generative Language API
                url = f"https://generativelanguage.googleapis.com/v1beta/models?key={key}"
                resp = requests.get(url, timeout=10)
                if resp.status_code == 200:
                    return {
                        "valid": True,
                        "message": "Google Gemini Medical AI key is active and ready for prescription scanning.",
                        "provider": "gemini",
                    }
                else:
                    err_msg = resp.json().get("error", {}).get("message", f"HTTP {resp.status_code}")
                    return {
                        "valid": False,
                        "message": f"Gemini API Error: {err_msg}",
                        "provider": "gemini",
                    }
            elif prov == "openai":
                url = "https://api.openai.com/v1/models"
                resp = requests.get(url, headers={"Authorization": f"Bearer {key}"}, timeout=10)
                if resp.status_code == 200:
                    return {
                        "valid": True,
                        "message": "OpenAI Vision key is active and ready for prescription scanning.",
                        "provider": "openai",
                    }
                else:
                    err_msg = resp.json().get("error", {}).get("message", f"HTTP {resp.status_code}")
                    return {
                        "valid": False,
                        "message": f"OpenAI API Error: {err_msg}",
                        "provider": "openai",
                    }
            else:
                return {"valid": False, "message": f"Unsupported provider: {prov}", "provider": prov}
        except Exception as e:
            return {"valid": False, "message": f"Connection failed: {str(e)}", "provider": prov}

    def scan_prescription(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
        api_key: Optional[str] = None,
        provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Sends the image to the Medical AI Vision model and parses the extracted prescription details.
        """
        resolved_key = self.get_api_key(api_key)
        if not resolved_key:
            raise ValueError(
                "No Medical AI API Key configured. Please enter your Gemini API key in the Capture settings or set GEMINI_API_KEY."
            )

        prov = provider or self.detect_provider(resolved_key)
        b64_image = base64.b64encode(image_bytes).decode("utf-8")

        if prov == "gemini":
            return self._call_gemini_vision(b64_image, mime_type, resolved_key)
        elif prov == "openai":
            return self._call_openai_vision(b64_image, mime_type, resolved_key)
        else:
            raise ValueError(f"Unknown AI provider: {prov}")

    def _call_gemini_vision(self, b64_image: str, mime_type: str, api_key: str) -> Dict[str, Any]:
        last_error = None

        for model in GEMINI_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": PRESCRIPTION_AI_PROMPT},
                            {
                                "inline_data": {
                                    "mime_type": mime_type if mime_type.startswith("image/") else "image/png",
                                    "data": b64_image,
                                }
                            },
                        ]
                    }
                ],
                "generationConfig": {
                    "temperature": 0.1,
                    "response_mime_type": "application/json",
                },
            }

            try:
                resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=30)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        text_part = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        return self._clean_and_parse_json(text_part)
                else:
                    err_json = resp.json().get("error", {})
                    last_error = f"{model} returned HTTP {resp.status_code}: {err_json.get('message', resp.text)}"
            except Exception as e:
                last_error = f"Request to {model} failed: {str(e)}"

        raise RuntimeError(f"Medical Vision AI failed across models. Last error: {last_error}")

    def _call_openai_vision(self, b64_image: str, mime_type: str, api_key: str) -> Dict[str, Any]:
        url = "https://api.openai.com/v1/chat/completions"
        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PRESCRIPTION_AI_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{b64_image}"
                            },
                        },
                    ],
                }
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
        }

        resp = requests.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=35,
        )

        if resp.status_code == 200:
            content = resp.json()["choices"][0]["message"]["content"]
            return self._clean_and_parse_json(content)
        else:
            raise RuntimeError(f"OpenAI Vision failed (HTTP {resp.status_code}): {resp.text}")

    def _clean_and_parse_json(self, raw_text: str) -> Dict[str, Any]:
        clean = raw_text.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        if clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        clean = clean.strip()
        return json.loads(clean)


medical_vision_service = MedicalVisionService()
