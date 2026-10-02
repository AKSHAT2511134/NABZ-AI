import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const DEFAULT_DOCTOR = {
  id: "dr-ananya",
  name: "Dr. Ananya Sharma",
  role: "doctor",
  email: "ananya.sharma@lucknowhealth.in",
  ward: "Aliganj Ward 3, Lucknow",
  facility: "Aliganj Community Health Center",
};

const DEFAULT_ADMIN = {
  id: "dr-rajesh",
  name: "Dr. Rajesh Verma",
  role: "admin",
  email: "rajesh.verma@cmo-lucknow.gov.in",
  ward: "City Health Directorate, Lucknow",
  facility: "District CMO Office, Lucknow",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("nabz_user");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_DOCTOR;
  });

  useEffect(() => {
    try {
      localStorage.setItem("nabz_user", JSON.stringify(user));
    } catch {
      // ignore
    }
  }, [user]);

  const login = (role, customData = {}) => {
    const base = role === "admin" ? DEFAULT_ADMIN : DEFAULT_DOCTOR;
    setUser({ ...base, ...customData, role });
  };

  const logout = () => {
    setUser(null);
  };

  const switchRole = (newRole) => {
    if (newRole === "admin") {
      setUser(DEFAULT_ADMIN);
    } else {
      setUser(DEFAULT_DOCTOR);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
