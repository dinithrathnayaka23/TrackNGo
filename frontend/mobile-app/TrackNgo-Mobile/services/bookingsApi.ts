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
  status?: string;
  cancellationStatus?: string | null;
  cancellationReason?: string | null;
  cancellationRequestedBy?: string | null;
  cancellationRejectReason?: string | null;
  refundPercentage?: number | null;
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
  paymentStatus?: string | null;
  cancellationStatus?: string | null;
  cancellationReason?: string | null;
  cancellationRequestedBy?: string | null;
  cancellationRejectReason?: string | null;
  refundPercentage?: number | null;
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

export async function requestBookingCancellation(
  bookingRef: string,
  reason: string,
): Promise<{ bookingReference: string; cancellationStatus: string; refundPercentage: number; refundMessage: string }> {
  const headers = await authHeaders();
  const res = await httpPost<ApiResponse<{ bookingReference: string; cancellationStatus: string; refundPercentage: number; refundMessage: string }>>(
    `/api/booking-flow/bookings/${encodeURIComponent(bookingRef)}/cancellation-request`,
    undefined,
    { reason, requesterType: "user" },
    headers,
  );
  return res.data;
}

export async function respondToBookingCancellation(
  bookingRef: string,
  accept: boolean,
  rejectReason?: string,
): Promise<any> {
  const headers = await authHeaders();
  const res = await httpPost<ApiResponse<any>>(
    `/api/booking-flow/bookings/${encodeURIComponent(bookingRef)}/cancellation-response`,
    undefined,
    { accept, rejectReason, responderType: "user" },
    headers,
  );
  return res.data;
}

