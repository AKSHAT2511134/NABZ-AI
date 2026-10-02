import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Shield, Stethoscope, Building2, KeyRound, Mail, ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [role, setRole] = useState("doctor");
  const [email, setEmail] = useState("ananya.sharma@lucknowhealth.in");
  const [password, setPassword] = useState("••••••••••••");
  const [ward, setWard] = useState("Aliganj Ward 3, Lucknow");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === "doctor") {
      setEmail("ananya.sharma@lucknowhealth.in");
      setWard("Aliganj Ward 3, Lucknow");
    } else {
      setEmail("rajesh.verma@cmo-lucknow.gov.in");
      setWard("City Health Directorate, Lucknow");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      login(role, {
        email,
        ward,
        name: role === "doctor" ? "Dr. Ananya Sharma" : "Dr. Rajesh Verma",
      });
      setIsSubmitting(false);
      if (role === "doctor") {
        navigate("/capture");
      } else {
        navigate(from === "/capture" ? "/" : from);
      }
    }, 400);
  };

  const handleQuickLogin = (selectedRole) => {
    login(selectedRole);
    if (selectedRole === "doctor") {
      navigate("/capture");
    } else {
      navigate("/");
    }
  };

  return (
    <div
      className="login-split-root use-page-reveal d-0"
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "55fr 45fr",
        position: "relative",
        zIndex: 1,
      }}
    >
      <style>{`
        @media (max-width: 650px) {
          .login-split-root {
            grid-template-columns: 1fr !important;
          }
          .login-left-pane {
            min-height: 42vh !important;
          }
        }
        .login-role-card[aria-pressed="true"] {
          box-shadow: 0 8px 40px -8px var(--sh-halo-cyan), 0 0 0 1px var(--accent-cyan) inset;
          border-color: var(--accent-cyan);
        }
        .login-role-card[aria-pressed="true"] .role-icon-wrap {
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-mint));
          color: var(--accent-ink);
        }
        .login-submit-gradient {
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-cyan-deep) 60%, var(--accent-mint));
          color: var(--accent-ink);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 40px -8px rgba(67,203,210,0.5);
          border: 1px solid rgba(67,203,210,0.55);
        }
        .login-submit-gradient:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .wordmark-gradient {
          background: linear-gradient(135deg, var(--accent-cyan), var(--accent-mint) 55%, var(--accent-mint-soft));
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .ai-superscript {
          color: var(--accent-mint);
        }
        .mini-radar {
          position: absolute;
          left: 20%;
          bottom: 20%;
          width: 120px;
          height: 120px;
        }
        .mini-radar-center {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent-cyan);
          box-shadow: 0 0 12px var(--accent-cyan);
        }
        .mini-radar-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(67,203,210,0.25);
        }
        .mini-radar-ring.r1 { inset: 30px; }
        .mini-radar-ring.r2 { inset: 18px; }
        .mini-radar-ring.r3 { inset: 6px; }
        .mini-radar-sweep {
          position: absolute;
          inset: 6px;
          border-radius: 50%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 280deg,
            rgba(61,220,151,0.55) 340deg,
            rgba(67,203,210,0.8) 360deg
          );
          mask: radial-gradient(circle, transparent 0%, transparent 40%, black 42%, black 100%);
          -webkit-mask: radial-gradient(circle, transparent 0%, transparent 40%, black 42%, black 100%);
        }
        .claim-badge-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          flex-shrink: 0;
        }
        .claim-shield {
          background: linear-gradient(135deg, rgba(67,203,210,0.14), rgba(61,220,151,0.10));
          border: 1px solid rgba(61,220,151,0.28);
          color: var(--accent-mint);
        }
        .claim-check {
          background: linear-gradient(135deg, rgba(61,220,151,0.14), rgba(67,203,210,0.10));
          border: 1px solid rgba(67,203,210,0.28);
          color: var(--accent-cyan);
        }
        .claim-map {
          background: linear-gradient(135deg, rgba(255,178,90,0.12), rgba(61,220,151,0.08));
          border: 1px solid rgba(255,178,90,0.28);
          color: var(--accent-amber);
        }
      `}</style>

      {/* LEFT PANE (55%) — Cinematic Brand */}
      <div
        className="login-left-pane"
        style={{
          position: "relative",
          minHeight: "100vh",
          padding: "56px 52px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
          background:
            "radial-gradient(ellipse at 18% 14%, rgba(67,203,210,0.18) 0, transparent 52%), radial-gradient(ellipse at 82% 86%, rgba(61,220,151,0.14) 0, transparent 48%), radial-gradient(circle at 50% 50%, var(--bg-raised) 0%, var(--bg-base) 100%)",
        }}
      >
        <img
          src="/nabz-logo.jpg"
          alt=""
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80%",
            maxWidth: "600px",
            opacity: 0.15,
            pointerEvents: "none",
            zIndex: 1,
            borderRadius: "50%",
            aspectRatio: "1/1",
            objectFit: "cover",
            maskImage: "radial-gradient(circle, black 65%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle, black 65%, transparent 70%)"
          }}
        />
        <div className="d-80 use-page-reveal" style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 14 }}>
            <img
              src="/nabz-logo.jpg"
              alt="NABZ AI Logo"
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid rgba(67,203,210,0.5)",
                boxShadow: "0 0 20px rgba(67,203,210,0.35)",
                background: "#ffffff",
                flexShrink: 0,
              }}
            />
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="t-64 wordmark-gradient" style={{ fontWeight: 900 }}>
                NABZ
              </span>
              <span className="t-44 ai-superscript" style={{ fontWeight: 800 }}>
                AI
              </span>
            </div>
          </div>
          <p className="t-18" style={{ color: "var(--text-2)", marginTop: 4, maxWidth: 520 }}>
            AI Early Signal Radar for Public Health Surveillance
          </p>
        </div>

        <div className="d-160 use-page-reveal" style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", gap: 14, maxWidth: 460 }}>
          <div className="glass-panel-sm" style={{ padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div className="claim-badge-icon claim-shield">
              <Shield size={18} />
            </div>
            <div>
              <div className="t-14" style={{ color: "var(--text-1)", fontWeight: 700 }}>
                Zero-PII Scrubbing
              </div>
              <p className="t-12" style={{ color: "var(--text-4)", marginTop: 3 }}>
                Names, phone, Aadhaar — redacted on-device before any signal leaves the terminal.
              </p>
            </div>
          </div>

          <div className="glass-panel-sm" style={{ padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div className="claim-badge-icon claim-check">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div className="t-14" style={{ color: "var(--text-1)", fontWeight: 700 }}>
                DPDP 2023 Compliant
              </div>
              <p className="t-12" style={{ color: "var(--text-4)", marginTop: 3 }}>
                Audit-ready federated pipeline — data residency, consent trail, purpose-limited.
              </p>
            </div>
          </div>

          <div className="glass-panel-sm" style={{ padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div className="claim-badge-icon claim-map">
              <MapPin size={18} />
            </div>
            <div>
              <div className="t-14" style={{ color: "var(--text-1)", fontWeight: 700 }}>
                Lucknow Wards Ready
              </div>
              <p className="t-12" style={{ color: "var(--text-4)", marginTop: 3 }}>
                110 municipal wards mapped — geocoded outbreak clusters down to the clinic block.
              </p>
            </div>
          </div>
        </div>

        <div className="d-240 use-page-reveal" style={{ position: "relative", zIndex: 2 }}>
          <span className="mono-clinical t-11" style={{ color: "var(--text-5)", letterSpacing: "0.06em" }}>
            v2.1 · Synthetic Demo Build · SIH 2026
          </span>
        </div>

        {/* Mini Radar — bottom-left 20% */}
        <div className="mini-radar" aria-hidden="true">
          <div className="mini-radar-ring r3" />
          <div className="mini-radar-ring r2" />
          <div className="mini-radar-ring r1" />
          <div className="mini-radar-sweep use-radar-sweep-fast" />
          <div className="mini-radar-center" />
        </div>
      </div>

      {/* RIGHT PANE (45%) — Login Card Stack */}
      <div
        className="login-right-pane"
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
          zIndex: 1,
        }}
      >
        <div
          className="glass-panel-lg d-80 use-page-reveal"
          style={{ width: "100%", maxWidth: 440, padding: "32px 28px" }}
        >
          {/* Header */}
          <div className="d-0" style={{ marginBottom: 22 }}>
            <h1 className="t-24" style={{ color: "var(--text-1)", fontWeight: 800 }}>
              Welcome Back
            </h1>
            <p className="t-13" style={{ color: "var(--text-4)", marginTop: 4 }}>
              Authenticate to your assigned terminal
            </p>
          </div>

          {/* Role Cards */}
          <div className="d-80" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <button
              type="button"
              className="login-role-card glass-panel-sm"
              aria-pressed={role === "doctor"}
              onClick={() => handleRoleChange("doctor")}
              style={{
                padding: "14px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 10,
                textAlign: "left",
                cursor: "pointer",
                transition: "all var(--dur-base) var(--ease-out-expo)",
              }}
            >
              <div
                className="role-icon-wrap"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(10,23,36,0.6)",
                  border: "1px solid var(--glass-border-weak)",
                  color: role === "doctor" ? "var(--accent-ink)" : "var(--accent-cyan)",
                  transition: "all var(--dur-base)",
                }}
              >
                <Stethoscope size={17} />
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div className="t-13" style={{ color: "var(--text-1)", fontWeight: 700 }}>
                  Doctor / Clinic
                </div>
                <div className="t-11" style={{ color: "var(--text-5)", marginTop: 3 }}>
                  Prescription Signal Capture
                </div>
              </div>
            </button>

            <button
              type="button"
              className="login-role-card glass-panel-sm"
              aria-pressed={role === "admin"}
              onClick={() => handleRoleChange("admin")}
              style={{
                padding: "14px 12px",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 10,
                textAlign: "left",
                cursor: "pointer",
                transition: "all var(--dur-base) var(--ease-out-expo)",
              }}
            >
              <div
                className="role-icon-wrap"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: "grid",
                  placeItems: "center",
                  background: "rgba(10,23,36,0.6)",
                  border: "1px solid var(--glass-border-weak)",
                  color: role === "admin" ? "var(--accent-ink)" : "var(--accent-mint)",
                  transition: "all var(--dur-base)",
                }}
              >
                <Building2 size={17} />
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div className="t-13" style={{ color: "var(--text-1)", fontWeight: 700 }}>
                  Health Official
                </div>
                <div className="t-11" style={{ color: "var(--text-5)", marginTop: 3 }}>
                  City Radar &amp; Alert Response
                </div>
              </div>
            </button>
          </div>

          {/* Quick 1-click Login */}
          <div className="d-160" style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            <button
              type="button"
              className="glass-button"
              onClick={() => handleQuickLogin("doctor")}
              style={{ flex: "1 1 auto", fontSize: 11, padding: "9px 12px" }}
            >
              Doctor (Aliganj Ward 3)
            </button>
            <button
              type="button"
              className="glass-button"
              onClick={() => handleQuickLogin("admin")}
              style={{
                flex: "1 1 auto",
                fontSize: 11,
                padding: "9px 12px",
                background: "linear-gradient(180deg, var(--accent-amber), var(--accent-amber-deep))",
                borderColor: "rgba(255,178,90,0.55)",
              }}
            >
              CMO Admin (Lucknow)
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="d-160" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="t-12" style={{ color: "var(--text-3)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <Mail size={13} /> Official Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="glass-input t-13"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="t-12" style={{ color: "var(--text-3)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <KeyRound size={13} /> Security Credential / PIN
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="glass-input t-13"
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="t-12" style={{ color: "var(--text-3)", fontWeight: 600 }}>
                Assigned Jurisdiction
              </label>
              <input
                type="text"
                value={ward}
                readOnly
                className="glass-input t-13"
                style={{ color: "var(--text-4)", cursor: "not-allowed" }}
              />
            </div>

            <button
              type="submit"
              className="login-submit-gradient d-240"
              disabled={isSubmitting}
              style={{
                marginTop: 6,
                padding: "13px 18px",
                borderRadius: "var(--r-sm)",
                fontWeight: 800,
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "inherit",
                transition: "all var(--dur-fast)",
              }}
            >
              {isSubmitting ? (
                "Authenticating Terminal…"
              ) : (
                <>
                  Sign In as {role === "doctor" ? "Medical Officer" : "City Health Admin"}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Guest / Demo Bypass */}
          <div className="d-240 use-page-reveal" style={{ marginTop: 18, textAlign: "center" }}>
            <button
              type="button"
              onClick={() => {
                login("doctor");
                navigate("/");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-4)",
                fontSize: 12,
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                cursor: "pointer",
                padding: "6px 10px",
                borderRadius: "var(--r-sm)",
                transition: "color var(--dur-fast), background var(--dur-fast)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--accent-cyan)";
                e.currentTarget.style.background = "rgba(67,203,210,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-4)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              Proceed as guest — demo mode <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
