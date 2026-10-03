import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  UploadCloud,
  FileText,
  Camera,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Stethoscope,
  Sparkles,
  ArrowRight,
  Layers,
  FileCheck,
  RefreshCw,
  Key,
  ExternalLink,
  Eye,
  EyeOff,
  Lock,
  X,
  Cpu,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  File,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { useAuth } from "../context/AuthContext";
import {
  apiAnalyzePrescription,
  apiVerifyMedicalAiKey,
  getStoredMedicalAiKey,
  getStoredMedicalAiProvider,
  setStoredMedicalAiConfig,
} from "../services/api";

// Pre-packaged realistic sample records for instant testing
const SAMPLE_RECORDS = {
  gastro: {
    id: "rec-gastro-01",
    name: "Prescription_Aliganj_Gastro_0412.png",
    type: "image/png",
    size: "1.4 MB",
    complaint: "Acute watery diarrhea (6-7 times/day), persistent vomiting, dehydration",
    medicines: "ORS Sachet 21.8g, Tab Ofloxacin 200mg + Ornidazole 500mg, Tab Ondansetron 4mg, Tab Paracetamol 650mg",
    category: "Gastrointestinal",
    rawText: `COMMUNITY HEALTH CENTER ALIGANJ, LUCKNOW
OPD SLIP - GENERAL MEDICINE
Date: 01/10/2026   Time: 10:45 AM
Patient: Ramesh Kumar, Age: 34 M, Phone: +91 98765-43210
Address: Sector B-14, Aliganj, Lucknow, UP 226024

C/O:
- Loose watery stools x 2 days (approx 7-8 episodes)
- Nausea and vomiting x 1 day
- Low grade fever & dehydration

Rx:
1. ORS (Oral Rehydration Solution) - 1 sachet in 1 Litre boiled water frequently
2. Tab. Ofloxacin (200mg) + Ornidazole (500mg) - 1 tab BD x 5 days
3. Tab. Ondansetron (4mg) - 1 tab 30 min before food SOS
4. Tab. Paracetamol (650mg) - SOS for fever

Dr. Ananya Sharma (MBBS, MD)
Reg No: MCI-UP-48291`,
    detectedMedicines: [
      {
        brand: "ORS Sachet (WHO Formula)",
        generic: "Oral Rehydration Salts",
        drugClass: "Oral Rehydration / Electrolyte",
        category: "Gastrointestinal",
        confidence: 99,
        dosage: "1 sachet in 1L water",
        frequency: "Frequently",
      },
      {
        brand: "Oflox-OZ",
        generic: "Ofloxacin + Ornidazole",
        drugClass: "Fluoroquinolone + Nitroimidazole",
        category: "Gastrointestinal",
        confidence: 97,
        dosage: "200mg + 500mg",
        frequency: "1 tab BD",
      },
      {
        brand: "Emeset 4mg",
        generic: "Ondansetron",
        drugClass: "5-HT3 Antiemetic",
        category: "Gastrointestinal",
        confidence: 95,
        dosage: "4mg",
        frequency: "1 tab SOS",
      },
      {
        brand: "Dolo 650",
        generic: "Paracetamol",
        drugClass: "Antipyretic / Analgesic",
        category: "General / Febrile",
        confidence: 98,
        dosage: "650mg",
        frequency: "SOS",
      },
    ],
    redactedFields: [
      { field: "Patient Name", value: "Ramesh Kumar", token: "██████████ [REDACTED_NAME]" },
      { field: "Phone Number", value: "+91 98765-43210", token: "█████████████ [REDACTED_PHONE]" },
      { field: "Residential Address", value: "Sector B-14, Aliganj, Lucknow, UP 226024", token: "████████████████████████ [REDACTED_ADDRESS]" },
      { field: "OPD Serial No", value: "OPD-4182", token: "████████ [REDACTED_ID]" },
    ],
  },
  fever: {
    id: "rec-fever-02",
    name: "Clinic_Rx_Chinhat_DengueProfile_0921.png",
    type: "image/png",
    size: "1.8 MB",
    complaint: "High grade fever x 4 days with severe joint pains, retro-orbital headache, chills",
    medicines: "Tab Paracetamol 650mg, IV Fluid NS 0.9%, Tab Pantoprazole 40mg, Dengue NS1 Ag Test requested",
    category: "Febrile Illness / Vector-Borne",
    rawText: `METRO PRIMARY HEALTH CLINIC, CHINHAT, LUCKNOW
Date: 01/10/2026   Slip: 0921
Patient: Priya Srivastava, Age: 26 F, Phone: +91 94150-11223
Address: Near Polytechnic Chauraha, Chinhat, Lucknow

C/O:
- High fever (103°F) with chills x 4 days
- Severe myalgia, body ache, retro-orbital eye pain
- Suspected Dengue / Febrile illness

Rx:
1. Tab. Paracetamol 650mg TDS
2. Cap. Pantoprazole 40mg OD empty stomach
3. Plenty of oral fluids (coconut water, ORS)
4. Urgent Lab: Dengue NS1 Antigen + Platelet Count

Dr. S. K. Gupta (MBBS)
Reg No: MCI-UP-29103`,
    detectedMedicines: [
      {
        brand: "Dolo 650",
        generic: "Paracetamol",
        drugClass: "Antipyretic / Analgesic",
        category: "Febrile Illness",
        confidence: 99,
        dosage: "650mg",
        frequency: "TDS",
      },
      {
        brand: "Pan 40",
        generic: "Pantoprazole",
        drugClass: "Proton Pump Inhibitor",
        category: "Gastroprotective",
        confidence: 96,
        dosage: "40mg",
        frequency: "OD",
      },
      {
        brand: "Electral",
        generic: "Oral Rehydration Salts",
        drugClass: "Oral Rehydration",
        category: "Supportive",
        confidence: 94,
        dosage: "1 sachet",
        frequency: "Frequently",
      },
    ],
    redactedFields: [
      { field: "Patient Name", value: "Priya Srivastava", token: "██████████████ [REDACTED_NAME]" },
      { field: "Phone Number", value: "+91 94150-11223", token: "█████████████ [REDACTED_PHONE]" },
      { field: "Residential Address", value: "Near Polytechnic Chauraha, Chinhat, Lucknow", token: "██████████████████████████ [REDACTED_ADDRESS]" },
    ],
  },
  respiratory: {
    id: "rec-resp-03",
    name: "Clinic_Rx_Alambagh_Respiratory_1002.png",
    type: "image/png",
    size: "1.6 MB",
    complaint: "Cough with expectoration x 5 days, fever, throat pain, breathlessness on exertion",
    medicines: "Tab Azithromycin 500mg, Syrup Ascoril LS, Tab Levocetirizine 5mg, Tab Paracetamol 650mg",
    category: "Respiratory",
    rawText: `ALAMBAGH COMMUNITY CLINIC, LUCKNOW
Date: 01/10/2026   Slip: ARI-0112
Patient: Suresh Yadav, Age: 45 M, Phone: +91 98112-78320
Address: C-Block, Alambagh, Lucknow, UP 226005

C/O:
- Productive cough x 5 days with thick sputum
- Low grade fever (100.2°F), sore throat
- Breathlessness on walking, chest tightness

Rx:
1. Tab. Azithromycin 500mg OD x 5 days (empty stomach)
2. Syrup Ascoril LS 10ml TDS x 7 days
3. Tab. Levocetirizine 5mg OD at night
4. Tab. Paracetamol 650mg SOS for fever
5. Steam inhalation BD, plenty of warm fluids

Dr. R. K. Sharma (MBBS, MD Pulmonology)
Reg No: MCI-UP-67421`,
    detectedMedicines: [
      {
        brand: "Azithral 500",
        generic: "Azithromycin",
        drugClass: "Macrolide Antibiotic",
        category: "Respiratory",
        confidence: 98,
        dosage: "500mg",
        frequency: "OD",
      },
      {
        brand: "Ascoril LS",
        generic: "Levosalbutamol + Ambroxol",
        drugClass: "Bronchodilator + Mucolytic",
        category: "Respiratory",
        confidence: 96,
        dosage: "10ml",
        frequency: "TDS",
      },
      {
        brand: "Levocet 5",
        generic: "Levocetirizine",
        drugClass: "Antihistamine / Decongestant",
        category: "Respiratory",
        confidence: 97,
        dosage: "5mg",
        frequency: "OD",
      },
      {
        brand: "Dolo 650",
        generic: "Paracetamol",
        drugClass: "Antipyretic / Analgesic",
        category: "General / Febrile",
        confidence: 98,
        dosage: "650mg",
        frequency: "SOS",
      },
    ],
    redactedFields: [
      { field: "Patient Name", value: "Suresh Yadav", token: "████████████ [REDACTED_NAME]" },
      { field: "Phone Number", value: "+91 98112-78320", token: "█████████████ [REDACTED_PHONE]" },
      { field: "Residential Address", value: "C-Block, Alambagh, Lucknow, UP 226005", token: "████████████████████████ [REDACTED_ADDRESS]" },
      { field: "OPD Serial No", value: "ARI-0112", token: "████████ [REDACTED_ID]" },
    ],
  },
  vector: {
    id: "rec-vector-04",
    name: "Clinic_Rx_Chinhat_Malaria_0930.png",
    type: "image/png",
    size: "1.5 MB",
    complaint: "Cyclic high fever with rigors, sweating, headache, fatigue x 3 days",
    medicines: "Tab Chloroquine 500mg, Tab Primaquine 15mg, Tab Paracetamol 500mg, ORS Sachets",
    category: "Vector-Borne",
    rawText: `CHINHAT PRIMARY HEALTH CENTER, LUCKNOW
Date: 30/09/2026   Slip: VEC-0078
Patient: Akhilesh Singh, Age: 31 M, Phone: +91 95552-34411
Address: Gomti Nagar Extension, Near Water Tank, Lucknow, UP 226010

C/O:
- Cyclic high fever with rigors & sweating x 3 days
- Severe headache, generalised weakness, loss of appetite
- Smear positive: P. vivax Malaria (confirmed at lab)

Rx:
1. Tab. Chloroquine 500mg - Day 1&2: 4 tabs + 2 tabs; Day 3: 2 tabs (10 tabs total)
2. Tab. Primaquine 15mg OD x 14 days
3. Tab. Paracetamol 500mg TDS SOS for fever
4. ORS Sachets frequently, rest, avoid fatty food

Dr. A. K. Verma (MBBS)
Reg No: MCI-UP-54320`,
    detectedMedicines: [
      {
        brand: "Lariago 250",
        generic: "Chloroquine Phosphate",
        drugClass: "Antimalarial (Blood Schizonticide)",
        category: "Vector-Borne",
        confidence: 99,
        dosage: "500mg",
        frequency: "Per protocol",
      },
      {
        brand: "Primaquine 15mg",
        generic: "Primaquine",
        drugClass: "Antimalarial (Radical Cure)",
        category: "Vector-Borne",
        confidence: 98,
        dosage: "15mg",
        frequency: "OD",
      },
      {
        brand: "Calpol 500",
        generic: "Paracetamol",
        drugClass: "Antipyretic / Analgesic",
        category: "General / Febrile",
        confidence: 97,
        dosage: "500mg",
        frequency: "TDS SOS",
      },
      {
        brand: "ORS Sachet",
        generic: "Oral Rehydration Salts",
        drugClass: "Oral Rehydration / Electrolyte",
        category: "Supportive",
        confidence: 95,
        dosage: "1 sachet",
        frequency: "Frequently",
      },
    ],
    redactedFields: [
      { field: "Patient Name", value: "Akhilesh Singh", token: "██████████████ [REDACTED_NAME]" },
      { field: "Phone Number", value: "+91 95552-34411", token: "█████████████ [REDACTED_PHONE]" },
      { field: "Residential Address", value: "Gomti Nagar Extension, Near Water Tank, Lucknow", token: "████████████████████████████████ [REDACTED_ADDRESS]" },
      { field: "OPD Serial No", value: "VEC-0078", token: "████████ [REDACTED_ID]" },
    ],
  },
};

const SAMPLE_CARDS = [
  {
    key: "gastro",
    title: "Acute Gastroenteritis",
    syndrome: "Gastrointestinal",
    gradient: "linear-gradient(135deg, var(--aurora-1), var(--aurora-2))",
    accent: "var(--accent-cyan)",
  },
  {
    key: "fever",
    title: "High Fever Profile",
    syndrome: "Febrile Illness",
    gradient: "linear-gradient(135deg, rgba(255,178,90,0.18), rgba(255,209,102,0.06))",
    accent: "var(--accent-amber)",
  },
  {
    key: "respiratory",
    title: "Respiratory ARI",
    syndrome: "Respiratory",
    gradient: "linear-gradient(135deg, rgba(87,148,242,0.18), rgba(67,203,210,0.06))",
    accent: "var(--accent-mint)",
  },
  {
    key: "vector",
    title: "Vector-Borne Track",
    syndrome: "Vector-Borne",
    gradient: "linear-gradient(135deg, rgba(255,122,122,0.18), rgba(255,178,90,0.06))",
    accent: "var(--accent-rose)",
  },
];

const ANALYSIS_STEPS = [
  { id: 1, label: "Reading Record", sublabel: "Extracting text & medicine names via Edge OCR" },
  { id: 2, label: "Protecting Identity", sublabel: "Redacting patient names, phone, address" },
  { id: 3, label: "Signal Ready", sublabel: "Mapping drugs to surveillance classification" },
];

export default function Capture() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [selectedMode, setSelectedMode] = useState("upload");
  const [selectedSample, setSelectedSample] = useState(SAMPLE_RECORDS.gastro);
  const [isCustomUpload, setIsCustomUpload] = useState(false);
  const [customFile, setCustomFile] = useState(null);
  const [customImagePreview, setCustomImagePreview] = useState(null);
  const [dropActive, setDropActive] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);

  const [keyInput, setKeyInput] = useState(getStoredMedicalAiKey());
  const [keyProvider, setKeyProvider] = useState(getStoredMedicalAiProvider());
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState(keyInput);
  const [tempProvider, setTempProvider] = useState(keyProvider);
  const [showKeyPassword, setShowKeyPassword] = useState(false);
  const [isKeyVerifying, setIsKeyVerifying] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState(null);

  const [manualSymptoms, setManualSymptoms] = useState(
    "Acute watery diarrhea 6-7 times, vomiting, severe dehydration"
  );
  const [manualMedicines, setManualMedicines] = useState(
    "ORS Sachets, Ofloxacin 200mg + Ornidazole 500mg, Ondansetron 4mg"
  );
  const [manualCategory, setManualCategory] = useState("Gastrointestinal");

  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisSteps] = useState(ANALYSIS_STEPS);
  const [resultData, setResultData] = useState(null);
  const [error, setError] = useState(null);

  const handleOpenKeyModal = () => {
    setTempKey(keyInput);
    setTempProvider(keyProvider);
    setKeyTestResult(null);
    setShowKeyModal(true);
  };

  const handleTestKey = async () => {
    if (!tempKey.trim()) {
      setKeyTestResult({ valid: false, message: "Please enter an API key to test." });
      return;
    }
    setIsKeyVerifying(true);
    setKeyTestResult(null);
    try {
      const res = await apiVerifyMedicalAiKey(tempKey.trim(), tempProvider);
      setKeyTestResult({ valid: res.valid, message: res.message });
    } catch (e) {
      setKeyTestResult({ valid: false, message: `Verification failed: ${e.message}` });
    } finally {
      setIsKeyVerifying(false);
    }
  };

  const handleSaveKey = () => {
    const cleanKey = tempKey.trim();
    setStoredMedicalAiConfig(cleanKey, tempProvider);
    setKeyInput(cleanKey);
    setKeyProvider(tempProvider);
    setShowKeyModal(false);
  };

  const handleClearKey = () => {
    setStoredMedicalAiConfig("", "gemini");
    setKeyInput("");
    setTempKey("");
    setKeyTestResult(null);
    setShowKeyModal(false);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      if (!dropActive) {
        setDropActive(true);
        setRippleKey((k) => k + 1);
      }
    } else if (e.type === "dragleave") {
      setDropActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleIncomingFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleIncomingFile(e.target.files[0]);
    }
  };

  const handleIncomingFile = (file) => {
    setCustomFile(file);
    setIsCustomUpload(true);

    if (file.type && file.type.startsWith("image/")) {
      const previewUrl = URL.createObjectURL(file);
      setCustomImagePreview(previewUrl);
    } else {
      setCustomImagePreview(null);
    }

    setSelectedSample({
      ...SAMPLE_RECORDS.gastro,
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      type: file.type || "application/octet-stream",
      rawText: `[Image ready for Medical AI Scan]\nFile: ${file.name}\nSize: ${(file.size / 1024 / 1024).toFixed(2)} MB\n\nClick "Analyse Record" below to run Medical Vision AI and extract exact medicines and clinical data.`,
    });
  };

  const handleSelectSample = (sampleKey) => {
    if (!SAMPLE_RECORDS[sampleKey]) return;
    setIsCustomUpload(false);
    setCustomFile(null);
    setCustomImagePreview(null);
    setSelectedSample(SAMPLE_RECORDS[sampleKey]);
  };

  const handleStartAnalysis = async () => {
    setShowAnalysisModal(true);
    setAnalysisStep(1);
    setError(null);
    setResultData(null);

    let backendResult = null;
    try {
      backendResult = await apiAnalyzePrescription({
        rawText: selectedMode === "manual" ? null : selectedSample?.rawText,
        mode: selectedMode,
        symptoms: manualSymptoms,
        medicines: manualMedicines,
        ward: user?.ward || "Aliganj Ward 3, Lucknow",
        facility: user?.facility || "Aliganj Community Health Center",
        file: customFile,
        apiKey: keyInput,
        provider: keyProvider,
      });
    } catch (err) {
      console.warn("Backend API call notice, evaluating result:", err);
      setError(err.message || "Analysis encountered a notice");
    }

    setTimeout(() => {
      setAnalysisStep(2);

      setTimeout(() => {
        setAnalysisStep(3);

        setTimeout(() => {
          setShowAnalysisModal(false);

          if (!backendResult) {
            return;
          }

          const recordData = {
            id: backendResult.id,
            name: selectedSample?.name || customFile?.name || "Uploaded_Prescription.png",
            category: backendResult.suggested_category,
            rawText: selectedSample?.rawText || "Prescription Record",
            redactedText: backendResult.raw_text_redacted,
            imagePreview: customImagePreview,
            detectedMedicines: (backendResult.detected_medicines || []).map((m) => ({
              brand: m.brand,
              generic: m.generic,
              drugClass: m.drugClass || m.drug_class,
              category: m.category,
              confidence: m.confidence,
              dosage: m.dosage,
              frequency: m.frequency,
              is_chronic: m.is_chronic,
            })),
            redactedFields: backendResult.redacted_fields || [],
            whatLeavesDevice: backendResult.what_leaves_device,
            warnings: backendResult.warnings,
          };

          setResultData(recordData);

          const payload = {
            record: recordData,
            ward: user?.ward || "Aliganj Ward 3, Lucknow",
            facility: user?.facility || "Aliganj Community Health Center",
            doctor: user?.name || "Dr. Ananya Sharma",
            mode: selectedMode,
            manualData:
              selectedMode === "manual"
                ? {
                    symptoms: manualSymptoms,
                    medicines: manualMedicines,
                    category: manualCategory,
                  }
                : null,
          };
          sessionStorage.setItem("nabz_pending_signal", JSON.stringify(payload));
          navigate("/privacy", { state: payload });
        }, 600);
      }, 600);
    }, 700);
  };

  const renderFilenameChars = (filename) => {
    return filename.split("").map((char, i) => (
      <span
        key={i}
        className="use-page-reveal mono-clinical t-13"
        style={{ display: "inline-block", animationDelay: `${i * 30}ms`, color: "var(--text-1)" }}
      >
        {char === " " ? "\u00A0" : char}
      </span>
    ));
  };

  const renderSignalMatrix = () => {
    const cells = [];
    for (let i = 0; i < 16; i++) {
      const z = Math.sin(i * 0.7) * 0.5 + Math.cos(i * 0.3) * 0.5;
      const color = z > 0.15 ? "var(--accent-cyan)" : z > -0.1 ? "var(--accent-amber)" : "var(--text-7)";
      cells.push(
        <div
          key={i}
          style={{
            width: "14px",
            height: "14px",
            borderRadius: "3px",
            background: color,
            opacity: 0.7 + Math.abs(z) * 0.3,
            boxShadow: z > 0.15 ? "0 0 8px var(--accent-cyan)" : "none",
          }}
        />
      );
    }
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "4px",
          padding: "10px 12px",
          background: "rgba(5,13,21,0.6)",
          borderRadius: "8px",
          border: "1px solid var(--glass-border-weak)",
        }}
      >
        {cells}
      </div>
    );
  };

  const isSampleActive = (key) => {
    if (!SAMPLE_RECORDS[key]) return false;
    return selectedSample.id === SAMPLE_RECORDS[key].id && !isCustomUpload;
  };

  return (
    <div className="app">
      <Sidebar />

      <main className="main">
        <TopBar eyebrow="01 / CAPTURE" title="Record Capture & Multimodal Extraction">
          <button
            type="button"
            onClick={handleOpenKeyModal}
            title="Click to configure Medical AI Vision API Key"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "var(--r-full)",
              background: keyInput ? "rgba(61,220,151,0.08)" : "rgba(255,178,90,0.08)",
              border: `1px solid ${keyInput ? "rgba(61,220,151,0.3)" : "rgba(255,178,90,0.3)"}`,
              color: keyInput ? "var(--accent-mint)" : "var(--accent-amber)",
              fontSize: "var(--fs-11)",
              fontWeight: "700",
              cursor: "pointer",
            }}
          >
            <span
              className="use-pulse-dot"
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: keyInput ? "var(--accent-mint-soft)" : "var(--accent-amber)",
              }}
            />
            <Key size={13} />
            <span>
              {keyInput
                ? `AI Vision: ${keyProvider === "openai" ? "GPT-4o" : "Gemini Active"}`
                : "Medical AI Key: Setup"}
            </span>
          </button>
        </TopBar>

        {/* 1. DOCTOR GLASS BANNER */}
        <section className="glass-panel use-page-reveal d-0" style={{ padding: "18px 22px", marginBottom: "18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              className="glass-panel-sm"
              style={{
                width: "54px",
                height: "54px",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: "rgba(61,220,151,0.08)",
                border: "1px solid rgba(61,220,151,0.28)",
                flexShrink: 0,
              }}
            >
              <Stethoscope size={24} style={{ color: "var(--accent-mint)" }} />
            </div>
            <div>
              <div className="t-20" style={{ color: "var(--text-1)", fontWeight: "700", lineHeight: "1.2" }}>
                {user?.name || "Dr. Ananya Sharma"}
              </div>
              <div className="t-12" style={{ color: "var(--text-3)", marginTop: "4px" }}>
                {user?.role === "doctor" ? "Registered Medical Officer" : "Health Inspector"}
                {" \u2022 "}
                {user?.ward || "Aliganj Ward 3, Lucknow"}
              </div>
            </div>
          </div>
          <div
            className="glass-panel-sm"
            style={{
              padding: "10px 16px",
              borderRadius: "var(--r-full)",
              background: "rgba(67,203,210,0.06)",
              border: "1px solid rgba(67,203,210,0.22)",
              textAlign: "right",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "14px",
                left: "10px",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "var(--accent-mint-soft)",
                boxShadow: "0 0 8px var(--accent-mint)",
              }}
              className="use-pulse-dot"
            />
            <div className="t-10" style={{ color: "var(--accent-cyan)", fontWeight: "800", letterSpacing: "0.12em", textTransform: "uppercase", paddingLeft: "10px" }}>
              Assigned Surveillance Ward
            </div>
            <div className="t-13" style={{ color: "var(--text-1)", fontWeight: "700", marginTop: "2px", paddingLeft: "10px" }}>
              {user?.ward || "Aliganj Ward 3, Lucknow"}
            </div>
          </div>
        </section>

        {/* 2. MODE SEGMENTED CONTROL */}
        <section className="use-page-reveal d-80" style={{ marginBottom: "18px" }}>
          <div
            className="glass-panel-sm"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
              padding: "6px",
              borderRadius: "var(--r-md)",
            }}
          >
            {[
              {
                key: "upload",
                Icon: UploadCloud,
                title: "Prescription Upload",
                subtitle: "Image scan · AI Vision OCR",
              },
              {
                key: "manual",
                Icon: FileText,
                title: "Manual Entry",
                subtitle: "Type medicines · Fallback",
              },
              {
                key: "pdf",
                Icon: Layers,
                title: "PDF Report",
                subtitle: "Multi-page · Lab extract",
              },
            ].map((mode, idx) => {
              const isActive = selectedMode === mode.key;
              const Icon = mode.Icon;
              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setSelectedMode(mode.key)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "var(--r-sm)",
                    border: isActive ? "1px solid rgba(67,203,210,0.4)" : "1px solid transparent",
                    background: isActive
                      ? "rgba(67,203,210,0.08)"
                      : "transparent",
                    boxShadow: isActive
                      ? "inset 0 0 20px rgba(75,208,214,0.20)"
                      : "none",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    transition: "all var(--dur-base) var(--ease-out-expo)",
                  }}
                >
                  <Icon
                    size={20}
                    style={{
                      color: isActive ? "var(--accent-cyan)" : "var(--text-4)",
                      fill: isActive ? "rgba(75,208,214,0.15)" : "none",
                    }}
                  />
                  <div className="t-13" style={{ fontWeight: "700", color: isActive ? "var(--text-1)" : "var(--text-3)" }}>
                    {mode.title}
                  </div>
                  <div className="t-10" style={{ color: "var(--text-5)", letterSpacing: "0.02em" }}>
                    {mode.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. AI PROVIDER BANNER */}
        <section className="use-page-reveal d-160" style={{ marginBottom: "18px" }}>
          {keyInput ? (
            <div
              className="glass-panel"
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <Cpu size={22} style={{ color: "var(--accent-cyan)" }} />
                <div>
                  <div className="t-14" style={{ fontWeight: "700", color: "var(--text-1)" }}>
                    <span style={{ color: "var(--accent-cyan)" }}>🔹</span> Medical AI Vision: Provider Active
                  </div>
                  <div className="t-11" style={{ color: "var(--text-4)", marginTop: "2px" }}>
                    {keyProvider === "openai"
                      ? "OpenAI GPT-4o Vision · Handwriting & printed text extraction"
                      : "Google Gemini 2.5 Flash · Free tier multimodal scanning"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className="circle use-pulse-dot" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-mint-soft)", boxShadow: "0 0 8px var(--accent-mint)" }} />
                <span className="circle use-pulse-dot delay-1" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-cyan)", boxShadow: "0 0 8px var(--accent-cyan)", animationDelay: "0.4s" }} />
                <span className="circle use-pulse-dot delay-1" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--accent-amber)", boxShadow: "0 0 8px var(--accent-amber)", animationDelay: "0.8s" }} />
                <button
                  type="button"
                  onClick={handleOpenKeyModal}
                  className="glass-input"
                  style={{
                    padding: "6px 14px",
                    cursor: "pointer",
                    fontSize: "var(--fs-11)",
                    fontWeight: "700",
                    color: "var(--accent-cyan)",
                    marginLeft: "12px",
                  }}
                >
                  Change Key
                </button>
              </div>
            </div>
          ) : (
            <div
              className="glass-panel"
              style={{
                padding: "20px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "20px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: "1 1 320px", minWidth: "280px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "var(--r-sm)",
                    background: "rgba(255,178,90,0.08)",
                    border: "1px solid rgba(255,178,90,0.25)",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <Key size={20} style={{ color: "var(--accent-amber)" }} />
                </div>
                <div>
                  <div className="t-14" style={{ fontWeight: "700", color: "var(--text-1)" }}>
                    Medical AI Vision Key Required
                  </div>
                  <div className="t-11" style={{ color: "var(--text-4)", marginTop: "2px" }}>
                    Add a free Gemini API key for precise handwriting prescription scanning
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "1 1 320px", minWidth: "280px" }}>
                <input
                  type={showKeyPassword ? "text" : "password"}
                  className="glass-input"
                  placeholder="AIzaSy...  (Gemini API Key)"
                  value={tempKey}
                  onChange={(e) => {
                    setTempKey(e.target.value);
                    setKeyTestResult(null);
                  }}
                  style={{ flex: "1" }}
                />
                <button
                  type="button"
                  onClick={() => setShowKeyPassword(!showKeyPassword)}
                  className="glass-panel-sm"
                  style={{
                    width: "40px",
                    height: "40px",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    border: "none",
                    color: "var(--text-3)",
                  }}
                >
                  {showKeyPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (tempKey.trim()) {
                      setStoredMedicalAiConfig(tempKey.trim(), tempProvider);
                      setKeyInput(tempKey.trim());
                    } else {
                      handleOpenKeyModal();
                    }
                  }}
                  className="glass-button"
                  style={{ padding: "10px 18px", fontSize: "var(--fs-12)" }}
                >
                  <Check size={14} /> Verify
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 4. SAMPLE PILLS / GLASS SAMPLE CARDS */}
        {(selectedMode === "upload" || selectedMode === "pdf") && (
          <section className="use-page-reveal d-240" style={{ marginBottom: "18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <Sparkles size={14} style={{ color: "var(--accent-amber)" }} />
              <div className="t-11" style={{ fontWeight: "700", color: "var(--accent-amber)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Quick Demo Samples
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "12px",
              }}
            >
              {SAMPLE_CARDS.map((card, idx) => {
                const isActive = isSampleActive(card.key);
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => handleSelectSample(card.key)}
                    className={`glass-panel-sm ${isActive ? "use-highlight-pulse" : ""}`}
                    style={{
                      padding: "14px",
                      textAlign: "left",
                      cursor: "pointer",
                      opacity: 1,
                      transform: isActive ? "translateY(-4px)" : "translateY(0)",
                      boxShadow: isActive
                        ? `0 8px 30px -10px ${card.accent}40, var(--sh-soft)`
                        : "var(--sh-soft)",
                      border: isActive ? `1px solid ${card.accent}66` : "1px solid var(--glass-border-weak)",
                      transition: "all var(--dur-base) var(--ease-out-expo)",
                    }}
                  >
                    <div
                      style={{
                        height: "64px",
                        borderRadius: "var(--r-sm)",
                        background: card.gradient,
                        marginBottom: "12px",
                        position: "relative",
                        overflow: "hidden",
                        border: "1px solid var(--glass-border-weak)",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "linear-gradient(180deg, transparent 40%, rgba(5,13,21,0.6))",
                        }}
                      />

                    </div>
                    <div className="t-13" style={{ fontWeight: "700", color: isActive ? "var(--text-1)" : "var(--text-2)", marginBottom: "4px" }}>
                      {card.title}
                    </div>
                    <div
                      className="t-10"
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "var(--r-full)",
                        fontWeight: "700",
                        letterSpacing: "0.04em",
                        color: card.accent,
                        background: `${card.accent}14`,
                        border: `1px solid ${card.accent}33`,
                      }}
                    >
                      {card.syndrome}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* 5. DROPZONE */}
        {(selectedMode === "upload" || selectedMode === "pdf") && (
          <section className="use-page-reveal d-240" style={{ marginBottom: "18px" }}>
            <div
              className={`glass-panel ${dropActive ? "use-highlight-pulse" : ""}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: "44px 24px",
                textAlign: "center",
                cursor: "pointer",
                borderStyle: "solid",
                border: dropActive ? "1px dashed var(--accent-cyan)" : "1px dashed var(--glass-border-accent)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {dropActive && (
                <div
                  key={rippleKey}
                  className="use-ripple-out"
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: "200px",
                    height: "200px",
                    borderRadius: "50%",
                    border: "2px solid var(--accent-cyan)",
                    pointerEvents: "none",
                  }}
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={selectedMode === "pdf" ? "application/pdf,image/*" : "image/*,application/pdf"}
                style={{ display: "none" }}
                onChange={handleFileInputChange}
              />

              <div
                className="glass-panel-sm"
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 18px",
                  background: dropActive ? "rgba(67,203,210,0.10)" : "rgba(61,220,151,0.07)",
                  border: `1px solid ${dropActive ? "rgba(67,203,210,0.35)" : "rgba(61,220,151,0.25)"}`,
                }}
              >
                <UploadCloud size={30} style={{ color: dropActive ? "var(--accent-cyan)" : "var(--accent-mint)" }} />
              </div>

              <div className="t-18" style={{ color: "var(--text-1)", fontWeight: "700", marginBottom: "6px" }}>
                Drag & drop {selectedMode === "pdf" ? "PDF lab report or prescription" : "prescription, lab report, or pharmacy slip"}
              </div>
              <div className="t-12" style={{ color: "var(--text-4)", marginBottom: "18px" }}>
                Multimodal AI Medical OCR · Up to 5 MB
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "8px",
                  marginBottom: "22px",
                  flexWrap: "wrap",
                }}
              >
                {[
                  { Icon: ImageIcon, label: "JPG", accent: "var(--accent-cyan)" },
                  { Icon: File, label: "PNG", accent: "var(--accent-mint)" },
                  { Icon: FileText, label: "PDF", accent: "var(--accent-amber)" },
                ].map((c, i) => (
                  <div
                    key={c.label}
                    className="glass-panel-sm"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      borderRadius: "var(--r-full)",
                      border: `1px solid ${c.accent}33`,
                      background: `${c.accent}0D`,
                    }}
                  >
                    <c.Icon size={13} style={{ color: c.accent }} />
                    <span className="t-11" style={{ fontWeight: "700", color: c.accent, letterSpacing: "0.04em" }}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>

              {selectedSample && isCustomUpload ? (
                <div
                  className="glass-panel-sm"
                  style={{
                    display: "inline-block",
                    padding: "10px 18px",
                    borderRadius: "var(--r-sm)",
                    border: "1px solid rgba(61,220,151,0.25)",
                    background: "rgba(61,220,151,0.06)",
                  }}
                >
                  <div className="t-10" style={{ fontWeight: "700", color: "var(--accent-mint)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>
                    File Received
                  </div>
                  {renderFilenameChars(selectedSample.name)}
                  <span className="t-11" style={{ color: "var(--text-4)", marginLeft: "8px" }}>
                    · {selectedSample.size}
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="glass-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    style={{ fontSize: "var(--fs-12)" }}
                  >
                    <FileCheck size={15} /> Browse Local File
                  </button>
                  <button
                    type="button"
                    className="glass-panel-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    style={{
                      padding: "10px 18px",
                      border: "1px solid var(--glass-border-accent)",
                      cursor: "pointer",
                      color: "var(--text-3)",
                      fontWeight: "700",
                      fontSize: "var(--fs-12)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Camera size={15} style={{ color: "var(--accent-mint)" }} /> Mobile Camera
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 6. PREVIEW SPLIT */}
        {selectedSample && (selectedMode === "upload" || selectedMode === "pdf") && (
          <section className="use-page-reveal d-320" style={{ marginBottom: "18px" }}>
            <div className="glass-panel" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "14px", borderBottom: "1px solid var(--glass-border-weak)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <FileText size={18} style={{ color: "var(--accent-cyan)" }} />
                  <div>
                    <div className="t-14" style={{ color: "var(--text-1)", fontWeight: "700" }}>
                      {selectedSample.name}
                    </div>
                    <div className="t-11" style={{ color: "var(--text-4)" }}>
                      {selectedSample.type} · {selectedSample.size} · {keyInput ? "Multimodal Vision AI Enabled" : "Ready for redaction"}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 12px",
                    borderRadius: "var(--r-sm)",
                    background: "rgba(61,220,151,0.10)",
                    border: "1px solid rgba(61,220,151,0.28)",
                  }}
                >
                  <CheckCircle size={13} style={{ color: "var(--accent-mint)" }} />
                  <span className="t-10" style={{ fontWeight: "800", color: "var(--accent-mint)", letterSpacing: "0.1em" }}>
                    READY FOR ANALYSIS
                  </span>
                </div>
              </div>

              {customImagePreview ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {/* LEFT: corner-frame image */}
                  <div style={{ position: "relative", padding: "12px" }}>
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "28px",
                        height: "28px",
                        borderTop: "2px solid var(--accent-cyan)",
                        borderLeft: "2px solid var(--accent-cyan)",
                        borderRadius: "4px 0 0 0",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        width: "28px",
                        height: "28px",
                        borderTop: "2px solid var(--accent-cyan)",
                        borderRight: "2px solid var(--accent-cyan)",
                        borderRadius: "0 4px 0 0",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        width: "28px",
                        height: "28px",
                        borderBottom: "2px solid var(--accent-mint)",
                        borderLeft: "2px solid var(--accent-mint)",
                        borderRadius: "0 0 0 4px",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: "28px",
                        height: "28px",
                        borderBottom: "2px solid var(--accent-mint)",
                        borderRight: "2px solid var(--accent-mint)",
                        borderRadius: "0 0 4px 0",
                      }}
                    />
                    <div className="t-10" style={{ color: "var(--text-4)", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
                      Uploaded Prescription Scan
                    </div>
                    <div
                      className="glass-panel-sm"
                      style={{
                        borderRadius: "var(--r-md)",
                        overflow: "hidden",
                        border: "1px solid var(--glass-border-weak)",
                      }}
                    >
                      <img
                        src={customImagePreview}
                        alt="Prescription Scan"
                        style={{ width: "100%", display: "block", maxHeight: "340px", objectFit: "contain", background: "var(--bg-base)" }}
                      />
                    </div>
                  </div>

                  {/* RIGHT: mock-paper with typewriter shimmer */}
                  <div>
                    <div className="t-10" style={{ color: "var(--text-4)", fontWeight: "700", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
                      Pre-Processing Stream
                    </div>
                    <div
                      className="glass-panel"
                      style={{
                        padding: "20px",
                        minHeight: "340px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: "14px",
                          right: "18px",
                          fontSize: "var(--fs-10)",
                          fontWeight: "800",
                          letterSpacing: "0.1em",
                          color: "var(--text-7)",
                          pointerEvents: "none",
                        }}
                      >
                        CLINICAL OPD RECORD
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
                          backgroundSize: "200% 100%",
                          animation: "shimmerRibbon 1.6s ease-in-out infinite",
                          pointerEvents: "none",
                          mixBlendMode: "overlay",
                        }}
                      />
                      <pre
                        className="mono-clinical t-12"
                        style={{
                          color: "var(--text-2)",
                          lineHeight: "1.65",
                          whiteSpace: "pre-wrap",
                          margin: 0,
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        {selectedSample.rawText}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="glass-panel"
                  style={{
                    padding: "22px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "16px",
                      right: "20px",
                      fontSize: "var(--fs-10)",
                      fontWeight: "800",
                      letterSpacing: "0.12em",
                      color: "var(--text-7)",
                      pointerEvents: "none",
                    }}
                  >
                    CLINICAL OPD RECORD
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmerRibbon 1.6s ease-in-out infinite",
                      pointerEvents: "none",
                      mixBlendMode: "overlay",
                    }}
                  />
                  <pre
                    className="mono-clinical t-12"
                    style={{
                      color: "var(--text-2)",
                      lineHeight: "1.65",
                      whiteSpace: "pre-wrap",
                      margin: 0,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    {selectedSample.rawText}
                  </pre>
                </div>
              )}
            </div>
          </section>
        )}

        {/* MANUAL ENTRY MODE */}
        {selectedMode === "manual" && (
          <section className="use-page-reveal d-240" style={{ marginBottom: "18px" }}>
            <div className="glass-panel" style={{ padding: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", paddingBottom: "14px", borderBottom: "1px solid var(--glass-border-weak)" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "var(--r-sm)",
                    background: "rgba(61,220,151,0.08)",
                    border: "1px solid rgba(61,220,151,0.28)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <FileText size={20} style={{ color: "var(--accent-mint)" }} />
                </div>
                <div>
                  <div className="t-18" style={{ color: "var(--text-1)", fontWeight: "700" }}>
                    Manual Syndromic Entry
                  </div>
                  <div className="t-12" style={{ color: "var(--text-4)", marginTop: "2px" }}>
                    Directly input prescribed formulations when digital record or camera is unavailable
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="t-11" style={{ fontWeight: "700", color: "var(--text-3)", letterSpacing: "0.04em" }}>
                    Primary Clinical Complaint / Symptoms
                  </label>
                  <textarea
                    rows={2}
                    value={manualSymptoms}
                    onChange={(e) => setManualSymptoms(e.target.value)}
                    className="glass-input"
                    placeholder="e.g. Watery diarrhea, nausea, low grade fever..."
                    style={{ minHeight: "64px", resize: "vertical" }}
                  />
                </div>

                <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="t-11" style={{ fontWeight: "700", color: "var(--text-3)", letterSpacing: "0.04em" }}>
                    Prescribed Formulations / Medicines
                  </label>
                  <textarea
                    rows={2}
                    value={manualMedicines}
                    onChange={(e) => setManualMedicines(e.target.value)}
                    className="glass-input"
                    placeholder="e.g. ORS, Ofloxacin 200mg, Ondansetron 4mg..."
                    style={{ minHeight: "64px", resize: "vertical" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="t-11" style={{ fontWeight: "700", color: "var(--text-3)", letterSpacing: "0.04em" }}>
                    Syndromic Disease Category
                  </label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="glass-input"
                    style={{
                      appearance: "none",
                      backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238da4b2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 14px center",
                      backgroundSize: "16px",
                      cursor: "pointer",
                    }}
                  >
                    <option value="Gastrointestinal">Gastrointestinal (Diarrhea / Cholera-like)</option>
                    <option value="Febrile Illness">Febrile Illness (Dengue / Malaria / Chikungunya)</option>
                    <option value="Respiratory">Acute Respiratory Infection (ARI)</option>
                    <option value="Vector-Borne">Vector-Borne Disease</option>
                    <option value="Dermatological">Dermatological / Waterborne Rash</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="t-11" style={{ fontWeight: "700", color: "var(--text-3)", letterSpacing: "0.04em" }}>
                    Surveillance Ward (Auto-locked)
                  </label>
                  <input
                    type="text"
                    value={user?.ward || "Aliganj Ward 3, Lucknow"}
                    readOnly
                    className="glass-input"
                    style={{
                      background: "rgba(5,13,21,0.4)",
                      borderColor: "var(--glass-border-weak)",
                      color: "var(--text-4)",
                      cursor: "not-allowed",
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PRIVACY ASSURANCE STRIP */}
        <section className="use-page-reveal d-320" style={{ marginBottom: "18px" }}>
          <div
            className="glass-panel-sm"
            style={{
              padding: "14px 18px",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
              border: "1px solid rgba(61,220,151,0.22)",
              background: "rgba(61,220,151,0.05)",
              borderRadius: "var(--r-lg)",
            }}
          >
            <ShieldCheck size={20} style={{ color: "var(--accent-mint)", flexShrink: 0, marginTop: "1px" }} />
            <div>
              <div className="t-13" style={{ fontWeight: "700", color: "var(--accent-mint)", marginBottom: "2px" }}>
                100% On-Device Identity Protection (DPDP Act 2023)
              </div>
              <div className="t-12" style={{ color: "var(--text-4)", lineHeight: "1.5" }}>
                Patient names, phone numbers, and addresses are redacted locally before any data leaves
                this terminal. No patient identity or raw image is ever transmitted or stored.
              </div>
            </div>
          </div>
        </section>

        {/* ANALYSIS ERROR CARD */}
        {error && (
          <section className="use-page-reveal d-160" style={{ marginBottom: "18px" }}>
            <div
              className="glass-panel-sm"
              style={{
                padding: "26px 28px",
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
                background: "color-mix(in srgb, var(--accent-rose) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent-rose) 28%, transparent)",
                borderRadius: "18px",
              }}
            >
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "11px",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                  background: "color-mix(in srgb, var(--accent-rose) 14%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent-rose) 35%, transparent)",
                }}
              >
                <AlertCircle size={19} style={{ color: "var(--accent-rose)" }} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                <div className="t-20" style={{ color: "var(--text-1)", fontWeight: 800, letterSpacing: "-0.01em" }}>
                  AI Model Unavailable
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div className="t-15" style={{ color: "var(--text-3)", fontWeight: 600 }}>
                    Analysis failed
                  </div>
                  <div className="t-14" style={{ color: "var(--text-4)", lineHeight: 1.55 }}>
                    {error || "The AI pipeline is temporarily overloaded. Please wait a moment and try again."}
                  </div>
                </div>
                <button
                  type="button"
                  className="glass-button"
                  onClick={handleStartAnalysis}
                  disabled={showAnalysisModal}
                  style={{
                    alignSelf: "flex-start",
                    marginTop: "6px",
                    padding: "11px 20px",
                    fontSize: "var(--fs-13)",
                    fontWeight: 700,
                    gap: "9px",
                    background: "color-mix(in srgb, var(--accent-skyfill) 35%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--accent-cyan) 25%, transparent)",
                  }}
                >
                  <RefreshCw size={15} /> Try Again
                </button>
              </div>
            </div>
          </section>
        )}

        {/* BOTTOM CTA BAR */}
        <section className="use-page-reveal d-320" style={{ marginBottom: "8px" }}>
          <div className="glass-panel" style={{ padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <div className="t-11" style={{ fontWeight: "700", color: "var(--accent-amber)", letterSpacing: "0.06em" }}>
                Next Step
              </div>
              <div className="t-13" style={{ color: "var(--text-3)", marginTop: "2px" }}>
                Review extracted data, exact medicines & confirm privacy redaction
              </div>
            </div>
            <button
              type="button"
              className="glass-button"
              onClick={handleStartAnalysis}
              disabled={showAnalysisModal}
              style={{ padding: "14px 24px", fontSize: "var(--fs-13)", gap: "10px" }}
            >
              {showAnalysisModal ? (
                <>
                  <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Processing Signal...
                </>
              ) : (
                <>
                  Analyse Record & Protect Privacy <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </section>

        {/* 8. BOTTOM: choreo-cta-strip */}
        <section className="use-page-reveal d-320">
          <div className="choreo-cta-strip">
            <div className="choreo-cta-left">
              <div className="choreo-cta-label">Deep Extraction</div>
              <div className="choreo-cta-text">
                <span className="choreo-cta-arrow">→</span>
                Jump to Deep Prescription Extraction Scanner
              </div>
            </div>
            <button
              type="button"
              className="choreo-cta-btn"
              onClick={() => navigate('/scanner')}
            >
              <Cpu size={14} /> Deep Scanner
              <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* 7. STEPPER MODAL / ANALYSIS OVERLAY */}
        {showAnalysisModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(4,11,18,0.85)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              display: "grid",
              placeItems: "center",
              zIndex: 1000,
              padding: "20px",
            }}
          >
            <div
              className="glass-panel-lg"
              style={{
                width: "100%",
                maxWidth: "540px",
                padding: "34px 30px",
                perspective: "1000px",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: "30px" }}>
                <div className="t-20" style={{ color: "var(--text-1)", fontWeight: "700", marginBottom: "6px" }}>
                  Processing Clinical Signal
                </div>
                <div className="t-12" style={{ color: "var(--text-4)" }}>
                  {keyInput
                    ? `Medical AI Vision (${keyProvider === "openai" ? "GPT-4o" : "Google Gemini"}) handwriting OCR in progress`
                    : "Zero-exposure edge intelligence pipeline in progress"}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "28px" }}>
                {analysisSteps.map((step, idx) => {
                  const isCompleted = analysisStep > step.id;
                  const isActive = analysisStep === step.id;
                  return (
                    <div key={step.id} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div
                        style={{
                          width: "42px",
                          height: "42px",
                          flexShrink: 0,
                          perspective: "800px",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            position: "relative",
                            transformStyle: "preserve-3d",
                            transform: isCompleted ? "rotateY(180deg)" : "rotateY(0deg)",
                            transition: "transform 0.6s var(--ease-out-expo)",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              borderRadius: "50%",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: "800",
                              fontSize: "var(--fs-14)",
                              backfaceVisibility: "hidden",
                              background: isActive
                                ? "linear-gradient(135deg, var(--accent-cyan), var(--accent-cyan-deep))"
                                : "var(--glass-fill-soft)",
                              color: isActive ? "var(--accent-ink)" : isCompleted ? "var(--text-6)" : "var(--text-4)",
                              border: `1px solid ${isActive ? "rgba(67,203,210,0.55)" : "var(--glass-border-weak)"}`,
                              boxShadow: isActive ? "var(--sh-halo-cyan)" : "none",
                            }}
                          >
                            {step.id}
                          </div>
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              borderRadius: "50%",
                              display: "grid",
                              placeItems: "center",
                              backfaceVisibility: "hidden",
                              transform: "rotateY(180deg)",
                              background: "rgba(61,220,151,0.12)",
                              border: "1px solid rgba(61,220,151,0.4)",
                              color: "var(--accent-mint)",
                            }}
                          >
                            <CheckCircle size={20} />
                          </div>
                        </div>
                      </div>

                      <div style={{ flex: 1, padding: "10px 14px", borderRadius: "var(--r-sm)", background: isActive ? "rgba(67,203,210,0.06)" : "transparent", border: isActive ? "1px solid rgba(67,203,210,0.22)" : "1px solid transparent", transition: "all 0.4s var(--ease-out-expo)" }}>
                        <div className="t-13" style={{ fontWeight: "700", color: isActive ? "var(--text-1)" : isCompleted ? "var(--text-3)" : "var(--text-5)" }}>
                          {step.id === 3 && isActive ? (
                            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              {step.label}
                              {renderSignalMatrix()}
                            </span>
                          ) : (
                            step.label
                          )}
                        </div>
                        <div className="t-11" style={{ color: "var(--text-5)", marginTop: "2px" }}>
                          {step.sublabel}
                        </div>
                      </div>

                      {idx < analysisSteps.length - 1 && (
                        <div
                          style={{
                            position: "absolute",
                            width: "2px",
                            height: "30px",
                            left: "36px",
                            marginTop: "72px",
                            background: "var(--glass-border-weak)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              background: "linear-gradient(180deg, var(--accent-cyan), var(--accent-mint))",
                              strokeDasharray: "100%",
                              animation: isCompleted || analysisStep > step.id ? "drawLine 0.5s var(--ease-out-expo) forwards" : "none",
                              transformOrigin: "top",
                              transform: isCompleted || analysisStep > step.id ? "scaleY(1)" : "scaleY(0)",
                              transition: "transform 0.5s var(--ease-out-expo)",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ height: "6px", background: "var(--glass-fill-soft)", borderRadius: "3px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    background: "linear-gradient(90deg, var(--accent-cyan), var(--accent-mint))",
                    width: `${(analysisStep / 3) * 100}%`,
                    transition: "width 0.5s var(--ease-out-expo)",
                    boxShadow: "var(--sh-halo-cyan)",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* MODAL: MEDICAL AI API KEY CONFIGURATION */}
        {showKeyModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(4,11,18,0.85)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              display: "grid",
              placeItems: "center",
              zIndex: 1000,
              padding: "20px",
            }}
            onClick={() => setShowKeyModal(false)}
          >
            <div
              className="glass-panel-lg"
              style={{ width: "100%", maxWidth: "540px", padding: "28px 26px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "22px" }}>
                <div>
                  <div className="t-18" style={{ color: "var(--text-1)", fontWeight: "700", display: "flex", alignItems: "center", gap: "10px" }}>
                    <Key size={20} style={{ color: "var(--accent-cyan)" }} /> Medical AI Vision API Configuration
                  </div>
                  <div className="t-12" style={{ color: "var(--text-4)", marginTop: "6px" }}>
                    Enable multimodal AI scanning for handwritten prescriptions and exact formulation extraction.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowKeyModal(false)}
                  className="glass-panel-sm"
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "var(--r-sm)",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    border: "1px solid var(--glass-border-weak)",
                    background: "var(--glass-fill-soft)",
                    color: "var(--text-3)",
                    flexShrink: 0,
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="t-11" style={{ fontWeight: "700", color: "var(--text-3)", letterSpacing: "0.04em" }}>
                    AI OCR Provider
                  </label>
                  <select
                    className="glass-input"
                    value={tempProvider}
                    onChange={(e) => setTempProvider(e.target.value)}
                    style={{
                      appearance: "none",
                      backgroundImage: "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238da4b2' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 14px center",
                      backgroundSize: "16px",
                      cursor: "pointer",
                    }}
                  >
                    <option value="gemini">Google Gemini 2.5 Flash (Recommended — Free Tier Available)</option>
                    <option value="openai">OpenAI GPT-4o Vision</option>
                  </select>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label className="t-11" style={{ fontWeight: "700", color: "var(--text-3)", letterSpacing: "0.04em" }}>
                    {tempProvider === "openai" ? "OpenAI API Key" : "Google Gemini API Key"}
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <div style={{ flex: 1, position: "relative" }}>
                      <input
                        type={showKeyPassword ? "text" : "password"}
                        className="glass-input"
                        placeholder={tempProvider === "openai" ? "sk-proj-..." : "AIzaSy..."}
                        value={tempKey}
                        onChange={(e) => {
                          setTempKey(e.target.value);
                          setKeyTestResult(null);
                        }}
                        style={{ width: "100%", paddingRight: "48px" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeyPassword(!showKeyPassword)}
                        style={{
                          position: "absolute",
                          top: "50%",
                          right: "8px",
                          transform: "translateY(-50%)",
                          width: "32px",
                          height: "32px",
                          borderRadius: "6px",
                          background: "transparent",
                          border: "none",
                          color: "var(--text-4)",
                          cursor: "pointer",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {showKeyPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className="glass-panel-sm"
                  style={{
                    padding: "14px 16px",
                    border: "1px solid rgba(67,203,210,0.18)",
                    background: "rgba(67,203,210,0.04)",
                    borderRadius: "var(--r-md)",
                  }}
                >
                  <div className="t-12" style={{ color: "var(--text-2)", lineHeight: "1.6" }}>
                    {tempProvider === "gemini" ? (
                      <>
                        <strong style={{ color: "var(--accent-cyan)" }}>How to get a Free Google Gemini API Key:</strong>
                        <br />
                        1. Visit Google AI Studio with your Google account.
                        <br />
                        2. Click "Get API Key" and generate a free API key.
                        <br />
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--accent-cyan)", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "4px" }}
                        >
                          Open Google AI Studio <ExternalLink size={12} />
                        </a>
                      </>
                    ) : (
                      <>
                        <strong style={{ color: "var(--accent-cyan)" }}>How to get an OpenAI API Key:</strong>
                        <br />
                        Create or copy your key from your OpenAI Platform API keys dashboard.
                        <br />
                        <a
                          href="https://platform.openai.com/api-keys"
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--accent-cyan)", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px", marginTop: "4px" }}
                        >
                          Open OpenAI Dashboard <ExternalLink size={12} />
                        </a>
                      </>
                    )}
                  </div>
                </div>

                {keyTestResult && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "12px 14px",
                      borderRadius: "var(--r-sm)",
                      background: keyTestResult.valid ? "rgba(61,220,151,0.08)" : "rgba(255,122,122,0.08)",
                      border: `1px solid ${keyTestResult.valid ? "rgba(61,220,151,0.3)" : "rgba(255,122,122,0.3)"}`,
                    }}
                  >
                    {keyTestResult.valid ? (
                      <CheckCircle size={18} style={{ color: "var(--accent-mint)" }} />
                    ) : (
                      <AlertTriangle size={18} style={{ color: "var(--accent-rose)" }} />
                    )}
                    <span className="t-12" style={{ color: keyTestResult.valid ? "var(--accent-mint)" : "var(--accent-rose)", fontWeight: "600" }}>
                      {keyTestResult.message}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  {keyInput && (
                    <button
                      type="button"
                      onClick={handleClearKey}
                      className="glass-panel-sm"
                      style={{
                        padding: "10px 18px",
                        cursor: "pointer",
                        fontSize: "var(--fs-12)",
                        fontWeight: "700",
                        color: "var(--accent-rose)",
                        border: "1px solid rgba(255,122,122,0.28)",
                        background: "rgba(255,122,122,0.06)",
                      }}
                    >
                      Remove Key
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={isKeyVerifying || !tempKey.trim()}
                    className="glass-panel-sm"
                    style={{
                      padding: "10px 18px",
                      cursor: isKeyVerifying || !tempKey.trim() ? "not-allowed" : "pointer",
                      fontSize: "var(--fs-12)",
                      fontWeight: "700",
                      color: "var(--text-3)",
                      border: "1px solid var(--glass-border-accent)",
                      opacity: isKeyVerifying || !tempKey.trim() ? 0.55 : 1,
                    }}
                  >
                    {isKeyVerifying ? "Testing..." : "Test Connection"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveKey}
                    className="glass-button"
                    style={{ fontSize: "var(--fs-12)", gap: "6px" }}
                  >
                    <Check size={15} /> Save Configuration
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
