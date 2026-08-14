import { httpGet, httpPost } from "./http";
import { API_BASE_URL } from "../config/env";

/* ── Shared wrapper ──────────────────────────────────── */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface AdminBusRouteInfo {
  busId: number;
  routeName: string | null;
  routeId: number | null;
  startTime?: string | null;
  endTime?: string | null;
  returnStartTime?: string | null;
  returnEndTime?: string | null;
}

interface RouteInfo {
  id?: number;
  name?: string;
  duration?: string;
  stops?: string[];
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
  busRouteName?: string;
  routeStartLocation?: string;
  routeEndLocation?: string;
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
  busRouteName?: string;
  routeStartLocation?: string;
  routeEndLocation?: string;
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
  paymentProviderReference?: string;
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

function normalizeStopKey(value?: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/[-\s]+/g, "");
}

function buildRouteLabel(start?: string | null, end?: string | null): string {
  const cleanStart = start?.trim() ?? "";
  const cleanEnd = end?.trim() ?? "";
  if (cleanStart && cleanEnd && normalizeStopKey(cleanStart) !== normalizeStopKey(cleanEnd)) {
    return `${cleanStart} to ${cleanEnd}`;
  }
  return cleanStart || cleanEnd;
}

function isSearchSegmentLabel(label: string | undefined | null, from: string, to: string): boolean {
  const normalizedLabel = normalizeStopKey((label ?? "").replace(/->/g, " ").replace(/\bto\b/gi, " "));
  const forward = normalizeStopKey(`${from}${to}`);
  const reverse = normalizeStopKey(`${to}${from}`);
  return !!normalizedLabel && (normalizedLabel === forward || normalizedLabel === reverse);
}

function parseTimeToMinutes(value?: string | null): number | null {
  const match = (value ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function formatMinutes(value: number): string {
  const minutesInDay = 24 * 60;
  const normalized = ((Math.round(value) % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatMinutes12(value: number): string {
  const minutesInDay = 24 * 60;
  const normalized = ((Math.round(value) % minutesInDay) + minutesInDay) % minutesInDay;
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function parseDurationToMinutes(value?: string | null): number {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return 0;

  const hours = Number(text.match(/(\d+(?:\.\d+)?)\s*h/)?.[1] ?? 0);
  const minutes = Number(text.match(/(\d+(?:\.\d+)?)\s*m/)?.[1] ?? 0);
  if (hours > 0 || minutes > 0) {
    return Math.round(hours * 60 + minutes);
  }

  const numeric = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function formatDurationLabel(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours > 0 ? `${hours}h ` : ""}${minutes}m`;
}

type SegmentTiming = {
  startTime: string;
  endTime: string;
  routeDuration: string;
  fullStartTime: string;
  fullEndTime: string;
  isFullRoute: boolean;
  baseMinutes: number;
  totalDuration: number;
  reverse: boolean;
  fromIndex: number;
  toIndex: number;
  stopCount: number;
};

function resolveSegmentTiming(
  adminBus: AdminBusRouteInfo | undefined,
  route: RouteInfo | undefined,
  from: string,
  to: string,
): SegmentTiming | null {
  const stops = route?.stops ?? [];
  const fromIndex = stops.findIndex((stop) => normalizeStopKey(stop) === normalizeStopKey(from));
  const toIndex = stops.findIndex((stop) => normalizeStopKey(stop) === normalizeStopKey(to));
  const totalDuration = parseDurationToMinutes(route?.duration);

  if (!adminBus || fromIndex < 0 || toIndex < 0 || fromIndex === toIndex || stops.length < 2 || totalDuration <= 0) {
    return null;
  }

  const reverse = fromIndex > toIndex;
  const baseMinutes = parseTimeToMinutes(reverse ? adminBus.returnStartTime : adminBus.startTime);
  if (baseMinutes === null) return null;

  const lastIndex = stops.length - 1;
  const offsetForIndex = (index: number) => Math.round((index / lastIndex) * totalDuration);
  const routeOffsetForIndex = (index: number) =>
    reverse ? totalDuration - offsetForIndex(index) : offsetForIndex(index);

  const fromOffset = routeOffsetForIndex(fromIndex);
  const toOffset = routeOffsetForIndex(toIndex);
  const segmentDuration = Math.abs(toOffset - fromOffset);

  return {
    startTime: formatMinutes(baseMinutes + fromOffset),
    endTime: formatMinutes(baseMinutes + toOffset),
    routeDuration: formatDurationLabel(segmentDuration),
    fullStartTime: formatMinutes(baseMinutes),
    fullEndTime: formatMinutes(baseMinutes + totalDuration),
    isFullRoute: Math.min(fromIndex, toIndex) === 0 && Math.max(fromIndex, toIndex) === lastIndex,
    baseMinutes,
    totalDuration,
    reverse,
    fromIndex,
    toIndex,
    stopCount: stops.length,
  };
}

function shouldReplaceSegmentTimes(
  source: { startTime?: string | null; endTime?: string | null },
  timing: SegmentTiming | null,
): timing is SegmentTiming {
  if (!timing || timing.isFullRoute) return false;

  const currentStart = parseTimeToMinutes(source.startTime);
  const currentEnd = parseTimeToMinutes(source.endTime);
  if (currentStart === null || currentEnd === null) return true;
  if (currentStart === currentEnd) return true;

  const currentDuration = (currentEnd - currentStart + 24 * 60) % (24 * 60);
  if (currentDuration === timing.totalDuration) return true;

  return (
    currentStart === parseTimeToMinutes(timing.fullStartTime) &&
    currentEnd === parseTimeToMinutes(timing.fullEndTime)
  );
}

function buildSegmentRouteStops(route: RouteInfo | undefined, timing: SegmentTiming | null): RouteStopInfo[] | null {
  const stops = route?.stops ?? [];
  if (!timing || stops.length < 2) return null;

  const minIndex = Math.min(timing.fromIndex, timing.toIndex);
  const maxIndex = Math.max(timing.fromIndex, timing.toIndex);
  const indexes = Array.from({ length: maxIndex - minIndex + 1 }, (_, index) => minIndex + index);
  if (timing.reverse) indexes.reverse();

  const lastIndex = timing.stopCount - 1;
  const offsetForIndex = (index: number) => Math.round((index / lastIndex) * timing.totalDuration);
  const routeOffsetForIndex = (index: number) =>
    timing.reverse ? timing.totalDuration - offsetForIndex(index) : offsetForIndex(index);

  return indexes.map((index) => ({
    name: stops[index],
    priority: index + 1,
    estimatedTime: formatMinutes12(timing.baseMinutes + routeOffsetForIndex(index)),
  }));
}

async function enrichBusRoutesFromAdminData(
  buses: BusSearchResult[],
  from: string,
  to: string,
): Promise<BusSearchResult[]> {
  if (buses.length === 0) return buses;

  try {
    const [adminBusRes, routeRes] = await Promise.all([
      httpGet<ApiResponse<AdminBusRouteInfo[]>>("/api/admin/buses"),
      httpGet<ApiResponse<RouteInfo[]>>("/api/routes"),
    ]);

    const adminBuses = new Map((adminBusRes.data ?? []).map((bus) => [bus.busId, bus]));
    const routes = new Map((routeRes.data ?? []).map((route) => [route.id, route]));

    return buses.map((bus) => {
      const currentLabel = bus.busRouteName || bus.routeName;
      const adminBus = adminBuses.get(bus.busId);
      const assignedRoute = adminBus?.routeId ? routes.get(adminBus.routeId) : undefined;
      const stops = assignedRoute?.stops ?? [];
      const stopLabel = buildRouteLabel(stops[0], stops[stops.length - 1]);
      const timing = resolveSegmentTiming(adminBus, assignedRoute, from, to);
      const segmentTiming = shouldReplaceSegmentTimes(bus, timing) ? timing : null;
      const keepCurrentLabel = !!currentLabel && !isSearchSegmentLabel(currentLabel, from, to);
      if (keepCurrentLabel && !segmentTiming) {
        return bus;
      }

      const adminRouteName =
        adminBus?.routeName && !isSearchSegmentLabel(adminBus.routeName, from, to)
          ? adminBus.routeName
          : "";
      const routeName =
        (keepCurrentLabel ? currentLabel : "") ||
        adminRouteName ||
        (assignedRoute?.name && !isSearchSegmentLabel(assignedRoute.name, from, to)
          ? assignedRoute.name
          : "") ||
        stopLabel;

      return routeName || segmentTiming
        ? {
            ...bus,
            ...(routeName
              ? {
                  routeName,
                  busRouteName: routeName,
                }
              : {}),
            routeStartLocation: bus.routeStartLocation || stops[0],
            routeEndLocation: bus.routeEndLocation || stops[stops.length - 1],
            ...(segmentTiming
              ? {
                  startTime: segmentTiming.startTime,
                  endTime: segmentTiming.endTime,
                }
              : {}),
          }
        : bus;
    });
  } catch (error) {
    console.warn("[BookingFlowApi] Failed to enrich bus routes", error);
    return buses;
  }
}

/* ── API calls ───────────────────────────────────────── */

async function enrichBusDetailFromAdminData(
  detail: BusDetailResult,
  busId: number,
  from?: string,
  to?: string,
): Promise<BusDetailResult> {
  if (!from || !to) return detail;

  try {
    const [adminBusRes, routeRes] = await Promise.all([
      httpGet<ApiResponse<AdminBusRouteInfo[]>>("/api/admin/buses"),
      httpGet<ApiResponse<RouteInfo[]>>("/api/routes"),
    ]);

    const adminBus = (adminBusRes.data ?? []).find((bus) => bus.busId === busId);
    const assignedRoute = adminBus?.routeId
      ? (routeRes.data ?? []).find((route) => route.id === adminBus.routeId)
      : undefined;
    const stops = assignedRoute?.stops ?? [];
    const timing = resolveSegmentTiming(adminBus, assignedRoute, from, to);
    const segmentTiming = shouldReplaceSegmentTimes(detail, timing) ? timing : null;

    const currentLabel = detail.busRouteName || detail.routeName;
    const stopLabel = buildRouteLabel(stops[0], stops[stops.length - 1]);
    const routeName =
      (currentLabel && !isSearchSegmentLabel(currentLabel, from, to) ? currentLabel : "") ||
      (adminBus?.routeName && !isSearchSegmentLabel(adminBus.routeName, from, to)
        ? adminBus.routeName
        : "") ||
      (assignedRoute?.name && !isSearchSegmentLabel(assignedRoute.name, from, to)
        ? assignedRoute.name
        : "") ||
      stopLabel;
    const routeStops = segmentTiming ? buildSegmentRouteStops(assignedRoute, segmentTiming) : null;

    return {
      ...detail,
      ...(routeName
        ? {
            routeName,
            busRouteName: routeName,
          }
        : {}),
      routeStartLocation: detail.routeStartLocation || stops[0],
      routeEndLocation: detail.routeEndLocation || stops[stops.length - 1],
      ...(segmentTiming
        ? {
            startTime: segmentTiming.startTime,
            endTime: segmentTiming.endTime,
            routeDuration: segmentTiming.routeDuration,
            routeStops: routeStops ?? detail.routeStops,
          }
        : {}),
    };
  } catch (error) {
    console.warn("[BookingFlowApi] Failed to enrich bus detail", error);
    return detail;
  }
}

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
  return enrichBusRoutesFromAdminData(res.data ?? [], from, to);
}

export async function getBusDetails(busId: number, from?: string, to?: string): Promise<BusDetailResult> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await httpGet<ApiResponse<BusDetailResult>>(
    `/api/booking-flow/buses/${busId}/details`,
    Object.keys(params).length > 0 ? params : undefined,
  );
  return enrichBusDetailFromAdminData(res.data, busId, from, to);
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
