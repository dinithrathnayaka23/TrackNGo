import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faCalendarDays, faChevronDown, faChevronLeft, faChevronRight, faComments, faMagnifyingGlass, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { fetchAdminUsers, type AdminUser } from '../../services/userService'
import { getAdminChatPath } from '../../utils/adminChatNavigation'

type PassengerStatus = 'Active' | 'Suspended' | 'Inactive'
type StatusFilter = PassengerStatus | 'All'

type Passenger = {
  id: string
  name: string
  userId: string
  email: string
  phone: string
  status: PassengerStatus
  registeredDate: string | null
  lastTripDate: string | null
  lastRoute: string
  bookingsCount: number
}

function mapStatus(value: string | null | undefined): PassengerStatus {
  const status = String(value ?? '').toLowerCase()
  if (status === 'suspended') return 'Suspended'
  if (status === 'inactive') return 'Inactive'
  return 'Active'
}

function mapPassenger(user: AdminUser): Passenger {
  const id = String(user.id ?? '')
  return {
    id,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || 'Unknown passenger',
    userId: `#PAS-${id || 'UNKNOWN'}`,
    email: user.email || '-',
    phone: user.phone || '-',
    status: mapStatus(user.status),
    registeredDate: user.joinedAt ?? null,
    lastTripDate: user.lastTripDate ?? null,
    lastRoute: user.lastRoute || 'No trips yet',
    bookingsCount: Number(user.passengerBookings ?? 0),
  }
}

function formatDate(value: string | null) {
  if (!value) return 'N/A'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

function formatLastTrip(value: string | null) {
  if (!value) return 'No trips yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No trips yet'
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000))
  if (days === 0) return 'Today'
  if (days === 1) return '1 Day Ago'
  return `${days} Days Ago`
}

function statusClass(status: PassengerStatus) {
  if (status === 'Active') return 'bg-green-100 text-green-700'
  if (status === 'Suspended') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-700'
}

function PassengerManagement() {
  const navigate = useNavigate()
  const [passengers, setPassengers] = useState<Passenger[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('All')
  const [registeredDate, setRegisteredDate] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageSize = 10

  useEffect(() => {
    let active = true
    fetchAdminUsers()
      .then((users) => {
        if (!active) return
        setPassengers(users.filter((user) => String(user.userType ?? user.role ?? '').toLowerCase() === 'passenger').map(mapPassenger))
      })
      .catch((requestError) => active && setError(requestError instanceof Error ? requestError.message : 'Could not load passengers'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return passengers.filter((passenger) => {
      const matchesSearch = !query || passenger.name.toLowerCase().includes(query) || passenger.email.toLowerCase().includes(query) || passenger.phone.toLowerCase().includes(query)
      const matchesStatus = status === 'All' || passenger.status === status
      const matchesDate = !registeredDate || passenger.registeredDate?.slice(0, 10) === registeredDate
      return matchesSearch && matchesStatus && matchesDate
    })
  }, [passengers, registeredDate, search, status])

  useEffect(() => { setPage(1) }, [registeredDate, search, status])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  const activeCount = passengers.filter((passenger) => passenger.status === 'Active').length
  const openPassengerChat = (passenger: Passenger) => {
    const path = getAdminChatPath(passenger.id, 'Passenger')
    if (path) navigate(path)
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <button type="button" onClick={() => navigate('/dashboard/users')} className="grid h-9 w-9 place-items-center rounded-lg border border-[#d6dbe6] bg-white text-[#334155] transition hover:bg-[#f1f5f9]"><FontAwesomeIcon icon={faArrowLeft} /></button>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Passenger Management</h1><p className="mt-1 text-sm text-[#64748b]">Total Passengers: <span className="text-[#111827]">{passengers.length}</span> | Active: <span className="text-[#10b981]">{activeCount}</span></p></div>
        <p className="text-sm text-[#64748b]">Live database records</p>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, or phone" className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition placeholder:text-[#94a3b8] focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]" />
        </div>
        <div className="relative">
          <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"><option value="All">All Status</option><option value="Active">Active</option><option value="Suspended">Suspended</option><option value="Inactive">Inactive</option></select>
          <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-3 py-2">
          <FontAwesomeIcon icon={faCalendarDays} className="text-sm text-[#94a3b8]" />
          <input type="date" value={registeredDate} onChange={(event) => setRegisteredDate(event.target.value)} className="border-none bg-transparent text-sm text-[#334155] outline-none" aria-label="Registration date" />
        </div>
        <button type="button" onClick={() => { setSearch(''); setStatus('All'); setRegisteredDate('') }} className="px-1 text-sm font-semibold text-[#64748b] transition hover:text-[#334155]">Clear All</button>
      </div>

      <article className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr className="border-b border-[#e5e7eb] bg-[#f9fbff] text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]"><th className="px-6 py-4">Passenger Details</th><th className="px-6 py-4">Contact Info</th><th className="px-6 py-4">Registered Date</th><th className="px-6 py-4">Last Trip/Route</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Bookings</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-[#64748b]"><FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />Loading passengers...</td></tr>}
              {!loading && error && <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-red-600">{error}</td></tr>}
              {!loading && !error && visible.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-[#64748b]">No passengers match your filters.</td></tr>}
              {!loading && !error && visible.map((passenger) => <tr key={passenger.id} className="border-b border-[#e5e7eb] text-sm hover:bg-[#f8faff]"><td className="px-6 py-4"><p className="font-semibold text-[#111827]">{passenger.name}</p><div className="mt-1 flex flex-wrap items-center gap-2"><p className="text-xs text-[#64748b]">ID: {passenger.userId}</p><button type="button" onClick={() => openPassengerChat(passenger)} className="inline-flex items-center gap-1 rounded-md border border-[#d6dbe6] bg-white px-2 py-1 text-xs font-semibold text-[#2642a6] transition hover:bg-[#eef2ff]" aria-label={`Chat with ${passenger.name}`}><FontAwesomeIcon icon={faComments} className="text-[10px]" />Chat</button></div></td><td className="px-6 py-4"><p className="text-[#334155]">{passenger.email}</p><p className="text-[#64748b]">{passenger.phone}</p></td><td className="px-6 py-4 font-semibold text-[#334155]">{formatDate(passenger.registeredDate)}</td><td className="px-6 py-4"><p className="text-[#334155]">{formatLastTrip(passenger.lastTripDate)}</p><p className="text-[#64748b]">{passenger.lastRoute}</p></td><td className="px-6 py-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusClass(passenger.status)}`}>{passenger.status}</span></td><td className="px-6 py-4 font-semibold text-[#111827]">{passenger.bookingsCount}</td></tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-4 py-3 text-sm text-[#64748b]"><span>Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} passengers</span><div className="flex items-center gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-lg border border-[#d6dbe6] px-3 py-2 disabled:opacity-40"><FontAwesomeIcon icon={faChevronLeft} /></button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="rounded-lg border border-[#d6dbe6] px-3 py-2 disabled:opacity-40"><FontAwesomeIcon icon={faChevronRight} /></button></div></div>
      </article>
    </section>
  )
}

export default PassengerManagement
