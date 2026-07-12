import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faBell,
  faMagnifyingGlass,
  faSignOutAlt,
} from "@fortawesome/free-solid-svg-icons";
import Sidebar from "./Sidebar";
import SosAlertPopup from "../SosAlertPopup";
import AdminNotificationsPanel from "../AdminNotificationsPanel";
import { logoutToLogin } from "../../utils/authSession";
import { fetchAdminNotifications } from "../../services/adminNotificationService";

type DashboardLayoutProps = {
  children: ReactNode;
};

const SUPPORT_ADMIN_ID = Number(
  import.meta.env.VITE_ADMIN_SUPPORT_USER_ID ?? "1",
);
const ADMIN_FORCE_OFFLINE_EVENT = "trackngo:admin-force-offline";
const OFFLINE_SOCKET_CLOSE_DELAY_MS = 120;

function getBackendOrigin() {
  const configured = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (configured) return configured.replace(/\/$/, "");
  if (window.location.port && window.location.port !== "8080") {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  return window.location.origin;
}

function getWsUrl() {
  const explicit = String(import.meta.env.VITE_CHAT_WS_URL ?? "").trim();
  if (explicit) return explicit;
  const origin = getBackendOrigin().replace(/^http/i, "ws");
  return `${origin}/ws/chat`;
}

function GlobalAdminPresence() {
  useEffect(() => {
    const socket = new WebSocket(getWsUrl());
    let closing = false;

    const sendPresence = (online: boolean) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          action: "PRESENCE",
          data: { userId: SUPPORT_ADMIN_ID, online },
        }),
      );
    };

    const goOffline = () => {
      if (closing) return;
      closing = true;
      sendPresence(false);
      window.setTimeout(() => {
        if (
          socket.readyState !== WebSocket.CLOSING &&
          socket.readyState !== WebSocket.CLOSED
        ) {
          socket.close();
        }
      }, OFFLINE_SOCKET_CLOSE_DELAY_MS);
    };

    socket.onopen = () => {
      if (closing) {
        socket.close();
        return;
      }
      sendPresence(true);
    };

    window.addEventListener(ADMIN_FORCE_OFFLINE_EVENT, goOffline);

    return () => {
      window.removeEventListener(ADMIN_FORCE_OFFLINE_EVENT, goOffline);
      goOffline();
    };
  }, []);

  return null;
}

function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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
    promotions: "Promotions",
    routes: "Routes",
    settings: "Settings",
  };
  const subSegment = location.pathname.split("/")[3] || "";
  const handleLogout = () => {
    window.dispatchEvent(new Event(ADMIN_FORCE_OFFLINE_EVENT));
    window.setTimeout(
      () => logoutToLogin(navigate),
      OFFLINE_SOCKET_CLOSE_DELAY_MS,
    );
  };
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

  useEffect(() => {
    let active = true;
    const loadUnreadCount = async () => {
      try {
        const notifications = await fetchAdminNotifications();
        if (!active) return;
        setUnreadCount(
          notifications.filter((notification) => !notification.read).length,
        );
      } catch {
        if (active) setUnreadCount(0);
      }
    };

    void loadUnreadCount();
    const intervalId = window.setInterval(() => {
      void loadUnreadCount();
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#f3f4f8] text-[#111827]">
      <GlobalAdminPresence />
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
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-1.5 text-xs font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#203b96]"
              >
                <FontAwesomeIcon icon={faSignOutAlt} />
                Logout
              </button>
              <button
                type="button"
                onClick={() => setShowNotifications((current) => !current)}
                className="relative text-sm text-[#3b4253] transition duration-200 hover:scale-105"
                aria-label="Notifications"
              >
                <FontAwesomeIcon icon={faBell} />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-h-4 min-w-4 rounded-full bg-[#f24f4f] px-1 text-[10px] font-semibold leading-4 text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>
              <div className="relative">
                <AdminNotificationsPanel
                  open={showNotifications}
                  onClose={() => setShowNotifications(false)}
                />
              </div>
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
