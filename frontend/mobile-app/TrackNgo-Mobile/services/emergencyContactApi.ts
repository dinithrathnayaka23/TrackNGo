import { httpGet, httpPost, httpDelete } from "./http";

export interface EmergencyContactDto {
  contactId: number;
  ownerId: number;
  ownerType: string;
  name: string;
  teleNumber: string;
  relationship: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getEmergencyContacts(ownerId: number, ownerType: string) {
  const res = await httpGet<ApiResponse<EmergencyContactDto[]>>(
    "/api/emergency-contacts",
    { ownerId, ownerType: ownerType.toLowerCase() },
  );
  return res.data;
}

export async function addEmergencyContact(params: {
  ownerId: number;
  ownerType: string;
  name: string;
  teleNumber: string;
  relationship?: string;
}) {
  const res = await httpPost<ApiResponse<EmergencyContactDto>>(
    "/api/emergency-contacts",
    undefined,
    {
      ownerId: params.ownerId,
      ownerType: params.ownerType.toLowerCase(),
      name: params.name,
      teleNumber: params.teleNumber,
      relationship: params.relationship ?? null,
    },
  );
  return res.data;
}

export async function deleteEmergencyContact(contactId: number) {
  const res = await httpDelete<ApiResponse<void>>(
    `/api/emergency-contacts/${contactId}`,
  );
  return res;
}
