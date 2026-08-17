import authService from './authService'

class ProfileRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ProfileRequestError'
    this.status = status
  }
}

export type AdminProfile = {
  userId: number
  fullName: string | null
  phoneNumber: string | null
  email: string | null
  profilePhoto: string | null
  companyName: string | null
  contactPersonName: string | null
  contactPhone: string | null
  contactPersonDesignation: string | null
  address: string | null
  businessRegistrationNumber: string | null
  industry: string | null
  userType: string | null
}

export type UpdateAdminProfileRequest = {
  fullName: string
  phoneNumber: string
  email: string
  profilePhoto?: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authService.getToken()
  if (!token) {
    throw new Error('Your admin session has expired. Please sign in again.')
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })

  const responseText = await response.text()
  let body: T | { message?: string } | null = null
  if (responseText.trim()) {
    try {
      body = JSON.parse(responseText) as T | { message?: string }
    } catch {
      throw new Error(`The server returned an invalid response (${response.status}).`)
    }
  }

  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? body.message : undefined
    throw new ProfileRequestError(message || `Profile request failed (HTTP ${response.status}).`, response.status)
  }

  return body as T
}

function legacyProfilePath() {
  const userId = authService.getAdminProfile()?.userId
  if (!userId) {
    throw new Error('Your admin session is missing a user ID. Please sign in again.')
  }
  return `/api/users/${userId}/profile`
}

export async function fetchMyProfile() {
  try {
    return await request<AdminProfile>('/api/profile')
  } catch (error) {
    if (error instanceof ProfileRequestError && error.status === 404) {
      return request<AdminProfile>(legacyProfilePath())
    }
    throw error
  }
}

export async function updateMyProfile(requestBody: UpdateAdminProfileRequest) {
  const init: RequestInit = {
    method: 'PUT',
    body: JSON.stringify(requestBody),
  }

  try {
    return await request<AdminProfile>('/api/profile', init)
  } catch (error) {
    if (error instanceof ProfileRequestError && error.status === 404) {
      return request<AdminProfile>(legacyProfilePath(), init)
    }
    throw error
  }
}
