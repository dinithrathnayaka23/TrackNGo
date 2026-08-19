import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

export const TRUSTED_DEVICE_TOKEN_KEY = "trackngo.auth.trusted-device";
const LEGACY_TOKEN_KEY = TRUSTED_DEVICE_TOKEN_KEY;

export async function getTrustedDeviceToken(): Promise<string | null> {
  try {
    const secureToken = await SecureStore.getItemAsync(TRUSTED_DEVICE_TOKEN_KEY);
    if (secureToken) {
      return secureToken;
    }
  } catch {
    // Continue with the legacy store for older Expo/native runtimes.
  }

  // Migrate tokens created by the first trusted-device implementation.
  const legacyToken = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacyToken) {
    await SecureStore.setItemAsync(TRUSTED_DEVICE_TOKEN_KEY, legacyToken);
    await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
  }
  return legacyToken;
}

export function saveTrustedDeviceToken(token: string): Promise<void> {
  return (async () => {
    // Keep a compatibility copy for Expo clients that do not yet include SecureStore.
    await AsyncStorage.setItem(LEGACY_TOKEN_KEY, token);
    try {
      await SecureStore.setItemAsync(TRUSTED_DEVICE_TOKEN_KEY, token);
    } catch {
      // The compatibility copy remains available to the next login.
    }
  })();
}

export async function clearTrustedDeviceToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TRUSTED_DEVICE_TOKEN_KEY);
  } catch {
    // The compatibility store is cleared below.
  }
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
}
