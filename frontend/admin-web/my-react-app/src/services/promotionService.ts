const API_BASE = '/api/admin/buses/promotions'

type ApiResponse<T> = {
  success: boolean
  message: string
  data: T
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  let body: ApiResponse<T> | null = null

  if (text) {
    try {
      body = JSON.parse(text) as ApiResponse<T>
    } catch {
      throw new Error(text || `Request failed with status ${res.status}`)
    }
  }

  if (!body) {
    throw new Error(`Request failed with status ${res.status}. Make sure the backend is running and restarted with the latest promotion API.`)
  }

  if (!res.ok || !body.success) {
    throw new Error(body.message || 'Request failed')
  }
  return body.data
}

export type PromotionTarget =
  | 'HIGHWAY'
  | 'LONG_DISTANCE'
  | 'HIGHWAY_AND_LONG_DISTANCE'
  | 'REGULAR_CUSTOMERS'
  | 'PROMO_CODE'

export type PromotionDiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT'
export type PromotionStatus = 'ACTIVE' | 'CANCELLED' | 'ENDED'

export type Promotion = {
  promotionId: number
  name: string
  description: string
  targetType: PromotionTarget
  discountType: PromotionDiscountType
  discountValue: number
  promoCode: string | null
  regularCustomerMinCompletedBookings: number | null
  maxBookings: number
  usedBookings: number
  status: PromotionStatus
  createdAt: string
  updatedAt: string
}

export type SavePromotionPayload = {
  name: string
  description: string
  targetType: PromotionTarget
  discountType: PromotionDiscountType
  discountValue: number
  promoCode?: string
  regularCustomerMinCompletedBookings?: number
  maxBookings: number
}

export async function fetchPromotions(): Promise<Promotion[]> {
  const res = await fetch(API_BASE)
  return handleResponse<Promotion[]>(res)
}

export async function createPromotion(payload: SavePromotionPayload): Promise<Promotion> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse<Promotion>(res)
}

export async function updatePromotion(promotionId: number, payload: SavePromotionPayload): Promise<Promotion> {
  const res = await fetch(`${API_BASE}/${promotionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return handleResponse<Promotion>(res)
}

export async function cancelPromotion(promotionId: number): Promise<Promotion> {
  const res = await fetch(`${API_BASE}/${promotionId}/cancel`, {
    method: 'PATCH',
  })
  return handleResponse<Promotion>(res)
}

export async function deletePromotion(promotionId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/${promotionId}`, {
    method: 'DELETE',
  })
  await handleResponse<null>(res)
}
