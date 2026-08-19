import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpGet, httpPost } from "./http";

const TOKEN_KEY = "trackngo.auth.token";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface RatingContextDto {
  bookingReference: string;
  startLocation?: string | null;
  endLocation?: string | null;
  journeyDate?: string | null;
  busNumber?: string | null;
  busType?: string | null;
  driverId?: number | null;
  driverName?: string | null;
  busId?: number | null;
  alreadyRated: boolean;
  driverRating?: number | null;
  busRating?: number | null;
  journeyRating?: number | null;
  comment?: string | null;
}

export interface RatingDto {
  id: number;
  bookingReference: string;
  passengerId?: number | null;
  driverId?: number | null;
  busId?: number | null;
  routeId?: number | null;
  driverRating?: number | null;
  busRating?: number | null;
  journeyRating?: number | null;
  comment?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface SubmitRatingRequest {
  bookingReference: string;
  driverRating?: number | null;
  busRating?: number | null;
  journeyRating: number;
  comment?: string | null;
}

async function authHeaders(): Promise<Record<string, string> | undefined> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

/** Loads the driver/bus/journey to rate for a booking, including any rating already submitted. */
export async function getRatingContext(
  bookingReference: string,
  userId?: number,
): Promise<RatingContextDto> {
  const headers = await authHeaders();
  const res = await httpGet<ApiResponse<RatingContextDto>>(
    "/api/ratings/context",
    { bookingReference, ...(userId ? { userId } : {}) },
    headers,
  );
  return res.data;
}

/** Creates or updates the current user's rating for a past booking. */
export async function submitRating(
  payload: SubmitRatingRequest,
  userId?: number,
): Promise<RatingDto> {
  const headers = await authHeaders();
  const res = await httpPost<ApiResponse<RatingDto>>(
    "/api/ratings",
    userId ? { userId } : undefined,
    payload,
    headers,
  );
  return res.data;
}
