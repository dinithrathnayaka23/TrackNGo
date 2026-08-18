import authService from './authService'

const API_BASE = '/api/admin/drivers'

export type AdminDriver = {
  id: number
  firstName: string
  lastName: string | null
  email: string
  phoneNumber: string
  profilePhoto: string | null
  licenseNumber: string
  licenceExpiry: string
  yearsOfExperience: number
  accountNumber: string | null
  bankName: string | null
  status: string
  isVerified: boolean
  isPhoneVerified: boolean
  joinedDate: string | null
  driverEarnings: number
  averageRating: number
  driverTrips: number
  assignedBusId: number | null
  assignedBus: string | null
}

export type SaveAdminDriverRequest = {
  firstName: string
  lastName: string
  email: string
  password?: string
  phoneNumber: string
  licenseNumber: string
  licenceExpiry: string
  yearsOfExperience: number
  accountNumber: string
  bankName: string
  status: string
  isVerified: boolean
  isPhoneVerified: boolean
  joinedDate: string
  profilePhoto?: string | null
}

export type DriverValidationError = {
  field: string
  message: string
}

const NAME_PATTERN = /^[\p{L}][\p{L} .'-]*$/u
const PHONE_PATTERN = /^0\d{9}$/
const LICENSE_PATTERN = /^B\d{7}$/
const ACCOUNT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{3,33}$/
const BANK_PATTERN = /^[\p{L}][\p{L} .&'-]*$/u
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function todayLocal() {
  const current = new Date()
  const month = String(current.getMonth() + 1).padStart(2, '0')
  const day = String(current.getDate()).padStart(2, '0')
  return `${current.getFullYear()}-${month}-${day}`
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function validateAdminDriverRequest(
  driver: SaveAdminDriverRequest,
  creating: boolean,
): DriverValidationError | null {
  const firstName = driver.firstName.trim()
  const lastName = driver.lastName.trim()
  const email = driver.email.trim()
  const phone = driver.phoneNumber.trim()
  const license = driver.licenseNumber.trim()
  const accountNumber = driver.accountNumber.trim()
  const bankName = driver.bankName.trim()

  if (!firstName) return { field: 'First name', message: 'is required.' }
  if (firstName.length > 80 || !NAME_PATTERN.test(firstName)) return { field: 'First name', message: 'may contain letters, spaces, apostrophes, periods, or hyphens only.' }
  if (lastName && (lastName.length > 80 || !NAME_PATTERN.test(lastName))) return { field: 'Last name', message: 'may contain letters, spaces, apostrophes, periods, or hyphens only.' }
  if (!email) return { field: 'Email', message: 'is required.' }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { field: 'Email', message: 'must be a valid email address.' }
  if (creating && !driver.password?.trim()) return { field: 'Initial password', message: 'is required for a new driver.' }
  if (driver.password?.trim() && (driver.password.length < 6 || driver.password.length > 72)) return { field: 'Password', message: 'must be between 6 and 72 characters.' }
  if (!phone) return { field: 'Phone number', message: 'is required.' }
  if (!PHONE_PATTERN.test(phone)) return { field: 'Phone number', message: 'must start with 0 and contain exactly 10 digits.' }
  if (!license) return { field: 'License number', message: 'is required.' }
  if (!LICENSE_PATTERN.test(license)) return { field: 'License number', message: 'must start with B followed by exactly 7 digits.' }
  if (!validDate(driver.licenceExpiry) || driver.licenceExpiry < todayLocal()) return { field: 'License expiry', message: 'must be today or a future date.' }
  if (!Number.isInteger(driver.yearsOfExperience) || driver.yearsOfExperience < 0 || driver.yearsOfExperience > 60) return { field: 'Years of experience', message: 'must be a whole number between 0 and 60.' }
  if (!validDate(driver.joinedDate) || driver.joinedDate > todayLocal()) return { field: 'Joined date', message: 'must be a valid date today or earlier.' }
  if (accountNumber && (accountNumber.length < 4 || accountNumber.length > 34 || !ACCOUNT_PATTERN.test(accountNumber))) return { field: 'Bank account number', message: 'must be 4-34 letters or numbers, with spaces or hyphens allowed.' }
  if (bankName && (bankName.length > 100 || !BANK_PATTERN.test(bankName))) return { field: 'Bank name', message: 'may contain letters, spaces, apostrophes, periods, ampersands, or hyphens only.' }
  if (!['active', 'inactive', 'on_leave', 'suspended'].includes(driver.status)) return { field: 'Status', message: 'is invalid.' }
  return null
}

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = authService.getToken()
  if (!token) throw new Error('Your admin session has expired. Please sign in again.')

  const response = await fetch(`${API_BASE}${path}`, {
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
    throw new Error(body?.message || `Driver request failed (HTTP ${response.status}).`)
  }
  return body.data
}

export function fetchAdminDrivers() {
  return request<AdminDriver[]>('')
}

export function fetchAdminDriver(id: number) {
  return request<AdminDriver>(`/${id}`)
}

export function createAdminDriver(driver: SaveAdminDriverRequest) {
  return request<AdminDriver>('', {
    method: 'POST',
    body: JSON.stringify(driver),
  })
}

export function updateAdminDriver(id: number, driver: SaveAdminDriverRequest) {
  return request<AdminDriver>(`/${id}`, {
    method: 'PUT',
    body: JSON.stringify(driver),
  })
}
