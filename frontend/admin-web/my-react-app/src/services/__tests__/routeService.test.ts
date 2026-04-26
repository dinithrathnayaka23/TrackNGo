/**
 * Unit tests for routeService.ts (admin web)
 * Mocks the global fetch API.
 */

import {
  fetchRoutes,
  fetchRoute,
  createRoute,
  updateRoute,
  deleteRoute,
  toggleRouteStatus,
  type RouteRow,
} from '../../services/routeService';

// Helper to build a mock fetch response
function mockFetchOk<T>(data: T, ok = true, message = ok ? 'ok' : 'error'): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => ({ success: ok, message, data }),
  } as unknown as Response;
}

const mockRoute: RouteRow = {
  id: 1,
  name: 'Colombo - Kandy Express',
  code: 'CKE-001',
  type: 'highway',
  distance: '120 km',
  duration: '4h 0m',
  stops: ['Colombo', 'Peradeniya', 'Kandy'],
  activeBuses: 2,
  baseFare: 'Rs.1500',
  status: 'Active',
};

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockReset();
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ─── fetchRoutes ─────────────────────────────────────────────────────────────

describe('fetchRoutes', () => {
  it('fetches and returns all routes', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk([mockRoute]));

    const result = await fetchRoutes();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Colombo - Kandy Express');
    expect(result[0].code).toBe('CKE-001');
    expect(global.fetch).toHaveBeenCalledWith('/api/routes');
  });

  it('throws when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null, false, 'Server error'));

    await expect(fetchRoutes()).rejects.toThrow('Server error');
  });

  it('returns empty array when no routes exist', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk([]));

    const result = await fetchRoutes();
    expect(result).toEqual([]);
  });
});

// ─── fetchRoute ──────────────────────────────────────────────────────────────

describe('fetchRoute', () => {
  it('fetches single route by id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(mockRoute));

    const result = await fetchRoute(1);

    expect(result.id).toBe(1);
    expect(result.stops).toEqual(['Colombo', 'Peradeniya', 'Kandy']);
    expect(global.fetch).toHaveBeenCalledWith('/api/routes/1');
  });

  it('throws when route not found', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null, false, 'Route not found'));

    await expect(fetchRoute(99)).rejects.toThrow('Route not found');
  });
});

// ─── createRoute ─────────────────────────────────────────────────────────────

describe('createRoute', () => {
  const newRoute: RouteRow = {
    name: 'Colombo - Galle',
    code: 'CGE-001',
    type: 'expressway',
    distance: '126 km',
    duration: '2h 30m',
    stops: ['Colombo', 'Moratuwa', 'Galle'],
    activeBuses: 0,
    baseFare: 'Rs.800',
    status: 'Active',
  };

  it('creates a route and returns the created route', async () => {
    const created: RouteRow = { ...newRoute, id: 2 };
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(created));

    const result = await createRoute(newRoute);

    expect(result.id).toBe(2);
    expect(result.name).toBe('Colombo - Galle');
    expect(global.fetch).toHaveBeenCalledWith('/api/routes', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRoute),
    }));
  });

  it('throws when creation fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null, false, 'Route code already exists'));

    await expect(createRoute(newRoute)).rejects.toThrow('Route code already exists');
  });
});

// ─── updateRoute ─────────────────────────────────────────────────────────────

describe('updateRoute', () => {
  const updatedData: RouteRow = {
    ...mockRoute,
    name: 'Colombo - Kandy Updated',
  };

  it('updates route and returns updated data', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(updatedData));

    const result = await updateRoute(1, updatedData);

    expect(result.name).toBe('Colombo - Kandy Updated');
    expect(global.fetch).toHaveBeenCalledWith('/api/routes/1', expect.objectContaining({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    }));
  });

  it('throws when route not found', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null, false, 'Route not found'));

    await expect(updateRoute(99, updatedData)).rejects.toThrow('Route not found');
  });
});

// ─── deleteRoute ─────────────────────────────────────────────────────────────

describe('deleteRoute', () => {
  it('deletes route successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null));

    await expect(deleteRoute(1)).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith('/api/routes/1', { method: 'DELETE' });
  });

  it('throws when delete fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null, false, 'Delete failed'));

    await expect(deleteRoute(99)).rejects.toThrow('Delete failed');
  });
});

// ─── toggleRouteStatus ───────────────────────────────────────────────────────

describe('toggleRouteStatus', () => {
  it('toggles active route to inactive', async () => {
    const toggled: RouteRow = { ...mockRoute, status: 'Inactive' };
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(toggled));

    const result = await toggleRouteStatus(1);

    expect(result.status).toBe('Inactive');
    expect(global.fetch).toHaveBeenCalledWith('/api/routes/1/toggle-status', { method: 'PATCH' });
  });

  it('toggles inactive route to active', async () => {
    const inactive: RouteRow = { ...mockRoute, status: 'Inactive' };
    const toggled: RouteRow = { ...mockRoute, status: 'Active' };
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(toggled));

    const result = await toggleRouteStatus(inactive.id!);

    expect(result.status).toBe('Active');
  });

  it('throws when toggle fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null, false, 'Route not found'));

    await expect(toggleRouteStatus(99)).rejects.toThrow('Route not found');
  });
});
