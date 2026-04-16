import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBus,
  faCheckCircle,
  faScrewdriverWrench,
  faBan,
  faSearch,
  faChevronDown,
  faChair,
  faPlus,
  faArrowUpFromBracket,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchBuses, type BusListItem } from '../../services/busService'

type BusStatus = 'active' | 'maintenance' | 'inactive'

function statusBadgeClass(status: string) {
  if (status === 'active') return 'bg-[#16a34a] text-white'
  if (status === 'maintenance') return 'bg-[#f59e0b] text-white'
  return 'bg-[#94a3b8] text-white'
}

function statusLabel(status: string) {
  if (status === 'active') return 'Active'
  if (status === 'maintenance') return 'Maintenance'
  return 'Inactive'
}

function hasAc(amenities: string[]) {
  return amenities.some((a) => a.toLowerCase() === 'ac')
}

function Buses() {
  const navigate = useNavigate()
  const [buses, setBuses] = useState<BusListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'All Types' | 'AC' | 'Non-AC'>('All Types')
  const [statusFilter, setStatusFilter] = useState<'All' | BusStatus>('All')
  const [minCap, setMinCap] = useState(0)
  const [maxCap, setMaxCap] = useState(100)

  useEffect(() => {
    fetchBuses()
      .then(setBuses)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = buses.filter((bus) => {
    if (search && !bus.busNumber.toLowerCase().includes(search.toLowerCase()) && !bus.busBrand.toLowerCase().includes(search.toLowerCase())) return false
    if (typeFilter === 'AC' && !hasAc(bus.amenities)) return false
    if (typeFilter === 'Non-AC' && hasAc(bus.amenities)) return false
    if (statusFilter !== 'All' && bus.status !== statusFilter) return false
    if (bus.seatCapacity < minCap || bus.seatCapacity > maxCap) return false
    return true
  })

  const TOTAL = buses.length
  const ACTIVE_COUNT = buses.filter((b) => b.status === 'active').length
  const MAINTENANCE_COUNT = buses.filter((b) => b.status === 'maintenance').length
  const INACTIVE_COUNT = buses.filter((b) => b.status === 'inactive').length

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="animate-dash-in flex flex-wrap items-center justify-between gap-4" style={{ animationDelay: '80ms' }}>
        <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Bus Management</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]"
          >
            <FontAwesomeIcon icon={faArrowUpFromBracket} className="text-xs" />
            Export
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
          >
            <FontAwesomeIcon icon={faPlus} className="text-xs" />
            Add New Bus
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="animate-dash-in grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '100ms' }}>
        <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Total Buses</p>
            <p className="mt-1 text-2xl font-extrabold text-[#111827]">{TOTAL}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#f1f5f9] text-[#475569]">
            <FontAwesomeIcon icon={faBus} />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Active</p>
            <p className="mt-1 text-2xl font-extrabold text-[#16a34a]">{ACTIVE_COUNT}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
            <FontAwesomeIcon icon={faCheckCircle} />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Maintenance</p>
            <p className="mt-1 text-2xl font-extrabold text-[#f59e0b]">{MAINTENANCE_COUNT}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#fef3c7] text-[#f59e0b]">
            <FontAwesomeIcon icon={faScrewdriverWrench} />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Inactive</p>
            <p className="mt-1 text-2xl font-extrabold text-[#dc2626]">{INACTIVE_COUNT}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#fee2e2] text-[#dc2626]">
            <FontAwesomeIcon icon={faBan} />
          </div>
        </article>
      </div>

      {/* Filters */}
      <div className="animate-dash-in flex flex-wrap items-center gap-3" style={{ animationDelay: '120ms' }}>
        <div className="relative flex-1 min-w-[200px]">
          <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search by registration, type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
          />
        </div>
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
            className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"
          >
            <option>All Types</option>
            <option>AC</option>
            <option>Non-AC</option>
          </select>
          <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"
          >
            <option value="All">All Status</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="inactive">Inactive</option>
          </select>
          <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-3 py-2">
          <span className="text-sm text-[#64748b]">Capacity</span>
          <input
            type="number"
            min={0}
            max={maxCap}
            value={minCap}
            onChange={(e) => setMinCap(Number(e.target.value))}
            className="w-10 border-none bg-transparent text-center text-sm font-semibold text-[#334155] outline-none"
          />
          <span className="text-xs text-[#94a3b8]">-</span>
          <input
            type="number"
            min={minCap}
            max={100}
            value={maxCap}
            onChange={(e) => setMaxCap(Number(e.target.value))}
            className="w-10 border-none bg-transparent text-center text-sm font-semibold text-[#334155] outline-none"
          />
        </div>
      </div>

      {/* Bus Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#64748b]">
          <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
          Loading buses...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-10 text-center text-sm text-red-600">
          {error}
        </div>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((bus) => {
          const acType = hasAc(bus.amenities) ? 'AC' : 'Non-AC'
          const initials = bus.driverName
            ? bus.driverName.split(' ').map((w) => w[0]).join('').slice(0, 2)
            : '—'
          return (
          <article
            key={bus.busId}
            className="animate-dash-in overflow-hidden rounded-xl border border-[#e5e7eb] bg-white transition hover:shadow-md"
            style={{ animationDelay: '150ms' }}
          >
            {/* Image */}
            <div className="relative h-40 w-full overflow-hidden bg-[#f1f5f9]">
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#e0e7ff] to-[#f1f5f9]">
                <FontAwesomeIcon icon={faBus} className="text-4xl text-[#94a3b8]" />
              </div>
              <span className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(bus.status)}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusLabel(bus.status)}
              </span>
            </div>

            {/* Body */}
            <div className="p-4">
              {/* Reg + AC badge */}
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-extrabold text-[#111827]">{bus.busNumber}</h3>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  acType === 'AC'
                    ? 'bg-[#dbeafe] text-[#2563eb]'
                    : 'bg-[#f1f5f9] text-[#475569]'
                }`}>
                  {acType}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-[#64748b]">{bus.busBrand}</p>

              {/* Seats */}
              <div className="mt-3 flex items-center gap-1.5 text-sm text-[#475569]">
                <FontAwesomeIcon icon={faChair} className="text-xs text-[#94a3b8]" />
                <span>{bus.seatCapacity} Seats</span>
              </div>

              {/* Driver */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-[#e0e7ff] text-[10px] font-bold text-[#3b5998]">
                    {initials}
                  </div>
                  <span className="text-sm font-medium text-[#334155]">{bus.driverName || 'Unassigned'}</span>
                </div>
                <span className="text-xs text-[#94a3b8]">Driver</span>
              </div>

              {/* Route info */}
              <div className="mt-3 flex items-center border-t border-[#f1f5f9] pt-3">
                <div className="flex-1">
                  <p className="text-xs text-[#94a3b8]">Route</p>
                  <p className="mt-0.5 text-sm font-bold text-[#111827]">{bus.routeName || 'None'}</p>
                </div>
                <div className="flex-1 text-right">
                  <p className="text-xs text-[#94a3b8]">Schedule</p>
                  <p className="mt-0.5 text-sm font-bold text-[#16a34a]">{bus.startTime && bus.endTime ? `${bus.startTime}–${bus.endTime}` : '—'}</p>
                </div>
              </div>

              {/* View Details */}
              <div className="mt-3 border-t border-[#f1f5f9] pt-3 text-right">
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/buses/${bus.busId}`)}
                  className="text-sm font-semibold text-[#2642a6] transition hover:text-[#1b357f]"
                >
                  View Details
                </button>
              </div>
            </div>
          </article>
          )
        })}
        {filtered.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-[#d6dbe6] bg-white px-4 py-10 text-center text-sm text-[#64748b]">
            No buses match your filters.
          </p>
        )}
      </div>
      )}
    </div>
  )
}

export default Buses
