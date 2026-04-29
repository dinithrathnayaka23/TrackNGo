/**
 * Unit tests for busService.ts (admin web)
 * Mocks the global fetch API.
 */

import {
  fetchBuses,
  fetchBusDetail,
  createBus,
  updateBus,
  deleteBus,
  fetchSeatLayout,
  saveSeatLayout,
  fetchDriverOptions,
  fetchRouteOptions,
  type BusListItem,
  type BusDetail,
  type SaveBusRequest,
  type SeatLayoutRow,
  type DriverOption,
  type RouteOption,
} from '../../services/busService';

// Helper to build a mock fetch response
function mockFetchOk<T>(data: T, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: async () => ({ success: ok, message: ok ? 'ok' : 'error', data }),
  } as unknown as Response;
}

beforeEach(() => {
  jest.spyOn(global, 'fetch').mockReset();
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ─── fetchBuses ─────────────────────────────────────────────────────────────

describe('fetchBuses', () => {
  const mockBus: BusListItem = {
    busId: 1,
    busNumber: 'NC-1234',
    busBrand: 'Toyota',
    seatCapacity: 40,
    busType: 'highway',
    busCondition: 'good',
    status: 'active',
    amenities: ['ac'],
    driverName: 'John Doe',
    driverId: 5,
    routeName: 'Colombo - Kandy',
    routeId: 2,
    startTime: '08:00',
    endTime: '12:00',
    registrationNumber: 'NC-1234',
    insuranceExpDate: '2026-01-01',
  };

  it('fetches buses and returns list', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk([mockBus]));

    const result = await fetchBuses();

    expect(result).toHaveLength(1);
    expect(result[0].busId).toBe(1);
    expect(result[0].busNumber).toBe('NC-1234');
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/buses');
  });

  it('throws when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null, false));

    await expect(fetchBuses()).rejects.toThrow('error');
  });
});

// ─── fetchBusDetail ─────────────────────────────────────────────────────────

describe('fetchBusDetail', () => {
  const mockDetail: BusDetail = {
    busId: 1,
    busNumber: 'NC-1234',
    busBrand: 'Toyota',
    seatCapacity: 40,
    busType: 'highway',
    busCondition: 'good',
    status: 'active',
    amenities: ['ac'],
    startTime: '08:00',
    endTime: '12:00',
    registrationNumber: 'NC-1234',
    insuranceExpDate: '2026-01-01',
    driverId: 5,
    driverName: 'John Doe',
    driverPhone: '+94771234567',
    driverRating: 4.5,
    routeId: 2,
    routeName: 'Colombo - Kandy',
    routeFee: 1500,
  };

  it('fetches bus detail by id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(mockDetail));

    const result = await fetchBusDetail(1);

    expect(result.busId).toBe(1);
    expect(result.driverRating).toBe(4.5);
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/buses/1');
  });
});

// ─── createBus ──────────────────────────────────────────────────────────────

describe('createBus', () => {
  const request: SaveBusRequest = {
    busNumber: 'NC-9999',
    busBrand: 'Toyota',
    seatCapacity: 40,
    busType: 'highway',
    busCondition: 'good',
    status: 'active',
    amenities: ['ac'],
    startTime: '08:00',
    endTime: '12:00',
    registrationNumber: 'NC-9999',
    insuranceExpDate: '2026-01-01',
    driverId: 5,
    routeId: 2,
  };

  it('creates bus and returns new id', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(99));

    const id = await createBus(request);

    expect(id).toBe(99);
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/buses', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }));
  });
});

// ─── updateBus ──────────────────────────────────────────────────────────────

describe('updateBus', () => {
  const request: SaveBusRequest = {
    busNumber: 'NC-1234',
    busBrand: 'Toyota',
    seatCapacity: 40,
    busType: 'highway',
    busCondition: 'excellent',
    status: 'active',
    amenities: ['ac', 'wifi'],
    startTime: '08:00',
    endTime: '12:00',
    registrationNumber: 'NC-1234',
    insuranceExpDate: '2027-01-01',
    driverId: 5,
    routeId: 2,
  };

  it('updates bus successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null));

    await expect(updateBus(1, request)).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/buses/1', expect.objectContaining({
      method: 'PUT',
    }));
  });

  it('throws when update fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null, false));

    await expect(updateBus(1, request)).rejects.toThrow('error');
  });
});

// ─── deleteBus ──────────────────────────────────────────────────────────────

describe('deleteBus', () => {
  it('deletes bus successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null));

    await expect(deleteBus(1)).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/buses/1', { method: 'DELETE' });
  });

  it('throws when bus not found', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null, false));

    await expect(deleteBus(999)).rejects.toThrow('error');
  });
});

// ─── fetchSeatLayout ────────────────────────────────────────────────────────

describe('fetchSeatLayout', () => {
  it('fetches seat layout rows', async () => {
    const layout: SeatLayoutRow[] = [
      { rowNum: 1, left: ['A1', 'A2'], right: ['A3', 'A4'], lastRow: null },
    ];
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(layout));

    const result = await fetchSeatLayout(1);

    expect(result).toHaveLength(1);
    expect(result[0].left).toEqual(['A1', 'A2']);
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/buses/1/seat-layout');
  });
});

// ─── saveSeatLayout ─────────────────────────────────────────────────────────

describe('saveSeatLayout', () => {
  it('saves seat layout successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(null));

    await expect(
      saveSeatLayout(1, { rows: [{ rowNum: 1, left: ['A1'], right: ['A2'], lastRow: null }] })
    ).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith('/api/admin/buses/1/seat-layout', expect.objectContaining({
      method: 'PUT',
    }));
  });
});

// ─── fetchDriverOptions ─────────────────────────────────────────────────────

describe('fetchDriverOptions', () => {
  it('returns driver option list', async () => {
    const drivers: DriverOption[] = [{ driverId: 1, name: 'John Doe' }];
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(drivers));

    const result = await fetchDriverOptions();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('John Doe');
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/buses/options/drivers');
  });
});

// ─── fetchRouteOptions ──────────────────────────────────────────────────────

describe('fetchRouteOptions', () => {
  it('returns route option list', async () => {
    const routes: RouteOption[] = [{ routeId: 1, routeName: 'Colombo - Kandy', durationMins: 240 }];
    (global.fetch as jest.Mock).mockResolvedValue(mockFetchOk(routes));

    const result = await fetchRouteOptions();

    expect(result).toHaveLength(1);
    expect(result[0].routeName).toBe('Colombo - Kandy');
    expect(result[0].durationMins).toBe(240);
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/buses/options/routes');
  });
});
