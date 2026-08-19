import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpPost } from "./http";

const TOKEN_KEY = "trackngo.auth.token";

export interface TwoFactorSetup {
  secret: string;
  provisioningUri: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

async function authHeaders(): Promise<Record<string, string> | undefined> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function beginTwoFactorSetup(userId: number): Promise<TwoFactorSetup> {
  const response = await httpPost<ApiResponse<TwoFactorSetup>>(
    `/api/users/${userId}/two-factor/setup`,
    undefined,
    undefined,
    await authHeaders(),
  );
  return response.data;
}

export async function enableTwoFactor(userId: number, code: string): Promise<string> {
  const response = await httpPost<ApiResponse<string>>(
    `/api/users/${userId}/two-factor/enable`,
    undefined,
    { code },
    await authHeaders(),
  );
  return response.data;
}

export async function disableTwoFactor(userId: number, code: string): Promise<void> {
  await httpPost<ApiResponse<null>>(
    `/api/users/${userId}/two-factor/disable`,
    undefined,
    { code },
    await authHeaders(),
  );
}
