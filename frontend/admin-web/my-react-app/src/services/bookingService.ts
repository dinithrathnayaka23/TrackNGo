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
  cancellationStatus?: string | null
  cancellationReason?: string | null
  cancellationRequestedBy?: string | null
  cancellationRejectReason?: string | null
  refundPercentage?: number | null
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
  estimatedPrice?: number | null
  discountAmount?: number | null
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
      amount: trip.finalPrice ?? trip.estimatedPrice ?? 0,
      paymentStatus: trip.paymentStatus || 'unpaid',
      status: trip.bookingStatus,
      category: 'Trip Bookings',
    }))
}

export type TripPricingSettings = {
  dailyRate: number
  smallBusRatePerKm: number
  largeBusRatePerKm: number
  passengerThreshold: number
  acSurchargePercent: number
  miniBusSurcharge: number
  advancePaymentPercent: number
  updatedAt: string | null
}

/**
 * Trip-booking pricing endpoints return the raw settings object directly on
 * success (matching every other `/api/trips/**` endpoint in this
 * controller), but fall back to the shared `{success, message, data}`
 * envelope on error via GlobalExceptionHandler — so only the failure path
 * needs to check for a wrapper.
 */
function extractErrorMessage(body: unknown): string | undefined {
  if (body && typeof body === 'object' && 'message' in body) {
    return (body as { message?: string }).message
  }
  return undefined
}

export async function fetchTripPricingSettings(): Promise<TripPricingSettings> {
  const token = authService.getToken()
  if (!token) throw new Error('Your admin session is missing. Please sign in again.')
  const response = await fetch('/api/trips/pricing-settings', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const text = await response.text()
  let body: unknown = null
  if (text.trim()) {
    try { body = JSON.parse(text) } catch { throw new Error(`The server returned an invalid response (${response.status}).`) }
  }
  if (!response.ok) {
    throw new Error(extractErrorMessage(body) || `Could not load trip pricing settings (HTTP ${response.status}).`)
  }
  return body as TripPricingSettings
}

export async function updateTripPricingSettings(
  settings: Omit<TripPricingSettings, 'updatedAt'>,
): Promise<TripPricingSettings> {
  const token = authService.getToken()
  if (!token) throw new Error('Your admin session is missing. Please sign in again.')
  const response = await fetch('/api/trips/pricing-settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  const text = await response.text()
  let body: unknown = null
  if (text.trim()) {
    try { body = JSON.parse(text) } catch { throw new Error(`The server returned an invalid response (${response.status}).`) }
  }
  if (!response.ok) {
    throw new Error(extractErrorMessage(body) || `Could not save trip pricing settings (HTTP ${response.status}).`)
  }
  return body as TripPricingSettings
}

type AdminContractSummary = {
  contractId: number
  contractName: string
  companyName: string | null
  contactPersonName: string | null
  startingLocation: string | null
  destination: string | null
  shiftType: string
  employeeCount: number
  busType: string
  status: string
  billingAmount: number
  startDate: string | null
  endDate: string | null
  busCount: number
  busNumbers: string | null
  advancePaymentStatus: string
}

/**
 * Corporate contracts, reshaped into the same generic `AdminBooking` row the
 * Bookings screen already renders for trip/seat bookings — reuses the
 * existing `/api/corporate/contracts/admin` endpoint (the one `Contracts.tsx`
 * calls) rather than adding a new backend read path.
 */
export async function fetchAdminCorporateBookings(): Promise<AdminBooking[]> {
  const token = authService.getToken()
  if (!token) throw new Error('Your admin session is missing. Please sign in again.')
  const response = await fetch('/api/corporate/contracts/admin', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const text = await response.text()
  let body: ApiResponse<AdminContractSummary[]> | null = null
  if (text.trim()) {
    try {
      body = JSON.parse(text) as ApiResponse<AdminContractSummary[]>
    } catch {
      throw new Error(`The server returned an invalid response (${response.status}).`)
    }
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('Your admin session has expired or does not have permission to view corporate bookings.')
  }
  if (!response.ok || !body?.success) {
    throw new Error(body?.message || `Could not load corporate bookings (HTTP ${response.status}).`)
  }
  const contracts = Array.isArray(body.data) ? body.data : []
  return contracts.map((contract) => ({
    bookingId: `CORP-${contract.contractId}`,
    passengerName: contract.contactPersonName || contract.companyName || 'Corporate client',
    route: contract.startingLocation && contract.destination
      ? `${contract.startingLocation} → ${contract.destination}`
      : contract.contractName,
    bus: contract.busNumbers || (contract.busCount ? `${contract.busCount} bus${contract.busCount === 1 ? '' : 'es'}` : 'Not assigned'),
    busType: contract.busType,
    journeyDate: contract.startDate,
    journeyTime: null,
    seats: `${contract.employeeCount} employees`,
    amount: contract.billingAmount,
    paymentStatus: contract.advancePaymentStatus,
    status: contract.status,
    category: 'Corporate Bookings',
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

export async function requestAdminCancellation(booking: AdminBooking, reason: string): Promise<void> {
  const token = authService.getToken()
  if (!token) throw new Error('Your admin session is missing. Please sign in again.')
  const cleanId = booking.bookingId.replace(/^#/, '')
  const isTrip = booking.busType === 'trip_booking' || cleanId.startsWith('BK-')
  const url = isTrip
    ? `/api/trips/book/${encodeURIComponent(cleanId.replace(/^BK-/, ''))}/cancellation-request`
    : `/api/booking-flow/bookings/${encodeURIComponent(cleanId)}/cancellation-request`

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, requesterType: 'admin' }),
  })
  const text = await response.text()
  let body: { message?: string } | null = null
  if (text.trim()) {
    try { body = JSON.parse(text) as { message?: string } } catch { /* Ignore */ }
  }
  if (!response.ok) throw new Error(body?.message || `Could not request cancellation (HTTP ${response.status}).`)
}

export async function respondToAdminCancellation(
  booking: AdminBooking,
  accept: boolean,
  rejectReason?: string,
): Promise<void> {
  const token = authService.getToken()
  if (!token) throw new Error('Your admin session is missing. Please sign in again.')
  const cleanId = booking.bookingId.replace(/^#/, '')
  const isTrip = booking.busType === 'trip_booking' || cleanId.startsWith('BK-')
  const url = isTrip
    ? `/api/trips/book/${encodeURIComponent(cleanId.replace(/^BK-/, ''))}/cancellation-response`
    : `/api/booking-flow/bookings/${encodeURIComponent(cleanId)}/cancellation-response`

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accept, rejectReason, responderType: 'admin' }),
  })
  const text = await response.text()
  let body: { message?: string } | null = null
  if (text.trim()) {
    try { body = JSON.parse(text) as { message?: string } } catch { /* Ignore */ }
  }
  if (!response.ok) throw new Error(body?.message || `Could not process cancellation response (HTTP ${response.status}).`)
}

