import authService from './authService'

export type AdminUser = {
  id?: number | null
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  userType?: string | null
  role?: string | null
  status?: string | null
  emailVerified?: boolean | null
  profilePhoto?: string | null
  joinedAt?: string | null
  licenseNumber?: string | null
  assignedBus?: string | null
  yearsOfExperience?: number | null
  driverVerified?: boolean | null
  driverRating?: number | null
  driverTrips?: number | null
  passengerBookings?: number | null
  lastTripDate?: string | null
  lastRoute?: string | null
  companyName?: string | null
  businessRegistrationNumber?: string | null
  contactPersonName?: string | null
  contactPersonDesignation?: string | null
  activeContracts?: number | null
  corporateRevenue?: number | null
}

export type AdminUserStatus = 'active' | 'suspended'

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const token = authService.getToken()
  if (!token) {
    throw new Error('Your admin session is missing. Please sign in again.')
  }

  const response = await fetch('/api/users', {
    headers: { Authorization: `Bearer ${token}` },
  })

  const responseText = await response.text()
  let body: ApiResponse<AdminUser[]> | null = null
  if (responseText.trim()) {
    try {
      body = JSON.parse(responseText) as ApiResponse<AdminUser[]>
    } catch {
      throw new Error(`The server returned an invalid response (${response.status}).`)
    }
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Your admin session has expired or does not have permission to view users. Please sign in again.')
  }
  if (!response.ok || !body?.success) {
    throw new Error(body?.message || `Could not load users (HTTP ${response.status}).`)
  }
  return Array.isArray(body.data) ? body.data : []
}

export async function updateAdminUserStatus(id: number, status: AdminUserStatus): Promise<AdminUser> {
  const token = authService.getToken()
  if (!token) {
    throw new Error('Your admin session is missing. Please sign in again.')
  }

  const response = await fetch(`/api/users/${id}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  })

  const responseText = await response.text()
  let body: ApiResponse<AdminUser> | null = null
  if (responseText.trim()) {
    try {
      body = JSON.parse(responseText) as ApiResponse<AdminUser>
    } catch {
      throw new Error(`The server returned an invalid response (${response.status}).`)
    }
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error('Your admin session has expired or does not have permission to change user status.')
  }
  if (!response.ok || !body?.success || !body.data) {
    throw new Error(body?.message || `Could not update user status (HTTP ${response.status}).`)
  }
  return body.data
}
