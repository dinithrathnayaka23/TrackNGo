import { apiUrl } from '@/config/env';

export interface LiveBusLocation {
  busNumber: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  /** Horizontal accuracy radius in metres reported by the device. */
  accuracy?: number | null;
  /** Quality of the fix, 0-100, scored by the server from `accuracy`. */
  accuracyPercent?: number | null;
  /** Fix quality folded together with how old the fix is, 0-100. */
  confidencePercent?: number | null;
  timestamp?: number | null;
  serverTimestamp?: number | null;
  ageSeconds?: number | null;
  stale?: boolean | null;
}

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T | null;
}

/** Thrown when the server accepted the request but rejected the GPS fix. */
export class LocationRejectedError extends Error {
  readonly lastKnown: LiveBusLocation | null;

  constructor(message: string, lastKnown: LiveBusLocation | null) {
    super(message);
    this.name = "LocationRejectedError";
    this.lastKnown = lastKnown;
  }
}

export async function publishDriverLocation(
  token: string,
  location: LiveBusLocation
): Promise<LiveBusLocation> {
  const response = await fetch(apiUrl('/api/tracking/live-location'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(location),
  });

  if (!response.ok) {
    throw new Error(`Failed to publish live location: ${response.status}`);
  }

  const result: ApiResponse<LiveBusLocation> = await response.json();

  /*
    The server drops fixes it judges impossible or too imprecise to show a
    passenger. That is a healthy outcome, not a transport failure, so it comes
    back as a 200 with success=false and the last position it did trust.
  */
  if (result.success === false) {
    throw new LocationRejectedError(
      result.message ?? "Location rejected by server",
      result.data ?? null,
    );
  }

  return result.data ?? location;
}

export async function getLatestBusLocation(
  token: string,
  busNumber: string
): Promise<LiveBusLocation | null> {
  const response = await fetch(
    apiUrl(`/api/tracking/live-location/${encodeURIComponent(busNumber)}`),
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const result: ApiResponse<LiveBusLocation> = await response.json();
  return result.data ?? null;
}
