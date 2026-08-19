import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faCircleExclamation, faTimes } from '@fortawesome/free-solid-svg-icons'
import { reviewTripBooking } from '../services/bookingService'
import type { BookingRecord } from '../pages/dashboard/Booking'

type Props = { bookings: BookingRecord[]; onUpdated: () => Promise<void> }

export default function TripBookingReviewPanel({ bookings, onUpdated }: Props) {
  const pending = useMemo(() => bookings.filter((booking) => booking.category === 'Trip Bookings' && (booking.status === 'Pending' || (booking.status === 'Confirmed' && booking.paymentStatus === 'Unpaid'))), [bookings])
  const [selected, setSelected] = useState<BookingRecord | null>(null)
  const [finalPrice, setFinalPrice] = useState('')
  const [discount, setDiscount] = useState('0')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openReview(booking: BookingRecord) {
    setSelected(booking); setFinalPrice(String(booking.amountNum || '')); setDiscount('0'); setNote(''); setError(null)
  }

  async function submit(decision: 'approved' | 'rejected') {
    if (!selected) return
    const amount = Number(finalPrice)
    if (decision === 'approved' && (!Number.isFinite(amount) || amount <= 0)) { setError('Enter a valid final negotiated amount.'); return }
    setBusy(true); setError(null)
    try {
      await reviewTripBooking(selected.bookingId, { decision, finalPrice: decision === 'approved' ? amount : undefined, discountAmount: decision === 'approved' ? Math.max(0, Number(discount) || 0) : undefined, adminNote: note.trim() || undefined })
      setSelected(null)
      await onUpdated()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update this booking.')
    } finally { setBusy(false) }
  }

  return <section className="rounded-xl border border-[#e5e7eb] bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-extrabold text-[#111827]">Trip booking requests</h2><p className="mt-1 text-sm text-[#64748b]">Review the estimated request, agree on the final amount, and unlock the passenger's 15% advance payment.</p></div><span className="rounded-full bg-[#fff7ed] px-3 py-1 text-xs font-bold text-[#c2410c]">{pending.length} awaiting review</span></div>
    {pending.length === 0 ? <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#f8fafc] p-4 text-sm text-[#64748b]"><FontAwesomeIcon icon={faCircleExclamation} /> No pending trip negotiation requests.</div> : <div className="mt-4 space-y-3">{pending.map((booking) => <div key={booking.bookingId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f1f5f9] p-4"><div className="min-w-0"><p className="font-bold text-[#2642a6]">{booking.bookingId} · {booking.passengerName}</p><p className="mt-1 truncate text-sm font-medium text-[#111827]">{booking.route}</p><p className="mt-1 text-xs text-[#64748b]">Estimated amount {booking.amount} · {booking.seats} passengers · {booking.journeyDate || 'Date unavailable'}</p></div><button type="button" onClick={() => openReview(booking)} className="rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white hover:bg-[#203b96]">Review request</button></div>)}</div>}
    {selected && <div className="mt-5 rounded-xl border border-[#bfdbfe] bg-[#f8fbff] p-4"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[#111827]">Review {selected.bookingId}</p><p className="text-xs text-[#64748b]">{selected.route}</p></div><button type="button" onClick={() => setSelected(null)} className="text-[#64748b]"><FontAwesomeIcon icon={faTimes} /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-[#334155]">Final negotiated total (LKR)<input type="number" min="1" step="0.01" value={finalPrice} onChange={(event) => setFinalPrice(event.target.value)} className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]" /></label><label className="text-xs font-semibold text-[#334155]">Discount applied (LKR)<input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]" /></label></div><label className="mt-3 block text-xs font-semibold text-[#334155]">Message for passenger<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} placeholder="Optional negotiation note" className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2642a6]" /></label>{Number(finalPrice) > 0 && <div className="mt-3 rounded-lg bg-white p-3 text-xs text-[#334155]">Passenger will pay <strong className="text-[#16a34a]">LKR {(Number(finalPrice) * 0.15).toLocaleString()}</strong> now as the 15% advance and <strong>LKR {Math.max(0, Number(finalPrice) * 0.85).toLocaleString()}</strong> later.</div>}{error && <p className="mt-3 text-sm font-semibold text-[#dc2626]">{error}</p>}<div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => void submit('rejected')} className="rounded-lg border border-[#fecaca] px-4 py-2 text-sm font-bold text-[#dc2626] disabled:opacity-50"><FontAwesomeIcon icon={faTimes} className="mr-2" />Reject request</button><button type="button" disabled={busy} onClick={() => void submit('approved')} className="rounded-lg bg-[#16a34a] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><FontAwesomeIcon icon={faCheck} className="mr-2" />{busy ? 'Saving...' : 'Approve & confirm amount'}</button></div></div>}
  </section>
}
