import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpGet } from "./http";

const TOKEN_KEY = "trackngo.auth.token";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface RecentBookingDto {
  busNumber: string;
  busType: string;
  bookingReference: string;
  startLocation: string;
  endLocation: string;
  journeyDate: string;
  journeyTime: string;
}

export async function getRecentUpcomingBookings(): Promise<RecentBookingDto[]> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
  const res = await httpGet<ApiResponse<RecentBookingDto[]>>(
    "/api/bookings/recent",
    undefined,
    headers,
  );
  return res.data ?? [];
}
