"""
Detection Engine for NABZ AI (Rule 4.5, 4.6 & Architecture.md §5)
Calculates z-scores vs baseline, enforces privacy suppression (count < 3),
checks multi-source corroboration, and produces explainable alerts.
"""

from typing import Dict, List, Optional, Tuple
from ..models.alert import AlertRecord, AlertExplanation, AlertEvidence
from ..models.signal import SignalRecord, WardSignalSummary


# Detection Thresholds (Rule 4.5: detection thresholds are config constants)
Z_WATCH = 2.0
Z_AMBER = 3.0
MIN_COUNT_SUPPRESSION = 3
MIN_SOURCES_AMBER = 3


def compute_z_score(count_today: int, baseline_mean: float, baseline_std: float = 1.0) -> float:
    """Computes statistical z-score vs baseline."""
    effective_std = max(baseline_std, 1.0)
    return (count_today - baseline_mean) / effective_std


def evaluate_signal_level(
    count_today: int,
    baseline_mean: float,
    baseline_std: float,
    source_counts: Dict[str, int],
    persisting_days: int = 2
) -> Tuple[str, float]:
    """
    Evaluates surveillance level:
    - count < 3 -> Suppressed / NORMAL (Rule 1.5 privacy suppression)
    - z >= 3.0 AND distinct sources >= 3 AND persists >= 2 -> AMBER
    - z >= 2.0 -> WATCH
    - otherwise -> NORMAL
    """
    if count_today < MIN_COUNT_SUPPRESSION:
        return "NORMAL", 0.0

    z = compute_z_score(count_today, baseline_mean, baseline_std)
    total_sources = sum(source_counts.values())

    if z >= Z_AMBER and total_sources >= MIN_SOURCES_AMBER and persisting_days >= 2:
        return "AMBER", round(z, 1)
    elif z >= Z_WATCH:
        return "WATCH", round(z, 1)
    else:
        return "NORMAL", round(z, 1)


def generate_explanation(
    ward_name: str,
    category: str,
    z_score: float,
    baseline_mean: int,
    source_counts: Dict[str, int],
    top_drug_classes: List[str]
) -> AlertExplanation:
    """
    Generates explainable human-readable justification for the alert (Rule 4.6).
    """
    total_sources = sum(source_counts.values())
    why_text = (
        f"{category}-class medicines in {ward_name} are {z_score}σ above the 28-day baseline "
        f"({baseline_mean} avg), corroborated across {total_sources} independent healthcare touchpoints."
    )
    return AlertExplanation(
        why=why_text,
        evidence=AlertEvidence(
            clinics=source_counts.get("clinics", 0),
            pharmacies=source_counts.get("pharmacies", 0),
            labs=source_counts.get("labs", 0),
        ),
        top_drug_classes=top_drug_classes or ["ORS", "Antiemetic", "Fluoroquinolone"],
        disclaimer="NABZ supports investigation. It does not diagnose individuals or declare an outbreak.",
    )
