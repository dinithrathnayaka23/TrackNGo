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
