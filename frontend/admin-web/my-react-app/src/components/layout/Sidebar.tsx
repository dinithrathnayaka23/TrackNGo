import { NavLink } from "react-router-dom";
import {
  FiGrid,
  FiUsers,
  FiMapPin,
  FiCreditCard,
  FiAlertTriangle,
  FiBarChart2,
  FiMessageCircle,
} from "react-icons/fi";
import { FaBus } from "react-icons/fa";

const mainMenu = [
  { label: "Dashboard", to: "/dashboard", icon: FiGrid },
  { label: "Users", to: "/users", icon: FiUsers },
  { label: "Buses", to: "/buses", icon: FaBus },
  { label: "Routes", to: "/routes", icon: FiMapPin },
  { label: "Bookings", to: "/bookings", icon: FiCreditCard },
];

const systemMenu = [
  { label: "Complaints", to: "/complaints", icon: FiAlertTriangle },
  { label: "Analytics", to: "/analytics", icon: FiBarChart2 },
  { label: "Chat", to: "/chat", icon: FiMessageCircle },
];

const linkBase =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition";

function Sidebar() {
  return (
    <aside className="flex w-64 flex-col border-r border-slate-800/40 bg-[#1d263a] text-white">
      <div className="flex items-center gap-3 px-6 py-5 text-lg font-semibold">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2e4ba6] text-white shadow-sm">
          <FaBus />
        </div>
        TrackNGo
      </div>

      <div className="flex-1 px-4">
        <p className="mb-3 mt-4 text-xs font-semibold uppercase tracking-wide text-white/60">
          Main Menu
        </p>
        <div className="space-y-1">
          {mainMenu.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `${linkBase} ${
                  isActive
                    ? "bg-[#2c3f7a] text-white"
                    : "text-white/80 hover:bg-[#2c3f7a]"
                }`
              }
            >
              <item.icon className="text-base" />
              {item.label}
            </NavLink>
          ))}
        </div>

        <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-white/60">
          System
        </p>
        <div className="space-y-1">
          {systemMenu.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `${linkBase} ${
                  isActive
                    ? "bg-[#2c3f7a] text-white"
                    : "text-white/80 hover:bg-[#2c3f7a]"
                }`
              }
            >
              <item.icon className="text-base" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>

      <div className="m-4 rounded-xl bg-white/10 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f1f3f9] text-sm font-semibold text-[#1d263a]">
            DR
          </div>
          <div>
            <p className="text-sm font-semibold">Dinith Rathnayaka</p>
            <p className="text-xs text-white/70">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
