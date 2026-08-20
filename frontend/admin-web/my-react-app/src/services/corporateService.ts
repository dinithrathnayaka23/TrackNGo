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

/** One pickup or drop-off point of a contract's shift. */
export type ShiftLeg = {
  location: string
  latitude: number
  longitude: number
  time: string
}

export type ContractBus = {
  busId: number
  busNumber: string | null
  busBrand: string | null
  registrationNumber: string | null
  seatCapacity: number | null
  amenities: string | null
  busCondition: string | null
  status: string | null
  routeName: string | null
  driverId: number | null
  driverName: string | null
  driverPhone: string | null
}

/** Lean row for the admin contract list — spans every corporate client. */
export type AdminContractSummary = {
  contractId: number
  contractName: string
  companyName: string | null
  contactPersonName: string | null
  contactPhone: string | null
  shiftType: 'morning' | 'evening' | 'both'
  employeeCount: number
  busType: 'standard' | 'ac' | 'mini'
  distanceKm: number | null
  status: 'pending' | 'active' | 'expired' | 'cancelled'
  billingAmount: number
  startDate: string | null
  endDate: string | null
  createdAt: string | null
  corporateUserId: number
  busCount: number
}

/** Full detail behind the admin "View" modal, including per-shift routes and assigned buses. */
export type CorporateContractDetail = CorporateContract & {
  shiftType: 'morning' | 'evening' | 'both'
  morningPickup: ShiftLeg | null
  morningDropoff: ShiftLeg | null
  morningDistanceKm: number | null
  eveningPickup: ShiftLeg | null
  eveningDropoff: ShiftLeg | null
  eveningDistanceKm: number | null
  employeeCount: number
  workingDays: 'weekdays' | 'all_days'
  busType: 'standard' | 'ac' | 'mini'
  distanceKm: number | null
  companyName: string | null
  contactPersonName: string | null
  contactPhone: string | null
  bus: ContractBus | null
  buses: ContractBus[]
  invoices: CorporateInvoice[]
  totalBilled: number
  totalPaid: number
  outstandingAmount: number
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authService.getToken()
  if (!token) throw new Error('Your admin session is missing. Please sign in again.')

  const response = await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
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

/** Every corporate contract across every company, optionally filtered by status. */
export function fetchAllCorporateContracts(status?: string) {
  const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''
  return request<AdminContractSummary[]>(`/api/corporate/contracts/admin${query}`)
}

/** Full detail for one contract — route legs, assigned buses, invoices. */
export function fetchCorporateContractDetail(contractId: number) {
  return request<CorporateContractDetail>(`/api/corporate/contracts/${contractId}`)
}

/** Approve, reject, cancel or expire a contract. */
export function updateContractStatus(contractId: number, status: 'active' | 'cancelled' | 'expired') {
  return request<CorporateContract>(`/api/corporate/contracts/${contractId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}

/** Admin-configurable rates driving the corporate contract pricing formula. */
export type CorporatePricingSettings = {
  smallBusRatePerKm: number
  largeBusRatePerKm: number
  smallBusMaxEmployees: number
  acSurchargePercent: number
  miniBusFlatSurcharge: number
  weekdaysPerMonth: number
  allDaysPerMonth: number
  updatedAt: string | null
}

export function fetchCorporatePricingSettings() {
  return request<CorporatePricingSettings>('/api/corporate/pricing-settings')
}

export function updateCorporatePricingSettings(settings: Omit<CorporatePricingSettings, 'updatedAt'>) {
  return request<CorporatePricingSettings>('/api/corporate/pricing-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}
