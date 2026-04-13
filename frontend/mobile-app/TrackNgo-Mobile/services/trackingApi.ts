import { API_BASE_URL } from "../config/env";
import { httpGet, httpPost } from "./http";

/* ── Types ──────────────────────────────────────────────── */

export interface LiveBusLocation {
  busNumber: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface RouteStopGeo {
  name: string;
  latitude: number | null;
  longitude: number | null;
  priority: number;
  distanceFromStart: number | null;
  estimatedArrivalMins: number | null;
}

export interface RouteGeometry {
  routeId: number;
  routeName: string;
  startLocation: string;
  endLocation: string;
  stops: RouteStopGeo[];
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

/* ── REST Calls ─────────────────────────────────────────── */

export async function publishBusLocation(
  location: Omit<LiveBusLocation, "timestamp">,
): Promise<LiveBusLocation> {
  const resp = await httpPost<ApiResponse<LiveBusLocation>>(
    "/api/tracking/live-location",
    undefined,
    { ...location, timestamp: Date.now() },
  );
  return resp.data!;
}

export async function getLatestBusLocation(
  busNumber: string,
): Promise<LiveBusLocation | null> {
  const resp = await httpGet<ApiResponse<LiveBusLocation>>(
    `/api/tracking/live-location/${encodeURIComponent(busNumber)}`,
  );
  return resp.data ?? null;
}

export async function getRouteGeometry(
  start: string,
  end: string,
): Promise<RouteGeometry | null> {
  const resp = await httpGet<ApiResponse<RouteGeometry>>(
    "/api/tracking/route-geometry",
    { start, end },
  );
  return resp.data ?? null;
}

/* ── WebSocket Connection ───────────────────────────────── */

type LocationUpdateCallback = (location: LiveBusLocation) => void;

export class BusTrackingSocket {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, LocationUpdateCallback[]>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const wsBaseUrl = API_BASE_URL.replace(/^http/, "ws");
    const url = `${wsBaseUrl}/ws/tracking`;
    console.log("[TrackingWS] Connecting to", url);

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log("[TrackingWS] Connected");
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data: LiveBusLocation = JSON.parse(event.data);
        if (!data.busNumber || data.latitude == null || data.longitude == null) return;

        // Notify listeners for this specific bus
        const busListeners = this.listeners.get(data.busNumber) ?? [];
        busListeners.forEach((cb) => cb(data));

        // Notify wildcard listeners (listen to all buses)
        const allListeners = this.listeners.get("*") ?? [];
        allListeners.forEach((cb) => cb(data));
      } catch (e) {
        console.warn("[TrackingWS] Invalid message:", e);
      }
    };

    this.ws.onclose = () => {
      console.log("[TrackingWS] Disconnected");
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      }
    };

    this.ws.onerror = (e) => {
      console.warn("[TrackingWS] Error:", e);
    };
  }

  subscribe(busNumber: string, callback: LocationUpdateCallback) {
    const existing = this.listeners.get(busNumber) ?? [];
    existing.push(callback);
    this.listeners.set(busNumber, existing);
  }

  unsubscribe(busNumber: string, callback: LocationUpdateCallback) {
    const existing = this.listeners.get(busNumber) ?? [];
    this.listeners.set(
      busNumber,
      existing.filter((cb) => cb !== callback),
    );
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.listeners.clear();
  }

  sendLocation(location: LiveBusLocation) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(location));
    }
  }
}
