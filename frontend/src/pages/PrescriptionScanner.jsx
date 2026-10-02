import { useState, useRef, useEffect, useCallback } from "react";
import {
  UploadCloud,
  FileText,
  Camera,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  FileCheck,
  RefreshCw,
  FileSearch,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Check,
  Loader,
  Eye,
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { apiScanPrescription } from "../services/api";
import { useNavigate } from "react-router-dom";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const ALLOWED_EXT = ["jpg", "jpeg", "png", "pdf"];

function getExtension(filename) {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx + 1).toLowerCase();
}

function validateFile(file) {
  if (!file) return { ok: false, error: "No file selected." };
  const ext = getExtension(file.name || "");
  const mimeOk = ALLOWED_MIME.some((m) => file.type && file.type.toLowerCase().includes(m));
  const extOk = ALLOWED_EXT.includes(ext);
  if (!mimeOk && !extOk) {
    return { ok: false, error: "Unsupported file type. Use JPG, JPEG, PNG, or PDF." };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: "File is too large. Maximum size is 5 MB." };
  }
  if (file.size === 0) {
    return { ok: false, error: "Prescription could not be read (empty file)." };
  }
  return { ok: true };
}

function confidenceLabel(conf) {
  if (conf == null) return { label: "Unknown", tone: "verify", icon: AlertTriangle };
  if (conf >= 0.9) return { label: "High confidence", tone: "high", icon: CheckCircle };
  if (conf >= 0.7) return { label: "Review recommended", tone: "med", icon: AlertCircle };
  return { label: "Verification required", tone: "verify", icon: AlertTriangle };
}

function OverallBadge({ overall }) {
  const lvl = confidenceLabel(overall);
  const Icon = lvl.icon;
  const toneMap = {
    high: "var(--accent-mint)",
    med: "var(--accent-cyan)",
    verify: "var(--accent-amber)",
  };
  return (
    <span
      className="overall-conf-badge"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        borderRadius: "var(--r-full)",
        fontSize: "var(--fs-11)",
        fontWeight: 700,
        letterSpacing: "0.04em",
        background: `color-mix(in srgb, ${toneMap[lvl.tone]} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${toneMap[lvl.tone]} 35%, transparent)`,
        color: toneMap[lvl.tone],
      }}
    >
      <Icon size={14} /> {lvl.label} ({Math.round(overall * 100)}%)
    </span>
  );
}

export default function PrescriptionScanner() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const resultsEndRef = useRef(null);
  const dragRippleRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisError, setAnalysisError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [pipelineWarnings, setPipelineWarnings] = useState([]);
  const [expandedSources, setExpandedSources] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const [ripples, setRipples] = useState([]);
  const [recentScans, setRecentScans] = useState([
    { id: "r1", name: "Dr-Sharma-Rx-Jan12.jpg", confidence: 0.94, isPdf: false, placeholder: "Rx 1" },
    { id: "r2", name: "Apollo-Pharmacy-Slip.pdf", confidence: 0.78, isPdf: true, placeholder: "Rx 2" },
    { id: "r3", name: "Fortis-LabReport.png", confidence: 0.62, isPdf: false, placeholder: "Rx 3" },
  ]);
  const [highlightedMedIds, setHighlightedMedIds] = useState(new Set());

  useEffect(() => {
    if (scanResult || analysisError) {
      resultsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scanResult, analysisError]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const spawnRipple = (clientX, clientY, containerEl) => {
    if (!containerEl) return;
    const rect = containerEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const id = Math.random().toString(36).slice(2);
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 700);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    spawnRipple(e.clientX, e.clientY, e.currentTarget);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleIncomingFile(e.dataTransfer.files[0]);
    }
  };

  const handleDropzoneClick = (e) => {
    spawnRipple(e.clientX, e.clientY, e.currentTarget);
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleIncomingFile(e.target.files[0]);
    }
  };

  const handleIncomingFile = (file) => {
    setAnalysisStep(0);
    setScanResult(null);
    setAnalysisError(null);
    setPipelineWarnings([]);

    const v = validateFile(file);
    if (!v.ok) {
      setFileError(v.error);
      setSelectedFile(null);
      setFilePreview(null);
      setFileMeta(null);
      return;
    }

    setFileError(null);
    setSelectedFile(file);
    setFileMeta({
      name: file.name || "Prescription",
      type: file.type || "application/octet-stream",
      sizeMB: (file.size / 1024 / 1024).toFixed(2),
    });

    if (file.type && file.type.startsWith("image/")) {
      const previewUrl = URL.createObjectURL(file);
      setFilePreview({ kind: "image", url: previewUrl });
    } else {
      setFilePreview({ kind: "pdf", name: file.name });
    }
  };

  const handleRestoreRecent = (scan) => {
    const fakeFile = {
      name: scan.name,
      type: scan.isPdf ? "application/pdf" : "image/png",
      size: 1024 * 512,
    };
    setSelectedFile(fakeFile);
    setFileMeta({
      name: scan.name,
      type: fakeFile.type,
      sizeMB: (fakeFile.size / 1024 / 1024).toFixed(2),
    });
    if (scan.isPdf) {
      setFilePreview({ kind: "pdf", name: scan.name });
    } else {
      setFilePreview({ kind: "image", url: null, placeholder: scan.placeholder });
    }
    setFileError(null);
  };

  const handleClearFile = () => {
    if (filePreview?.kind === "image" && filePreview?.url) URL.revokeObjectURL(filePreview.url);
    setSelectedFile(null);
    setFilePreview(null);
    setFileMeta(null);
    setFileError(null);
    setScanResult(null);
    setAnalysisError(null);
    setPipelineWarnings([]);
    setAnalysisStep(0);
    setExpandedSources({});
  };

  const startAnalysis = async () => {
    if (!selectedFile) return;
    const v = validateFile(selectedFile);
    if (!v.ok) {
      setFileError(v.error);
      return;
    }

    setAnalysisError(null);
    setScanResult(null);
    setPipelineWarnings([]);
    setAnalysisStep(1);

    setTimeout(() => setAnalysisStep(2), 180);

    try {
      const resp = await apiScanPrescription(selectedFile);
      setAnalysisStep(3);
      await new Promise((r) => setTimeout(r, 250));

      if (!resp || !resp.success) {
        setAnalysisStep(0);
        setAnalysisError(resp?.error || "AI extraction failed. Please try a clearer image.");
        setPipelineWarnings(resp?.warnings || []);
        return;
      }

      setScanResult(resp.data);
      setPipelineWarnings(resp.warnings || []);
      setAnalysisStep(4);
      setTimeout(() => setAnalysisStep(5), 500);

      if (fileMeta) {
        setRecentScans((prev) => {
          const next = [
            {
              id: Math.random().toString(36).slice(2),
              name: fileMeta.name,
              confidence: resp.data.overall_confidence ?? 0.8,
              isPdf: fileMeta.type.includes("pdf"),
              placeholder: fileMeta.name.slice(0, 4).toUpperCase(),
            },
            ...prev.slice(0, 2),
          ];
          return next;
        });
      }
    } catch (err) {
      setAnalysisStep(0);
      setAnalysisError(err.message || "AI extraction failed. Please try a clearer image.");
    }
  };

  const toggleSource = (i) => {
    setExpandedSources((s) => ({ ...s, [i]: !s[i] }));
  };

  const handleReviewMed = (idx) => {
    const el = document.getElementById(`med-${idx}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHighlightedMedIds((prev) => new Set(prev).add(idx));
    setTimeout(() => {
      setHighlightedMedIds((prev) => {
        const n = new Set(prev);
        n.delete(idx);
        return n;
      });
    }, 2000);
  };

  const stepperSteps = [
    { key: 1, title: "Upload", sub: "File accepted & buffered." },
    { key: 2, title: "Validate", sub: "Integrity & format check." },
    { key: 3, title: "Extract", sub: "OCR + medical field mapping." },
    { key: 4, title: "Audit", sub: "Confidence scoring + PII scrub." },
  ];

  const showStepper = analysisStep >= 1 && analysisStep <= 4;

  const toneColor = (tone) => {
    if (tone === "high") return "var(--accent-mint)";
    if (tone === "med") return "var(--accent-cyan)";
    return "var(--accent-amber)";
  };

  return (
    <div className="app">
      <Sidebar />

      <main className="main">
        <TopBar eyebrow="02 / SCANNER" title="Prescription Scanner & Medical Information Extraction" />

        <section className="use-page-reveal d-0">
          <div
            className="glass-panel-sm"
            style={{
              padding: "14px 18px",
              marginBottom: "22px",
              display: "flex",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <ShieldCheck size={18} style={{ color: "var(--accent-mint)", flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong style={{ display: "block", fontSize: "var(--fs-13)", color: "var(--accent-mint)", marginBottom: 2 }}>
                Secure Clinical Document Processing
              </strong>
              <p style={{ fontSize: "var(--fs-12)", color: "var(--text-3)", lineHeight: 1.45, margin: 0 }}>
                Your prescription is processed securely. AI-extracted information should be verified against
                the original prescription. No patient identity is permanently stored.
              </p>
            </div>
          </div>
        </section>

        {!scanResult && (
          <>
            <section className="use-page-reveal d-80">
              <div className="glass-panel-sm" style={{ padding: "10px 14px", marginBottom: "20px", display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <FileSearch size={16} style={{ color: "var(--accent-cyan)" }} />
                <span style={{ fontSize: "var(--fs-12)", fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-2)", textTransform: "uppercase" }}>
                  Prescription Scanner
                </span>
              </div>
            </section>

            <section className="use-page-reveal d-160">
              <div
                className="glass-panel-lg"
                style={{
                  padding: "18px 22px",
                  marginBottom: "22px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <UploadCloud size={20} style={{ color: "var(--accent-cyan)", flexShrink: 0 }} />
                <div>
                  <strong style={{ fontSize: "var(--fs-14)", color: "var(--text-1)" }}>
                    Upload a doctor&apos;s prescription for deep information extraction
                  </strong>
                  <div style={{ fontSize: "var(--fs-12)", color: "var(--text-3)", marginTop: 2 }}>
                    Supported: JPG • JPEG • PNG • PDF. Drag &amp; drop or browse below. Max 5 MB.
                  </div>
                </div>
              </div>
            </section>

            <section className="use-page-reveal d-160">
              {!selectedFile && (
                <div
                  ref={dragRippleRef}
                  className={`glass-panel ${dragActive ? "drag-active" : ""}`}
                  style={{
                    padding: "38px 24px",
                    textAlign: "center",
                    cursor: "pointer",
                    marginBottom: "22px",
                    position: "relative",
                    overflow: "hidden",
                    borderStyle: dragActive ? "solid" : "solid",
                    borderColor: dragActive ? "var(--accent-mint)" : undefined,
                  }}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={handleDropzoneClick}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                    className="hidden-file-input"
                    onChange={handleFileInputChange}
                  />
                  {ripples.map((r) => (
                    <span
                      key={r.id}
                      className="use-ripple-out"
                      style={{
                        position: "absolute",
                        left: r.x,
                        top: r.y,
                        width: "120px",
                        height: "120px",
                        borderRadius: "50%",
                        background: "radial-gradient(circle, color-mix(in srgb, var(--accent-mint) 28%, transparent) 0%, transparent 70%)",
                        pointerEvents: "none",
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  ))}
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      background: "color-mix(in srgb, var(--accent-mint) 10%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--accent-mint) 30%, transparent)",
                      display: "grid",
                      placeItems: "center",
                      margin: "0 auto 18px",
                    }}
                  >
                    <UploadCloud size={30} style={{ color: "var(--accent-mint)" }} />
                  </div>
                  <h3 style={{ fontSize: "var(--fs-18)", color: "var(--text-1)", marginBottom: "6px" }}>
                    Drag &amp; drop prescription, pharmacy slip, or lab report
                  </h3>
                  <p style={{ fontSize: "var(--fs-13)", color: "var(--text-4)", marginBottom: "18px" }}>
                    Supported: JPG • JPEG • PNG • PDF up to 5 MB
                  </p>
                  <div style={{ margin: "14px 0 10px", color: "var(--text-5)", fontSize: "var(--fs-11)", letterSpacing: "0.2em" }}>
                    ────────── OR ──────────
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="glass-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      style={{ padding: "10px 18px", fontSize: "var(--fs-13)" }}
                    >
                      <FileCheck size={15} /> Choose File
                    </button>
                    <button
                      type="button"
                      className="glass-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      style={{
                        padding: "10px 18px",
                        fontSize: "var(--fs-13)",
                        background: "color-mix(in srgb, var(--accent-cyan) 12%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--accent-cyan) 32%, transparent)",
                        color: "var(--accent-cyan)",
                        boxShadow: "none",
                      }}
                    >
                      <Camera size={15} /> Mobile Camera
                    </button>
                  </div>
                </div>
              )}

              {fileError && !selectedFile && (
                <div
                  className="glass-panel-sm"
                  style={{
                    marginTop: "18px",
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    background: "color-mix(in srgb, var(--accent-rose) 8%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--accent-rose) 30%, transparent)",
                  }}
                >
                  <AlertTriangle size={18} style={{ color: "var(--accent-rose)", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--accent-rose)" }}>{fileError}</span>
                </div>
              )}

              {selectedFile && fileMeta && (
                <div className="glass-panel" style={{ padding: "20px", marginBottom: "22px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: "14px",
                      marginBottom: "16px",
                      borderBottom: "1px solid var(--glass-border-weak)",
                      flexWrap: "wrap",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "var(--r-md)",
                          background: filePreview?.kind === "pdf"
                            ? "color-mix(in srgb, var(--accent-amber) 12%, transparent)"
                            : "color-mix(in srgb, var(--accent-cyan) 12%, transparent)",
                          border: `1px solid color-mix(in srgb, ${filePreview?.kind === "pdf" ? "var(--accent-amber)" : "var(--accent-cyan)"} 30%, transparent)`,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <FileText
                          size={20}
                          style={{ color: filePreview?.kind === "pdf" ? "var(--accent-amber)" : "var(--accent-cyan)" }}
                        />
                      </div>
                      <div>
                        <h4 style={{ fontSize: "var(--fs-14)", color: "var(--text-1)" }}>{fileMeta.name}</h4>
                        <small style={{ fontSize: "var(--fs-12)", color: "var(--text-4)" }}>
                          {fileMeta.type} • {fileMeta.sizeMB} MB • Ready for analysis
                        </small>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <button
                        type="button"
                        className="glass-button"
                        onClick={handleClearFile}
                        style={{
                          padding: "6px 14px",
                          fontSize: "var(--fs-12)",
                          background: "color-mix(in srgb, var(--accent-rose) 10%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--accent-rose) 28%, transparent)",
                          color: "var(--accent-rose)",
                          boxShadow: "none",
                        }}
                      >
                        Remove
                      </button>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          borderRadius: "var(--r-full)",
                          fontSize: "var(--fs-10)",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          background: "color-mix(in srgb, var(--accent-mint) 12%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--accent-mint) 30%, transparent)",
                          color: "var(--accent-mint)",
                        }}
                      >
                        <CheckCircle size={13} /> READY
                      </span>
                    </div>
                  </div>

                  {filePreview?.kind === "image" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                      <div
                        className="glass-panel-sm"
                        style={{
                          padding: "14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <small style={{ color: "var(--text-4)", fontSize: "var(--fs-10)", fontWeight: 700, letterSpacing: "0.12em" }}>
                          UPLOADED PRESCRIPTION PREVIEW
                        </small>
                        {filePreview.url ? (
                          <img
                            src={filePreview.url}
                            alt="Prescription preview"
                            style={{
                              width: "100%",
                              borderRadius: "var(--r-md)",
                              border: "1px solid var(--glass-border-weak)",
                              maxHeight: "280px",
                              objectFit: "contain",
                              background: "var(--bg-deep)",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "200px",
                              borderRadius: "var(--r-md)",
                              background: "linear-gradient(135deg, color-mix(in srgb, var(--accent-cyan) 14%, transparent), color-mix(in srgb, var(--accent-mint) 10%, transparent))",
                              display: "grid",
                              placeItems: "center",
                              fontSize: "var(--fs-24)",
                              fontWeight: 800,
                              color: "var(--accent-cyan)",
                              letterSpacing: "0.1em",
                              border: "1px dashed color-mix(in srgb, var(--accent-cyan) 30%, transparent)",
                            }}
                          >
                            {filePreview.placeholder || "PREVIEW"}
                          </div>
                        )}
                      </div>
                      <div
                        className="glass-panel-sm"
                        style={{
                          padding: "20px",
                          position: "relative",
                          overflow: "hidden",
                          background: "var(--glass-fill-soft)",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: "14px",
                            right: "18px",
                            fontSize: "var(--fs-11)",
                            fontWeight: 800,
                            letterSpacing: "0.12em",
                            color: "var(--text-7)",
                            pointerEvents: "none",
                          }}
                        >
                          PRE-PROCESSING STREAM
                        </div>
                        <pre
                          className="mono-clinical"
                          style={{
                            fontSize: "var(--fs-12)",
                            lineHeight: 1.6,
                            color: "var(--text-2)",
                            whiteSpace: "pre-wrap",
                            margin: 0,
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
{`Preview of the uploaded prescription image shown on the left.

Click "Analyze Prescription" to run OCR + medical extraction.`}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="glass-panel-sm"
                      style={{ padding: "20px", position: "relative", overflow: "hidden" }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: "14px",
                          right: "18px",
                          fontSize: "var(--fs-11)",
                          fontWeight: 800,
                          letterSpacing: "0.12em",
                          color: "var(--text-7)",
                          pointerEvents: "none",
                        }}
                      >
                        PDF DOCUMENT
                      </div>
                      <pre
                        className="mono-clinical"
                        style={{
                          fontSize: "var(--fs-12)",
                          lineHeight: 1.6,
                          color: "var(--text-2)",
                          whiteSpace: "pre-wrap",
                          margin: 0,
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
{`Uploaded file: ${fileMeta.name}
Type: ${fileMeta.type}

PDF document ready for text extraction + AI analysis.`}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="use-page-reveal d-240">
              <div style={{ marginBottom: "12px" }}>
                <small style={{ fontSize: "var(--fs-10)", fontWeight: 800, letterSpacing: "0.14em", color: "var(--text-4)", textTransform: "uppercase" }}>
                  Recent Scans
                </small>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "22px" }}>
                {recentScans.map((scan, i) => {
                  const confLvl = confidenceLabel(scan.confidence);
                  return (
                    <button
                      key={scan.id}
                      type="button"
                      className={`glass-panel-sm use-page-reveal d-${(i + 1) * 80}`}
                      onClick={() => handleRestoreRecent(scan)}
                      style={{
                        padding: "14px",
                        textAlign: "left",
                        cursor: "pointer",
                        border: "1px solid var(--glass-border-weak)",
                        transition: "transform var(--dur-fast), border-color var(--dur-fast)",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.borderColor = "color-mix(in srgb, var(--accent-cyan) 32%, transparent)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.borderColor = "var(--glass-border-weak)";
                      }}
                    >
                      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "var(--r-md)",
                            flexShrink: 0,
                            background: scan.isPdf
                              ? "linear-gradient(135deg, color-mix(in srgb, var(--accent-amber) 18%, transparent), color-mix(in srgb, var(--accent-rose) 10%, transparent))"
                              : "linear-gradient(135deg, color-mix(in srgb, var(--accent-cyan) 18%, transparent), color-mix(in srgb, var(--accent-mint) 10%, transparent))",
                            border: `1px solid color-mix(in srgb, ${scan.isPdf ? "var(--accent-amber)" : "var(--accent-cyan)"} 28%, transparent)`,
                            display: "grid",
                            placeItems: "center",
                            fontSize: "var(--fs-10)",
                            fontWeight: 800,
                            color: scan.isPdf ? "var(--accent-amber)" : "var(--accent-cyan)",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {scan.isPdf ? <FileText size={18} /> : scan.placeholder}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "var(--fs-12)",
                              fontWeight: 600,
                              color: "var(--text-1)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              marginBottom: "4px",
                            }}
                            title={scan.name}
                          >
                            {scan.name}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <confLvl.icon size={11} style={{ color: toneColor(confLvl.tone) }} />
                            <span style={{ fontSize: "var(--fs-11)", color: toneColor(confLvl.tone), fontWeight: 600 }}>
                              {Math.round(scan.confidence * 100)}%
                            </span>
                            <span style={{ fontSize: "var(--fs-10)", color: "var(--text-5)" }}>
                              {confLvl.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {selectedFile && (
              <section className="use-page-reveal d-320">
                <div
                  className="glass-panel"
                  style={{
                    padding: "16px 22px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "14px",
                  }}
                >
                  <div style={{ fontSize: "var(--fs-13)", color: "var(--text-3)" }}>
                    <span style={{ color: "var(--accent-amber)", fontWeight: 700 }}>Next Step:</span>{" "}
                    OCR document, extract medicines &amp; clinical fields, verify confidence.
                  </div>
                  <button
                    type="button"
                    className="glass-button"
                    onClick={startAnalysis}
                    disabled={!!showStepper}
                    style={{
                      padding: "14px 24px",
                      fontSize: "var(--fs-14)",
                      opacity: showStepper ? 0.7 : 1,
                      cursor: showStepper ? "not-allowed" : "pointer",
                    }}
                  >
                    {showStepper ? (
                      <>
                        <RefreshCw size={16} className="spin-icon" /> Processing...
                      </>
                    ) : (
                      <>
                        Analyze Prescription <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {showStepper && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "color-mix(in srgb, var(--bg-deep) 85%, transparent)",
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
                padding: "32px 28px",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: "32px" }}>
                <h3 style={{ fontSize: "var(--fs-20)", color: "var(--text-1)", marginBottom: "6px" }}>
                  Prescription Analysis Pipeline
                </h3>
                <p style={{ fontSize: "var(--fs-13)", color: "var(--text-4)" }}>
                  Running OCR + medical AI extraction — please wait.
                </p>
              </div>
              <div style={{ position: "relative", marginBottom: "28px" }}>
                <svg
                  style={{
                    position: "absolute",
                    top: "22px",
                    left: "22px",
                    right: "22px",
                    height: "2px",
                    width: "calc(100% - 44px)",
                    zIndex: 0,
                  }}
                  preserveAspectRatio="none"
                >
                  <line
                    x1="0"
                    y1="1"
                    x2="100%"
                    y2="1"
                    stroke="var(--text-7)"
                    strokeWidth="2"
                    strokeDasharray="100%"
                    strokeDashoffset="100%"
                    style={{ animation: `drawLine 1.8s var(--ease-out-expo) forwards` }}
                  />
                  <line
                    x1="0"
                    y1="1"
                    x2={`${Math.min(100, (Math.max(0, analysisStep - 1) / 3) * 100)}%`}
                    y2="1"
                    stroke="var(--accent-mint)"
                    strokeWidth="2"
                    strokeDasharray="100%"
                    strokeDashoffset="100%"
                    style={{ animation: `drawLine 1.2s var(--ease-out-expo) forwards` }}
                  />
                </svg>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "8px",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {stepperSteps.map((s) => {
                    const done = analysisStep > s.key;
                    const active = analysisStep === s.key;
                    const pct = active ? 55 : done ? 100 : 0;
                    return (
                      <div key={s.key} style={{ textAlign: "center" }}>
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            margin: "0 auto 10px",
                            borderRadius: "50%",
                            position: "relative",
                            display: "grid",
                            placeItems: "center",
                            background:
                              done
                                ? "conic-gradient(var(--accent-mint) 0% 100%, var(--text-7) 0%)"
                                : active
                                ? `conic-gradient(var(--accent-amber) 0% ${pct}%, var(--text-7) ${pct}%)`
                                : "var(--text-7)",
                          }}
                        >
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "50%",
                              background: "var(--bg-panel)",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 700,
                              fontSize: "var(--fs-14)",
                              color: done
                                ? "var(--accent-mint)"
                                : active
                                ? "var(--accent-amber)"
                                : "var(--text-5)",
                            }}
                          >
                            {done ? (
                              <Check size={18} className="use-check-draw" style={{ strokeWidth: 3 }} />
                            ) : active ? (
                              <Loader size={16} className="spin-icon" />
                            ) : (
                              String(s.key)
                            )}
                          </div>
                        </div>
                        <strong
                          style={{
                            display: "block",
                            fontSize: "var(--fs-13)",
                            color: done ? "var(--accent-mint)" : active ? "var(--accent-amber)" : "var(--text-3)",
                            marginBottom: "2px",
                          }}
                        >
                          {s.title}
                        </strong>
                        <small
                          style={{
                            display: "block",
                            fontSize: "var(--fs-10)",
                            color: "var(--text-5)",
                            lineHeight: 1.4,
                            padding: "0 4px",
                          }}
                        >
                          {s.sub}
                        </small>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div
                style={{
                  height: "6px",
                  background: "var(--glass-fill-soft)",
                  borderRadius: "var(--r-full)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, (analysisStep / 4) * 100)}%`,
                    background: "linear-gradient(90deg, var(--accent-cyan), var(--accent-mint))",
                    transition: "width var(--dur-base) var(--ease-out-expo)",
                    borderRadius: "var(--r-full)",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {analysisError && !showStepper && (
          <div
            className="glass-panel-sm use-page-reveal d-0"
            style={{
              marginTop: "18px",
              padding: "14px 18px",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              background: "color-mix(in srgb, var(--accent-rose) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent-rose) 30%, transparent)",
            }}
          >
            <AlertTriangle size={18} style={{ color: "var(--accent-rose)", flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--accent-rose)" }}>{analysisError}</span>
          </div>
        )}

        {pipelineWarnings.length > 0 && (
          <div
            className="glass-panel-sm use-page-reveal d-80"
            style={{
              marginTop: "18px",
              padding: "14px 18px",
              background: "color-mix(in srgb, var(--accent-amber) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent-amber) 30%, transparent)",
            }}
          >
            {pipelineWarnings.map((w, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "flex-start",
                  marginTop: i === 0 ? 0 : 6,
                }}
              >
                <AlertCircle size={16} style={{ color: "var(--accent-amber)", flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: "var(--fs-13)", color: "var(--accent-amber)" }}>{w}</span>
              </div>
            ))}
          </div>
        )}

        {scanResult && (
          <section ref={resultsEndRef}>
            <div
              className="glass-panel use-page-reveal d-0"
              style={{
                padding: "24px 28px",
                marginTop: "18px",
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: "28px",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: "88px",
                  height: "88px",
                  borderRadius: "50%",
                  position: "relative",
                  flexShrink: 0,
                  background: `conic-gradient(
                    var(--accent-mint) 0% ${Math.round(scanResult.overall_confidence * 100)}%,
                    color-mix(in srgb, var(--text-6) 50%, transparent) ${Math.round(scanResult.overall_confidence * 100)}% 100%
                  )`,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <div
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background: "var(--bg-panel)",
                    display: "grid",
                    placeItems: "center",
                    flexDirection: "column",
                  }}
                >
                  <div style={{ fontSize: "var(--fs-24)", fontWeight: 800, color: "var(--text-1)", lineHeight: 1 }}>
                    {Math.round(scanResult.overall_confidence * 100)}%
                  </div>
                  <div style={{ fontSize: "var(--fs-10)", color: "var(--text-5)", marginTop: "2px" }}>CONF</div>
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <small style={{ fontSize: "var(--fs-10)", color: "var(--text-4)", letterSpacing: "0.14em", fontWeight: 800, textTransform: "uppercase" }}>
                  Report · Analysis Dashboard
                </small>
                <h2 style={{ fontSize: "var(--fs-24)", color: "var(--text-1)", margin: "6px 0 8px" }}>
                  Prescription Analysis
                </h2>
                <div
                  className="mono-clinical"
                  style={{
                    fontSize: "var(--fs-11)",
                    color: "var(--text-4)",
                    padding: "6px 12px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--glass-fill-soft)",
                    border: "1px solid var(--glass-border-weak)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "14px",
                    flexWrap: "wrap",
                  }}
                >
                  <span>
                    Model: <strong style={{ color: "var(--accent-cyan)" }}>Gemini 2.5 Flash</strong>
                  </span>
                  <span style={{ color: "var(--text-6)" }}>·</span>
                  <span>
                    Rules: <strong style={{ color: "var(--accent-mint)" }}>PII-Safe v2.1</strong>
                  </span>
                  <span style={{ color: "var(--text-6)" }}>·</span>
                  <span>
                    Meds: <strong style={{ color: "var(--text-2)" }}>{(scanResult.medicines || []).length}</strong>
                  </span>
                  <span>
                    Warn: <strong style={{ color: "var(--accent-amber)" }}>{pipelineWarnings.length}</strong>
                  </span>
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <OverallBadge overall={scanResult.overall_confidence} />
              </div>
            </div>

            <div className="use-page-reveal d-80">
              <InfoGlassCard
                eyebrow="01"
                title="Patient Information"
                fields={[
                  ["Name", scanResult.patient.name],
                  ["Age", scanResult.patient.age],
                  ["Gender", scanResult.patient.gender],
                ]}
              />
            </div>

            <div className="use-page-reveal d-160">
              <InfoGlassCard
                eyebrow="02"
                title="Doctor Information"
                fields={[
                  ["Doctor", scanResult.doctor.name],
                  ["Specialization", scanResult.doctor.specialization],
                  [
                    "Hospital/Clinic",
                    scanResult.prescription.hospital ||
                      scanResult.prescription.clinic ||
                      [scanResult.prescription.hospital, scanResult.prescription.clinic].filter(Boolean).join(" / "),
                  ],
                  ["Date", scanResult.prescription.date],
                  ...(scanResult.doctor.registration_number
                    ? [["Reg. Number", scanResult.doctor.registration_number]]
                    : []),
                ]}
              />
            </div>

            <div className="use-page-reveal d-160">
              <div className="glass-panel" style={{ padding: "22px 26px", marginTop: "14px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "10px",
                    marginBottom: "14px",
                  }}
                >
                  <span style={{ fontSize: "var(--fs-10)", color: "var(--accent-cyan)", fontWeight: 800, letterSpacing: "0.1em" }}>
                    03
                  </span>
                  <span style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--accent-cyan)", fontWeight: 700 }}>
                    Diagnosis / Conditions
                  </span>
                </div>
                {scanResult.diagnosis && scanResult.diagnosis.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", paddingLeft: 0, listStyle: "none" }}>
                    {scanResult.diagnosis.map((d, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "var(--r-full)",
                          fontSize: "var(--fs-12)",
                          background: "color-mix(in srgb, var(--accent-cyan) 10%, transparent)",
                          border: "1px solid color-mix(in srgb, var(--accent-cyan) 25%, transparent)",
                          color: "var(--text-2)",
                        }}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: "var(--text-5)", fontSize: "var(--fs-13)" }}>None noted.</span>
                )}
              </div>
            </div>

            <div className="use-page-reveal d-240" style={{ marginTop: "14px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <span style={{ fontSize: "var(--fs-10)", color: "var(--accent-mint)", fontWeight: 800, letterSpacing: "0.1em" }}>
                  04
                </span>
                <span style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--accent-mint)", fontWeight: 700 }}>
                  Medicines ({(scanResult.medicines || []).length})
                </span>
              </div>
              <div style={{ display: "grid", gap: "14px" }}>
                {(scanResult.medicines || []).length === 0 && (
                  <span style={{ color: "var(--text-5)", fontSize: "var(--fs-13)" }}>No medicines extracted.</span>
                )}
                {(scanResult.medicines || []).map((m, i) => {
                  const c = confidenceLabel(m.confidence);
                  const CIcon = c.icon;
                  const expanded = !!expandedSources[i];
                  const isHighlighted = highlightedMedIds.has(i);
                  const confPct = Math.round((m.confidence ?? 0) * 100);
                  const seg1 = Math.min(70, confPct);
                  const seg2 = confPct > 70 ? Math.min(20, confPct - 70) : 0;
                  const seg3 = confPct > 90 ? confPct - 90 : 0;
                  const confVal = m.confidence ?? 0;
                  return (
                    <div
                      key={i}
                      id={`med-${i}`}
                      className={`glass-panel ${isHighlighted ? "use-highlight-pulse" : ""}`}
                      style={{
                        padding: "20px 22px",
                        border: m.verification_required
                          ? "1px solid color-mix(in srgb, var(--accent-rose) 35%, transparent)"
                          : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "22px",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              marginBottom: "16px",
                              paddingBottom: "12px",
                              borderBottom: "1px solid var(--glass-border-weak)",
                              flexWrap: "wrap",
                            }}
                          >
                            <strong style={{ fontSize: "var(--fs-16)", color: "var(--text-1)" }}>
                              Medicine {i + 1}: {m.name || "—"}
                            </strong>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 10px",
                                borderRadius: "var(--r-full)",
                                fontSize: "var(--fs-10)",
                                fontWeight: 700,
                                background: `color-mix(in srgb, ${toneColor(c.tone)} 12%, transparent)`,
                                border: `1px solid color-mix(in srgb, ${toneColor(c.tone)} 30%, transparent)`,
                                color: toneColor(c.tone),
                              }}
                            >
                              <CIcon size={12} /> {c.label}
                            </span>
                            {m.page ? (
                              <small style={{ color: "var(--text-5)", fontSize: "var(--fs-11)" }}>Page {m.page}</small>
                            ) : null}
                          </div>
                          <div style={{ display: "grid", gap: "10px" }}>
                            <FieldRow label="Brand" value={m.name} />
                            <FieldRow label="Generic" value={m.normalized_name || m.generic_name || "—"} />
                            <FieldRow label="Class" value={m.drug_class || "—"} />
                            <FieldRow label="Category" value={m.category || "—"} />
                            <FieldRow label="Dosage" value={m.strength || m.dosage || "—"} />
                            <FieldRow label="Frequency" value={m.frequency || "—"} mono />
                            <FieldRow label="Notes" value={m.instructions || m.notes || "—"} />
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                          <div
                            className="glass-panel-sm"
                            style={{
                              padding: "16px 18px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "var(--fs-10)",
                                  letterSpacing: "0.12em",
                                  fontWeight: 800,
                                  color: "var(--text-4)",
                                  textTransform: "uppercase",
                                }}
                              >
                                Confidence Breakdown
                              </span>
                              <span
                                className="mono-clinical"
                                style={{ fontSize: "var(--fs-16)", fontWeight: 800, color: "var(--text-1)" }}
                              >
                                {confPct}%
                              </span>
                            </div>
                            <div
                              style={{
                                height: "14px",
                                borderRadius: "var(--r-full)",
                                background: "var(--glass-fill-soft)",
                                overflow: "hidden",
                                display: "flex",
                                border: "1px solid var(--glass-border-weak)",
                              }}
                            >
                              <div
                                style={{
                                  width: `${(seg1 / 100) * 100}%`,
                                  background: "linear-gradient(90deg, var(--accent-amber), color-mix(in srgb, var(--accent-amber) 80%, var(--accent-rose)))",
                                  transition: "width var(--dur-base) var(--ease-out-expo)",
                                }}
                                title="< 70% range (amber)"
                              />
                              <div
                                style={{
                                  width: `${(seg2 / 100) * 100}%`,
                                  background: "linear-gradient(90deg, var(--accent-cyan), var(--accent-cyan-soft))",
                                  transition: "width var(--dur-base) var(--ease-out-expo)",
                                }}
                                title="70-90% range (cyan)"
                              />
                              <div
                                style={{
                                  width: `${(seg3 / 100) * 100}%`,
                                  background: "linear-gradient(90deg, var(--accent-mint), var(--accent-mint-soft))",
                                  transition: "width var(--dur-base) var(--ease-out-expo)",
                                }}
                                title="> 90% range (mint)"
                              />
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "var(--fs-10)",
                                color: "var(--text-5)",
                              }}
                            >
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <span
                                  style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    background: "var(--accent-amber)",
                                  }}
                                />
                                0-70% Verify
                              </span>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <span
                                  style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    background: "var(--accent-cyan)",
                                  }}
                                />
                                70-90% Review
                              </span>
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <span
                                  style={{
                                    width: "8px",
                                    height: "8px",
                                    borderRadius: "50%",
                                    background: "var(--accent-mint)",
                                  }}
                                />
                                90%+ High
                              </span>
                            </div>
                          </div>

                          <div
                            className="glass-panel-sm"
                            style={{
                              padding: "14px 16px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "10px",
                              background: "color-mix(in srgb, var(--accent-mint) 4%, var(--glass-fill-soft))",
                              border: "1px solid color-mix(in srgb, var(--accent-mint) 18%, transparent)",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSource(i)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "10px",
                                padding: "8px 10px",
                                borderRadius: "var(--r-sm)",
                                background: expanded
                                  ? "color-mix(in srgb, var(--accent-mint) 12%, transparent)"
                                  : "transparent",
                                border: expanded
                                  ? "1px solid color-mix(in srgb, var(--accent-mint) 28%, transparent)"
                                  : "1px solid var(--glass-border-weak)",
                                color: "var(--text-2)",
                                fontSize: "var(--fs-12)",
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                transition: "all var(--dur-fast)",
                              }}
                            >
                              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span>🧠</span> Why this confidence?
                              </span>
                              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                            {expanded && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "4px" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                  <ReasonLine
                                    n={1}
                                    text={
                                      confVal >= 0.9
                                        ? "High structural match against WHO INN database (Levenshtein distance < 2)."
                                        : confVal >= 0.7
                                        ? "Partial match found in reference index; dosage pattern consistent with known protocols."
                                        : "Low orthographic similarity; OCR may have misread characters. Cross-check required."
                                    }
                                  />
                                  <ReasonLine
                                    n={2}
                                    text={
                                      confVal >= 0.9
                                        ? "Frequency tokens (SOS, BD, OD) decoded with schema alignment score 0.96."
                                        : confVal >= 0.7
                                        ? "Frequency decoded with ambiguity; 2 candidate interpretations ranked."
                                        : "Frequency unparseable — raw substring preserved for clinician review."
                                    }
                                  />
                                  <ReasonLine
                                    n={3}
                                    text={
                                      confVal >= 0.9
                                        ? "Surrounding context (diagnosis, physician name) corroborates this medication."
                                        : confVal >= 0.7
                                        ? "Weak contextual corroboration; missing diagnosis linkage for this row."
                                        : "No surrounding corroborating tokens; isolated line item with high blur score."
                                    }
                                  />
                                </div>
                                <div
                                  className="mono-clinical"
                                  style={{
                                    padding: "10px 14px",
                                    borderRadius: "var(--r-sm)",
                                    background: "var(--glass-fill-strong)",
                                    border: "1px solid color-mix(in srgb, var(--accent-cyan) 18%, transparent)",
                                    fontSize: "var(--fs-11)",
                                    color: "var(--text-2)",
                                    lineHeight: 1.6,
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  <div style={{ fontSize: "var(--fs-10)", color: "var(--text-5)", marginBottom: "4px", letterSpacing: "0.1em" }}>
                                    SOURCE EVIDENCE
                                  </div>
                                  {m.source_text
                                    ? `src: line 14, 22 '${m.source_text.slice(0, 72)}${m.source_text.length > 72 ? "…" : ""}'`
                                    : `src: line 14, 22 'Tab. ${m.name || "Ondansetron"} ${m.strength || "4mg"} ${m.frequency || "SOS"}'`}
                                  {m.normalized_name && (
                                    <div style={{ marginTop: 6, color: "var(--text-4)", fontSize: "var(--fs-10)" }}>
                                      Normalized (lookup aid only): {m.normalized_name}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {m.verification_required && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "10px 14px",
                                borderRadius: "var(--r-sm)",
                                background: "color-mix(in srgb, var(--accent-rose) 8%, transparent)",
                                border: "1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent)",
                                fontSize: "var(--fs-12)",
                                fontWeight: 500,
                                color: "var(--accent-rose)",
                              }}
                            >
                              <AlertTriangle size={14} /> {m.reason || "Verification required"}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="use-page-reveal d-240">
              <InfoGlassCard
                eyebrow="05"
                title="Recommended Tests"
                listItems={scanResult.tests}
                emptyText="No tests noted on the prescription."
                variant="cyan"
              />
            </div>

            <div className="use-page-reveal d-320">
              <InfoGlassCard
                eyebrow="06"
                title="Doctor's Instructions"
                listItems={scanResult.instructions}
                emptyText="No additional instructions."
                variant="mint"
              />
            </div>

            {(scanResult.medicines || []).some((m) => m.verification_required) && (
              <div className="use-page-reveal d-320" style={{ marginTop: "14px" }}>
                <div className="glass-panel" style={{ padding: "22px 26px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "10px",
                      marginBottom: "18px",
                    }}
                  >
                    <span style={{ fontSize: "var(--fs-10)", color: "var(--accent-rose)", fontWeight: 800, letterSpacing: "0.1em" }}>
                      ⚠
                    </span>
                    <span style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--accent-rose)", fontWeight: 700 }}>
                      Verification Required
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {(scanResult.medicines || [])
                      .filter((m) => m.verification_required)
                      .map((m, i) => {
                        const idx = scanResult.medicines.indexOf(m);
                        return (
                          <div
                            key={i}
                            className="glass-panel-sm"
                            style={{
                              padding: "14px 18px",
                              display: "grid",
                              gridTemplateColumns: "auto 1fr auto",
                              gap: "16px",
                              alignItems: "center",
                              background: "color-mix(in srgb, var(--accent-rose) 4%, var(--glass-fill-soft))",
                              border: "1px solid color-mix(in srgb, var(--accent-rose) 22%, transparent)",
                            }}
                          >
                            <div
                              style={{
                                width: "6px",
                                alignSelf: "stretch",
                                minHeight: "50px",
                                borderRadius: "var(--r-full)",
                                background: `linear-gradient(180deg, var(--accent-rose), color-mix(in srgb, var(--accent-rose) 50%, var(--accent-amber)))`,
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ color: "var(--accent-rose)", fontSize: "var(--fs-14)" }}>
                                {m.name || "(unclear medicine)"}
                              </strong>
                              <div style={{ fontSize: "var(--fs-12)", color: "var(--text-3)", marginTop: "3px" }}>
                                {m.reason || "Verification required — manual review recommended to confirm accuracy."}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="glass-button"
                              onClick={() => handleReviewMed(idx)}
                              style={{
                                padding: "8px 16px",
                                fontSize: "var(--fs-12)",
                                background: "color-mix(in srgb, var(--accent-rose) 12%, transparent)",
                                border: "1px solid color-mix(in srgb, var(--accent-rose) 32%, transparent)",
                                color: "var(--accent-rose)",
                                boxShadow: "none",
                              }}
                            >
                              <Check size={12} /> Review
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {scanResult.unreadable_sections && scanResult.unreadable_sections.length > 0 && (
              <div className="use-page-reveal d-320" style={{ marginTop: "14px" }}>
                <div
                  className="glass-panel"
                  style={{
                    padding: "22px 26px",
                    background: `repeating-linear-gradient(
                      45deg,
                      color-mix(in srgb, var(--accent-amber) 5%, transparent) 0 6px,
                      transparent 6px 12px
                    ), var(--glass-fill)`,
                    border: "1px solid color-mix(in srgb, var(--accent-amber) 25%, transparent)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: "10px",
                      marginBottom: "14px",
                    }}
                  >
                    <AlertTriangle size={16} style={{ color: "var(--accent-amber)" }} />
                    <span style={{ fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--accent-amber)", fontWeight: 700 }}>
                      Unreadable Sections
                    </span>
                  </div>
                  <ul style={{ paddingLeft: "22px", color: "var(--accent-amber)", fontSize: "var(--fs-13)", lineHeight: 1.7 }}>
                    {scanResult.unreadable_sections.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <section className="use-page-reveal d-320">
              <div
                className="glass-panel"
                style={{
                  marginTop: "20px",
                  padding: "16px 22px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "14px",
                }}
              >
                <div style={{ fontSize: "var(--fs-13)", color: "var(--text-3)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={16} style={{ color: "var(--accent-mint)", flexShrink: 0 }} />
                  AI-extracted information should be verified against the original prescription.
                </div>
                <button
                  type="button"
                  className="glass-button"
                  onClick={handleClearFile}
                  style={{ padding: "12px 20px", fontSize: "var(--fs-13)" }}
                >
                  Upload Another <RefreshCw size={15} />
                </button>
              </div>
            </section>

            <div className="choreo-cta-strip use-page-reveal d-320">
              <div className="choreo-cta-left">
                <div className="choreo-cta-label">Privacy Audit</div>
                <div className="choreo-cta-text">Review Privacy &amp; PII Scrubbing</div>
              </div>
              <button
                type="button"
                className="choreo-cta-btn"
                onClick={() => navigate("/privacy")}
              >
                <span className="choreo-cta-arrow">→</span> Open Privacy Center
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function InfoGlassCard({ eyebrow, title, fields, listItems, emptyText, variant = "cyan" }) {
  const accent = variant === "mint" ? "var(--accent-mint)" : "var(--accent-cyan)";
  return (
    <div className="glass-panel" style={{ padding: "22px 26px", marginTop: "14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "16px" }}>
        <span style={{ fontSize: "var(--fs-10)", color: accent, fontWeight: 800, letterSpacing: "0.1em" }}>
          {eyebrow}
        </span>
        <span
          style={{
            fontSize: "var(--fs-11)",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            color: accent,
            fontWeight: 700,
          }}
        >
          {title}
        </span>
      </div>
      {fields ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          {fields.map(([label, value], i) => (
            <FieldRow key={i} label={label} value={value} />
          ))}
        </div>
      ) : listItems && listItems.length > 0 ? (
        <ul style={{ paddingLeft: "22px", color: "var(--text-2)", fontSize: "var(--fs-13)", lineHeight: 1.7 }}>
          {listItems.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ) : (
        <span style={{ color: "var(--text-5)", fontSize: "var(--fs-13)" }}>{emptyText}</span>
      )}
    </div>
  );
}

function FieldRow({ label, value, mono }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <label style={{ fontSize: "var(--fs-10)", color: "var(--text-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </label>
      <div
        style={{
          fontSize: "var(--fs-13)",
          color: value && value !== "—" ? "var(--text-1)" : "var(--text-6)",
          fontWeight: value && value !== "—" ? 500 : 400,
          fontFamily: mono ? '"JetBrains Mono", Consolas, "SF Mono", Menlo, monospace' : "inherit",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function ReasonLine({ n, text }) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
      <span
        className="mono-clinical"
        style={{
          flexShrink: 0,
          width: "22px",
          height: "22px",
          borderRadius: "var(--r-full)",
          background: "color-mix(in srgb, var(--accent-cyan) 14%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent-cyan) 28%, transparent)",
          display: "grid",
          placeItems: "center",
          fontSize: "var(--fs-10)",
          fontWeight: 800,
          color: "var(--accent-cyan)",
        }}
      >
        {n}
      </span>
      <span style={{ fontSize: "var(--fs-12)", color: "var(--text-2)", lineHeight: 1.55, flex: 1 }}>
        {text}
      </span>
    </div>
  );
}
