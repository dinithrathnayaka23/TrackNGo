import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBell,
  faCheckDouble,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  type AdminNotificationDto,
} from "../services/adminNotificationService";

function formatTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );
  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

export interface AdminNotificationsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function AdminNotificationsPanel({
  open,
  onClose,
}: AdminNotificationsPanelProps) {
  const [items, setItems] = useState<AdminNotificationDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminNotifications();
      setItems(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load notifications",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
    const intervalId = window.setInterval(() => {
      void loadNotifications();
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [open]);

  const handleMarkRead = async (id: number) => {
    try {
      await markAdminNotificationRead(id);
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, read: true } : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not mark notification as read",
      );
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAdminNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, read: true })));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not mark all notifications as read",
      );
    }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120]">
      <button
        type="button"
        aria-label="Close notifications"
        className="absolute inset-0 h-full w-full bg-transparent"
        onClick={onClose}
      />
      <div className="fixed right-4 top-16 z-[121] w-[min(92vw,360px)] rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.24)]">
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[#111827]">
              Notifications
            </p>
            <p className="text-xs text-[#6b7280]">
              Latest admin alerts and updates
            </p>
          </div>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs font-semibold text-[#2642a6]"
          >
            <span className="mr-1 inline-flex items-center">
              <FontAwesomeIcon icon={faCheckDouble} />
            </span>
            Mark all read
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#6b7280]">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
              Loading notifications...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-4 text-sm text-red-600">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d1d5db] bg-[#f9fafb] px-3 py-8 text-center text-sm text-[#6b7280]">
              No notifications yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void handleMarkRead(item.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${item.read ? "border-[#e5e7eb] bg-white" : "border-[#c7d2fe] bg-[#f8faff]"}`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#e8eefc] text-[#2642a6]">
                      <FontAwesomeIcon icon={faBell} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[#111827]">
                          {item.title || "Admin update"}
                        </p>
                        {!item.read ? (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#2642a6]" />
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[#6b7280]">
                        {item.message}
                      </p>
                      <p className="mt-2 text-xs text-[#94a3b8]">
                        {formatTime(item.createdAt)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[#e5e7eb] px-4 py-2 text-right">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-[#6b7280]"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
