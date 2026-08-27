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

/** Mutual-consent cancellation state for a corporate contract. */
export type ContractCancellation = {
  status: 'none' | 'pending' | 'accepted' | 'rejected'
  requestedBy: 'admin' | 'corporate' | null
  reason: string | null
  requestedAt: string | null
  effectiveDate: string | null
  responseReason: string | null
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
  busIds: number[] | null
  carriedBalance: number
  renewedFromContractId?: number | null
  cancellation: ContractCancellation
  /** The corporate client's ask to renew this contract — always available while active, not just near its end date. */
  renewalRequestStatus: 'none' | 'requested' | 'approved' | 'declined'
}

export type CorporateInvoice = {
  invoiceNumber: number
  contractId: number
  busId: number | null
  busNumber: string | null
  amount: number
  status: string
  date: string | null
  periodEnd: string | null
  dueDate: string | null
  invoiceType?: 'monthly' | 'carried_balance' | 'adjustment'
  stripeTransactionId: string | null
  paidAt: string | null
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
  startingLocation: string | null
  destination: string | null
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
  busNumbers: string | null
  advanceAmount: number | null
  advancePaymentStatus: 'pending' | 'paid' | 'waived' | 'refunded'
  advancePaidAt: string | null
  originalBillingAmount: number | null
  discountAmount: number | null
  carriedBalance: number
  renewedFromContractId?: number | null
  cancellation: ContractCancellation
  /** The corporate client's ask to renew this contract — always available while active, not just near its end date. */
  renewalRequestStatus: 'none' | 'requested' | 'approved' | 'declined'
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
  finalizedAt: string | null
  companyName: string | null
  contactPersonName: string | null
  contactPhone: string | null
  bus: ContractBus | null
  buses: ContractBus[]
  invoices: CorporateInvoice[]
  totalBilled: number
  totalPaid: number
  outstandingAmount: number
  advanceAmount: number | null
  advancePaymentStatus: 'pending' | 'paid' | 'waived' | 'refunded'
  advancePaidAt: string | null
  advanceTransactionId: string | null
  originalBillingAmount: number | null
  discountAmount: number | null
  adminNote: string | null
  cancellation: ContractCancellation
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

export function finalizeCorporateContract(contractId: number) {
  return request<CorporateContract>(`/api/corporate/contracts/${contractId}/finalize`, { method: 'PUT' })
}

export function waiveAdvanceDeposit(contractId: number) {
  return request<CorporateContract>(`/api/corporate/contracts/${contractId}/waive-advance-payment`, { method: 'POST' })
}

/**
 * Approve, reject, cancel or expire a contract. `discountAmount`/`adminNote`
 * only apply when approving (status = 'active') — the admin's one chance to
 * apply a manual discount off the auto-calculated monthly amount.
 */
export function updateContractStatus(
  contractId: number,
  status: 'active' | 'cancelled' | 'expired',
  options?: { discountAmount?: number; adminNote?: string },
) {
  return request<CorporateContract>(`/api/corporate/contracts/${contractId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, discountAmount: options?.discountAmount, adminNote: options?.adminNote }),
  })
}

/**
 * Requests to cancel a pending or active contract, with a required reason.
 * The other party must accept via `respondToCancellation` before anything
 * changes. An admin request on an already-active contract carries a minimum
 * 2-week notice period, enforced server-side.
 */
export function requestContractCancellation(contractId: number, reason: string) {
  return request<CorporateContract>(`/api/corporate/contracts/${contractId}/cancel-request`, {
    method: 'POST',
    body: JSON.stringify({ role: 'admin', reason }),
  })
}

/**
 * Accept or reject a cancellation request the corporate client filed. Admin
 * only ever responds to corporate-initiated requests, which always take
 * effect immediately — the immediate-vs-2-week-notice choice belongs to the
 * corporate user when accepting an admin-initiated request instead, so no
 * timing choice is needed here.
 */
export function respondToContractCancellation(contractId: number, accept: boolean, responseReason?: string) {
  return request<CorporateContract>(`/api/corporate/contracts/${contractId}/cancel-response`, {
    method: 'POST',
    body: JSON.stringify({ role: 'admin', accept, responseReason }),
  })
}

/**
 * Instantly renews a contract nearing its end date by submitting a new
 * pending contract that continues from where this one leaves off, cloning
 * its route/shift/bus setup — an admin shortcut that skips the client's own
 * request/approval step. Goes through the same admin-approval flow as any
 * new contract request. The corporate app instead has the client ask for
 * permission first (see {@link respondToContractRenewal}).
 */
export function renewContract(contractId: number) {
  return request<CorporateContract>(`/api/corporate/contracts/${contractId}/renew`, {
    method: 'POST',
    body: JSON.stringify({ role: 'admin' }),
  })
}

/** Admin accepts or declines a corporate client's request to renew their contract. */
export function respondToContractRenewal(contractId: number, approve: boolean) {
  return request<CorporateContract>(`/api/corporate/contracts/${contractId}/renewal-response`, {
    method: 'POST',
    body: JSON.stringify({ approve }),
  })
}

/** Admin-configurable rates driving the corporate contract pricing formula. */
export type CorporatePricingSettings = {
  standardBusRatePerKm: number
  miniBusRatePerKm: number
  acSurchargePercent: number
  platformFeePercent: number
  taxPercent: number
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
