export type DriverNoticeCategory =
  | "All"
  | "Bookings"
  | "Journeys"
  | "Ratings"
  | "Support";

export type DriverNoticeSection = Exclude<DriverNoticeCategory, "All"> | "Other";

export const driverNotificationTabs: DriverNoticeCategory[] = [
  "All",
  "Bookings",
  "Journeys",
  "Ratings",
  "Support",
];

/**
 * Maps a stored notification type onto the tab it belongs in.
 *
 * Types with no entry fall through to "Other", which keeps them out of the
 * tabs while still listing them under All - that is where promotions, payments
 * and system notices surface.
 *
 * SOS sits under Support rather than falling through, because for a driver an
 * emergency on their bus is something to act on, not a receipt to file away.
 */
const sectionByType: Record<string, DriverNoticeSection> = {
  booking: "Bookings",
  cancellation: "Bookings",
  journey: "Journeys",
  rating: "Ratings",
  complaint: "Support",
  sos: "Support",
};

export function sectionForType(notificationType: string | null): DriverNoticeSection {
  if (!notificationType) return "Other";
  return sectionByType[notificationType.toLowerCase()] ?? "Other";
}

export interface DriverNotificationItem {
  id: number;
  title: string;
  message: string;
  read: boolean;
  createdAt: string | null;
  notificationType: string;
  category: DriverNoticeSection;
}

export function sameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function sectionForDate(value: string | null) {
  if (!value) return "Earlier";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (sameCalendarDay(date, today)) return "Today";
  if (sameCalendarDay(date, yesterday)) return "Yesterday";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: today.getFullYear() === date.getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function timeAgo(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffSeconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000),
  );
  if (diffSeconds < 60) return "now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}
