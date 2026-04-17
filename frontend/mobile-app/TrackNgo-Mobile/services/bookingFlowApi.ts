import { httpGet, httpPost } from "./http";

/* ── Shared wrapper ──────────────────────────────────── */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/* ── Response types ──────────────────────────────────── */

export interface BusSearchResult {
  busId: number;
  busNumber: string;
  busType: string;
  busBrand: string;
  startTime: string;
  endTime: string;
  seatCapacity: number;
  availableSeats: number;
  amenities: string[];
  fee: number;
  driverName: string;
  driverRating: number;
}

export interface RouteStopInfo {
  name: string;
  estimatedTime: string;
  priority: number;
}

export interface DriverInfo {
  name: string;
  phoneNumber: string | null;
  rating: number;
  profilePhoto: string | null;
}

export interface BusDetailResult {
  busId: number;
  busNumber: string;
  busType: string;
  busBrand: string;
  startTime: string;
  endTime: string;
  seatCapacity: number;
  amenities: string[];
  fee: number;
  routeName: string;
  routeStops: RouteStopInfo[];
  driver: DriverInfo;
}

export interface SeatLayoutRow {
  rowNum: number;
  left: string[];
  right: string[];
  lastRow: string[] | null;
}

export interface BookingConfirmation {
  bookingReference: string;
  status: string;
  transactionId: string;
  seatNumbers: string;
  totalAmount: number;
  busNumber: string;
  fromLocation: string;
  toLocation: string;
  journeyDate: string;
  journeyTime: string;
}

export interface CreateBookingRequest {
  busId: number;
  journeyDate: string;
  journeyTime: string;
  seatNumbers: string[];
  specialRequest: string;
  paymentMethod: string;
  totalAmount: number;
  passengerId: number;
}

/* ── API calls ───────────────────────────────────────── */

export async function searchBuses(
  from: string,
  to: string,
  date: string,
  busCategory?: string,
): Promise<BusSearchResult[]> {
  const params: Record<string, string> = { from, to, date };
  if (busCategory) params.busCategory = busCategory;
  const res = await httpGet<ApiResponse<BusSearchResult[]>>(
    "/api/booking-flow/search",
    params,
  );
  return res.data ?? [];
}

export async function getBusDetails(busId: number): Promise<BusDetailResult> {
  const res = await httpGet<ApiResponse<BusDetailResult>>(
    `/api/booking-flow/buses/${busId}/details`,
  );
  return res.data;
}

export async function getSeatLayout(
  busId: number,
): Promise<SeatLayoutRow[]> {
  const res = await httpGet<ApiResponse<SeatLayoutRow[]>>(
    `/api/booking-flow/buses/${busId}/seat-layout`,
  );
  return res.data ?? [];
}

export async function getBookedSeats(
  busId: number,
  date: string,
): Promise<string[]> {
  const res = await httpGet<ApiResponse<string[]>>(
    `/api/booking-flow/buses/${busId}/booked-seats`,
    { date },
  );
  return res.data ?? [];
}

export async function createBooking(
  request: CreateBookingRequest,
): Promise<BookingConfirmation> {
  const res = await httpPost<ApiResponse<BookingConfirmation>>(
    "/api/booking-flow/bookings",
    undefined,
    request,
  );
  return res.data;
}

/* ── PayHere hash generation ─────────────────────────── */

export interface PayHereHashRequest {
  orderId: string;
  amount: string;
  currency: string;
}

export interface PayHereHashResponse {
  merchant_id: string;
  hash: string;
}

export async function getPayHereHash(
  request: PayHereHashRequest,
): Promise<PayHereHashResponse> {
  const res = await httpPost<ApiResponse<PayHereHashResponse>>(
    "/api/booking-flow/payhere/hash",
    undefined,
    request,
  );
  return res.data;
}

export async function getBookingByRef(
  bookingRef: string,
): Promise<BookingConfirmation> {
  const res = await httpGet<ApiResponse<BookingConfirmation>>(
    `/api/booking-flow/bookings/${encodeURIComponent(bookingRef)}`,
  );
  return res.data;
}
