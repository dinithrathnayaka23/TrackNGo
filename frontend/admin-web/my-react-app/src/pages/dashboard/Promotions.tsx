import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBan,
  faBullseye,
  faCircleCheck,
  faClock,
  faPen,
  faPercent,
  faPlus,
  faRotate,
  faTicket,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import {
  cancelPromotion,
  createPromotion,
  deletePromotion,
  fetchPromotions,
  updatePromotion,
} from '../../services/promotionService'
import type { Promotion, PromotionDiscountType, PromotionTarget, SavePromotionPayload } from '../../services/promotionService'

const targetLabels: Record<PromotionTarget, string> = {
  HIGHWAY: 'Highway users',
  LONG_DISTANCE: 'Long distance users',
  HIGHWAY_AND_LONG_DISTANCE: 'Highway and long distance users',
  REGULAR_CUSTOMERS: 'Regular customers',
  PROMO_CODE: 'Promo code users',
}

const discountLabels: Record<PromotionDiscountType, string> = {
  PERCENTAGE: 'Percentage',
  FIXED_AMOUNT: 'Fixed amount',
}

type PromotionForm = {
  name: string
  description: string
  targetType: PromotionTarget
  discountType: PromotionDiscountType
  discountValue: string
  promoCode: string
  regularCustomerMinCompletedBookings: string
  maxBookings: string
}

const emptyForm: PromotionForm = {
  name: '',
  description: '',
  targetType: 'HIGHWAY',
  discountType: 'PERCENTAGE',
  discountValue: '10',
  promoCode: '',
  regularCustomerMinCompletedBookings: '10',
  maxBookings: '100',
}

// Maps promotion status values to the badge styles shown in the admin table.
export function statusClass(status: Promotion['status']) {
  if (status === 'ACTIVE') return 'bg-[#dcfce7] text-[#047857]'
  if (status === 'ENDED') return 'bg-[#e0e7ff] text-[#3730a3]'
  return 'bg-[#fee2e2] text-[#b91c1c]'
}

// Converts an existing promotion record into the editable form state.
export function toForm(promotion: Promotion): PromotionForm {
  return {
    name: promotion.name,
    description: promotion.description ?? '',
    targetType: promotion.targetType,
    discountType: promotion.discountType,
    discountValue: String(promotion.discountValue),
    promoCode: promotion.promoCode ?? '',
    regularCustomerMinCompletedBookings: String(promotion.regularCustomerMinCompletedBookings ?? 10),
    maxBookings: String(promotion.maxBookings ?? 100),
  }
}

// Normalizes form input values into the payload expected by the promotion API.
export function toPayload(form: PromotionForm): SavePromotionPayload {
  const payload: SavePromotionPayload = {
    name: form.name.trim(),
    description: form.description.trim(),
    targetType: form.targetType,
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    maxBookings: Number(form.maxBookings),
  }

  if (form.targetType === 'PROMO_CODE') {
    payload.promoCode = form.promoCode.trim().toUpperCase()
  }
  if (form.targetType === 'REGULAR_CUSTOMERS') {
    payload.regularCustomerMinCompletedBookings = Number(form.regularCustomerMinCompletedBookings)
  }
  return payload
}

// Formats the promotion discount in the same style used by the admin table.
export function formatDiscount(promotion: Promotion) {
  if (promotion.discountType === 'PERCENTAGE') return `${Number(promotion.discountValue).toFixed(0)}%`
  return `LKR ${Number(promotion.discountValue).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [form, setForm] = useState<PromotionForm>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const activeCount = useMemo(() => promotions.filter((promotion) => promotion.status === 'ACTIVE').length, [promotions])
  const totalRedemptions = useMemo(() => promotions.reduce((sum, promotion) => sum + promotion.usedBookings, 0), [promotions])
  const endingSoon = useMemo(
    () => promotions.filter((promotion) => promotion.status === 'ACTIVE' && promotion.maxBookings - promotion.usedBookings <= 5).length,
    [promotions],
  )

  // Reloads the promotion list and refreshes the dashboard summary cards.
  const loadPromotions = async () => {
    setLoading(true)
    setError('')
    try {
      setPromotions(await fetchPromotions())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load promotions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPromotions()
  }, [])

  useEffect(() => {
    if (!error && !success) return undefined

    const timer = window.setTimeout(() => {
      setError('')
      setSuccess('')
    }, 3500)

    return () => window.clearTimeout(timer)
  }, [error, success])

  // Resets the form back to the default create-promotion state.
  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  // Validates promotion fields before the form data is sent to the backend.
  const validate = () => {
    if (!form.name.trim()) return 'Promotion name is required.'
    if (Number(form.discountValue) <= 0) return 'Discount value must be greater than 0.'
    if (form.discountType === 'PERCENTAGE' && Number(form.discountValue) > 100) return 'Percentage discount cannot be greater than 100.'
    if (Number(form.maxBookings) <= 0) return 'Maximum booking amount must be greater than 0.'
    if (form.targetType === 'PROMO_CODE' && !form.promoCode.trim()) return 'Promo code is required.'
    if (form.targetType === 'REGULAR_CUSTOMERS' && Number(form.regularCustomerMinCompletedBookings) < 0) return 'Regular customer threshold cannot be negative.'
    return ''
  }

  // Creates a new promotion or saves edits to the selected promotion.
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    try {
      const payload = toPayload(form)
      if (editingId) {
        const updated = await updatePromotion(editingId, payload)
        setPromotions((items) => items.map((item) => (item.promotionId === updated.promotionId ? updated : item)))
        setSuccess('Promotion updated.')
      } else {
        const created = await createPromotion(payload)
        setPromotions((items) => [created, ...items])
        setSuccess('Promotion created.')
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save promotion')
    } finally {
      setSaving(false)
    }
  }

  // Loads an active promotion into the form so admins can update it.
  const handleEdit = (promotion: Promotion) => {
    if (promotion.status !== 'ACTIVE') return
    setForm(toForm(promotion))
    setEditingId(promotion.promotionId)
    setError('')
    setSuccess('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Cancels an active promotion and updates the current list in place.
  const handleCancel = async (promotion: Promotion) => {
    if (promotion.status !== 'ACTIVE') return
    setError('')
    setSuccess('')
    try {
      const cancelled = await cancelPromotion(promotion.promotionId)
      setPromotions((items) => items.map((item) => (item.promotionId === cancelled.promotionId ? cancelled : item)))
      setSuccess('Promotion cancelled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel promotion')
    }
  }

  // Deletes a non-active promotion from the admin list.
  const handleDelete = async (promotion: Promotion) => {
    if (promotion.status === 'ACTIVE') return
    setError('')
    setSuccess('')
    try {
      await deletePromotion(promotion.promotionId)
      setPromotions((items) => items.filter((item) => item.promotionId !== promotion.promotionId))
      if (editingId === promotion.promotionId) resetForm()
      setSuccess('Promotion removed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove promotion')
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="animate-dash-in flex flex-wrap items-center justify-between gap-4" style={{ animationDelay: '70ms' }}>
        <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Promotions</h1>
        <button
          type="button"
          onClick={loadPromotions}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]"
        >
          <FontAwesomeIcon icon={faRotate} />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="animate-dash-in rounded-xl border border-[#e5e7eb] bg-white px-5 py-4" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#64748b]">Active promotions</p>
              <p className="mt-1 text-2xl font-extrabold text-[#16a34a]">{activeCount}</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
              <FontAwesomeIcon icon={faCircleCheck} />
            </span>
          </div>
        </div>
        <div className="animate-dash-in rounded-xl border border-[#e5e7eb] bg-white px-5 py-4" style={{ animationDelay: '160ms' }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#64748b]">Total redemptions</p>
              <p className="mt-1 text-2xl font-extrabold text-[#111827]">{totalRedemptions}</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e8eeff] text-[#2642a6]">
              <FontAwesomeIcon icon={faTicket} />
            </span>
          </div>
        </div>
        <div className="animate-dash-in rounded-xl border border-[#e5e7eb] bg-white px-5 py-4" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#64748b]">Ending soon</p>
              <p className="mt-1 text-2xl font-extrabold text-[#f59e0b]">{endingSoon}</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#fef3c7] text-[#f59e0b]">
              <FontAwesomeIcon icon={faClock} />
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="animate-dash-in rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.05)]" style={{ animationDelay: '240ms' }}>
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[#111827]">{editingId ? 'Edit promotion' : 'Create promotion'}</h2>
            <p className="text-sm text-[#64748b]">Set discount rules, promo codes, and booking limits.</p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center justify-center rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]"
            >
              New promotion
            </button>
          )}
        </div>

        {(error || success) && (
          <div className={`mb-4 rounded-lg px-4 py-3 text-sm font-semibold ${error ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#dcfce7] text-[#047857]'}`}>
            {error || success}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-semibold text-[#334155]">Promotion name</span>
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
              placeholder="Weekend highway discount"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-[#334155]">Audience</span>
            <select
              value={form.targetType}
              onChange={(event) => setForm((current) => ({ ...current, targetType: event.target.value as PromotionTarget }))}
              className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
            >
              {Object.entries(targetLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-[#334155]">Discount type</span>
            <select
              value={form.discountType}
              onChange={(event) => setForm((current) => ({ ...current, discountType: event.target.value as PromotionDiscountType }))}
              className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
            >
              {Object.entries(discountLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-semibold text-[#334155]">Discount value</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.discountValue}
              onChange={(event) => setForm((current) => ({ ...current, discountValue: event.target.value }))}
              className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
            />
          </label>

          {form.targetType === 'PROMO_CODE' && (
            <label className="space-y-1">
              <span className="text-sm font-semibold text-[#334155]">Promo code</span>
              <input
                value={form.promoCode}
                onChange={(event) => setForm((current) => ({ ...current, promoCode: event.target.value.toUpperCase() }))}
                className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-xs font-semibold uppercase tracking-wide outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                placeholder="TRACK20"
              />
            </label>
          )}

          {form.targetType === 'REGULAR_CUSTOMERS' && (
            <label className="space-y-1">
              <span className="text-sm font-semibold text-[#334155]">Completed booking threshold</span>
              <input
                type="number"
                min="0"
                value={form.regularCustomerMinCompletedBookings}
                onChange={(event) => setForm((current) => ({ ...current, regularCustomerMinCompletedBookings: event.target.value }))}
                className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
              />
            </label>
          )}

          <label className="space-y-1">
            <span className="text-sm font-semibold text-[#334155]">Maximum booking amount</span>
            <input
              type="number"
              min="1"
              value={form.maxBookings}
              onChange={(event) => setForm((current) => ({ ...current, maxBookings: event.target.value }))}
              className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
            />
          </label>

          <label className="space-y-1 lg:col-span-2">
            <span className="text-sm font-semibold text-[#334155]">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="min-h-24 w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
              placeholder="Optional notes for the admin team"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96] disabled:opacity-60"
          >
            <FontAwesomeIcon icon={editingId ? faPen : faPlus} />
            {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create promotion'}
          </button>
        </div>
      </form>

      <div className="animate-dash-in overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)]" style={{ animationDelay: '280ms' }}>
        <div className="border-b border-[#e5e7eb] px-5 py-4">
          <h2 className="text-lg font-extrabold text-[#111827]">Promotion list</h2>
        </div>
        {loading ? (
          <div className="p-6 text-sm font-semibold text-[#64748b]">Loading promotions...</div>
        ) : promotions.length === 0 ? (
          <div className="p-6 text-sm font-semibold text-[#64748b]">No promotions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#64748b] font-semibold tracking-wide">
                <tr>
                  <th className="px-5 py-3">Promotion</th>
                  <th className="px-5 py-3">Audience</th>
                  <th className="px-5 py-3">Discount</th>
                  <th className="px-5 py-3">Usage</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef2f7]">
                {promotions.map((promotion) => {
                  const usagePercent = Math.min(100, Math.round((promotion.usedBookings / promotion.maxBookings) * 100))
                  return (
                    <tr key={promotion.promotionId} className="align-top">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e8eeff] text-[#2642a6]">
                            <FontAwesomeIcon icon={promotion.targetType === 'PROMO_CODE' ? faPercent : faBullseye} />
                          </span>
                          <div>
                            <p className="font-bold text-[#111827]">{promotion.name}</p>
                            {promotion.promoCode && <p className="mt-1 text-xs font-bold text-[#2642a6]">{promotion.promoCode}</p>}
                            {promotion.description && <p className="mt-1 max-w-md text-xs text-[#64748b]">{promotion.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-[#334155]">
                        {targetLabels[promotion.targetType]}
                        {promotion.targetType === 'REGULAR_CUSTOMERS' && (
                          <p className="mt-1 text-xs text-[#64748b]">More than {promotion.regularCustomerMinCompletedBookings ?? 10} completed bookings</p>
                        )}
                      </td>
                      <td className="px-5 py-4 font-bold text-[#111827]">{formatDiscount(promotion)}</td>
                      <td className="px-5 py-4">
                        <div className="min-w-36">
                          <div className="flex justify-between text-xs font-semibold text-[#64748b]">
                            <span>{promotion.usedBookings}</span>
                            <span>{promotion.maxBookings}</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-[#e2e8f0]">
                            <div className="h-2 rounded-full bg-[#2642a6]" style={{ width: `${usagePercent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusClass(promotion.status)}`}>{promotion.status}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {promotion.status === 'ACTIVE' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleEdit(promotion)}
                                className="grid h-9 w-9 place-items-center rounded-lg border border-[#d6dbe6] text-[#334155] transition hover:bg-[#f1f5f9]"
                                aria-label={`Edit ${promotion.name}`}
                              >
                                <FontAwesomeIcon icon={faPen} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancel(promotion)}
                                className="grid h-9 w-9 place-items-center rounded-lg border border-[#fecaca] text-[#dc2626] transition hover:bg-[#fef2f2]"
                                aria-label={`Cancel ${promotion.name}`}
                              >
                                <FontAwesomeIcon icon={faBan} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleDelete(promotion)}
                              className="grid h-9 w-9 place-items-center rounded-lg border border-[#fecaca] text-[#dc2626] transition hover:bg-[#fef2f2]"
                              aria-label={`Remove ${promotion.name}`}
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Promotions
