"""
In-Memory Store for NABZ AI (Thread-safe surveillance state)
Pre-seeded with Lucknow wards, baseline models, existing alerts, and audit logs.
Updates detection state in real-time when new anonymous signals are confirmed.
"""

import threading
from datetime import datetime, timezone
from typing import Dict, List, Optional
from ..models.alert import AlertRecord, AlertExplanation, AlertEvidence
from ..models.signal import SignalRecord, WardSignalSummary
from .detection_engine import evaluate_signal_level, generate_explanation, compute_z_score


class SurveillanceStore:
    def __init__(self):
        self.lock = threading.Lock()
        self.signals: List[SignalRecord] = []
        self.audit_logs: List[dict] = []
        self._init_wards()
        self._init_alerts()

    def _init_wards(self):
        self.wards: Dict[str, dict] = {
            "w-aliganj": {
                "id": "w-aliganj",
                "name": "Aliganj Ward 3",
                "lat": 26.8900,
                "lng": 80.9500,
                "status": "AMBER",
                "category": "Gastrointestinal",
                "count": 31,
                "baseline": 9,
                "baseline_std": 6.5,
                "z_score": "3.4",
                "sources": {"clinics": 3, "pharmacies": 2, "labs": 1},
                "alert_id": 1,
            },
            "w-chinhat": {
                "id": "w-chinhat",
                "name": "Chinhat",
                "lat": 26.8650,
                "lng": 81.0300,
                "status": "WATCH",
                "category": "Febrile / Viral",
                "count": 14,
                "baseline": 8,
                "baseline_std": 2.8,
                "z_score": "2.1",
                "sources": {"clinics": 2, "pharmacies": 1, "labs": 0},
                "alert_id": 2,
            },
            "w-gomti": {
                "id": "w-gomti",
                "name": "Gomti Nagar",
                "lat": 26.8563,
                "lng": 80.9950,
                "status": "NORMAL",
                "category": "Febrile / Viral",
                "count": 7,
                "baseline": 8,
                "baseline_std": 3.0,
                "z_score": "0.2",
                "sources": {"clinics": 1, "pharmacies": 1, "labs": 0},
                "alert_id": None,
            },
            "w-hazratganj": {
                "id": "w-hazratganj",
                "name": "Hazratganj",
                "lat": 26.8467,
                "lng": 80.9462,
                "status": "NORMAL",
                "category": "Respiratory",
                "count": 9,
                "baseline": 10,
                "baseline_std": 2.5,
                "z_score": "0.4",
                "sources": {"clinics": 2, "pharmacies": 0, "labs": 0},
                "alert_id": None,
            },
            "w-indira": {
                "id": "w-indira",
                "name": "Indira Nagar",
                "lat": 26.8793,
                "lng": 80.9929,
                "status": "NORMAL",
                "category": "Gastrointestinal",
                "count": 5,
                "baseline": 6,
                "baseline_std": 2.0,
                "z_score": "0.3",
                "sources": {"clinics": 1, "pharmacies": 1, "labs": 0},
                "alert_id": None,
            },
            "w-alambagh": {
                "id": "w-alambagh",
                "name": "Alambagh",
                "lat": 26.8060,
                "lng": 80.9097,
                "status": "WATCH",
                "category": "Respiratory",
                "count": 18,
                "baseline": 10,
                "baseline_std": 3.3,
                "z_score": "2.4",
                "sources": {"clinics": 2, "pharmacies": 2, "labs": 0},
                "alert_id": 3,
            },
            "w-chowk": {
                "id": "w-chowk",
                "name": "Chowk",
                "lat": 26.8650,
                "lng": 80.9130,
                "status": "NORMAL",
                "category": "Febrile / Viral",
                "count": 8,
                "baseline": 9,
                "baseline_std": 2.0,
                "z_score": "0.5",
                "sources": {"clinics": 1, "pharmacies": 1, "labs": 0},
                "alert_id": None,
            },
            "w-mahanagar": {
                "id": "w-mahanagar",
                "name": "Mahanagar",
                "lat": 26.8745,
                "lng": 80.9600,
                "status": "NORMAL",
                "category": "Gastrointestinal",
                "count": 4,
                "baseline": 5,
                "baseline_std": 2.0,
                "z_score": "0.1",
                "sources": {"clinics": 1, "pharmacies": 0, "labs": 0},
                "alert_id": None,
            },
        }

    def _init_alerts(self):
        self.alerts: Dict[int, AlertRecord] = {
            1: AlertRecord(
                id=1,
                ward_id="w-aliganj",
                ward_name="Aliganj Ward 3",
                category="Gastrointestinal",
                level="AMBER",
                count_today=31,
                baseline_mean=9,
                z_score="3.4",
                source_count=6,
                status="open",
                explanation=AlertExplanation(
                    why="GI-class medicines in Aliganj Ward 3 are 3.4σ above the 28-day baseline (9 avg), corroborated across 6 independent healthcare touchpoints.",
                    evidence=AlertEvidence(clinics=3, pharmacies=2, labs=1),
                    top_drug_classes=["Oral Rehydration / Electrolyte", "5-HT3 Antiemetic", "Fluoroquinolone + Nitroimidazole"],
                    disclaimer="NABZ supports investigation. It does not diagnose individuals or declare an outbreak.",
                ),
                created_at="2026-10-01T08:30:00Z",
            ),
            2: AlertRecord(
                id=2,
                ward_id="w-chinhat",
                ward_name="Chinhat",
                category="Febrile / Viral",
                level="WATCH",
                count_today=14,
                baseline_mean=8,
                z_score="2.1",
                source_count=3,
                status="open",
                explanation=AlertExplanation(
                    why="Febrile syndromic medicines in Chinhat are 2.1σ above baseline with mild clustering.",
                    evidence=AlertEvidence(clinics=2, pharmacies=1, labs=0),
                    top_drug_classes=["Antipyretic / Analgesic", "Thrombocytopenia Supportive", "NSAID"],
                    disclaimer="NABZ supports investigation. It does not diagnose individuals or declare an outbreak.",
                ),
                created_at="2026-10-01T09:15:00Z",
            ),
            3: AlertRecord(
                id=3,
                ward_id="w-alambagh",
                ward_name="Alambagh",
                category="Respiratory",
                level="WATCH",
                count_today=18,
                baseline_mean=10,
                z_score="2.4",
                source_count=4,
                status="open",
                explanation=AlertExplanation(
                    why="Respiratory and bronchodilator prescriptions in Alambagh show early rise (2.4σ).",
                    evidence=AlertEvidence(clinics=2, pharmacies=2, labs=0),
                    top_drug_classes=["Cold Formulation Decongestant", "Antitussive Syrup", "Macrolide Antibiotic"],
                    disclaimer="NABZ supports investigation. It does not diagnose individuals or declare an outbreak.",
                ),
                created_at="2026-10-01T10:00:00Z",
            ),
        }

    def record_signal(self, signal: SignalRecord) -> bool:
        """
        Records anonymous signal and triggers real-time surveillance detection engine.
        Returns True if an existing alert or ward status was updated.
        """
        with self.lock:
            self.signals.append(signal)

            # Match ward
            ward_info = self.wards.get(signal.ward_id)
            if not ward_info:
                # Fallback to Aliganj
                ward_info = self.wards["w-aliganj"]

            # Update count
            ward_info["count"] += 1
            src_key = signal.source_type if signal.source_type in ward_info["sources"] else "clinics"
            ward_info["sources"][src_key] = ward_info["sources"].get(src_key, 0) + 1

            # Recalculate level
            count_today = ward_info["count"]
            baseline = ward_info["baseline"]
            baseline_std = ward_info.get("baseline_std", 2.5)

            new_level, z_val = evaluate_signal_level(
                count_today, baseline, baseline_std, ward_info["sources"]
            )
            ward_info["status"] = new_level
            ward_info["z_score"] = str(z_val)

            # Update or create alert if AMBER/WATCH
            if new_level in ["AMBER", "WATCH"]:
                alert_id = ward_info.get("alert_id")
                if alert_id and alert_id in self.alerts:
                    alert = self.alerts[alert_id]
                    alert.count_today = count_today
                    alert.z_score = str(z_val)
                    alert.level = new_level
                    alert.explanation = generate_explanation(
                        ward_info["name"],
                        ward_info["category"],
                        z_val,
                        baseline,
                        ward_info["sources"],
                        signal.drug_classes,
                    )
                else:
                    new_alert_id = max(self.alerts.keys(), default=0) + 1
                    ward_info["alert_id"] = new_alert_id
                    self.alerts[new_alert_id] = AlertRecord(
                        id=new_alert_id,
                        ward_id=ward_info["id"],
                        ward_name=ward_info["name"],
                        category=ward_info["category"],
                        level=new_level,
                        count_today=count_today,
                        baseline_mean=baseline,
                        z_score=str(z_val),
                        source_count=sum(ward_info["sources"].values()),
                        status="open",
                        explanation=generate_explanation(
                            ward_info["name"],
                            ward_info["category"],
                            z_val,
                            baseline,
                            ward_info["sources"],
                            signal.drug_classes,
                        ),
                        created_at=datetime.now(timezone.utc).isoformat(),
                    )

            # Audit log
            self.audit_logs.append({
                "action": "SIGNAL_TRANSMITTED",
                "signal_id": signal.id,
                "ward_id": signal.ward_id,
                "category": signal.category,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })

            return True

    def get_wards(self, category: Optional[str] = None, date_range: Optional[str] = "7d") -> List[dict]:
        with self.lock:
            ward_list = []
            for w in self.wards.values():
                item = dict(w)
                # Scale counts based on date window for demo realism
                if date_range == "24h":
                    item["count"] = max(1, round(w["count"] * 0.32))
                    item["baseline"] = max(1, round(w["baseline"] * 0.32))
                elif date_range == "28d":
                    item["count"] = round(w["count"] * 3.8)
                    item["baseline"] = round(w["baseline"] * 4.0)

                ward_list.append(item)

            if category and category != "All":
                ward_list = [w for w in ward_list if w["category"].lower() == category.lower()]
            return ward_list

    def get_alerts(self) -> List[AlertRecord]:
        with self.lock:
            return list(self.alerts.values())

    def get_alert_by_id(self, alert_id: int) -> Optional[AlertRecord]:
        with self.lock:
            return self.alerts.get(alert_id)

    def update_alert(self, alert_id: int, status: str, notes: Optional[str] = None, reviewed_by: Optional[str] = None) -> Optional[AlertRecord]:
        with self.lock:
            if alert_id in self.alerts:
                alert = self.alerts[alert_id]
                alert.status = status
                if notes:
                    alert.review_notes = notes
                if reviewed_by:
                    alert.reviewed_by = reviewed_by
                self.audit_logs.append({
                    "action": f"ALERT_{status.upper()}",
                    "alert_id": alert_id,
                    "reviewed_by": reviewed_by,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                return alert
            return None

    def get_dashboard_summary(self) -> dict:
        with self.lock:
            total_today = sum(w["count"] for w in self.wards.values())
            amber_count = sum(1 for w in self.wards.values() if w["status"] == "AMBER")
            watch_count = sum(1 for w in self.wards.values() if w["status"] == "WATCH")
            return {
                "signals_today": total_today,
                "areas_monitored": len(self.wards),
                "active_amber_alerts": amber_count,
                "active_watch_alerts": watch_count,
                "identity_exposure": 0,
                "disclaimer": "NABZ supports investigation. It does not diagnose individuals or declare an outbreak.",
                "wards": list(self.wards.values())
            }


surveillance_store = SurveillanceStore()
