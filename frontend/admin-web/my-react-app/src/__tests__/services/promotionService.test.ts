import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelPromotion,
  createPromotion,
  deletePromotion,
  fetchPromotions,
  updatePromotion,
} from '../../services/promotionService'

describe('promotionService', () => {
  /** Restores fetch state before each promotion service test. */
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  /** Verifies that the admin promotion list request targets the list endpoint and unwraps the response. */
  it('fetchPromotions returns the promotion list data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(true, true, [{ promotionId: 11, name: 'Weekend Saver' }]),
    )

    const result = await fetchPromotions()

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/promotions')
    expect(result).toEqual([{ promotionId: 11, name: 'Weekend Saver' }])
  })

  /** Verifies that promotion creation uses POST and sends the serialized JSON payload. */
  it('createPromotion sends a post request with the serialized payload', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(true, true, { promotionId: 11, name: 'Weekend Saver' }),
    )

    await createPromotion({
      name: 'Weekend Saver',
      description: 'Weekend discount',
      targetType: 'PROMO_CODE',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      promoCode: 'TRACK15',
      maxBookings: 20,
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/promotions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Weekend Saver',
        description: 'Weekend discount',
        targetType: 'PROMO_CODE',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        promoCode: 'TRACK15',
        maxBookings: 20,
      }),
    })
  })

  /** Verifies that promotion updates use PUT and target the selected promotion id. */
  it('updatePromotion sends a put request with the selected promotion id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(true, true, { promotionId: 11, name: 'Weekend Saver Updated' }),
    )

    await updatePromotion(11, {
      name: 'Weekend Saver Updated',
      description: 'Updated',
      targetType: 'HIGHWAY',
      discountType: 'FIXED_AMOUNT',
      discountValue: 500,
      maxBookings: 25,
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/promotions/11', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Weekend Saver Updated',
        description: 'Updated',
        targetType: 'HIGHWAY',
        discountType: 'FIXED_AMOUNT',
        discountValue: 500,
        maxBookings: 25,
      }),
    })
  })

  /** Verifies that promotion cancellation calls the dedicated cancel endpoint. */
  it('cancelPromotion sends a patch request to the cancel endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(true, true, { promotionId: 11, status: 'CANCELLED' }),
    )

    await cancelPromotion(11)

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/promotions/11/cancel', {
      method: 'PATCH',
    })
  })

  /** Verifies that promotion deletion uses DELETE on the selected promotion id. */
  it('deletePromotion sends a delete request to the selected promotion endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildResponse(true, true, null),
    )

    await deletePromotion(22)

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/promotions/22', {
      method: 'DELETE',
    })
  })

  /** Verifies that unsuccessful promotion responses surface the backend error message. */
  it('throws when the backend reports an unsuccessful promotion response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      buildTextResponse(true, false, null, 'Promotion not found'),
    )

    await expect(fetchPromotions()).rejects.toThrow('Promotion not found')
  })

  /** Builds a response object for JSON body promotion service tests. */
  function buildResponse(ok: boolean, success: boolean, data: unknown, message = 'OK'): Response {
    return {
      ok,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          success,
          message,
          data,
        }),
      ),
    } as unknown as Response
  }

  /** Builds a text-based response object used to exercise promotion error handling. */
  function buildTextResponse(ok: boolean, success: boolean, data: unknown, message = 'OK'): Response {
    return {
      ok,
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          success,
          message,
          data,
        }),
      ),
    } as unknown as Response
  }
})
