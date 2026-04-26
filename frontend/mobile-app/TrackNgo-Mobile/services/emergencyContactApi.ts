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

// Loads the emergency contacts owned by the selected passenger or driver.
export async function getEmergencyContacts(ownerId: number, ownerType: string) {
  const res = await httpGet<ApiResponse<EmergencyContactDto[]>>(
    "/api/emergency-contacts",
    { ownerId, ownerType: ownerType.toLowerCase() },
  );
  return res.data;
}

// Creates a new emergency contact using the normalized mobile payload.
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

// Deletes an emergency contact by id.
export async function deleteEmergencyContact(contactId: number) {
  const res = await httpDelete<ApiResponse<void>>(
    `/api/emergency-contacts/${contactId}`,
  );
  return res;
}
