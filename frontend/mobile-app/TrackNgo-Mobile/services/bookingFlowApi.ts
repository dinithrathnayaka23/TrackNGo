import { httpGet, httpPost } from "./http";
import { API_BASE_URL } from "../config/env";

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
  routeName: string;
  routeStops: Array<{ name: string; priority: number }>;
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
  routeDistance?: string;
  routeDuration?: string;
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
  fromLocation: string;
  toLocation: string;
  originalAmount?: number;
  discountAmount?: number;
  promotionId?: number | null;
  promoCode?: string;
}

export interface PromotionSummary {
  promotionId: number;
  name: string;
  description: string;
  targetType: string;
  discountType: string;
  discountValue: number;
  promoCode: string | null;
  regularCustomerMinCompletedBookings: number | null;
  maxBookings: number;
  usedBookings: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionQuoteRequest {
  passengerId: number;
  busId: number;
  fromLocation: string;
  toLocation: string;
  originalAmount: number;
  promoCode?: string;
}

export interface PromotionQuoteResult {
  promotionId: number | null;
  name: string | null;
  targetType: string | null;
  discountType: string | null;
  discountValue: number | null;
  promoCode: string | null;
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  message: string;
  eligiblePromotions: PromotionSummary[];
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

export async function getBusDetails(busId: number, from?: string, to?: string): Promise<BusDetailResult> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await httpGet<ApiResponse<BusDetailResult>>(
    `/api/booking-flow/buses/${busId}/details`,
    Object.keys(params).length > 0 ? params : undefined,
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

export async function getBlockedSeats(
  busId: number,
): Promise<string[]> {
  const res = await httpGet<ApiResponse<string[]>>(
    `/api/booking-flow/buses/${busId}/blocked-seats`,
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

// Fetches the promotion quote that should be applied to the current booking summary.
export async function quotePromotion(
  request: PromotionQuoteRequest,
): Promise<PromotionQuoteResult> {
  const url = new URL("/api/booking-flow/promotions/quote", API_BASE_URL).toString();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const text = await response.text();
  let body: ApiResponse<PromotionQuoteResult> | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as ApiResponse<PromotionQuoteResult>;
    } catch {
      body = null;
    }
  }

  if (!response.ok || !body?.success) {
    throw new Error(body?.message || "Promo code could not be applied.");
  }

  return body.data;
}

/* ── Stripe checkout session ──────────────────────────── */

export interface StripeCheckoutRequest {
  orderId: string;
  amount: number;
  currency: string;
  itemName: string;
  itemDescription: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeCheckoutResponse {
  sessionId: string;
  url: string;
}

export async function createStripeCheckoutSession(
  request: StripeCheckoutRequest,
): Promise<StripeCheckoutResponse> {
  const res = await httpPost<ApiResponse<StripeCheckoutResponse>>(
    "/api/booking-flow/stripe/create-checkout-session",
    undefined,
    request,
  );
  return res.data;
}

export interface StripeSessionStatus {
  status: string;
  paymentStatus: string;
  orderId: string;
  paymentIntentId: string;
}

export async function getStripeSessionStatus(
  sessionId: string,
): Promise<StripeSessionStatus> {
  const res = await httpGet<ApiResponse<StripeSessionStatus>>(
    `/api/booking-flow/stripe/session-status?sessionId=${encodeURIComponent(sessionId)}`,
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
