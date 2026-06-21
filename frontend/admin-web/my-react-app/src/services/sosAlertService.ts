export const SOS_API_BASE = 'http://127.0.0.1:8080'

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

// Sends the selected resolve or dismiss action for the current SOS alert.
export async function updateSosAlertStatus(sosId: number, action: SosAlertStatusAction): Promise<void> {
  const res = await fetch(`${SOS_API_BASE}/api/sos-alerts/${sosId}/${action}`, {
    method: 'PUT',
  })
  if (!res.ok) {
    throw new Error('Failed to update SOS alert status')
  }
}
