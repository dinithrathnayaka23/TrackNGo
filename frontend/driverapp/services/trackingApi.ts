import { apiUrl } from '@/config/env';

export interface LiveBusLocation {
  busNumber: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number | null;
}

interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T | null;
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
