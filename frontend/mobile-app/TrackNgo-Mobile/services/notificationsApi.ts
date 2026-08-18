import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpGet, httpPut } from "./http";

const TOKEN_KEY = "trackngo.auth.token";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type NotificationType =
  | "booking"
  | "payment"
  | "journey"
  | "cancellation"
  | "rating"
  | "complaint"
  | "promotion"
  | "system_alert"
  | "system"
  | "sos";

export interface NotificationDto {
  id: number;
  notificationType: NotificationType | string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string | null;
  passengerId: number | null;
  corporateUserId: number | null;
  driverId: number | null;
  adminId: number | null;
}

async function authHeaders(): Promise<Record<string, string> | undefined> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function getPassengerNotifications(
  userId: number,
  type?: "booking" | "cancellation" | "payment" | "journey",
): Promise<NotificationDto[]> {
  const headers = await authHeaders();
  const res = await httpGet<ApiResponse<NotificationDto[]>>(
    "/api/notifications",
    { userId, type },
    headers,
  );
  return res.data ?? [];
}

/**
 * Corporate notifications are keyed by corporate_user_id, so they are *not*
 * returned by the passenger endpoint — they need their own route.
 * GET /api/notifications/corporate/{userId}
 */
export async function getCorporateNotifications(
  userId: number,
  type?: "booking" | "payment" | "promotion" | "system_alert",
): Promise<NotificationDto[]> {
  const headers = await authHeaders();
  const res = await httpGet<ApiResponse<NotificationDto[]>>(
    `/api/notifications/corporate/${userId}`,
    { type },
    headers,
  );
  return res.data ?? [];
}

/**
 * Unread count for the corporate bell badge.
 */
export async function getCorporateUnreadCount(userId: number): Promise<number> {
  try {
    const notifications = await getCorporateNotifications(userId);
    return notifications.filter((notification) => !notification.read).length;
  } catch (err) {
    console.warn("[Notifications] Failed to load corporate unread count:", err);
    return 0;
  }
}

export async function markAllCorporateNotificationsRead(
  userId: number,
): Promise<void> {
  const headers = await authHeaders();
  await httpPut<ApiResponse<void>>(
    `/api/notifications/corporate/${userId}/read`,
    undefined,
    headers,
  ).catch(async () => {
    const notifications = await getCorporateNotifications(userId);
    await Promise.all(
      notifications
        .filter((notification) => !notification.read)
        .map((notification) => markNotificationRead(notification.id)),
    );
  });
}

export async function markNotificationRead(id: number): Promise<NotificationDto> {
  const headers = await authHeaders();
  const res = await httpPut<ApiResponse<NotificationDto>>(
    `/api/notifications/${id}/read`,
    undefined,
    headers,
  );
  return res.data;
}

export async function markAllPassengerNotificationsRead(
  userId: number,
): Promise<void> {
  const headers = await authHeaders();
  await httpPut<ApiResponse<void>>(
    `/api/notifications/passenger/${userId}/read`,
    undefined,
    headers,
  ).catch(async () => {
    const notifications = await getPassengerNotifications(userId);
    await Promise.all(
      notifications
        .filter((notification) => !notification.read)
        .map((notification) => markNotificationRead(notification.id)),
    );
  });
}
