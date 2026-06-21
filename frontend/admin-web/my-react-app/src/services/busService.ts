const API_BASE = '/api/admin/buses';

type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

async function handleResponse<T>(res: Response): Promise<T> {
  const body: ApiResponse<T> = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.message || 'Request failed');
  }
  return body.data;
}

/* ── Types ────────────────────────────────────────────────── */

export type BusListItem = {
  busId: number;
  busNumber: string;
  busBrand: string;
  seatCapacity: number;
  busType: string;
  busCondition: string;
  status: string;
  amenities: string[];
  driverName: string | null;
  driverId: number | null;
  routeName: string | null;
  routeId: number | null;
  startTime: string | null;
  endTime: string | null;
  returnStartTime: string | null;
  returnEndTime: string | null;
  registrationNumber: string;
  insuranceExpDate: string | null;
};

export type BusDetail = {
  busId: number;
  busNumber: string;
  busBrand: string;
  seatCapacity: number;
  busType: string;
  busCondition: string;
  status: string;
  amenities: string[];
  startTime: string | null;
  endTime: string | null;
  returnStartTime: string | null;
  returnEndTime: string | null;
  registrationNumber: string;
  insuranceExpDate: string | null;
  driverId: number | null;
  driverName: string | null;
  driverPhone: string | null;
  driverRating: number;
  routeId: number | null;
  routeName: string | null;
  routeFee: number;
};

export type SaveBusRequest = {
  busNumber: string;
  busBrand: string;
  seatCapacity: number;
  busType: string;
  busCondition: string;
  status: string;
  amenities: string[];
  startTime: string | null;
  endTime: string | null;
  returnStartTime?: string | null;
  returnEndTime?: string | null;
  registrationNumber: string;
  insuranceExpDate: string;
  driverId: number | null;
  routeId: number | null;
};

export type SeatLayoutRow = {
  rowNum: number;
  left: string[];
  right: string[];
  lastRow: string[] | null;
};

export type SaveSeatLayoutRequest = {
  rows: SeatLayoutRow[];
  blockedSeats?: string[];
};

export type DriverOption = {
  driverId: number;
  name: string;
};

export type RouteOption = {
  routeId: number;
  routeName: string;
  durationMins: number;
};

/* ── API calls ────────────────────────────────────────────── */

export async function fetchBuses(): Promise<BusListItem[]> {
  const res = await fetch(API_BASE);
  return handleResponse<BusListItem[]>(res);
}

export async function fetchBusDetail(busId: number): Promise<BusDetail> {
  const res = await fetch(`${API_BASE}/${busId}`);
  return handleResponse<BusDetail>(res);
}

export async function createBus(bus: SaveBusRequest): Promise<number> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bus),
  });
  return handleResponse<number>(res);
}

export async function updateBus(busId: number, bus: SaveBusRequest): Promise<void> {
  const res = await fetch(`${API_BASE}/${busId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bus),
  });
  await handleResponse<void>(res);
}

export async function deleteBus(busId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/${busId}`, { method: 'DELETE' });
  await handleResponse<void>(res);
}

export async function fetchSeatLayout(busId: number): Promise<SeatLayoutRow[]> {
  const res = await fetch(`${API_BASE}/${busId}/seat-layout`);
  return handleResponse<SeatLayoutRow[]>(res);
}

export async function saveSeatLayout(busId: number, req: SaveSeatLayoutRequest): Promise<void> {
  const res = await fetch(`${API_BASE}/${busId}/seat-layout`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  await handleResponse<void>(res);
}

export async function fetchDriverOptions(): Promise<DriverOption[]> {
  const res = await fetch(`${API_BASE}/options/drivers`);
  return handleResponse<DriverOption[]>(res);
}

export async function fetchRouteOptions(): Promise<RouteOption[]> {
  const res = await fetch(`${API_BASE}/options/routes`);
  return handleResponse<RouteOption[]>(res);
}
