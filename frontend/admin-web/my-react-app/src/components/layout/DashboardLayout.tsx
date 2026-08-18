import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBars,
  faBell,
  faChevronRight,
  faHouse,
} from "@fortawesome/free-solid-svg-icons";
import { faRobot } from "@fortawesome/free-solid-svg-icons";
import Sidebar from "./Sidebar";
import SosAlertPopup from "../SosAlertPopup";
import AdminNotificationsPanel from "../AdminNotificationsPanel";
import AiAssistantPanel from "../AiAssistantPanel";
import { logoutToLogin } from "../../utils/authSession";
import { fetchAdminNotifications } from "../../services/adminNotificationService";
import adminProfileImage from "../../assets/images/adminProfilePlaceholder.svg";
import authService from "../../services/authService";

type DashboardLayoutProps = {
  children: ReactNode;
};

const SUPPORT_ADMIN_ID = Number(
  import.meta.env.VITE_ADMIN_SUPPORT_USER_ID ?? "1",
);
const ADMIN_FORCE_OFFLINE_EVENT = "trackngo:admin-force-offline";
const ADMIN_PROFILE_PHOTO_KEY = "adminProfilePhoto";
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
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminPhotoUrl, setAdminPhotoUrl] = useState(
    () => localStorage.getItem(ADMIN_PROFILE_PHOTO_KEY) || adminProfileImage,
  );
  const [adminProfile, setAdminProfile] = useState(() => authService.getAdminProfile());
  const fallbackEmail = localStorage.getItem("adminEmail") ?? "";
  const adminFullName = [adminProfile?.firstName, adminProfile?.lastName]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .trim();
  const formatFallbackName = (value: string) =>
    value
      .replace(/[._-]+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map(
        (part) =>
          part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
      )
      .join(" ");
  const fallbackNameFromEmail = adminProfile?.email
    ? formatFallbackName(adminProfile.email.split("@")[0])
    : fallbackEmail
      ? formatFallbackName(fallbackEmail.split("@")[0])
      : "";
  const adminDisplayName = adminFullName || fallbackNameFromEmail || "Admin User";
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
    const onStorageUpdate = () => {
      setAdminPhotoUrl(
        localStorage.getItem(ADMIN_PROFILE_PHOTO_KEY) || adminProfileImage,
      );
    };

    const onCustomUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail) {
        setAdminPhotoUrl(customEvent.detail);
      } else {
        onStorageUpdate();
      }
    };

    window.addEventListener("storage", onStorageUpdate);
    window.addEventListener(
      "admin-profile-photo-updated",
      onCustomUpdate as EventListener,
    );
    const onProfileUpdate = () => setAdminProfile(authService.getAdminProfile());
    window.addEventListener("admin-profile-updated", onProfileUpdate);

    return () => {
      window.removeEventListener("storage", onStorageUpdate);
      window.removeEventListener(
        "admin-profile-photo-updated",
        onCustomUpdate as EventListener,
      );
      window.removeEventListener("admin-profile-updated", onProfileUpdate);
    };
  }, []);

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
          onLogout={handleLogout}
        />

        <div className="min-h-screen flex-1 min-w-0">
          <header
            className="animate-dash-in z-10 flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-[#e2e8f0] bg-white/95 px-4 backdrop-blur sm:px-6"
            style={{ animationDelay: "40ms" }}
          >
            <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 text-sm text-[#94a3b8] whitespace-nowrap">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#475569] transition hover:bg-[#f1f5f9] lg:hidden"
                aria-label="Open navigation menu"
              >
                <FontAwesomeIcon icon={faBars} />
              </button>
              <FontAwesomeIcon icon={faHouse} className="hidden shrink-0 text-xs text-[#94a3b8] sm:block" />
              {["Home", ...breadcrumbTrail].map((crumb, index, arr) => {
                const isLast = index === arr.length - 1;
                return (
              <div
                    key={`${crumb}-${index}`}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <span
                      className={
                        isLast
                          ? "truncate font-bold text-[#1e293b]"
                          : "hidden sm:inline"
                      }
                    >
                      {crumb}
                    </span>
                    {!isLast ? <FontAwesomeIcon icon={faChevronRight} className="hidden text-[10px] text-[#cbd5e1] sm:inline" /> : null}
                  </div>
                );
              })}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowAiAssistant((current) => !current)}
                className={`grid h-10 w-10 place-items-center rounded-xl border text-sm transition duration-200 ${showAiAssistant ? "border-[#c7d2fe] bg-[#eef2ff] text-[#2642a6]" : "border-transparent text-[#64748b] hover:border-[#e2e8f0] hover:bg-[#f8fafc] hover:text-[#2642a6]"}`}
                aria-label="AI Assistant"
                title="AI Assistant"
              >
                <FontAwesomeIcon icon={faRobot} />
              </button>
              <button
                type="button"
                onClick={() => setShowNotifications((current) => !current)}
                className={`relative grid h-10 w-10 place-items-center rounded-xl border text-sm transition duration-200 ${showNotifications ? "border-[#c7d2fe] bg-[#eef2ff] text-[#2642a6]" : "border-transparent text-[#64748b] hover:border-[#e2e8f0] hover:bg-[#f8fafc] hover:text-[#2642a6]"}`}
                aria-label="Notifications"
                title="Notifications"
              >
                <FontAwesomeIcon icon={faBell} />
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-h-4 min-w-4 rounded-full bg-[#f24f4f] px-1 text-[10px] font-semibold leading-4 text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </button>
              <div className="mx-1 hidden h-8 w-px bg-[#e2e8f0] sm:block" />
              <button
                type="button"
                onClick={() => navigate("/dashboard/settings/profile")}
                className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#eef2ff] p-0 shadow-[0_0_0_1px_#dbe4f0] transition hover:scale-105 hover:shadow-[0_0_0_3px_#c7d2fe] focus:outline-none focus:ring-2 focus:ring-[#93c5fd] focus:ring-offset-2"
                aria-label={`Open ${adminDisplayName} profile`}
                title="Profile settings"
              >
                <img
                  src={adminPhotoUrl}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = adminProfileImage;
                    localStorage.removeItem(ADMIN_PROFILE_PHOTO_KEY);
                    setAdminPhotoUrl(adminProfileImage);
                  }}
                  className="block h-full w-full rounded-full object-cover object-center"
                />
              </button>
            </div>

            <AiAssistantPanel
              open={showAiAssistant}
              onClose={() => setShowAiAssistant(false)}
            />
            <AdminNotificationsPanel
              open={showNotifications}
              onClose={() => setShowNotifications(false)}
            />
          </header>

          <main className="p-5">{children}</main>
        </div>
      </div>
      <SosAlertPopup />
    </div>
  );
}

export default DashboardLayout;
