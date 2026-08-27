import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiUrl } from "@/config/env";

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

async function authHeaders(): Promise<Record<string, string>> {
  const stored = await AsyncStorage.getItem("user");
  const user = stored ? JSON.parse(stored) : null;
  return {
    Authorization: `Bearer ${user?.token ?? ""}`,
    "Content-Type": "application/json",
  };
}

function buildUrl(path: string, query?: Record<string, string | number | undefined>) {
  const url = new URL(apiUrl(path));
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  const text = await response.text();
  const body = text ? (JSON.parse(text) as ApiResponse<T>) : null;
  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || fallbackMessage);
  }
  return body?.data as T;
}

export async function getEmergencyContacts(ownerId: number) {
  const response = await fetch(
    buildUrl("/api/emergency-contacts", { ownerId, ownerType: "driver" }),
    {
      method: "GET",
      headers: await authHeaders(),
    },
  );
  return readJson<EmergencyContactDto[]>(response, "Failed to load emergency contacts");
}

export async function addEmergencyContact(params: {
  ownerId: number;
  name: string;
  teleNumber: string;
  relationship?: string;
}) {
  const response = await fetch(apiUrl("/api/emergency-contacts"), {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      ownerId: params.ownerId,
      ownerType: "driver",
      name: params.name,
      teleNumber: params.teleNumber,
      relationship: params.relationship ?? null,
    }),
  });
  return readJson<EmergencyContactDto>(response, "Failed to add emergency contact");
}

export async function deleteEmergencyContact(contactId: number) {
  const response = await fetch(apiUrl(`/api/emergency-contacts/${contactId}`), {
    method: "DELETE",
    headers: await authHeaders(),
  });
  await readJson<void>(response, "Failed to delete emergency contact");
}
