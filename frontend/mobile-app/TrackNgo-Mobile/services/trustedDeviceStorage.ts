import AsyncStorage from "@react-native-async-storage/async-storage";

export const TRUSTED_DEVICE_TOKEN_KEY = "trackngo.auth.trusted-device";

export function getTrustedDeviceToken(): Promise<string | null> {
  return AsyncStorage.getItem(TRUSTED_DEVICE_TOKEN_KEY);
}

export function saveTrustedDeviceToken(token: string): Promise<void> {
  return AsyncStorage.setItem(TRUSTED_DEVICE_TOKEN_KEY, token);
}

export function clearTrustedDeviceToken(): Promise<void> {
  return AsyncStorage.removeItem(TRUSTED_DEVICE_TOKEN_KEY);
}
