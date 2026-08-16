import authService from "./authService";

export type AnalyticsSummary = {
  bookings: number;
  revenue: number;
  activeUsers: number;
  avgBookingValue: number;
  /** Null when the preceding window had no data to compare against. */
  bookingsTrendPct: number | null;
  revenueTrendPct: number | null;
  activeUsersTrendPct: number | null;
  avgBookingValueTrendPct: number | null;
};

export type AnalyticsDailyPoint = {
  date: string;
  total: number;
  highway: number;
  longDistance: number;
  tripBooking: number;
  corporate: number;
};

export type AnalyticsStatusRow = {
  type: string;
  completed: number;
  pending: number;
  cancelled: number;
};

export type AnalyticsCategorySlice = {
  type: string;
  bookings: number;
  sharePct: number;
};

export type AnalyticsResponse = {
  from: string;
  to: string;
  summary: AnalyticsSummary;
  series: AnalyticsDailyPoint[];
  statusByType: AnalyticsStatusRow[];
  categoryMix: AnalyticsCategorySlice[];
};

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

const API_BASE = "/api/admin/analytics";

export async function fetchAnalytics(
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<AnalyticsResponse> {
  const token = authService.getToken();
  const query = new URLSearchParams({ from, to });

  const response = await fetch(`${API_BASE}?${query.toString()}`, {
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as ApiResponse<AnalyticsResponse>) : null;

  if (!response.ok || !body?.success) {
    throw new Error(body?.message || "Failed to load analytics");
  }

  return body.data;
}
