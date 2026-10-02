"""
NLP Extraction Engine for NABZ AI
Matches medicine names against authentic Indian pharmaceutical dictionary using RapidFuzz.
Extracts dosage, frequency, normalises generic names, and infers syndromic category using multi-drug combination heuristics.
"""

import json
import os
import re
from typing import List, Tuple, Dict, Any, Optional
from rapidfuzz import fuzz
from ..models.prescription import DetectedMedicine


# Path to dictionary
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DICT_FILE = os.path.join(DATA_DIR, "medicine_dictionary.json")

# Dose & frequency patterns
DOSE_PATTERN = re.compile(r"(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|sachet|tab|cap|puff))", re.IGNORECASE)
FREQ_PATTERN = re.compile(r"\b(od|bd|tid|tds|qid|qds|sos|hs|stat|bbf|pc|ac|x\s*\d+\s*days?)\b", re.IGNORECASE)


class NLPExtractor:
    def __init__(self):
        self.dictionary: List[Dict[str, Any]] = []
        self._load_dictionary()

    def _load_dictionary(self):
        if os.path.exists(DICT_FILE):
            with open(DICT_FILE, "r", encoding="utf-8") as f:
                self.dictionary = json.load(f)
        else:
            self.dictionary = []

    def extract_from_text(self, text: str) -> Tuple[List[DetectedMedicine], str, float, List[str]]:
        """
        Parses raw text, identifies medicines, calculates match confidences,
        infers syndromic category, and flags warnings.
        """
        warnings = []
        if not text:
            return [], "Unknown", 0.0, ["Empty input"]

        lines = [line.strip() for line in text.split("\n") if line.strip()]
        detected_list: List[DetectedMedicine] = []
        seen_generics = set()

        for line in lines:
            # Ignore headers / doctor metadata lines
            line_lower = line.lower()
            if any(skip in line_lower for skip in [
                "community health center", "hospital", "opd", "date:", "time:", "patient:", 
                "address:", "c/o:", "chief complaints", "dr.", "reg no:", "mci-", "mbbs"
            ]):
                continue

            # Strip leading list indices e.g. "1.", "2)", "Tab.", "Cap.", "Syp."
            clean_line = re.sub(r"^\s*(?:\d+[\.\)]|\-|\*|Tab\.?|Cap\.?|Syp\.?|Inj\.?)\s*", "", line, flags=re.IGNORECASE).strip()
            if len(clean_line) < 3:
                continue

            # Extract dosage & frequency from the line
            dose_match = DOSE_PATTERN.search(clean_line)
            freq_match = FREQ_PATTERN.search(clean_line)
            dosage = dose_match.group(1) if dose_match else None
            freq = freq_match.group(0).upper() if freq_match else None

            # Attempt match against dictionary
            best_match, score = self._match_medicine(clean_line)

            if best_match and score >= 65:
                # Normalise and avoid duplicate generics in the same encounter
                generic_key = best_match["generic"].lower()
                if generic_key in seen_generics:
                    continue
                seen_generics.add(generic_key)

                # Confidence capped at 99
                confidence = min(int(score), 99)
                if confidence < 70:
                    warnings.append(f"Low confidence ({confidence}%) match for: '{clean_line}' → {best_match['brand']}")

                med = DetectedMedicine(
                    brand=best_match["brand"],
                    generic=best_match["generic"],
                    drugClass=best_match["drug_class"],
                    category=best_match["category"],
                    confidence=confidence,
                    dosage=dosage,
                    frequency=freq,
                    is_chronic=best_match.get("is_chronic", False)
                )
                detected_list.append(med)

        # Syndromic Classification
        category, confidence_score = self.classify_syndrome(detected_list)

        return detected_list, category, confidence_score, warnings

    def _match_medicine(self, line: str) -> Tuple[Optional[Dict[str, Any]], float]:
        """
        Fuzzy matches a line of text against the dictionary.
        Tries exact substring first, then RapidFuzz token_set_ratio.
        """
        line_clean = line.lower()
        best_entry = None
        best_score = 0.0

        for entry in self.dictionary:
            brand = entry["brand"].lower()
            generic = entry["generic"].lower()

            # Exact brand or generic substring bonus
            if brand in line_clean:
                score = 98.0
            elif generic in line_clean:
                score = 96.0
            else:
                # RapidFuzz token_set_ratio handles word order differences
                score_brand = fuzz.token_set_ratio(brand, line_clean)
                score_generic = fuzz.token_set_ratio(generic, line_clean)
                score = max(score_brand, score_generic)

            if score > best_score:
                best_score = score
                best_entry = entry

        return best_entry, best_score

    def classify_syndrome(self, medicines: List[DetectedMedicine]) -> Tuple[str, float]:
        """
        Rule 5.4 & 5.5:
        - Exclude chronic medicines (diabetes, BP, etc.) from outbreak signal weights
        - Single non-specific medicines (Paracetamol alone) get low weight
        - Multi-drug combinations determine category (ORS + Antiemetic + Antibiotic => Gastrointestinal)
        """
        # Filter out chronic meds
        acute_meds = [m for m in medicines if not m.is_chronic]
        if not acute_meds:
            return "Uncategorized", 0.0

        categories_scores: Dict[str, float] = {
            "Gastrointestinal": 0.0,
            "Febrile / Viral": 0.0,
            "Respiratory": 0.0,
            "Dermatological": 0.0
        }

        has_ors = any("oral rehydration" in m.generic.lower() or "ors" in m.brand.lower() for m in acute_meds)
        has_antiemetic = any("antiemetic" in m.drug_class.lower() or "ondansetron" in m.generic.lower() or "domperidone" in m.generic.lower() for m in acute_meds)
        has_gi_antibiotic = any(m.generic.lower() in ["ofloxacin + ornidazole", "norfloxacin + tinidazole", "metronidazole", "rifaximin", "racecadotril"] for m in acute_meds)
        has_antipyretic = any("paracetamol" in m.generic.lower() or "ibuprofen" in m.generic.lower() for m in acute_meds)
        has_antimalarial_dengue = any("carica papaya" in m.generic.lower() or "chloroquine" in m.generic.lower() or "artesunate" in m.generic.lower() or "artemether" in m.generic.lower() for m in acute_meds)
        has_cough_decongestant = any("decongestant" in m.drug_class.lower() or "antitussive" in m.drug_class.lower() or "cough" in m.brand.lower() or "montelukast" in m.generic.lower() or "cetirizine" in m.generic.lower() for m in acute_meds)
        has_respiratory_antibiotic = any("azithromycin" in m.generic.lower() or "amoxicillin" in m.generic.lower() or "cefixime" in m.generic.lower() or "cefuroxime" in m.generic.lower() for m in acute_meds)

        # GI Combination Rule (Rule 5.4)
        if has_ors or (has_antiemetic and has_gi_antibiotic):
            categories_scores["Gastrointestinal"] += 3.5
        if has_gi_antibiotic:
            categories_scores["Gastrointestinal"] += 2.0
        if has_antiemetic:
            categories_scores["Gastrointestinal"] += 1.5

        # Respiratory Combination Rule
        if has_cough_decongestant and has_respiratory_antibiotic:
            categories_scores["Respiratory"] += 3.5
        elif has_cough_decongestant:
            categories_scores["Respiratory"] += 2.5
        elif has_respiratory_antibiotic and not (has_gi_antibiotic or has_ors):
            categories_scores["Respiratory"] += 1.8

        # Febrile / Viral Rule
        if has_antimalarial_dengue:
            categories_scores["Febrile / Viral"] += 4.0
        elif has_antipyretic and not (has_ors or has_cough_decongestant or has_gi_antibiotic):
            # Paracetamol alone is non-specific (Rule 5.4)
            categories_scores["Febrile / Viral"] += 1.2

        # Dermatological
        has_skin = any(m.category == "Dermatological" for m in acute_meds)
        if has_skin:
            categories_scores["Dermatological"] += 3.0

        # Determine winner
        best_category = max(categories_scores, key=categories_scores.get)
        top_score = categories_scores[best_category]

        if top_score == 0.0:
            return "Uncategorized", 0.3

        confidence_normalized = min(0.98, max(0.60, round(top_score / 4.0, 2)))
        return best_category, confidence_normalized


nlp_extractor = NLPExtractor()
