const API_BASE = '/api';

export type RouteRow = {
  id?: number;
  name: string;
  code: string;
  type: string;
  distance: string;
  duration: string;
  stops: string[];
  activeBuses: number;
  baseFare: string;
  status: 'Active' | 'Inactive';
};

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

export async function fetchRoutes(): Promise<RouteRow[]> {
  const res = await fetch(`${API_BASE}/routes`);
  return handleResponse<RouteRow[]>(res);
}

export async function fetchRoute(id: number): Promise<RouteRow> {
  const res = await fetch(`${API_BASE}/routes/${id}`);
  return handleResponse<RouteRow>(res);
}

export async function createRoute(route: RouteRow): Promise<RouteRow> {
  const res = await fetch(`${API_BASE}/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(route),
  });
  return handleResponse<RouteRow>(res);
}

export async function updateRoute(id: number, route: RouteRow): Promise<RouteRow> {
  const res = await fetch(`${API_BASE}/routes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(route),
  });
  return handleResponse<RouteRow>(res);
}

export async function deleteRoute(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/routes/${id}`, {
    method: 'DELETE',
  });
  const body: ApiResponse<void> = await res.json();
  if (!res.ok || !body.success) {
    throw new Error(body.message || 'Delete failed');
  }
}

export async function toggleRouteStatus(id: number): Promise<RouteRow> {
  const res = await fetch(`${API_BASE}/routes/${id}/toggle-status`, {
    method: 'PATCH',
  });
  return handleResponse<RouteRow>(res);
}
