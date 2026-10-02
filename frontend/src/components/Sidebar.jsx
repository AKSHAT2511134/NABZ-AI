import { NavLink, Link } from "react-router-dom";
import {
  LayoutDashboard,
  ScanLine,
  ShieldCheck,
  FileSearch,
  Activity,
  Map,
  Bell,
  LogIn,
  User,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

// Canonical demo path order (Dashboard → Capture → Scanner → Privacy → Signals → Alert → Map)
const menuItems = [
  { step: "01", name: "Dashboard",            path: "/",         Icon: LayoutDashboard, end: true },
  { step: "02", name: "Record Capture",       path: "/capture",  Icon: ScanLine },
  { step: "03", name: "Prescription Scanner", path: "/scanner",  Icon: FileSearch },
  { step: "04", name: "Privacy Review",       path: "/privacy",  Icon: ShieldCheck },
  { step: "05", name: "Signal Detection",     path: "/signals",  Icon: Activity },
  { step: "06", name: "Explainable Alert",    path: "/alerts/1", Icon: Bell },
  { step: "07", name: "Lucknow Health Map",   path: "/map",      Icon: Map },
];

function Sidebar() {
  const { user, switchRole } = useAuth();

  return (
    <aside className="sidebar glass-sidebar">
      <Link to="/" className="logo" style={{ textDecoration: "none", color: "inherit" }}>
        <img
          src="/nabz-logo.jpg"
          alt="NABZ AI Logo"
          className="logo-img"
        />

        <div>
          <h2>
            NABZ<span>AI</span>
          </h2>
          <p>HEALTH SIGNAL RADAR</p>
        </div>
      </Link>

      {/* User profile capsule in sidebar */}
      <div className="sidebar-user-capsule">
        <div className="user-capsule-top">
          <div className="user-avatar-mini">
            <User size={13} />
          </div>
          <div className="user-capsule-meta">
            <strong>{user?.name || "Dr. Ananya Sharma"}</strong>
            <span className={`role-badge ${user?.role || "doctor"}`}>
              {user?.role === "admin" ? "Health Official" : "Doctor"}
            </span>
          </div>
        </div>

        <div className="user-capsule-actions">
          <button
            type="button"
            className="switch-role-btn"
            title="Switch demo role"
            onClick={() => switchRole(user?.role === "admin" ? "doctor" : "admin")}
          >
            <RefreshCw size={11} /> {user?.role === "admin" ? "Switch to Doctor" : "Switch to Admin"}
          </button>
          <Link to="/login" className="login-link-btn" title="Go to login portal">
            <LogIn size={11} />
          </Link>
        </div>
      </div>

      <div className="menu-title">DEMO PATH · LIVE</div>

      <nav>
        {menuItems.map(({ step, name, path, Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            className={({ isActive }) =>
              isActive ? "menu-item active" : "menu-item"
            }
          >
            <span className="menu-step">{step}</span>
            <Icon
              size={14}
              style={{ marginRight: 8, verticalAlign: "middle", flexShrink: 0 }}
            />
            {name}
            <ChevronRight size={12} className="menu-chevron" />
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="online">
          <span className="online-dot"></span>
          System Online <span className="live-pill">LIVE</span>
        </div>

        <small>Synthetic demo environment</small>
      </div>
    </aside>
  );
}

export default Sidebar;