import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpGet, httpPost, httpPut } from "./http";

const TOKEN_KEY = "trackngo.auth.token";

export type ProfileLanguage = "en" | "si";

export interface UserSettings {
  userId: number;
  language: ProfileLanguage;
  shareLocation: boolean;
  twoFactorAuthentication: boolean;
  pushNotifications: boolean;
  smsAlerts: boolean;
  emailUpdates: boolean;
  bookingUpdates: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

function normalizeSettings(settings: UserSettings): UserSettings {
  return {
    ...settings,
    language: String(settings.language).trim().toLowerCase() === "si" ? "si" : "en",
  };
}

async function authHeaders(): Promise<Record<string, string> | undefined> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function getUserSettings(userId: number): Promise<UserSettings> {
  const response = await httpGet<ApiResponse<UserSettings>>(
    `/api/users/${userId}/settings`,
    undefined,
    await authHeaders(),
  );
  return normalizeSettings(response.data);
}

export async function updateUserSettings(
  userId: number,
  changes: Partial<Omit<UserSettings, "userId">>,
): Promise<UserSettings> {
  const response = await httpPut<ApiResponse<UserSettings>>(
    `/api/users/${userId}/settings`,
    changes,
    await authHeaders(),
  );
  return normalizeSettings(response.data);
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<void> {
  await httpPost<ApiResponse<null>>(
    `/api/users/${userId}/password`,
    undefined,
    { currentPassword, newPassword, confirmPassword },
    await authHeaders(),
  );
}
