import { useEffect, useState } from "react";
import { Radio, Clock3, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function useIstClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function TopBar({
  eyebrow = "CITY HEALTH MONITORING",
  title = "Lucknow / Overview",
  children,
  showLive = true,
}) {
  const { user } = useAuth();
  const now = useIstClock();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  const displayName = user?.name || "Dr. Ananya Sharma";
  const displayWard = user?.ward || "Aliganj CHC";
  const shortWard = displayWard.split(",")[0].split(" Ward")[0].trim();

  return (
    <header className="topbar glass-topbar">
      <div>
        <small>{eyebrow}</small>
        <h1>{title}</h1>
      </div>

      <div className="topbar-right">
        {children}
        <div className="user-capsule-topbar" title={`${displayName} · ${displayWard}`}>
          <div className="user-avatar-mini">
            <User size={12} />
          </div>
          <div className="user-capsule-topbar-meta">
            <strong>{displayName}</strong>
            <small>{shortWard}</small>
          </div>
        </div>
        <div className="live-clock" title="Local IST time">
          <Clock3 size={13} />
          <span className="mono-clinical">{hh}:{mm}:<b>{ss}</b></span>
          <small>{WEEKDAYS[now.getDay()]}&nbsp;{MONTHS[now.getMonth()]} {now.getDate()}</small>
        </div>
        {showLive && (
          <div className="demo-badge live-badge">
            <Radio size={11} />
            <span className="live-dot"></span>
            LIVE · SYNTHETIC DEMO
          </div>
        )}
      </div>
    </header>
  );
}

export default TopBar;