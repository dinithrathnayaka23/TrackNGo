import authService from './authService'

const API_BASE = '/api/admin/support-contact'

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

export type SupportContact = {
  name: string
  role: string
  phone: string
  updatedAt: string | null
}

export type SaveSupportContactRequest = {
  name: string
  role: string
  phone: string
}

export async function fetchSupportContact(): Promise<SupportContact> {
  const res = await fetch(API_BASE)
  return handleResponse<SupportContact>(res)
}

export async function updateSupportContact(payload: SaveSupportContactRequest): Promise<SupportContact> {
  const token = authService.getToken()
  if (!token) throw new Error('Your admin session is missing. Please sign in again.')
  const res = await fetch(API_BASE, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  return handleResponse<SupportContact>(res)
}
