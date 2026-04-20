import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpGet, httpPost } from "./http";

const TOKEN_KEY = "trackngo.auth.token";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ComplaintDto {
  id: number;
  image?: string | null;
  bookingReference?: string | null;
  complaintType: string;
  priority?: string | null;
  description: string;
  status?: string | null;
  adminResponse?: string | null;
  createdAt?: string | null;
  resolvedAt?: string | null;
  passengerId?: number | null;
}

export interface CreateComplaintRequest {
  image?: string | null;
  bookingReference?: string | null;
  complaintType: string;
  priority?: string | null;
  description: string;
}

async function authHeaders(): Promise<Record<string, string> | undefined> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function createComplaint(
  payload: CreateComplaintRequest,
  userId?: number,
): Promise<ComplaintDto> {
  const headers = await authHeaders();
  const res = await httpPost<ApiResponse<ComplaintDto>>(
    "/api/complaints",
    userId ? { userId } : undefined,
    payload,
    headers,
  );
  return res.data;
}

export async function getMyComplaints(userId?: number): Promise<ComplaintDto[]> {
  const headers = await authHeaders();
  const res = await httpGet<ApiResponse<ComplaintDto[]>>(
    "/api/complaints/mine",
    userId ? { userId } : undefined,
    headers,
  );
  return res.data ?? [];
}
