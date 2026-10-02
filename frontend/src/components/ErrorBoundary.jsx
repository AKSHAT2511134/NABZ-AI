/**
 * ErrorBoundary.jsx — Global crash guard for NABZ AI
 *
 * Wraps the entire app. If any component throws an unhandled error
 * the user sees a styled recovery screen instead of a blank white page.
 */

import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[NABZ ErrorBoundary]", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    // Navigate to root so component re-mounts cleanly
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message || "Unknown error";

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-base, #050d15)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          fontFamily: "'Inter', sans-serif",
          padding: "32px",
          textAlign: "center",
        }}
      >
        {/* Animated icon */}
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            background: "rgba(255,80,80,0.12)",
            border: "1.5px solid rgba(255,80,80,0.35)",
            display: "grid",
            placeItems: "center",
            fontSize: "32px",
            animation: "nabz-error-pop 0.4s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          ⚡
        </div>

        <div>
          <h1
            style={{
              color: "#f8fafc",
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              color: "rgba(148,163,184,0.8)",
              fontSize: "13px",
              margin: "0 0 4px",
              maxWidth: "460px",
            }}
          >
            NABZ AI encountered an unexpected error. Your data is safe.
          </p>
          <code
            style={{
              display: "inline-block",
              marginTop: "10px",
              background: "rgba(255,80,80,0.08)",
              border: "1px solid rgba(255,80,80,0.2)",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "11px",
              color: "#f87171",
              maxWidth: "500px",
              wordBreak: "break-word",
            }}
          >
            {msg}
          </code>
        </div>

        <button
          onClick={this.handleReset}
          style={{
            marginTop: "8px",
            padding: "10px 28px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, #0ea5e9, #06b6d4)",
            border: "none",
            color: "#fff",
            fontWeight: "700",
            fontSize: "13px",
            cursor: "pointer",
            letterSpacing: "0.02em",
            boxShadow: "0 4px 20px rgba(14,165,233,0.35)",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => (e.target.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.target.style.opacity = "1")}
        >
          ↩ Return to Dashboard
        </button>

        <style>{`
          @keyframes nabz-error-pop {
            from { transform: scale(0.6); opacity: 0; }
            to   { transform: scale(1);   opacity: 1; }
          }
        `}</style>
      </div>
    );
  }
}
