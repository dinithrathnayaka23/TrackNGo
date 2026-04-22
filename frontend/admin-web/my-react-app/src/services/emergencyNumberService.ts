const API_BASE = '/api/emergency-numbers'

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) {
    throw new Error(res.ok ? 'Server returned an empty response' : `Request failed with status ${res.status}`)
  }

  let body: ApiResponse<T>
  try {
    body = JSON.parse(text) as ApiResponse<T>
  } catch {
    throw new Error('Server returned an invalid response')
  }

  if (!res.ok || !body.success) {
    throw new Error(body.message || 'Request failed')
  }
  return body.data
}

export type EmergencyNumber = {
  emergencyId: number
  label: string
  fireBrigade: string
  ambulance: string
  police: string
  helpCenter: string
  isActive: boolean
}

export type SaveEmergencyNumberRequest = {
  label: string
  fireBrigade: string
  ambulance: string
  police: string
  helpCenter: string
  isActive: boolean
}

export async function fetchEmergencyNumbers(): Promise<EmergencyNumber[]> {
  const res = await fetch(API_BASE)
  return handleResponse<EmergencyNumber[]>(res)
}

export async function createEmergencyNumber(payload: SaveEmergencyNumberRequest): Promise<EmergencyNumber> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse<EmergencyNumber>(res)
}

export async function updateEmergencyNumber(
  emergencyId: number,
  payload: SaveEmergencyNumberRequest,
): Promise<EmergencyNumber> {
  const res = await fetch(`${API_BASE}/${emergencyId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse<EmergencyNumber>(res)
}
