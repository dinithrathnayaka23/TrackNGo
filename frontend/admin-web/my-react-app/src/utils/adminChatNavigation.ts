import type { UserType } from '../services/chatAdminService'

export type AdminChatRole = 'Passenger' | 'Driver' | 'Corporate' | string | null | undefined

export function toAdminChatUserType(role: AdminChatRole): UserType | null {
  const normalized = String(role ?? '').trim().toLowerCase().replace(/[_\s-]+/g, '_')
  if (normalized === 'passenger') return 'PASSENGER'
  if (normalized === 'driver') return 'DRIVER'
  if (normalized === 'corporate' || normalized === 'corporate_user') return 'CORPORATE_USER'
  return null
}

export function getAdminChatPath(userId: string | number | null | undefined, role: AdminChatRole) {
  const numericUserId = Number(userId)
  const userType = toAdminChatUserType(role)
  if (!Number.isInteger(numericUserId) || numericUserId <= 0 || !userType) return null
  const params = new URLSearchParams({
    userId: String(numericUserId),
    userType,
  })
  return `/dashboard/chat?${params.toString()}`
}
