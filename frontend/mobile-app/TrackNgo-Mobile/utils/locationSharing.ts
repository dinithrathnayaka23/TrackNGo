import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Platform } from "react-native";

/**
 * Records what was chosen in the device's location dialog at sign-in. Tracking
 * screens read it to decide whether they may use the phone's position.
 */
const SHARE_LOCATION_KEY = "trackngo.shareLocation";

export type LocationEnableResult = "enabled" | "permission-denied" | "services-disabled";

export async function readShareLocation(): Promise<boolean> {
  try {
    // Absent means the dialog has not been answered on this device yet. Tracking
    // screens still ask the OS for permission of their own, so nothing starts
    // before someone has agreed to it.
    return (await AsyncStorage.getItem(SHARE_LOCATION_KEY)) !== "false";
  } catch (error) {
    console.warn("Failed to read location sharing preference:", error);
    return true;
  }
}

export async function rememberShareLocation(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SHARE_LOCATION_KEY, String(enabled));
  } catch (error) {
    console.warn("Failed to save location sharing preference:", error);
  }
}

/**
 * Run at sign-in, when the choice is about to matter. The device's own dialog is the
 * whole prompt - no in-app alert warms it up and none follows it - so the question is
 * asked once, by the platform, with its own explanation and its own link to Settings.
 * Whatever is chosen there becomes the app's sharing preference, and the next sign-in
 * asks again.
 */
export async function requestLocationOnSignIn(): Promise<void> {
  const result = await turnOnDeviceLocation();
  await rememberShareLocation(result === "enabled");
}

/**
 * Turns the phone's location on as far as an app is allowed to: neither iOS nor
 * Android lets an app flip the system switch itself, so this asks for permission
 * and then asks Android's own Location Accuracy dialog to switch location on
 * without leaving the app. iOS has no counterpart, so there the request simply
 * stops rather than substituting a dialog of our own.
 */
export async function turnOnDeviceLocation(): Promise<LocationEnableResult> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    return "permission-denied";
  }

  if (await Location.hasServicesEnabledAsync()) {
    return "enabled";
  }

  if (Platform.OS === "android") {
    try {
      await Location.enableNetworkProviderAsync();
    } catch {
      // "No, thanks" in the system dialog rather than location being switched on.
      return "services-disabled";
    }
    return (await Location.hasServicesEnabledAsync()) ? "enabled" : "services-disabled";
  }

  return "services-disabled";
}
