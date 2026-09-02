import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBus,
  faCalendarDays,
  faCheckCircle,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faDownload,
  faHourglassHalf,
  faSearch,
  faSliders,
  faSort,
  faSortDown,
  faSortUp,
  faSpinner,
  faTimesCircle,
  faBan,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons'
import {
  fetchAdminBookings,
  fetchAdminCorporateBookings,
  fetchTripBookingRequests,
  requestAdminCancellation,
  respondToAdminCancellation,
  type AdminBooking,
} from '../../services/bookingService'
import TripBookingReviewPanel from '../../components/TripBookingReviewPanel'

type BookingStatus = 'Confirmed' | 'Pending' | 'Cancelled' | 'Completed' | 'In Progress'
type PaymentStatus = 'Paid' | 'Refunded' | 'Pending' | 'Failed' | 'Unpaid'
type BookingCategory = 'All Bookings' | 'Highway/Long-distance' | 'Trip Bookings' | 'Corporate Bookings'
type SortField = 'bookingId' | 'dateTime' | 'amount'
type SortDir = 'asc' | 'desc' | null

export type BookingRecord = {
  bookingId: string
  passengerName: string
  passengerInitials: string
  route: string
  bus: string
  busType: string
  dateTime: string
  dateSort: number
  journeyDate: string | null
  seats: string
  amount: string
  amountNum: number
  paymentStatus: PaymentStatus
  status: BookingStatus
  category: BookingCategory
  cancellationStatus?: string | null
  cancellationReason?: string | null
  cancellationRequestedBy?: string | null
  cancellationRejectReason?: string | null
  refundPercentage?: number | null
  rawBooking: AdminBooking
}

function mapStatus(value: string | null | undefined): BookingStatus {
  const status = String(value ?? '').toLowerCase()
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'completed' || status === 'expired') return 'Completed'
  if (status === 'in_progress') return 'In Progress'
  if (status === 'confirmed' || status === 'active') return 'Confirmed'
  return 'Pending'
}

function mapPaymentStatus(value: string | null | undefined): PaymentStatus {
  const status = String(value ?? '').toLowerCase()
  if (status === 'success' || status === 'paid' || status === 'waived') return 'Paid'
  if (status === 'refunded') return 'Refunded'
  if (status === 'pending') return 'Pending'
  if (status === 'failed') return 'Failed'
  return 'Unpaid'
}

function mapBusType(value: string | null | undefined) {
  const type = String(value ?? '').toLowerCase()
  if (type === 'long_distance') return 'Long-distance'
  if (type === 'trip_booking') return 'Trip Booking'
  if (type === 'ac') return 'AC'
  if (type === 'mini') return 'Mini Bus'
  if (!type) return 'Unknown'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function mapBooking(booking: AdminBooking): BookingRecord {
  const date = booking.journeyDate || null
  const time = booking.journeyTime || '00:00:00'
  const dateValue = date ? new Date(`${date}T${time}`).getTime() : 0
  const name = booking.passengerName || 'Unknown passenger'
  const amountNum = Number(booking.amount ?? 0)
  const category =
    booking.category === 'Trip Bookings'
      ? 'Trip Bookings'
      : booking.category === 'Highway/Long-distance'
        ? 'Highway/Long-distance'
        : booking.category === 'Corporate Bookings'
          ? 'Corporate Bookings'
          : 'All Bookings'
  return {
    bookingId: `#${booking.bookingId || 'UNKNOWN'}`,
    passengerName: name,
    passengerInitials: name.split(/\s+/).map((part) => part[0] ?? '').slice(0, 2).join('').toUpperCase(),
    route: booking.route || 'Route unavailable',
    bus: booking.bus || 'Bus unavailable',
    busType: mapBusType(booking.busType),
    dateTime: date ? `${date}\n${time.slice(0, 5)}` : 'Date unavailable\n-',
    dateSort: Number.isNaN(dateValue) ? 0 : dateValue,
    journeyDate: date,
    seats: booking.seats || '-',
    amount: `Rs.${Number.isFinite(amountNum) ? amountNum.toLocaleString('en-US') : '0'}`,
    amountNum: Number.isFinite(amountNum) ? amountNum : 0,
    paymentStatus: mapPaymentStatus(booking.paymentStatus),
    status: mapStatus(booking.status),
    category,
    cancellationStatus: booking.cancellationStatus,
    cancellationReason: booking.cancellationReason,
    cancellationRequestedBy: booking.cancellationRequestedBy,
    cancellationRejectReason: booking.cancellationRejectReason,
    refundPercentage: booking.refundPercentage,
    rawBooking: booking,
  }
}

function statusBadge(status: BookingStatus) {
  if (status === 'Confirmed' || status === 'Completed') return 'bg-[#dcfce7] text-[#047857]'
  if (status === 'Pending' || status === 'In Progress') return 'bg-[#fef3c7] text-[#b45309]'
  return 'bg-[#fee2e2] text-[#dc2626]'
}

function paymentColor(status: PaymentStatus) {
  if (status === 'Paid') return 'text-[#16a34a]'
  if (status === 'Refunded' || status === 'Failed') return 'text-[#dc2626]'
  if (status === 'Pending') return 'text-[#f59e0b]'
  return 'text-[#64748b]'
}

function Booking() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [tripRequests, setTripRequests] = useState<BookingRecord[]>([])
  const [activeTab, setActiveTab] = useState<BookingCategory>('All Bookings')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All Statuses' | BookingStatus>('All Statuses')
  const [routeFilter, setRouteFilter] = useState('All Routes')
  const [busTypeFilter, setBusTypeFilter] = useState('All')
  const [paymentFilter, setPaymentFilter] = useState<'All' | PaymentStatus>('All')
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'dateTime', dir: 'desc' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 10

  // ── Admin-Initiated Cancellation Modal State ──
  const [cancelModalBooking, setCancelModalBooking] = useState<BookingRecord | null>(null)
  const [adminCancelReason, setAdminCancelReason] = useState('')
  const [submittingAdminCancel, setSubmittingAdminCancel] = useState(false)

  // ── Review Passenger Cancellation Request Modal State ──
  const [reviewModalBooking, setReviewModalBooking] = useState<BookingRecord | null>(null)
  const [rejectReasonInput, setRejectReasonInput] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)

  const loadBookings = useCallback(async () => {
    try {
      const [data, requests, corporateBookings] = await Promise.all([
        fetchAdminBookings(),
        fetchTripBookingRequests(),
        fetchAdminCorporateBookings().catch(() => []),
      ])
      const merged = [
        ...data.filter((booking) => booking.category !== 'Trip Bookings' || ['success', 'paid'].includes(String(booking.paymentStatus ?? '').toLowerCase())),
        ...corporateBookings,
      ]
      setBookings(merged.map(mapBooking))
      setTripRequests(requests.map(mapBooking))
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load bookings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBookings()
    const interval = window.setInterval(() => { void loadBookings() }, 15_000)
    window.addEventListener('focus', loadBookings)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', loadBookings) }
  }, [loadBookings])

  const routes = useMemo(() => ['All Routes', ...Array.from(new Set(bookings.map((booking) => booking.route))).sort()], [bookings])
  const busTypes = useMemo(() => ['All', ...Array.from(new Set(bookings.map((booking) => booking.busType))).sort()], [bookings])
  const counts = useMemo(() => ({
    all: bookings.length,
    highway: bookings.filter((booking) => booking.category === 'Highway/Long-distance').length,
    trip: bookings.filter((booking) => booking.category === 'Trip Bookings').length,
    corporate: bookings.filter((booking) => booking.category === 'Corporate Bookings').length,
  }), [bookings])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    let list = bookings.filter((booking) => {
      if (activeTab === 'Highway/Long-distance' && booking.category !== activeTab) return false
      if (activeTab === 'Trip Bookings' && booking.category !== activeTab) return false
      if (activeTab === 'Corporate Bookings' && booking.category !== activeTab) return false
      if (query && !booking.bookingId.toLowerCase().includes(query) && !booking.passengerName.toLowerCase().includes(query) && !booking.route.toLowerCase().includes(query)) return false
      if (statusFilter !== 'All Statuses' && booking.status !== statusFilter) return false
      if (routeFilter !== 'All Routes' && booking.route !== routeFilter) return false
      if (busTypeFilter !== 'All' && booking.busType !== busTypeFilter) return false
      if (paymentFilter !== 'All' && booking.paymentStatus !== paymentFilter) return false
      if (dateFilter && booking.journeyDate !== dateFilter) return false
      return true
    })
    if (sort.dir) {
      const direction = sort.dir === 'asc' ? 1 : -1
      list = [...list].sort((a, b) => sort.field === 'bookingId' ? a.bookingId.localeCompare(b.bookingId) * direction : sort.field === 'amount' ? (a.amountNum - b.amountNum) * direction : (a.dateSort - b.dateSort) * direction)
    }
    return list
  }, [activeTab, bookings, busTypeFilter, dateFilter, paymentFilter, routeFilter, search, sort, statusFilter])

  useEffect(() => { setPage(1) }, [activeTab, busTypeFilter, dateFilter, paymentFilter, routeFilter, search, statusFilter])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const stats = { confirmed: bookings.filter((booking) => booking.status === 'Confirmed').length, pending: bookings.filter((booking) => booking.status === 'Pending').length, cancelled: bookings.filter((booking) => booking.status === 'Cancelled').length }

  function toggleSort(field: SortField) {
    setSort((current) => current.field !== field ? { field, dir: 'asc' } : current.dir === 'asc' ? { field, dir: 'desc' } : current.dir === 'desc' ? { field, dir: null } : { field, dir: 'asc' })
  }

  function sortIcon(field: SortField) {
    return sort.field !== field || !sort.dir ? faSort : sort.dir === 'asc' ? faSortUp : faSortDown
  }

  function resetFilters() {
    setSearch(''); setStatusFilter('All Statuses'); setRouteFilter('All Routes'); setBusTypeFilter('All'); setPaymentFilter('All'); setDateFilter(''); setPage(1)
  }

  const handleAdminCancelSubmit = async () => {
    if (!cancelModalBooking || !adminCancelReason.trim()) return
    setSubmittingAdminCancel(true)
    try {
      await requestAdminCancellation(cancelModalBooking.rawBooking, adminCancelReason.trim())
      setCancelModalBooking(null)
      setAdminCancelReason('')
      await loadBookings()
    } catch (err: any) {
      alert(err.message || 'Failed to submit cancellation request.')
    } finally {
      setSubmittingAdminCancel(false)
    }
  }

  const handleReviewPassengerCancel = async (accept: boolean) => {
    if (!reviewModalBooking) return
    if (!accept && isRejecting && !rejectReasonInput.trim()) {
      alert('Please provide a reason for rejecting the cancellation request.')
      return
    }
    setSubmittingReview(true)
    try {
      await respondToAdminCancellation(reviewModalBooking.rawBooking, accept, !accept ? rejectReasonInput.trim() : undefined)
      setReviewModalBooking(null)
      setIsRejecting(false)
      setRejectReasonInput('')
      await loadBookings()
    } catch (err: any) {
      alert(err.message || 'Failed to respond to cancellation request.')
    } finally {
      setSubmittingReview(false)
    }
  }

  const tabs = [
    { key: 'All Bookings' as const, label: 'All Bookings', count: counts.all },
    { key: 'Highway/Long-distance' as const, label: 'Highway/Long-distance', count: counts.highway },
    { key: 'Trip Bookings' as const, label: 'Trip Bookings', count: counts.trip },
    { key: 'Corporate Bookings' as const, label: 'Corporate Bookings', count: counts.corporate },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="animate-dash-in flex flex-wrap items-center justify-between gap-4" style={{ animationDelay: '80ms' }}>
        <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Bookings Management</h1>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]">
          <FontAwesomeIcon icon={faDownload} className="text-xs" />
          Export Bookings
        </button>
      </div>

      <div className="animate-dash-in grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '100ms' }}>
        <Stat label="Total Bookings" value={bookings.length} icon={faBus} color="text-[#334155]" bg="bg-[#f1f5f9]" />
        <Stat label="Confirmed" value={stats.confirmed} icon={faCheckCircle} color="text-[#16a34a]" bg="bg-[#dcfce7]" />
        <Stat label="Pending" value={stats.pending} icon={faHourglassHalf} color="text-[#f59e0b]" bg="bg-[#fef3c7]" />
        <Stat label="Cancelled" value={stats.cancelled} icon={faTimesCircle} color="text-[#dc2626]" bg="bg-[#fee2e2]" />
      </div>

      <div className="animate-dash-in" style={{ animationDelay: '120ms' }}>
        <TripBookingReviewPanel bookings={tripRequests} onUpdated={loadBookings} />
      </div>

      <div className="animate-dash-in border-b border-[#e5e7eb]" style={{ animationDelay: '140ms' }}>
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setActiveTab(tab.key); setPage(1) }}
              className={`whitespace-nowrap border-b-2 pb-2.5 text-sm font-semibold ${activeTab === tab.key ? 'border-[#2642a6] text-[#2642a6]' : 'border-transparent text-[#64748b]'}`}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs">{tab.count}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="animate-dash-in flex gap-5" style={{ animationDelay: '160ms' }}>
        <aside className="w-64 shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#111827]">Filters</h2>
            <FontAwesomeIcon icon={faSliders} className="text-sm text-[#94a3b8]" />
          </div>
          <div>
            <label className="text-sm font-semibold text-[#64748b]">Search</label>
            <div className="relative mt-1">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Booking ID, Name..."
                className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
              />
            </div>
          </div>
          <FilterSelect label="Booking Status" value={statusFilter} onChange={(value) => setStatusFilter(value as typeof statusFilter)} options={['All Statuses', 'Confirmed', 'Pending', 'Cancelled', 'Completed', 'In Progress']} />
          <div>
            <label className="text-sm font-semibold text-[#64748b]">Date</label>
            <div className="relative mt-1">
              <FontAwesomeIcon icon={faCalendarDays} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
              <input
                type="date"
                value={dateFilter}
                onChange={(event) => setDateFilter(event.target.value)}
                className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
              />
            </div>
          </div>
          <FilterSelect label="Route" value={routeFilter} onChange={setRouteFilter} options={routes} />
          <FilterSelect label="Bus Type" value={busTypeFilter} onChange={setBusTypeFilter} options={busTypes} />
          <FilterSelect label="Payment Status" value={paymentFilter} onChange={(value) => setPaymentFilter(value as typeof paymentFilter)} options={['All', 'Paid', 'Refunded', 'Pending', 'Failed', 'Unpaid']} />
          <div className="flex gap-2">
            <button type="button" onClick={() => setPage(1)} className="flex-1 rounded-lg bg-[#2642a6] py-2.5 text-sm font-semibold text-white transition hover:bg-[#203b96]">Apply</button>
            <button type="button" onClick={resetFilters} className="flex-1 rounded-lg border border-[#d6dbe6] bg-white py-2.5 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]">Reset</button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1020px] text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb] text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                  <th className="py-3 pl-5 pr-2"><SortButton label="Booking ID" icon={sortIcon('bookingId')} onClick={() => toggleSort('bookingId')} /></th>
                  <th className="px-2 py-3">Passenger</th>
                  <th className="px-2 py-3">Route / Bus</th>
                  <th className="px-2 py-3"><SortButton label="Date & Time" icon={sortIcon('dateTime')} onClick={() => toggleSort('dateTime')} /></th>
                  <th className="px-2 py-3">Seats</th>
                  <th className="px-2 py-3"><SortButton label="Amount" icon={sortIcon('amount')} onClick={() => toggleSort('amount')} /></th>
                  <th className="px-2 py-3">Status</th>
                  <th className="py-3 pl-2 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-[#64748b]">
                      <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                      Loading bookings...
                    </td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-red-600">
                      {error}
                    </td>
                  </tr>
                )}
                {!loading && !error && visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-sm text-[#64748b]">
                      No bookings match your filters.
                    </td>
                  </tr>
                )}
                {!loading && !error && visible.map((booking) => {
                  const [date, time] = booking.dateTime.split('\n')
                  const isCorporate = booking.category === 'Corporate Bookings'
                  const isUserCancel = booking.cancellationStatus === 'requested_by_user'
                  const isAdminCancel = booking.cancellationStatus === 'requested_by_admin'
                  const isRejected = booking.cancellationStatus === 'rejected'

                  return (
                    <tr
                      key={booking.bookingId}
                      className={`border-b border-[#f1f5f9] transition hover:bg-[#f8fafc] ${
                        isUserCancel ? 'bg-amber-50/50' : isAdminCancel ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <td className="py-3.5 pl-5 pr-2 font-bold text-[#2642a6]">
                        {booking.bookingId}
                      </td>
                      <td className="px-2 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-[#e0e7ff] text-2xs font-bold text-[#3b5998]">
                            {booking.passengerInitials}
                          </div>
                          <span className="font-medium text-[#111827]">{booking.passengerName}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3.5">
                        <p className="font-medium text-[#111827]">{booking.route}</p>
                        <p className="text-xs text-[#94a3b8]">{booking.bus} · {booking.busType}</p>
                      </td>
                      <td className="px-2 py-3.5">
                        <p className="text-[#111827]">{date}</p>
                        <p className="text-xs text-[#94a3b8]">{time}</p>
                      </td>
                      <td className="px-2 py-3.5 text-[#334155]">{booking.seats}</td>
                      <td className="px-2 py-3.5">
                        <p className="font-semibold text-[#111827]">{booking.amount}</p>
                        <p className={`text-xs font-medium ${paymentColor(booking.paymentStatus)}`}>{booking.paymentStatus}</p>
                      </td>
                      <td className="px-2 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadge(booking.status)}`}>
                            {booking.status}
                          </span>
                          {isUserCancel && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                              Cancel Requested
                            </span>
                          )}
                          {isAdminCancel && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                              Admin Cancel Sent
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                              Cancel Rejected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 pl-2 pr-5 text-right">
                        {isUserCancel ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReviewModalBooking(booking)
                              setIsRejecting(false)
                              setRejectReasonInput('')
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
                          >
                            <FontAwesomeIcon icon={faExclamationTriangle} className="text-xs" />
                            Review Request
                          </button>
                        ) : !isCorporate && booking.status !== 'Cancelled' && !isAdminCancel ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelModalBooking(booking)
                              setAdminCancelReason('')
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 hover:text-red-700"
                          >
                            <FontAwesomeIcon icon={faBan} className="text-2xs" />
                            Cancel
                          </button>
                        ) : isCorporate ? (
                          <button
                            type="button"
                            onClick={() => navigate('/dashboard/corporate/contracts')}
                            className="text-xs font-semibold text-[#2642a6] hover:underline"
                          >
                            View Contract
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-5 py-3 text-sm text-[#64748b]">
            <p>Showing <span className="font-semibold text-[#2642a6]">{filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}</span> to <span className="font-semibold text-[#2642a6]">{Math.min(page * pageSize, filtered.length)}</span> of <span className="font-semibold text-[#2642a6]">{filtered.length}</span> results</p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-[#d6dbe6] px-3 py-1.5 disabled:opacity-40">
                <FontAwesomeIcon icon={faChevronLeft} />
              </button>
              <span>{page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-[#d6dbe6] px-3 py-1.5 disabled:opacity-40">
                <FontAwesomeIcon icon={faChevronRight} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Admin Initiating Booking Cancellation ── */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-600">
                  <FontAwesomeIcon icon={faBan} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Initiate Booking Cancellation</h3>
                  <p className="text-xs text-slate-500">{cancelModalBooking.bookingId} • {cancelModalBooking.passengerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                <p className="font-bold flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-600" />
                  Refund Notice
                </p>
                <p className="mt-1 text-amber-800">
                  The refund will be redirected to the account within 10 working business days.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Cancellation Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={adminCancelReason}
                  onChange={(e) => setAdminCancelReason(e.target.value)}
                  placeholder="Explain why this booking is being cancelled by admin..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                disabled={submittingAdminCancel}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleAdminCancelSubmit}
                disabled={!adminCancelReason.trim() || submittingAdminCancel}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {submittingAdminCancel ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : null}
                Submit Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Review Passenger Cancellation Request ── */}
      {reviewModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Passenger Cancellation Request</h3>
                  <p className="text-xs text-slate-500">{reviewModalBooking.bookingId} • {reviewModalBooking.passengerName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalBooking(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="my-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 text-xs">
                <p className="text-slate-500 font-semibold uppercase tracking-wider">Passenger Reason</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  &ldquo;{reviewModalBooking.cancellationReason || 'No reason provided'}&rdquo;
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
                <p className="font-bold flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-600" />
                  Refund Policy Calculation
                </p>
                <p className="mt-1 text-emerald-800">
                  Entitled Refund: <span className="font-bold">{reviewModalBooking.refundPercentage ?? 100}%</span>. The refund will be credited to the account within 10 working business days upon acceptance.
                </p>
              </div>

              {isRejecting ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-rose-700">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={rejectReasonInput}
                    onChange={(e) => setRejectReasonInput(e.target.value)}
                    placeholder="State why this cancellation request is being rejected..."
                    className="mt-1 w-full rounded-xl border border-rose-200 p-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setReviewModalBooking(null)}
                disabled={submittingReview}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>

              {!isRejecting ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsRejecting(true)}
                    disabled={submittingReview}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100"
                  >
                    Reject Request...
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewPassengerCancel(true)}
                    disabled={submittingReview}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                  >
                    {submittingReview ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : null}
                    Accept & Refund
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleReviewPassengerCancel(false)}
                  disabled={!rejectReasonInput.trim() || submittingReview}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  {submittingReview ? <FontAwesomeIcon icon={faSpinner} className="animate-spin" /> : null}
                  Confirm Rejection
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, icon, color, bg }: { label: string; value: number; icon: typeof faBus; color: string; bg: string }) {
  return (
    <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
      <div>
        <p className="text-sm text-[#64748b] font-semibold">{label}</p>
        <p className={`mt-1 text-2xl font-extrabold ${color}`}>{value.toLocaleString()}</p>
      </div>
      <div className={`grid h-10 w-10 place-items-center rounded-lg ${bg} ${color}`}>
        <FontAwesomeIcon icon={icon} />
      </div>
    </article>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <div>
      <label className="text-sm font-semibold text-[#64748b]">{label}</label>
      <div className="relative mt-1">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"
        >
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
      </div>
    </div>
  )
}

function SortButton({ label, icon, onClick }: { label: string; icon: typeof faSort; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-[#334155]">
      {label}
      <FontAwesomeIcon icon={icon} className="text-2xs" />
    </button>
  )
}

export default Booking
