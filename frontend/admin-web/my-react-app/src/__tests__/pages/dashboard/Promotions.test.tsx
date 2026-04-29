import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Promotions, {
  formatDiscount,
  statusClass,
  toForm,
  toPayload,
} from '../../../pages/dashboard/Promotions'
import {
  cancelPromotion,
  createPromotion,
  deletePromotion,
  fetchPromotions,
  updatePromotion,
  type Promotion,
} from '../../../services/promotionService'

vi.mock('../../../services/promotionService', () => ({
  fetchPromotions: vi.fn(),
  createPromotion: vi.fn(),
  updatePromotion: vi.fn(),
  cancelPromotion: vi.fn(),
  deletePromotion: vi.fn(),
}))

const mockedFetchPromotions = vi.mocked(fetchPromotions)
const mockedCreatePromotion = vi.mocked(createPromotion)
const mockedUpdatePromotion = vi.mocked(updatePromotion)
const mockedCancelPromotion = vi.mocked(cancelPromotion)
const mockedDeletePromotion = vi.mocked(deletePromotion)

describe('Promotions page', () => {
  /** Resets promotion page mocks and applies the default promotion list for each test. */
  beforeEach(() => {
    vi.clearAllMocks()
    mockedFetchPromotions.mockResolvedValue(buildPromotionList())
    mockedCreatePromotion.mockResolvedValue(buildPromotion({ promotionId: 44, name: 'Track20', promoCode: 'TRACK20' }))
    mockedUpdatePromotion.mockResolvedValue(buildPromotion({ promotionId: 11, name: 'Weekend Saver Updated' }))
    mockedCancelPromotion.mockResolvedValue(buildPromotion({ promotionId: 11, status: 'CANCELLED' }))
    mockedDeletePromotion.mockResolvedValue()
    vi.stubGlobal('scrollTo', vi.fn())
  })

  /** Verifies that the promotion dashboard loads list data and shows summary metrics. */
  it('loads promotions and displays dashboard counts', async () => {
    render(<Promotions />)

    expect(screen.getByText('Loading promotions...')).toBeInTheDocument()

    await waitFor(() => expect(mockedFetchPromotions).toHaveBeenCalledTimes(1))

    expect(screen.getByText('Promotions')).toBeInTheDocument()
    expect(screen.getByText('Active promotions').parentElement).toHaveTextContent('2')
    expect(screen.getByText('Total redemptions').parentElement).toHaveTextContent('22')
    expect(screen.getByText('Ending soon').parentElement).toHaveTextContent('1')
    expect(screen.getByText('Weekend Saver')).toBeInTheDocument()
    expect(screen.getByText('TRACK15')).toBeInTheDocument()
  })

  /** Verifies that promo-code promotions are blocked until a promo code is provided. */
  it('validates promo code promotions before saving', async () => {
    render(<Promotions />)

    await waitFor(() => expect(mockedFetchPromotions).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Audience'), {
      target: { value: 'PROMO_CODE' },
    })
    fireEvent.change(screen.getByLabelText('Promotion name'), {
      target: { value: 'Flash saver' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create promotion' }))

    expect(screen.getByText('Promo code is required.')).toBeInTheDocument()
    expect(mockedCreatePromotion).not.toHaveBeenCalled()
  })

  /** Verifies that creating a promotion normalizes the form payload and prepends the new row. */
  it('creates a promotion from the admin form', async () => {
    render(<Promotions />)

    await waitFor(() => expect(mockedFetchPromotions).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Promotion name'), {
      target: { value: '  Track20  ' },
    })
    fireEvent.change(screen.getByLabelText('Audience'), {
      target: { value: 'PROMO_CODE' },
    })
    fireEvent.change(screen.getByLabelText('Discount type'), {
      target: { value: 'FIXED_AMOUNT' },
    })
    fireEvent.change(screen.getByLabelText('Discount value'), {
      target: { value: '250' },
    })
    fireEvent.change(screen.getByLabelText('Promo code'), {
      target: { value: 'track20' },
    })
    fireEvent.change(screen.getByLabelText('Maximum booking amount'), {
      target: { value: '75' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: '  Limited time booking offer.  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create promotion' }))

    await waitFor(() =>
      expect(mockedCreatePromotion).toHaveBeenCalledWith({
        name: 'Track20',
        description: 'Limited time booking offer.',
        targetType: 'PROMO_CODE',
        discountType: 'FIXED_AMOUNT',
        discountValue: 250,
        promoCode: 'TRACK20',
        maxBookings: 75,
      }),
    )

    expect(screen.getByText('Promotion created.')).toBeInTheDocument()
    expect(screen.getByText('Track20')).toBeInTheDocument()
    expect(screen.getByText('TRACK20')).toBeInTheDocument()
  })

  /** Verifies that editing an active promotion loads the form and saves the updated payload. */
  it('edits an active promotion and saves changes', async () => {
    render(<Promotions />)

    await waitFor(() => expect(mockedFetchPromotions).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Edit Weekend Saver' }))

    expect(screen.getByDisplayValue('Weekend Saver')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Promotion name'), {
      target: { value: 'Weekend Saver Updated' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Updated description' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(mockedUpdatePromotion).toHaveBeenCalledWith(11, {
        name: 'Weekend Saver Updated',
        description: 'Updated description',
        targetType: 'PROMO_CODE',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        promoCode: 'TRACK15',
        maxBookings: 20,
      }),
    )

    expect(screen.getByText('Promotion updated.')).toBeInTheDocument()
  })

  /** Verifies that active promotions can be cancelled and ended promotions can be removed. */
  it('cancels active promotions and removes ended promotions', async () => {
    render(<Promotions />)

    await waitFor(() => expect(mockedFetchPromotions).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Weekend Saver' }))

    await waitFor(() => expect(mockedCancelPromotion).toHaveBeenCalledWith(11))
    expect(screen.getByText('Promotion cancelled.')).toBeInTheDocument()
    expect(screen.getByText('CANCELLED')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Loyalty Bonus' }))

    await waitFor(() => expect(mockedDeletePromotion).toHaveBeenCalledWith(22))
    await waitFor(() => expect(screen.queryByText('Loyalty Bonus')).not.toBeInTheDocument())
    expect(screen.getByText('Promotion removed.')).toBeInTheDocument()
  })

  /** Verifies that helper utilities keep status styles, form mapping, and payload formatting stable. */
  it('maps promotion helper values correctly', () => {
    const promotion = buildPromotion({
      promotionId: 88,
      name: 'Route Saver',
      description: 'Frequent route offer',
      targetType: 'REGULAR_CUSTOMERS',
      discountType: 'FIXED_AMOUNT',
      discountValue: 350,
      promoCode: null,
      regularCustomerMinCompletedBookings: 12,
      maxBookings: 45,
      usedBookings: 9,
      status: 'ENDED',
    })

    expect(statusClass('ACTIVE')).toContain('text-[#047857]')
    expect(statusClass('CANCELLED')).toContain('text-[#b91c1c]')
    expect(formatDiscount(promotion)).toBe('LKR 350.00')
    expect(toForm(promotion)).toEqual({
      name: 'Route Saver',
      description: 'Frequent route offer',
      targetType: 'REGULAR_CUSTOMERS',
      discountType: 'FIXED_AMOUNT',
      discountValue: '350',
      promoCode: '',
      regularCustomerMinCompletedBookings: '12',
      maxBookings: '45',
    })
    expect(
      toPayload({
        name: '  Code Promo  ',
        description: '  Weekend only  ',
        targetType: 'PROMO_CODE',
        discountType: 'PERCENTAGE',
        discountValue: '20',
        promoCode: ' save20 ',
        regularCustomerMinCompletedBookings: '10',
        maxBookings: '100',
      }),
    ).toEqual({
      name: 'Code Promo',
      description: 'Weekend only',
      targetType: 'PROMO_CODE',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      promoCode: 'SAVE20',
      maxBookings: 100,
    })
  })

  /** Builds the promotion list fixture used across page-level promotion tests. */
  function buildPromotionList(): Promotion[] {
    return [
      buildPromotion({
        promotionId: 11,
        name: 'Weekend Saver',
        description: 'Discount for weekend trips',
        targetType: 'PROMO_CODE',
        discountType: 'PERCENTAGE',
        discountValue: 15,
        promoCode: 'TRACK15',
        maxBookings: 20,
        usedBookings: 18,
        status: 'ACTIVE',
      }),
      buildPromotion({
        promotionId: 22,
        name: 'Loyalty Bonus',
        description: 'For regular riders',
        targetType: 'REGULAR_CUSTOMERS',
        discountType: 'FIXED_AMOUNT',
        discountValue: 500,
        promoCode: null,
        regularCustomerMinCompletedBookings: 10,
        maxBookings: 40,
        usedBookings: 4,
        status: 'ENDED',
      }),
      buildPromotion({
        promotionId: 33,
        name: 'Highway Pass',
        description: 'Highway route bonus',
        targetType: 'HIGHWAY',
        discountType: 'PERCENTAGE',
        discountValue: 5,
        promoCode: null,
        maxBookings: 25,
        usedBookings: 0,
        status: 'ACTIVE',
      }),
    ]
  }

  /** Builds a single promotion fixture and allows targeted overrides per test. */
  function buildPromotion(overrides: Partial<Promotion>): Promotion {
    return {
      promotionId: 1,
      name: 'Promotion',
      description: 'Description',
      targetType: 'HIGHWAY',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      promoCode: null,
      regularCustomerMinCompletedBookings: null,
      maxBookings: 100,
      usedBookings: 0,
      status: 'ACTIVE',
      createdAt: '2026-04-25T10:00:00',
      updatedAt: '2026-04-25T10:00:00',
      ...overrides,
    }
  }
})
