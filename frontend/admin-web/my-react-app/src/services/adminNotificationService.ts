import authService from "./authService";

export interface AdminNotificationDto {
  id: number;
  notificationType: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string | null;
  passengerId: number | null;
  corporateUserId: number | null;
  driverId: number | null;
  adminId: number | null;
}

export type AdminNoticeCategory = "All" | "Approvals" | "Support" | "Emergency";

export type AdminNoticeSection = Exclude<AdminNoticeCategory, "All"> | "Other";

export const adminNotificationTabs: AdminNoticeCategory[] = [
  "All",
  "Approvals",
  "Support",
  "Emergency",
];

/**
 * Maps a stored notification type onto the tab it belongs in.
 *
 * The tabs follow what an admin has to do about a notice rather than which
 * module raised it: trip and contract requests both wait on a decision, so
 * they share Approvals. Types with no entry fall through to "Other" and stay
 * reachable under All without needing a code change here.
 */
const sectionByType: Record<string, AdminNoticeSection> = {
  booking: "Approvals",
  system_alert: "Approvals",
  complaint: "Support",
  sos: "Emergency",
};

export function sectionForType(
  notificationType: string | null | undefined,
): AdminNoticeSection {
  if (!notificationType) return "Other";
  return sectionByType[notificationType.toLowerCase()] ?? "Other";
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

const API_BASE = "/api/notifications";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authService.getToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as ApiResponse<T>) : null;

  if (!response.ok || !body?.success) {
    throw new Error(body?.message || "Request failed");
  }

  return body.data as T;
}

export async function fetchAdminNotifications(): Promise<
  AdminNotificationDto[]
> {
  const adminProfile = authService.getAdminProfile();
  if (!adminProfile?.userId) return [];
  return request<AdminNotificationDto[]>(
    `${API_BASE}/admin/${adminProfile.userId}`,
  );
}

export async function markAdminNotificationRead(id: number): Promise<void> {
  await request<void>(`${API_BASE}/${id}/read`, { method: "PUT" });
}

export async function markAllAdminNotificationsRead(): Promise<void> {
  const adminProfile = authService.getAdminProfile();
  if (!adminProfile?.userId) return;
  await request<void>(`${API_BASE}/admin/${adminProfile.userId}/read`, {
    method: "PUT",
  });
}
