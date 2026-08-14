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
