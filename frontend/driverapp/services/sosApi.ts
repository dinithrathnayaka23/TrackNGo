import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiUrl } from "@/config/env";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface EmergencyNumberDto {
  emergencyId: number;
  label: string;
  fireBrigade: string;
  ambulance: string;
  police: string;
  helpCenter: string;
}

export interface TriggerSosAlertRequest {
  driverId: number;
  sharedLocation?: string;
  busNumber?: string;
  startLocation?: string;
  endLocation?: string;
  notifyEmergencyContacts?: boolean;
}

async function authHeaders(): Promise<Record<string, string>> {
  const stored = await AsyncStorage.getItem("user");
  if (!stored) {
    return { "Content-Type": "application/json" };
  }

  const user = JSON.parse(stored);
  return {
    Authorization: `Bearer ${user?.token ?? ""}`,
    "Content-Type": "application/json",
  };
}

/** Loads the emergency numbers shown as quick-call tiles on the SOS screen. */
export async function getActiveEmergencyNumbers(): Promise<EmergencyNumberDto | null> {
  const headers = await authHeaders();
  const response = await fetch(apiUrl("/api/emergency-numbers/active"), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to load emergency numbers");
  }

  const result: ApiResponse<EmergencyNumberDto> = await response.json();
  return result.data ?? null;
}

/**
 * Raises an SOS alert on the driver's behalf.
 *
 * The backend accepts either a passenger or a driver as the originator, and
 * stamps `triggered_by_type` from whichever id is present, so sending only
 * `driverId` is what marks this as a driver alert in the admin popup.
 */
export async function triggerSosAlert(
  payload: TriggerSosAlertRequest,
): Promise<void> {
  const headers = await authHeaders();
  const response = await fetch(apiUrl("/api/sos-alerts/trigger"), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send SOS alert: ${response.status} - ${errorText}`);
  }
}
