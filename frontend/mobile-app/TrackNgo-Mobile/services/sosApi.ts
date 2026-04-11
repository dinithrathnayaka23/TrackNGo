import { httpGet } from "./http";

export interface EmergencyNumberDto {
  emergencyId: number;
  label: string;
  fireBrigade: string;
  ambulance: string;
  police: string;
  helpCenter: string;
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
