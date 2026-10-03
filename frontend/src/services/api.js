/**
 * services/api.js — NABZ AI Frontend API Service
 * Connects React UI to FastAPI backend with graceful fallback.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

/* ── LOCAL STORAGE KEY HELPERS ── */
export function getStoredMedicalAiKey() {
  return localStorage.getItem("nabz_medical_ai_key") || "";
}

export function getStoredMedicalAiProvider() {
  return localStorage.getItem("nabz_medical_ai_provider") || "gemini";
}

export function setStoredMedicalAiConfig(apiKey, provider = "gemini") {
  if (apiKey) {
    localStorage.setItem("nabz_medical_ai_key", apiKey.trim());
  } else {
    localStorage.removeItem("nabz_medical_ai_key");
  }
  localStorage.setItem("nabz_medical_ai_provider", provider);
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    ...options.headers,
  };

  // Auto attach medical AI key header if available
  const storedKey = getStoredMedicalAiKey();
  if (storedKey && !headers["X-Medical-AI-Key"]) {
    headers["X-Medical-AI-Key"] = storedKey;
  }

  // Only set application/json if body is not FormData
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP Error ${res.status}`);
    }

    const json = await res.json();
    return json;
  } catch (err) {
    console.warn(`NABZ API [${endpoint}] unavailable, using fallback:`, err.message);
    throw err;
  }
}

/* ── AUTH ── */
export async function apiLogin(email, password, role) {
  try {
    return await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });
  } catch (e) {
    return null;
  }
}

/* ── MEDICAL AI KEY VERIFICATION ── */
export async function apiVerifyMedicalAiKey(apiKey, provider = "gemini") {
  return await request("/prescriptions/verify-key", {
    method: "POST",
    body: JSON.stringify({ api_key: apiKey, provider }),
  });
}

/* ── PRESCRIPTION ANALYSIS & PRIVACY REDACTION ── */
export async function apiAnalyzePrescription({
  rawText,
  mode,
  symptoms,
  medicines,
  ward,
  facility,
  file,
  extractedText,
  apiKey,
  provider,
}) {
  const activeKey = apiKey || getStoredMedicalAiKey();
  const activeProvider = provider || getStoredMedicalAiProvider();

  if (file) {
    const formData = new FormData();
    formData.append("file", file);
    if (extractedText || rawText) {
      formData.append("extracted_text", extractedText || rawText);
    }
    formData.append("ward", ward || "Aliganj Ward 3, Lucknow");
    formData.append("facility", facility || "Aliganj Community Health Center");
    if (activeKey) {
      formData.append("api_key", activeKey);
      formData.append("provider", activeProvider);
    }
    return await request("/prescriptions/upload", {
      method: "POST",
      body: formData,
    });
  }

  return await request("/prescriptions/analyze", {
    method: "POST",
    body: JSON.stringify({
      rawText,
      mode: mode || "upload",
      symptoms,
      medicines,
      ward,
      facility,
    }),
  });
}

/* ── ANONYMOUS SIGNAL TRANSMISSION ── */
export async function apiConfirmPrescription(payload) {
  return await request("/prescriptions/confirm", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ── DASHBOARD SUMMARY ── */
export async function apiGetDashboardSummary() {
  return await request("/dashboard/summary");
}

/* ── WARDS & HEALTH MAP SIGNALS ── */
export async function apiGetWardSignals(category = null) {
  const query = category && category !== "All" ? `?category=${encodeURIComponent(category)}` : "";
  return await request(`/wards/signals${query}`);
}

/* ── EXPLAINABLE ALERTS & HUMAN REVIEW ── */
export async function apiGetAlerts() {
  return await request("/alerts");
}

export async function apiGetAlert(alertId) {
  return await request(`/alerts/${alertId}`);
}

export async function apiReviewAlert(alertId, status, notes = "") {
  return await request(`/alerts/${alertId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, notes, reviewed_by: "District Health Officer" }),
  });
}

export async function apiScanPrescription(file, apiKey, provider) {
  const formData = new FormData();
  formData.append("prescription", file);
  if (apiKey) {
    formData.append("api_key", apiKey);
  }
  if (provider) {
    formData.append("provider", provider);
  }
  return await request("/prescriptions/scan", {
    method: "POST",
    body: formData,
  });
}
