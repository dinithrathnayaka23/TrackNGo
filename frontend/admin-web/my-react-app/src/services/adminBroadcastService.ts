import authService from './authService'

export type BroadcastAudience = 'passengers' | 'drivers' | 'corporate'

/** Categories the backend accepts for an admin-composed broadcast. */
export type BroadcastCategory = 'system_alert' | 'promotion' | 'journey'

export type AudienceCounts = Record<BroadcastAudience, number>

export type BroadcastRequest = {
  audiences: BroadcastAudience[]
  notificationType: BroadcastCategory
  title: string
  message: string
}

export type BroadcastResult = {
  passengers: number
  drivers: number
  corporate: number
  total: number
}

export const audienceLabels: Record<BroadcastAudience, string> = {
  passengers: 'Passengers',
  drivers: 'Drivers',
  corporate: 'Corporate users',
}

export const categoryLabels: Record<BroadcastCategory, string> = {
  system_alert: 'System alert',
  promotion: 'Promotion',
  journey: 'Journey update',
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authService.getToken()
  if (!token) {
    throw new Error('Your admin session has expired. Please sign in again.')
  }

  const response = await fetch(`/api/admin/notifications${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })

  const text = await response.text()
  let body: ApiResponse<T> | null = null
  if (text.trim()) {
    try {
      body = JSON.parse(text) as ApiResponse<T>
    } catch {
      throw new Error(`The server returned an invalid response (${response.status}).`)
    }
  }

  if (!response.ok || !body?.success) {
    throw new Error(body?.message || `Notification request failed (HTTP ${response.status}).`)
  }
  return body.data
}

/** Counts the accounts each audience currently reaches, so a send can be sized first. */
export function fetchAudienceCounts() {
  return request<AudienceCounts>('/audience-counts')
}

/** Writes one notice per recipient across the chosen audiences. There is no undo. */
export function sendBroadcast(payload: BroadcastRequest) {
  return request<BroadcastResult>('/broadcast', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
