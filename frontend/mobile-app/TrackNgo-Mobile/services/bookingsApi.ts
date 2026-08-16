import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpGet, httpPut } from "./http";

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
  paymentStatus?: string | null;
}

export interface BookingHistoryDto {
  bookingReference: string;
  busNumber: string;
  busType: string;
  startLocation: string;
  endLocation: string;
  journeyDate: string;
  journeyTime: string;
  seatNumber: string;
  totalAmount: number;
  status: string;
  transactionId: string;
}

async function authHeaders(): Promise<Record<string, string> | undefined> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function getRecentUpcomingBookings(userId: number): Promise<RecentBookingDto[]> {
  const headers = await authHeaders();
  const res = await httpGet<ApiResponse<RecentBookingDto[]>>(
    "/api/bookings/recent",
    { userId },
    headers,
  );
  return res.data ?? [];
}

export async function getUpcomingBookings(userId: number): Promise<BookingHistoryDto[]> {
  const headers = await authHeaders();
  const res = await httpGet<ApiResponse<BookingHistoryDto[]>>(
    "/api/bookings/upcoming",
    { userId },
    headers,
  );
  return res.data ?? [];
}

export async function getPastBookings(userId: number): Promise<BookingHistoryDto[]> {
  const headers = await authHeaders();
  const res = await httpGet<ApiResponse<BookingHistoryDto[]>>(
    "/api/bookings/past",
    { userId },
    headers,
  );
  return res.data ?? [];
}

export async function cancelBooking(bookingRef: string): Promise<void> {
  const headers = await authHeaders();
  await httpPut<ApiResponse<void>>(
    `/api/booking-flow/bookings/${encodeURIComponent(bookingRef)}/cancel`,
    undefined,
    headers,
  );
}
