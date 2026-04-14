import { httpGet, httpPost } from "./http";

export interface EmergencyNumberDto {
  emergencyId: number;
  label: string;
  fireBrigade: string;
  ambulance: string;
  police: string;
  helpCenter: string;
}

export interface TriggerSosAlertRequest {
  passengerId?: number;
  driverId?: number;
  sharedLocation?: string;
  busNumber?: string;
  startLocation?: string;
  endLocation?: string;
  notifyEmergencyContacts?: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getActiveEmergencyNumbers(): Promise<EmergencyNumberDto> {
  const res = await httpGet<ApiResponse<EmergencyNumberDto>>(
    "/api/emergency-numbers/active",
  );
  return res.data;
}

export async function triggerSosAlert(
  payload: TriggerSosAlertRequest,
): Promise<void> {
  await httpPost<ApiResponse<unknown>>(
    "/api/sos-alerts/trigger",
    undefined,
    payload,
  );
}
