import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiUrl } from "@/config/env";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface DriverTripRatingDto {
  id: number;
  driverRating: number | null;
  busConditionRating: number | null;
  journeyRating: number | null;
  reviewText: string | null;
  image: string | null;
  createdAt: string | null;
  passengerName: string;
  busNumber: string | null;
}

export interface DriverComplaintDto {
  id: number;
  image: string | null;
  bookingReference: string | null;
  complaintType: string;
  priority: string;
  description: string;
  status: string;
  adminResponse: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
  passengerId: number | null;
  driverId: number | null;
}

async function authHeaders(token?: string): Promise<Record<string, string>> {
  let resolvedToken = token?.trim();

  if (!resolvedToken) {
    const storedUser = await AsyncStorage.getItem("user");
    if (storedUser) {
      try {
        resolvedToken = JSON.parse(storedUser)?.token?.trim();
      } catch {
        // Fall through to the legacy token storage key.
      }
    }
  }

  if (!resolvedToken) {
    resolvedToken = (await AsyncStorage.getItem("token"))?.trim();
  }

  return {
    ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
    "Content-Type": "application/json",
  };
}

async function readApiResponse<T>(
  response: Response,
  message: string,
): Promise<T> {
  const body = await response.text();
  let result: Partial<ApiResponse<T>> = {};

  try {
    result = body ? (JSON.parse(body) as Partial<ApiResponse<T>>) : {};
  } catch {
    // Keep the HTTP status as the useful error when the server returned non-JSON.
  }

  if (!response.ok || result.success === false) {
    const detail = result.message?.trim() || body.trim();
    throw new Error(
      `${message} (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  return result.data as T;
}

export async function getDriverRatings(
  driverId: number,
  token?: string,
): Promise<DriverTripRatingDto[]> {
  const headers = await authHeaders(token);
  const response = await fetch(apiUrl(`/api/ratings/driver/${driverId}`), {
    method: "GET",
    headers,
  });

  return (await readApiResponse<DriverTripRatingDto[]>(
    response,
    "Failed to load driver ratings",
  )) ?? [];
}

export async function getDriverComplaints(
  driverId: number,
  token?: string,
): Promise<DriverComplaintDto[]> {
  const headers = await authHeaders(token);
  const response = await fetch(apiUrl(`/api/complaints/driver/${driverId}`), {
    method: "GET",
    headers,
  });

  return (await readApiResponse<DriverComplaintDto[]>(
    response,
    "Failed to load driver complaints",
  )) ?? [];
}
