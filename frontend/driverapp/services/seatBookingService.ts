import AsyncStorage from '@react-native-async-storage/async-storage';

// Use the same IP as other screens in the app
const API_BASE_URL = 'http://10.43.239.185:8080/api';

console.log('🔌 API_BASE_URL:', API_BASE_URL);

interface SeatLayoutRow {
  rowNum: number;
  left: string[];
  right: string[];
  lastRow: string[] | null;
}

interface BookedSeatData {
  seatBookingId?: number;
  bookingReference?: string;
  journeyDate?: string;
  journeyTime?: string;
  seatNumber: string;
  passengerName?: string;
  passengerId?: number;
  passengerPhone?: string;
  totalAmount?: number;
  status?: string;
  fromStop?: string;
  toStop?: string;
  specialRequest?: string;
}

interface BusAssignment {
  busId: number;
  busNumber: string;
  routeId: number;
  routeName: string;
  seatCapacity: number;
  startTime?: string;
  endTime?: string;
  busBrand?: string;
  busCondition?: string;
  busType?: string;
  registrationNumber?: string;
  insuranceExpDate?: string;
  amenities?: string;
  status?: string;
}

interface RouteInfo {
  routeId: number;
  routeName: string;
  startLocation: string;
  endLocation: string;
  estimatedTimeInMinutes: number;
}

export const seatBookingService = {
  /**
   * Get the assigned bus for a specific driver
   */
  async getDriverAssignment(driverId: number, token: string): Promise<BusAssignment> {
    try {
      const url = `${API_BASE_URL}/drivers/${driverId}/profile-and-assignment`;
      console.log('📡 Fetching driver assignment from:', url);
      console.log('🔑 Token:', token ? '***' : 'MISSING');
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('📊 Response status:', response.status);
      console.log('📝 Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`Failed to fetch driver assignment: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Driver assignment data:', data);
      
      // Handle nested response structure: data.data.assignment
      const assignment = data.data?.assignment || data.assignment || data.busAssignment;
      console.log('📦 Extracted assignment:', assignment);
      
      return assignment;
    } catch (error) {
      console.error('❌ Error fetching driver assignment:', error);
      throw error;
    }
  },

  /**
   * Get seat layout for a specific bus
   */
  async getSeatLayout(busId: number, token: string): Promise<SeatLayoutRow[]> {
    try {
      const url = `${API_BASE_URL}/booking-flow/buses/${busId}/seat-layout`;
      console.log('📡 Fetching seat layout from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`Failed to fetch seat layout: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Seat layout raw data:', data);

      let rows = data.data || data || [];
      if (Array.isArray(data)) {
        rows = data;
      } else if (rows && typeof rows === 'object' && !Array.isArray(rows)) {
        rows = [rows];
      } else if (!Array.isArray(rows)) {
        rows = [];
      }

      console.log('📦 Extracted seat rows:', rows);
      return rows;
    } catch (error) {
      console.error('❌ Error fetching seat layout:', error);
      throw error;
    }
  },

  /**
   * Get booked seats for a specific bus on a given date
   */
  async getBookedSeats(
    busId: number,
    journeyDate: string,
    token: string
  ): Promise<BookedSeatData[]> {
    const detailUrl = `${API_BASE_URL}/booking-flow/buses/${busId}/booked-seats-details?date=${journeyDate}`;
    const legacyUrl = `${API_BASE_URL}/booking-flow/buses/${busId}/booked-seats?date=${journeyDate}`;

    const fetchBookedSeats = async (url: string) => {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ Booked seats fetch failed for ${url}:`, response.status, errorText);
        return { status: response.status, body: errorText, ok: false } as const;
      }

      const data = await response.json();
      return { ok: true, data } as const;
    };

    console.log('📡 Fetching booked seats details from:', detailUrl);
    const detailResponse = await fetchBookedSeats(detailUrl);

    if (detailResponse.ok) {
      const data = detailResponse.data;
      console.log('✅ Booked seats data:', data);
      let bookings = data.data || data || [];
      if (Array.isArray(data)) {
        bookings = data;
      } else if (bookings && typeof bookings === 'object' && !Array.isArray(bookings)) {
        bookings = [bookings];
      } else if (!Array.isArray(bookings)) {
        bookings = [];
      }

      console.log('📦 Extracted bookings:', bookings);
      return bookings.map((booking: any) => ({
        seatBookingId: booking.seatBookingId,
        bookingReference: booking.bookingReference,
        journeyDate: booking.journeyDate,
        journeyTime: booking.journeyTime,
        seatNumber: booking.seatNumber,
        passengerName: booking.passengerName,
        passengerId: booking.passengerId,
        passengerPhone: booking.passengerPhone,
        totalAmount: booking.totalAmount,
        status: booking.status,
        fromStop: booking.fromStop,
        toStop: booking.toStop,
        specialRequest: booking.specialRequest,
      }));
    }

    if (detailResponse.status === 404) {
      console.warn('⚠️ Booked seats details endpoint not found, falling back to legacy endpoint:', legacyUrl);
      const legacyResponse = await fetchBookedSeats(legacyUrl);
      if (!legacyResponse.ok) {
        throw new Error(`Failed to fetch booked seats: ${legacyResponse.status}`);
      }

      const data = legacyResponse.data;
      console.log('✅ Legacy booked seats data:', data);
      let seatNumbers = data.data || data || [];
      if (Array.isArray(data)) {
        seatNumbers = data;
      } else if (seatNumbers && typeof seatNumbers === 'object' && !Array.isArray(seatNumbers)) {
        seatNumbers = [seatNumbers];
      } else if (!Array.isArray(seatNumbers)) {
        seatNumbers = [];
      }

      return seatNumbers.map((seatId: any) => ({
        seatNumber: seatId.toString(),
        status: 'booked',
      }));
    }

    throw new Error(`Failed to fetch booked seats: ${detailResponse.status}`);
  },

  /**
   * Get bus details including route and timing information
   */
  async getBusDetails(busId: number, token: string): Promise<any> {
    try {
      const url = `${API_BASE_URL}/booking-flow/buses/${busId}/details`;
      console.log('📡 Fetching bus details from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        throw new Error(`Failed to fetch bus details: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Bus details data:', data);
      
      // Handle nested response structure
      const busDetails = data.data || data;
      console.log('📦 Extracted bus details:', busDetails);
      
      return busDetails;
    } catch (error) {
      console.error('❌ Error fetching bus details:', error);
      throw error;
    }
  },

  /**
   * Mark a passenger as boarded
   */
  async markPassengerBoarded(
    seatBookingId: number,
    token: string
  ): Promise<boolean> {
    try {
      const url = `${API_BASE_URL}/bookings/${seatBookingId}/boarded`;
      console.log('📡 Marking passenger as boarded:', url);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'boarded' }),
      });

      console.log('📊 Mark boarded response status:', response.status);
      
      if (response.ok) {
        console.log('✅ Passenger marked as boarded successfully');
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ Error response:', errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ Error marking passenger as boarded:', error);
      throw error;
    }
  },

  /**
   * Get token from AsyncStorage
   */
  async getToken(): Promise<string> {
    const token = await AsyncStorage.getItem('token');
    if (!token) {
      throw new Error('No auth token found');
    }
    return token;
  },

  /**
   * Get route details
   */
  async getRouteDetails(routeId: number, token: string): Promise<any> {
    try {
      const url = `${API_BASE_URL}/routes/${routeId}`;
      console.log('🗺️ Fetching route details from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.warn('⚠️ Route details not available, using route name fallback');
        return null;
      }

      const data = await response.json();
      console.log('✅ Route details data:', data);
      
      const routeDetails = data.data || data;
      console.log('📦 Extracted route details:', routeDetails);
      
      return routeDetails;
    } catch (error) {
      console.error('⚠️ Error fetching route details (non-critical):', error);
      return null;
    }
  },
};
