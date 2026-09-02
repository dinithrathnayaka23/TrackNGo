import authService from './authService'

// Same VITE_API_BASE_URL pattern as DashboardLayout.tsx / Chat.tsx: use the
// configured production backend origin when set, otherwise fall back to the
// local dev backend unchanged.
export const SOS_API_BASE =
  String(import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '') || 'http://127.0.0.1:8080'

export type EmergencyContact = {
  contactId: number
  name: string
  teleNumber: string
  relationship: string | null
}

export type SosAlertData = {
  sosId: number
  sharedLocation: string | null
  status: string
  triggeredAt: string
  resolvedAt: string | null
  passengerId: number | null
  driverId: number | null
  triggeredByType: string
  name: string
  phoneNumber: string | null
  profilePhoto: string | null
  routeName: string | null
  busNumber: string | null
  startLocation: string | null
  endLocation: string | null
  passengerName: string | null
  passengerPhoneNumber: string | null
  driverName: string | null
  driverPhoneNumber: string | null
  emergencyContacts: EmergencyContact[]
}

export type EmergencyServiceNumbers = {
  ambulance: string
  police: string
  fireBrigade: string
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export type SosAlertStatusAction = 'resolve' | 'dismiss'

// Parses the shared backend envelope and returns null when the response body is missing or invalid.
export async function readApiResponse<T>(res: Response): Promise<ApiResponse<T> | null> {
  const text = await res.text()
  if (!text) return null

  try {
    return JSON.parse(text) as ApiResponse<T>
  } catch {
    return null
  }
}

// Loads the currently triggered SOS alerts for the admin popup.
export async function fetchActiveSosAlerts(): Promise<SosAlertData[]> {
  const res = await fetch(`${SOS_API_BASE}/api/sos-alerts/active`)
  const json = await readApiResponse<SosAlertData[]>(res)
  if (!res.ok || !json?.success || !json.data) {
    return []
  }
  return json.data
}

// Loads the currently active emergency-service numbers displayed beside the alert.
export async function fetchActiveEmergencyNumbers(): Promise<Partial<EmergencyServiceNumbers> | null> {
  const res = await fetch(`${SOS_API_BASE}/api/emergency-numbers/active`)
  const json = await readApiResponse<Partial<EmergencyServiceNumbers>>(res)
  if (!res.ok || !json?.success || !json.data) {
    return null
  }
  return json.data
}

export type SosHistoryStatus = 'triggered' | 'resolved' | 'false_alarm'
export type SosHistoryTriggeredBy = 'passenger' | 'driver'

export type SosHistoryFilters = {
  /** Inclusive YYYY-MM-DD bounds; an empty string leaves that end of the range open. */
  from?: string
  to?: string
  status?: SosHistoryStatus | ''
  triggeredBy?: SosHistoryTriggeredBy | ''
}

/**
 * Loads past SOS alerts for the admin history report.
 *
 * Unlike the live-alert calls above, this endpoint names the people involved and their
 * phone numbers, so it is admin-only and goes through the proxied path with the admin's
 * bearer token rather than the open SOS base URL.
 */
export async function fetchSosAlertHistory(filters: SosHistoryFilters = {}): Promise<SosAlertData[]> {
  const token = authService.getToken()
  if (!token) {
    throw new Error('Your admin session has expired. Please sign in again.')
  }

  const query = new URLSearchParams()
  if (filters.from) query.set('from', filters.from)
  if (filters.to) query.set('to', filters.to)
  if (filters.status) query.set('status', filters.status)
  if (filters.triggeredBy) query.set('triggeredBy', filters.triggeredBy)

  const suffix = query.toString() ? `?${query.toString()}` : ''
  const res = await fetch(`/api/admin/sos-alerts/history${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  const json = await readApiResponse<SosAlertData[]>(res)
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `Could not load SOS history (HTTP ${res.status}).`)
  }
  return json.data ?? []
}

// Sends the selected resolve or dismiss action for the current SOS alert.
export async function updateSosAlertStatus(sosId: number, action: SosAlertStatusAction): Promise<void> {
  const res = await fetch(`${SOS_API_BASE}/api/sos-alerts/${sosId}/${action}`, {
    method: 'PUT',
  })
  if (!res.ok) {
    throw new Error('Failed to update SOS alert status')
  }
}
