import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiUrl } from "@/config/env";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface DriverNotificationDto {
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

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem("user");
  if (!token) {
    return {};
  }

  const user = JSON.parse(token);
  return {
    Authorization: `Bearer ${user?.token ?? ""}`,
    "Content-Type": "application/json",
  };
}

export async function getDriverNotifications(
  userId: number,
): Promise<DriverNotificationDto[]> {
  const headers = await authHeaders();
  const response = await fetch(apiUrl(`/api/notifications/driver/${userId}`), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to load driver notifications");
  }

  const result: ApiResponse<DriverNotificationDto[]> = await response.json();
  return result.data ?? [];
}

export async function markDriverNotificationRead(id: number): Promise<void> {
  const headers = await authHeaders();
  const response = await fetch(apiUrl(`/api/notifications/${id}/read`), {
    method: "PUT",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to mark notification as read");
  }
}

export async function markAllDriverNotificationsRead(
  userId: number,
): Promise<void> {
  const headers = await authHeaders();
  const response = await fetch(
    apiUrl(`/api/notifications/driver/${userId}/read`),
    {
      method: "PUT",
      headers,
    },
  );

  if (!response.ok) {
    throw new Error("Failed to mark notifications as read");
  }
}
