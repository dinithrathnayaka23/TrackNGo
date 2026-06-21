/**
 * Unit tests for bookingFlowApi.ts (mobile app)
 * Uses Jest with global fetch mock.
 */

// Mock the http module so we don't make real network calls
jest.mock('../services/http', () => ({
  httpGet: jest.fn(),
  httpPost: jest.fn(),
}));

// Mock config/env
jest.mock('../config/env', () => ({
  API_BASE_URL: 'http://localhost:8080',
}));

import { httpGet, httpPost } from '../services/http';
import {
  searchBuses,
  getBusDetails,
  getSeatLayout,
  getBookedSeats,
  getBlockedSeats,
  createBooking,
  getBookingByRef,
  type BusSearchResult,
  type BusDetailResult,
  type SeatLayoutRow,
  type BookingConfirmation,
  type CreateBookingRequest,
} from '../services/bookingFlowApi';

const mockHttpGet = httpGet as jest.MockedFunction<typeof httpGet>;
const mockHttpPost = httpPost as jest.MockedFunction<typeof httpPost>;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── searchBuses ────────────────────────────────────────────────────────────

describe('searchBuses', () => {
  it('returns bus list on success', async () => {
    const buses: BusSearchResult[] = [
      {
        busId: 1,
        busNumber: 'NC-1234',
        busType: 'highway',
        busBrand: 'Toyota',
        startTime: '08:00',
        endTime: '12:00',
        seatCapacity: 40,
        availableSeats: 38,
        amenities: ['ac', 'wifi'],
        fee: 1500,
        driverName: 'John Doe',
        driverRating: 4.5,
        routeName: 'Colombo - Kandy',
        routeStops: [
          { name: 'Colombo', priority: 1 },
          { name: 'Kandy', priority: 10 },
        ],
      },
    ];
    mockHttpGet.mockResolvedValue({ success: true, message: 'ok', data: buses });

    const result = await searchBuses('Colombo', 'Kandy', '2025-05-01');

    expect(result).toHaveLength(1);
    expect(result[0].busId).toBe(1);
    expect(result[0].busNumber).toBe('NC-1234');
    expect(result[0].availableSeats).toBe(38);
    expect(mockHttpGet).toHaveBeenCalledWith(
      '/api/booking-flow/search',
      { from: 'Colombo', to: 'Kandy', date: '2025-05-01' },
    );
  });

  it('returns empty array when data is null/undefined', async () => {
    mockHttpGet.mockResolvedValue({ success: true, message: 'ok', data: null });

    const result = await searchBuses('Colombo', 'Kandy', '2025-05-01');
    expect(result).toEqual([]);
  });

  it('passes busCategory param when provided', async () => {
    mockHttpGet.mockResolvedValue({ success: true, message: 'ok', data: [] });

    await searchBuses('Colombo', 'Kandy', '2025-05-01', 'highway');

    expect(mockHttpGet).toHaveBeenCalledWith(
      '/api/booking-flow/search',
      { from: 'Colombo', to: 'Kandy', date: '2025-05-01', busCategory: 'highway' },
    );
  });

  it('propagates errors from http layer', async () => {
    mockHttpGet.mockRejectedValue(new Error('Network error'));

    await expect(searchBuses('Colombo', 'Kandy', '2025-05-01')).rejects.toThrow('Network error');
  });
});

// ─── getBusDetails ──────────────────────────────────────────────────────────

describe('getBusDetails', () => {
  const mockDetail: BusDetailResult = {
    busId: 1,
    busNumber: 'NC-1234',
    busType: 'highway',
    busBrand: 'Toyota',
    startTime: '08:00',
    endTime: '12:00',
    seatCapacity: 40,
    amenities: ['ac'],
    fee: 1500,
    routeName: 'Colombo - Kandy',
    routeDistance: '120 km',
    routeDuration: '4h 0m',
    routeStops: [{ name: 'Colombo Fort', estimatedTime: '08:00 AM', priority: 1 }],
    driver: { name: 'John Doe', phoneNumber: '+94771234567', rating: 4.5, profilePhoto: null },
  };

  it('returns bus detail without from/to params', async () => {
    mockHttpGet.mockResolvedValue({ success: true, message: 'ok', data: mockDetail });

    const result = await getBusDetails(1);

    expect(result.busId).toBe(1);
    expect(result.routeDistance).toBe('120 km');
    expect(mockHttpGet).toHaveBeenCalledWith(
      '/api/booking-flow/buses/1/details',
      undefined,
    );
  });

  it('passes from/to params when provided', async () => {
    mockHttpGet.mockResolvedValue({ success: true, message: 'ok', data: mockDetail });

    await getBusDetails(1, 'Colombo', 'Kandy');

    expect(mockHttpGet).toHaveBeenCalledWith(
      '/api/booking-flow/buses/1/details',
      { from: 'Colombo', to: 'Kandy' },
    );
  });
});

// ─── getSeatLayout ──────────────────────────────────────────────────────────

describe('getSeatLayout', () => {
  it('returns seat layout rows', async () => {
    const layout: SeatLayoutRow[] = [
      { rowNum: 1, left: ['A1', 'A2'], right: ['A3', 'A4'], lastRow: null },
    ];
    mockHttpGet.mockResolvedValue({ success: true, message: 'ok', data: layout });

    const result = await getSeatLayout(1);

    expect(result).toHaveLength(1);
    expect(result[0].rowNum).toBe(1);
    expect(result[0].left).toEqual(['A1', 'A2']);
  });

  it('returns empty array when data is null', async () => {
    mockHttpGet.mockResolvedValue({ success: true, message: 'ok', data: null });

    const result = await getSeatLayout(1);
    expect(result).toEqual([]);
  });
});

// ─── getBookedSeats ─────────────────────────────────────────────────────────

describe('getBookedSeats', () => {
  it('returns list of booked seat labels', async () => {
    mockHttpGet.mockResolvedValue({ success: true, message: 'ok', data: ['A1', 'B2'] });

    const result = await getBookedSeats(1, '2025-05-01');

    expect(result).toEqual(['A1', 'B2']);
    expect(mockHttpGet).toHaveBeenCalledWith(
      '/api/booking-flow/buses/1/booked-seats',
      { date: '2025-05-01' },
    );
  });

  it('returns empty array when no seats are booked', async () => {
    mockHttpGet.mockResolvedValue({ success: true, message: 'ok', data: null });

    const result = await getBookedSeats(1, '2025-05-01');
    expect(result).toEqual([]);
  });
});

// ─── getBlockedSeats ────────────────────────────────────────────────────────

describe('getBlockedSeats', () => {
  it('returns list of blocked seat labels', async () => {
    mockHttpGet.mockResolvedValue({ success: true, message: 'ok', data: ['C3', 'C4'] });

    const result = await getBlockedSeats(1);

    expect(result).toEqual(['C3', 'C4']);
    expect(mockHttpGet).toHaveBeenCalledWith(
      '/api/booking-flow/buses/1/blocked-seats',
    );
  });
});

// ─── createBooking ──────────────────────────────────────────────────────────

describe('createBooking', () => {
  const request: CreateBookingRequest = {
    busId: 1,
    journeyDate: '2025-05-01',
    journeyTime: '08:00',
    seatNumbers: ['A1', 'A2'],
    specialRequest: '',
    paymentMethod: 'stripe',
    totalAmount: 3000,
    passengerId: 100,
    fromLocation: 'Colombo',
    toLocation: 'Kandy',
  };

  it('creates booking and returns confirmation', async () => {
    const confirmation: BookingConfirmation = {
      bookingReference: 'BK-20250501-ABCD',
      status: 'confirmed',
      transactionId: 'TXN-ABCD1234',
      seatNumbers: 'A1,A2',
      totalAmount: 3000,
      busNumber: 'NC-1234',
      fromLocation: 'Colombo',
      toLocation: 'Kandy',
      journeyDate: '2025-05-01',
      journeyTime: '08:00',
    };
    mockHttpPost.mockResolvedValue({ success: true, message: 'ok', data: confirmation });

    const result = await createBooking(request);

    expect(result.bookingReference).toBe('BK-20250501-ABCD');
    expect(result.status).toBe('confirmed');
    expect(result.seatNumbers).toBe('A1,A2');
    expect(mockHttpPost).toHaveBeenCalledWith(
      '/api/booking-flow/bookings',
      undefined,
      request,
    );
  });

  it('propagates errors from http layer', async () => {
    mockHttpPost.mockRejectedValue(new Error('Server error'));

    await expect(createBooking(request)).rejects.toThrow('Server error');
  });
});

// ─── getBookingByRef ────────────────────────────────────────────────────────

describe('getBookingByRef', () => {
  it('returns booking confirmation for given reference', async () => {
    const confirmation: BookingConfirmation = {
      bookingReference: 'BK-20250501-ABCD',
      status: 'confirmed',
      transactionId: 'TXN-ABCD1234',
      seatNumbers: 'A1',
      totalAmount: 1500,
      busNumber: 'NC-1234',
      fromLocation: 'Colombo',
      toLocation: 'Kandy',
      journeyDate: '2025-05-01',
      journeyTime: '08:00',
    };
    mockHttpGet.mockResolvedValue({ success: true, message: 'ok', data: confirmation });

    const result = await getBookingByRef('BK-20250501-ABCD');

    expect(result.bookingReference).toBe('BK-20250501-ABCD');
    expect(result.fromLocation).toBe('Colombo');
  });
});
