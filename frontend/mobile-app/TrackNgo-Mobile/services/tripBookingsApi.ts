import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpGet, httpPost, httpPut } from "./http";

const TOKEN_KEY = "trackngo.auth.token";

export type TripBooking = {
  id: number;
  startLocation: string;
  destination: string;
  startDate: string;
  returnDate: string | null;
  passengerCount: number;
  advancePayment: number;
  finalPrice: number;
  estimatedPrice?: number | null;
  discountAmount?: number | null;
  adminNote?: string | null;
  negotiatedAt?: string | null;
  bookingStatus: string;
  passengerId: number;
  busId: number | null;
  busNumber?: string | null;
  busBrand?: string | null;
  paymentStatus?: string | null;
  transactionId?: string | null;
};

export type TripBus = {
  busId: number;
  busNumber: string;
  busBrand: string;
  seatCapacity: number;
  amenities: string[];
  status: string;
};

export type CreateTripBookingRequest = {
  startLocation: string;
  destination: string;
  startDate: string;
  returnDate: string;
  passengerCount: number;
  requirement: string;
  distanceKm: number;
  startLatitude?: number;
  startLongitude?: number;
  destinationLatitude?: number;
  destinationLongitude?: number;
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function unwrap<T>(value: T | { data?: T }): T {
  if (value && typeof value === "object" && "data" in value && (value as { data?: T }).data !== undefined) {
    return (value as { data: T }).data;
  }
  return value as T;
}

export async function createTripBooking(request: CreateTripBookingRequest): Promise<TripBooking> {
  const result = await httpPost<TripBooking | { data: TripBooking }>(
    "/api/trips/book",
    undefined,
    request,
    await authHeaders(),
  );
  return unwrap(result);
}

export async function getAvailableTripBuses(passengers: number, requirement: string): Promise<TripBus[]> {
  const result = await httpGet<TripBus[] | { data?: TripBus[] }>(
    "/api/trips/available-buses",
    { passengers, requirement },
    await authHeaders(),
  );
  return unwrap(result) ?? [];
}

export async function getTripBooking(bookingId: number): Promise<TripBooking> {
  const result = await httpGet<TripBooking | { data: TripBooking }>(
    `/api/trips/book/${bookingId}`,
    undefined,
    await authHeaders(),
  );
  return unwrap(result);
}

export async function assignTripBus(bookingId: number, busId: number): Promise<TripBooking> {
  const result = await httpPut<TripBooking | { data: TripBooking }>(
    `/api/trips/book/${bookingId}/bus?busId=${encodeURIComponent(busId)}`,
    undefined,
    await authHeaders(),
  );
  return unwrap(result);
}

export async function confirmTripPayment(bookingId: number, sessionId: string): Promise<TripBooking> {
  const result = await httpPost<TripBooking | { data: TripBooking }>(
    `/api/trips/book/${bookingId}/payment`,
    undefined,
    { sessionId },
    await authHeaders(),
  );
  return unwrap(result);
}
