import authService from './authService'

export type CorporateProfile = {
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

export type CorporateContract = {
  contractId: number
  contractName: string
  startingLocation: string
  destination: string
  startShiftTime: string | null
  endShiftTime: string | null
  status: string
  billingAmount: number
  startDate: string | null
  endDate: string | null
  createdAt: string | null
  corporateUserId: number
  busId: number | null
}

export type CorporateInvoice = {
  invoiceNumber: number
  contractId: number
  amount: number
  status: string
  date: string | null
  dueDate: string | null
  createdAt: string | null
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

async function request<T>(path: string): Promise<T> {
  const token = authService.getToken()
  if (!token) throw new Error('Your admin session is missing. Please sign in again.')

  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const responseText = await response.text()
  let body: T | ApiResponse<T> | { message?: string } | null = null
  if (responseText.trim()) {
    try {
      body = JSON.parse(responseText) as T | ApiResponse<T> | { message?: string }
    } catch {
      throw new Error(`The server returned an invalid response (${response.status}).`)
    }
  }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? body.message : undefined
    throw new Error(message || `Corporate request failed (HTTP ${response.status}).`)
  }
  if (body && typeof body === 'object' && 'success' in body) {
    const wrapped = body as ApiResponse<T>
    if (!wrapped.success) throw new Error(wrapped.message || 'Corporate request failed.')
    return wrapped.data
  }
  return body as T
}

export function fetchCorporateProfile(userId: number) {
  return request<CorporateProfile>(`/api/users/${userId}/profile`)
}

export function fetchCorporateContracts(userId: number) {
  return request<CorporateContract[]>(`/api/corporate/contracts?userId=${encodeURIComponent(userId)}`)
}

export function fetchCorporateInvoices(userId: number) {
  return request<CorporateInvoice[]>(`/api/corporate/invoices?userId=${encodeURIComponent(userId)}`)
}
