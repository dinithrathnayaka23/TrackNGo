import authService from './authService'

export type AdminBooking = {
  bookingId: string
  passengerName: string
  route: string
  bus: string
  busType: string
  journeyDate: string | null
  journeyTime: string | null
  seats: string
  amount: number | null
  paymentStatus: string
  status: string
  category: string
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export async function fetchAdminBookings(): Promise<AdminBooking[]> {
  const token = authService.getToken()
  if (!token) throw new Error('Your admin session is missing. Please sign in again.')

  const response = await fetch('/api/admin/bookings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const text = await response.text()
  let body: ApiResponse<AdminBooking[]> | null = null
  if (text.trim()) {
    try {
      body = JSON.parse(text) as ApiResponse<AdminBooking[]>
    } catch {
      throw new Error(`The server returned an invalid response (${response.status}).`)
    }
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('Your admin session has expired or does not have permission to view bookings. Please sign in again.')
  }
  if (!response.ok || !body?.success) {
    throw new Error(body?.message || `Could not load bookings (HTTP ${response.status}).`)
  }
  return Array.isArray(body.data) ? body.data : []
}

export async function fetchTripBookingRequests(): Promise<AdminBooking[]> {
  const token = authService.getToken()
  if (!token) throw new Error('Your admin session is missing. Please sign in again.')
  const response = await fetch('/api/admin/bookings/trip-requests', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 404) {
    return fetchLegacyTripBookingRequests(token)
  }
  const text = await response.text()
  let body: ApiResponse<AdminBooking[]> | null = null
  if (text.trim()) {
    try { body = JSON.parse(text) as ApiResponse<AdminBooking[]> } catch { throw new Error(`The server returned an invalid response (${response.status}).`) }
  }
  if (response.status === 401 || response.status === 403) throw new Error('Your admin session has expired or does not have permission to view trip requests.')
  if (!response.ok || !body?.success) throw new Error(body?.message || `Could not load trip requests (HTTP ${response.status}).`)
  return Array.isArray(body.data) ? body.data : []
}

type LegacyTripBooking = {
  id: number
  startLocation: string
  destination: string
  startDate: string | null
  passengerCount: number
  finalPrice: number | null
  bookingStatus: string
  passengerId: number
  busId?: number | null
  busNumber?: string | null
  paymentStatus?: string | null
}

async function fetchLegacyTripBookingRequests(token: string): Promise<AdminBooking[]> {
  const response = await fetch('/api/trips/all', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Could not load trip requests (HTTP ${response.status}).`)
  let payload: unknown
  try { payload = text.trim() ? JSON.parse(text) : [] } catch { throw new Error(`The server returned an invalid trip-request response (${response.status}).`) }
  const trips = Array.isArray(payload) ? payload : (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data) ? (payload as { data: LegacyTripBooking[] }).data : [])
  return (trips as LegacyTripBooking[])
    .filter((trip) => ['pending', 'confirmed'].includes(String(trip.bookingStatus).toLowerCase()) && trip.busId != null && !['success', 'paid'].includes(String(trip.paymentStatus ?? '').toLowerCase()))
    .map((trip) => ({
      bookingId: `BK-${trip.id}`,
      passengerName: `Passenger #${trip.passengerId}`,
      route: `${trip.startLocation} - ${trip.destination}`,
      bus: trip.busNumber || 'Pending assignment',
      busType: 'trip_booking',
      journeyDate: trip.startDate,
      journeyTime: '08:00:00',
      seats: `${trip.passengerCount} seats`,
      amount: trip.finalPrice,
      paymentStatus: trip.paymentStatus || 'unpaid',
      status: trip.bookingStatus,
      category: 'Trip Bookings',
    }))
}

export type TripBookingReviewRequest = {
  finalPrice?: number
  discountAmount?: number
  adminNote?: string
  decision: 'approved' | 'rejected'
}

export async function reviewTripBooking(bookingId: string, request: TripBookingReviewRequest): Promise<void> {
  const token = authService.getToken()
  if (!token) throw new Error('Your admin session is missing. Please sign in again.')
  const numericId = bookingId.replace(/^#(?:BK-)?/, '')
  const response = await fetch(`/api/trips/book/${encodeURIComponent(numericId)}/review`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  const text = await response.text()
  let body: { message?: string } | null = null
  if (text.trim()) {
    try { body = JSON.parse(text) as { message?: string } } catch { /* Use the HTTP status below. */ }
  }
  if (response.status === 401 || response.status === 403) throw new Error('Your admin session has expired or does not have permission to review bookings.')
  if (!response.ok) throw new Error(body?.message || `Could not update booking (HTTP ${response.status}).`)
}
