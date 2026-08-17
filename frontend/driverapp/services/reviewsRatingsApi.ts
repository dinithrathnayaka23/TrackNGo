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

async function authHeaders(): Promise<Record<string, string>> {
  const stored = await AsyncStorage.getItem("user");
  if (!stored) {
    return {};
  }

  const user = JSON.parse(stored);
  return {
    Authorization: `Bearer ${user?.token ?? ""}`,
    "Content-Type": "application/json",
  };
}

export async function getDriverRatings(
  driverId: number,
): Promise<DriverTripRatingDto[]> {
  const headers = await authHeaders();
  const response = await fetch(apiUrl(`/api/ratings/driver/${driverId}`), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to load driver ratings");
  }

  const result: ApiResponse<DriverTripRatingDto[]> = await response.json();
  return result.data ?? [];
}

export async function getDriverComplaints(
  driverId: number,
): Promise<DriverComplaintDto[]> {
  const headers = await authHeaders();
  const response = await fetch(apiUrl(`/api/complaints/driver/${driverId}`), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to load driver complaints");
  }

  const result: ApiResponse<DriverComplaintDto[]> = await response.json();
  return result.data ?? [];
}
