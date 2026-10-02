import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import Dashboard from "./pages/Dashboard";
import Capture from "./pages/Capture";
import PrivacyReview from "./pages/PrivacyReview";
import PrescriptionScanner from "./pages/PrescriptionScanner";
import SignalDetection from "./pages/SignalDetection";
import HealthMap from "./pages/HealthMap";
import AlertDetails from "./pages/AlertDetails";
import Login from "./pages/Login";

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/capture" element={<Capture />} />
        <Route path="/privacy" element={<PrivacyReview />} />
        <Route path="/scanner" element={<PrescriptionScanner />} />
        <Route path="/signals" element={<SignalDetection />} />
        <Route path="/map" element={<HealthMap />} />
        <Route path="/alerts/:alertId" element={<AlertDetails />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;