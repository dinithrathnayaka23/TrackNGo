import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowRotateRight,
  faCalendarDays,
  faCircleExclamation,
  faDownload,
  faMoneyBillWave,
  faTicketSimple,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { fetchAdminBookings, type AdminBooking } from '../../services/bookingService'
import { fetchComplaints, type AdminComplaint } from '../../services/complaintService'
import { fetchAdminUsers, type AdminUser } from '../../services/userService'
import { buildDashboardBookingsPdf } from '../../utils/dashboardBookingsPdf'
import authService from '../../services/authService'

type Range = 7 | 30 | 90
type Category = 'Highway' | 'Long-distance' | 'Corporate' | 'Trip'

const categoryColors: Record<Category, string> = {
  Corporate: '#22449d',
  Trip: '#0f8f84',
  Highway: '#3b82f6',
  'Long-distance': '#f59e0b',
}

const categoryOrder: Category[] = ['Corporate', 'Trip', 'Highway', 'Long-distance']

function normalise(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[_\s]+/g, '-')
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDateTime(dateValue: string | null, timeValue: string | null) {
  const date = parseDate(dateValue)
  if (!date) return 'Date unavailable'
  const dateText = date.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })
  return `${dateText}${timeValue ? `, ${timeValue}` : ''}`
}

function formatTime(value: Date) {
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatAmount(value: number | null | undefined) {
  return `Rs. ${(value ?? 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function bookingAmount(booking: AdminBooking) {
  return Number.isFinite(booking.amount) ? Number(booking.amount) : 0
}

function isPaid(booking: AdminBooking) {
  const status = normalise(booking.paymentStatus)
  return status === 'paid' || status === 'completed' || status === 'success' || status === 'successful'
}

function isActiveBooking(booking: AdminBooking) {
  const status = normalise(booking.status)
  return !['cancelled', 'canceled', 'completed', 'refunded', 'rejected', 'failed'].includes(status)
}

function bookingCategory(booking: AdminBooking): Category {
  const type = normalise(booking.busType)
  const category = normalise(booking.category)
  if (type.includes('corporate') || category.includes('corporate')) return 'Corporate'
  if (type.includes('long') || type.includes('distance')) return 'Long-distance'
  if (type.includes('highway')) return 'Highway'
  if (category.includes('trip')) return 'Trip'
  return category.includes('long') ? 'Long-distance' : 'Highway'
}

function statusClass(status: string) {
  const value = normalise(status)
  if (['cancelled', 'canceled', 'rejected', 'failed'].includes(value)) return 'bg-[#ffe2e2] text-[#dc2626]'
  if (['completed', 'refunded'].includes(value)) return 'bg-[#e8edf5] text-[#64748b]'
  if (['pending', 'under-review', 'in-progress'].includes(value)) return 'bg-[#fff2e3] text-[#d9960a]'
  return 'bg-[#cdeed9] text-[#1f9d60]'
}

function dayKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function pieSlicePath(startPercent: number, percentage: number) {
  const center = 100
  const radius = 86
  if (percentage >= 99.999) {
    return `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center} ${center + radius} A ${radius} ${radius} 0 1 1 ${center} ${center - radius} Z`
  }
  const startAngle = (startPercent * 3.6 - 90) * (Math.PI / 180)
  const endAngle = ((startPercent + percentage) * 3.6 - 90) * (Math.PI / 180)
  const startX = center + radius * Math.cos(startAngle)
  const startY = center + radius * Math.sin(startAngle)
  const endX = center + radius * Math.cos(endAngle)
  const endY = center + radius * Math.sin(endAngle)
  const largeArcFlag = percentage > 50 ? 1 : 0
  return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`
}

function Analytics() {
  const navigate = useNavigate()
  const [selectedRange, setSelectedRange] = useState<Range>(30)
  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [complaints, setComplaints] = useState<AdminComplaint[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const [hoveredCategory, setHoveredCategory] = useState<Category | null>(null)

  const loadDashboard = useCallback(async (background = false) => {
    if (background) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const [liveBookings, liveUsers, liveComplaints] = await Promise.all([
        fetchAdminBookings(),
        fetchAdminUsers(),
        fetchComplaints(),
      ])
      setBookings(liveBookings)
      setUsers(liveUsers)
      setComplaints(liveComplaints)
      setLastRefreshedAt(new Date())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load dashboard data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
    const refreshTimer = window.setInterval(() => void loadDashboard(true), 15000)
    const refreshOnFocus = () => void loadDashboard(true)
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      window.clearInterval(refreshTimer)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [loadDashboard])

  const activeBookings = useMemo(() => bookings.filter(isActiveBooking).length, [bookings])
  const pendingComplaints = useMemo(
    () => complaints.filter((complaint) => normalise(complaint.status) === 'pending').length,
    [complaints],
  )

  const monthlyRevenue = useMemo(() => {
    const now = new Date()
    return bookings.reduce((total, booking) => {
      const journeyDate = parseDate(booking.journeyDate)
      if (!journeyDate || journeyDate.getFullYear() !== now.getFullYear() || journeyDate.getMonth() !== now.getMonth()) return total
      return total + (isPaid(booking) ? bookingAmount(booking) : 0)
    }, 0)
  }, [bookings])

  const recentBookings = useMemo(() => {
    return [...bookings]
      .sort((left, right) => (parseDate(right.journeyDate)?.getTime() ?? 0) - (parseDate(left.journeyDate)?.getTime() ?? 0))
      .slice(0, 5)
  }, [bookings])

  const trend = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = Array.from({ length: selectedRange }, (_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() - selectedRange + index + 1)
      return date
    })
    const series = categoryOrder.reduce<Record<Category, number[]>>((result, category) => {
      result[category] = days.map((day) => bookings.filter((booking) => {
        const journeyDate = parseDate(booking.journeyDate)
        return journeyDate && dayKey(journeyDate) === dayKey(day) && bookingCategory(booking) === category
      }).length)
      return result
    }, {} as Record<Category, number[]>)
    const step = selectedRange === 7 ? 1 : selectedRange === 30 ? 5 : 15
    const labels = days.map((date, index) => index % step === 0 || index === days.length - 1
      ? date.toLocaleDateString([], { month: 'short', day: 'numeric' })
      : '')
    return { series, labels, max: Math.max(1, ...categoryOrder.flatMap((category) => series[category])) }
  }, [bookings, selectedRange])

  const revenueCategories = useMemo(() => {
    const totals = categoryOrder.reduce<Record<Category, number>>((result, category) => {
      result[category] = bookings.reduce((total, booking) => (
        bookingCategory(booking) === category && isPaid(booking) ? total + bookingAmount(booking) : total
      ), 0)
      return result
    }, {} as Record<Category, number>)
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0)
    let accumulated = 0
    const segments = categoryOrder.map((category) => {
      const percentage = total ? (totals[category] / total) * 100 : 0
      const segment = `${categoryColors[category]} ${accumulated}% ${accumulated + percentage}%`
      accumulated += percentage
      return segment
    })
    return { totals, total, background: total ? `conic-gradient(${segments.join(', ')})` : '#e5e7eb' }
  }, [bookings])

  const revenueSlices = useMemo(() => {
    let startPercent = 0
    return categoryOrder.map((category) => {
      const percentage = revenueCategories.total
        ? (revenueCategories.totals[category] / revenueCategories.total) * 100
        : 0
      const slice = { category, percentage, startPercent }
      startPercent += percentage
      return slice
    })
  }, [revenueCategories])

  const trendPoints = (values: number[]) => values.map((value, index) => {
    const x = 70 + (index * 630) / Math.max(1, values.length - 1)
    const y = 235 - (value / trend.max) * 205
    return `${x},${y}`
  }).join(' ')

  const handleExport = () => {
    const profile = authService.getAdminProfile()
    const generatedBy = profile ? [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email : 'Admin'
    const doc = buildDashboardBookingsPdf(bookings, selectedRange, generatedBy)
    doc.save('trackngo-dashboard-bookings.pdf')
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="animate-dash-in text-xl font-extrabold tracking-tight text-[#111827]">Dashboard</h1>
          <p className="mt-1 text-sm text-[#64748b]">
            {lastRefreshedAt ? `Live data · refreshed at ${formatTime(lastRefreshedAt)}` : 'Loading live database data...'}
          </p>
        </div>
        <div className="animate-dash-in flex flex-wrap items-center gap-3">
          <label className="inline-flex h-10 items-center rounded-lg border border-[#d6dbe6] bg-white px-3 text-sm font-semibold text-[#64748b]">
            <select
              value={selectedRange}
              onChange={(event) => setSelectedRange(Number(event.target.value) as Range)}
              className="bg-transparent pr-1 font-semibold text-[#334155] outline-none"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </label>
          <button type="button" onClick={() => void loadDashboard(true)} disabled={loading || refreshing} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9] disabled:opacity-60">
            <FontAwesomeIcon icon={faArrowRotateRight} spin={refreshing} />
            Refresh
          </button>
          <button type="button" onClick={handleExport} disabled={!recentBookings.length} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2642a6] px-4 text-sm font-semibold text-white transition duration-200 hover:bg-[#203b96] disabled:cursor-not-allowed disabled:opacity-60">
            <FontAwesomeIcon icon={faDownload} />
            Export
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f3caca] bg-[#fff5f5] px-4 py-3 text-sm text-[#b42318]">
          <span>{error}</span>
          <button type="button" onClick={() => void loadDashboard(true)} className="font-semibold underline">Try again</button>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Total Users', value: users.length.toLocaleString(), icon: faUsers, iconWrap: 'bg-[#e8eeff] text-[#2f4fb5]' },
          { title: 'Active Bookings', value: activeBookings.toLocaleString(), icon: faTicketSimple, iconWrap: 'bg-[#e6f7ee] text-[#1aa56e]' },
          { title: 'Monthly Revenue', value: formatAmount(monthlyRevenue), icon: faMoneyBillWave, iconWrap: 'bg-[#e6f7ee] text-[#1aa56e]' },
          { title: 'Pending Complaints', value: pendingComplaints.toLocaleString(), icon: faCircleExclamation, iconWrap: 'bg-[#fff2e3] text-[#e68d10]' },
        ].map((kpi) => (
          <article key={kpi.title} className="animate-dash-in flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
            <div>
              <p className="text-sm text-[#64748b] font-semibold">{kpi.title}</p>
              <p className="mt-1 text-2xl font-extrabold text-[#111827]">{loading ? '—' : kpi.value}</p>
              <p className="mt-1 text-xs text-[#94a3b8]">From current database records</p>
            </div>
            <div className={`grid h-10 w-10 place-items-center rounded-lg ${kpi.iconWrap}`}><FontAwesomeIcon icon={kpi.icon} /></div>
          </article>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.58fr_1fr]">
        <article className="animate-dash-in rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
          <h2 className="text-base font-bold text-[#111827]">Booking Trends</h2>
          <p className="text-sm text-[#64748b]">Bookings by route type from journey dates in the database</p>
          <div className="mt-4 h-[240px] rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
            <svg viewBox="0 0 740 280" className="h-full w-full" role="img" aria-label="Live booking trend chart">
              {[30, 80, 130, 180, 230].map((y) => <line key={y} x1="60" y1={y} x2="705" y2={y} stroke={y === 230 ? '#d6dce8' : '#e4e8f1'} />)}
              {categoryOrder.map((category) => <polyline key={category} fill="none" stroke={categoryColors[category]} strokeWidth="2.2" points={trendPoints(trend.series[category])} />)}
              <text x="15" y="234" fontSize="11" fill="#7d879b">0</text>
              <text x="5" y="184" fontSize="11" fill="#7d879b">{Math.ceil(trend.max * 0.25)}</text>
              <text x="5" y="134" fontSize="11" fill="#7d879b">{Math.ceil(trend.max * 0.5)}</text>
              <text x="5" y="84" fontSize="11" fill="#7d879b">{Math.ceil(trend.max * 0.75)}</text>
              <text x="5" y="34" fontSize="11" fill="#7d879b">{trend.max}</text>
              {trend.labels.map((label, index) => label ? <text key={`${label}-${index}`} x={70 + (index * 630) / Math.max(1, trend.labels.length - 1)} y="265" textAnchor="middle" fontSize="11" fill="#7d879b">{label}</text> : null)}
            </svg>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-sm font-semibold text-[#334155]">
            {categoryOrder.map((category) => <div key={category} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: categoryColors[category] }} />{category}</div>)}
          </div>
        </article>

        <article className="animate-dash-in rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
          <h2 className="text-base font-bold text-[#111827]">Revenue by Category</h2>
          <p className="text-sm text-[#64748b]">Paid booking revenue from the database</p>
          <div className="mt-5 flex justify-center">
            <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-5 py-2.5 text-center">
              <p className="text-xs font-semibold uppercase text-[#94a3b8] tracking-wide">Total paid revenue</p>
              <p className="mt-1 text-lg font-extrabold tracking-tight text-[#111827]">{formatAmount(revenueCategories.total)}</p>
            </div>
          </div>
          <div className="relative mx-auto mt-4 h-56 w-56">
            <svg viewBox="0 0 200 200" className="h-full w-full overflow-visible drop-shadow-[0_8px_12px_rgba(32,55,110,0.12)]" role="img" aria-label="Revenue by booking category pie chart">
              <circle cx="100" cy="100" r="86" fill="#e5eaf3" />
              {revenueSlices.map((slice) => slice.percentage > 0 ? (
                <path
                  key={slice.category}
                  d={pieSlicePath(slice.startPercent, slice.percentage)}
                  fill={categoryColors[slice.category]}
                  stroke="#ffffff"
                  strokeWidth="2"
                  tabIndex={0}
                  aria-label={`${slice.category}: ${slice.percentage.toFixed(1)}%, ${formatAmount(revenueCategories.totals[slice.category])}`}
                  className="cursor-pointer outline-none transition-[opacity,filter,transform] duration-200 focus:outline-none"
                  style={{
                    opacity: hoveredCategory && hoveredCategory !== slice.category ? 0.38 : 1,
                    filter: hoveredCategory === slice.category ? 'brightness(1.08)' : undefined,
                    transform: hoveredCategory === slice.category ? 'scale(1.025)' : undefined,
                    transformOrigin: '100px 100px',
                  }}
                  onMouseEnter={() => setHoveredCategory(slice.category)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  onFocus={() => setHoveredCategory(slice.category)}
                  onBlur={() => setHoveredCategory(null)}
                />
              ) : null)}
            </svg>
            {hoveredCategory ? (() => {
              const selectedSlice = revenueSlices.find((slice) => slice.category === hoveredCategory)
              if (!selectedSlice) return null
              return <div className="pointer-events-none absolute left-1/2 top-1/2 min-w-[132px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/80 bg-white/95 px-3 py-2 text-center shadow-lg backdrop-blur-sm"><p className="text-xs font-bold text-[#64748b]">{selectedSlice.category}</p><p className="mt-0.5 text-sm font-extrabold text-[#111827]">{formatAmount(revenueCategories.totals[selectedSlice.category])}</p><p className="text-xs font-semibold text-[#94a3b8]">{selectedSlice.percentage.toFixed(1)}% of revenue</p></div>
            })() : null}
          </div>
          <div className="revenue-category-list mt-4 grid gap-3 sm:grid-cols-2">
            {categoryOrder.map((category) => {
              const percentage = revenueCategories.total ? (revenueCategories.totals[category] / revenueCategories.total) * 100 : 0
              return <div key={category} className="rounded-lg bg-[#f4f6fa] px-3 py-3"><p className="text-sm text-[#64748b]"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryColors[category] }} />{category}</p><p className="text-sm font-semibold text-[#111827]">{percentage.toFixed(1)}% · {formatAmount(revenueCategories.totals[category])}</p></div>
            })}
          </div>
        </article>
      </div>

      <article className="animate-dash-in overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between px-4 py-3"><h2 className="text-base font-bold text-[#111827]">Recent Bookings</h2><button type="button" onClick={() => navigate('/dashboard/booking')} className="text-sm font-semibold text-[#2642a6]">View All</button></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr className="bg-[#f1f4fa] text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]"><th className="px-4 py-3">Booking ID</th><th className="px-4 py-3">Passenger</th><th className="px-4 py-3">Route</th><th className="px-4 py-3">Date & Time</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#64748b]">Loading bookings from the database...</td></tr> : null}
              {!loading && !recentBookings.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#64748b]">No bookings found.</td></tr> : null}
              {!loading && recentBookings.map((booking) => <tr key={booking.bookingId} className="border-b border-[#e5e7eb] text-sm text-[#111827]"><td className="px-4 py-3 font-semibold text-[#2642a6]">{booking.bookingId}</td><td className="px-4 py-3">{booking.passengerName}</td><td className="px-4 py-3 text-[#64748b]">{booking.route}</td><td className="px-4 py-3 text-[#64748b]"><span className="inline-flex items-center gap-2"><FontAwesomeIcon icon={faCalendarDays} className="text-[#94a3b8]" />{formatDateTime(booking.journeyDate, booking.journeyTime)}</span></td><td className="px-4 py-3 font-semibold">{formatAmount(booking.amount)}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusClass(booking.status)}`}>{booking.status || 'Unknown'}</span></td></tr>)}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

export default Analytics
