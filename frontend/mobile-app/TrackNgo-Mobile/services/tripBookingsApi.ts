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
  cancellationStatus?: string | null;
  cancellationReason?: string | null;
  cancellationRequestedBy?: string | null;
  cancellationRejectReason?: string | null;
  refundPercentage?: number | null;
};

export type TripBus = {
  busId: number;
  busNumber: string;
  busBrand: string;
  seatCapacity: number;
  amenities: string[];
  status: string;
};

export type TripPricingSettings = {
  dailyRate: number;
  smallBusRatePerKm: number;
  largeBusRatePerKm: number;
  passengerThreshold: number;
  acSurchargePercent: number;
  miniBusSurcharge: number;
  advancePaymentPercent: number;
  updatedAt?: string | null;
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

/** Live pricing rates driving the "approximate fee" estimate shown before booking. */
export async function getTripPricingSettings(): Promise<TripPricingSettings> {
  const result = await httpGet<TripPricingSettings | { data: TripPricingSettings }>(
    "/api/trips/pricing-settings",
  );
  return unwrap(result);
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

export async function getAvailableTripBuses(
  passengers: number,
  requirement: string,
  startDate?: string,
  returnDate?: string,
  bookingId?: number,
): Promise<TripBus[]> {
  const result = await httpGet<TripBus[] | { data?: TripBus[] }>(
    "/api/trips/available-buses",
    {
      passengers,
      requirement: requirement || undefined,
      startDate: startDate || undefined,
      returnDate: returnDate || undefined,
      bookingId: bookingId || undefined,
    },
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

export async function requestTripCancellation(bookingId: number, reason: string): Promise<TripBooking> {
  const result = await httpPost<TripBooking | { data: TripBooking }>(
    `/api/trips/book/${bookingId}/cancellation-request`,
    undefined,
    { reason, requesterType: "user" },
    await authHeaders(),
  );
  return unwrap(result);
}

export async function respondToTripCancellation(
  bookingId: number,
  accept: boolean,
  rejectReason?: string,
): Promise<TripBooking> {
  const result = await httpPost<TripBooking | { data: TripBooking }>(
    `/api/trips/book/${bookingId}/cancellation-response`,
    undefined,
    { accept, rejectReason, responderType: "user" },
    await authHeaders(),
  );
  return unwrap(result);
}

