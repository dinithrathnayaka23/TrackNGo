import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faBell,
  faMagnifyingGlass,
  faSignOutAlt,
} from "@fortawesome/free-solid-svg-icons";
import Sidebar from "./Sidebar";
import SosAlertPopup from "../SosAlertPopup";

type DashboardLayoutProps = {
  children: ReactNode;
};

function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const segment = location.pathname.split("/")[2] || "dashboard";
  const labelBySegment: Record<string, string> = {
    dashboard: "Dashboard",
    analytics: "Analytics",
    chat: "Chat",
    users: "Users",
    passenger: "Passenger",
    driver: "Driver",
    corporate: "Corporate",
    buses: "Buses",
    booking: "Bookings",
    complaints: "Complaints",
    routes: "Routes",
    settings: "Settings",
  };
  const subSegment = location.pathname.split("/")[3] || "";
  const breadcrumbTrail =
    segment === "passenger" || segment === "driver"
      ? ["Users", labelBySegment[segment] ?? "Dashboard"]
      : segment === "corporate" && subSegment
        ? ["Users", "Corporate", "Details"]
        : segment === "corporate"
          ? ["Users", "Corporate"]
          : segment === "users" && subSegment === "corporate-users"
            ? ["Users", "Corporate Users"]
            : segment === "buses" && subSegment
              ? ["Buses", "Bus Details"]
              : [labelBySegment[segment] ?? "Dashboard"];

  return (
    <div className="min-h-screen bg-[#f3f4f8] text-[#111827]">
      <div className="flex w-full">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />

        <div className="min-h-screen flex-1 min-w-0">
          <header
            className="animate-dash-in z-10 flex h-16 shrink-0 items-center justify-between border-b border-[#dfe1e8] bg-[#f7f7fa] px-6"
            style={{ animationDelay: "40ms" }}
          >
            <div className="flex flex-nowrap items-center gap-3 text-sm text-[#6a7284] whitespace-nowrap">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="mr-1 grid h-9 w-9 place-items-center rounded-lg text-[#374151] hover:bg-[#eef2ff] lg:hidden"
              >
                <FontAwesomeIcon icon={faBars} />
              </button>
              {["Home", ...breadcrumbTrail].map((crumb, index, arr) => {
                const isLast = index === arr.length - 1;
                return (
                  <div
                    key={`${crumb}-${index}`}
                    className="flex items-center gap-3"
                  >
                    <span
                      className={
                        isLast
                          ? "whitespace-nowrap font-bold text-[#2b3448]"
                          : "whitespace-nowrap"
                      }
                    >
                      {crumb}
                    </span>
                    {!isLast ? <span>{">"}</span> : null}
                  </div>
                );
              })}
            </div>

            <div className="w-full max-w-[560px] px-6">
              <div className="flex h-12 items-center gap-3 rounded-xl bg-[#eef0f5] px-4 text-[#7d8798]">
                <FontAwesomeIcon icon={faMagnifyingGlass} />
                <input
                  type="text"
                  placeholder="Search buses, drivers, or routes..."
                  className="w-full bg-transparent text-sm text-[#2f394d] outline-none"
                />
              </div>
            </div>

            <div className="relative flex items-center gap-8">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-1.5 text-xs font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#203b96]"
              >
                <FontAwesomeIcon icon={faSignOutAlt} />
                Logout
              </button>
              <button
                type="button"
                className="relative text-sm text-[#3b4253] transition duration-200 hover:scale-105"
                aria-label="Notifications"
              >
                <FontAwesomeIcon icon={faBell} />
              </button>
            </div>
          </header>

          <main className="p-5">{children}</main>
        </div>
      </div>
      <SosAlertPopup />
    </div>
  );
}

export default DashboardLayout;
