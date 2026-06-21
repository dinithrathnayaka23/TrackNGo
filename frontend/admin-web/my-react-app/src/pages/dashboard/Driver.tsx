import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faBus,
  faChevronDown,
  faEllipsisVertical,
  faPlus,
  faSearch,
  faStar,
} from '@fortawesome/free-solid-svg-icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

type VerificationStatus = 'Verified' | 'Not Verified'

type DriverRecord = {
  id: string
  driverId: string
  name: string
  initials: string
  licenseNo: string
  phone: string
  assignedBus: string | null
  rating: number | null
  experience: string
  trips: string
  status: VerificationStatus
}

const DRIVERS: DriverRecord[] = [
  {
    id: '1',
    driverId: 'DRV-2023-001',
    name: 'Dinith Rathnayaka',
    initials: 'DR',
    licenseNo: 'B6160539',
    phone: '+94701803826',
    assignedBus: 'ND-3590',
    rating: 4.8,
    experience: '5yr Exp',
    trips: '1.2k Trips',
    status: 'Verified',
  },
  {
    id: '2',
    driverId: 'DRV-2024-042',
    name: 'Janani Pitawala',
    initials: 'JP',
    licenseNo: 'P4567756',
    phone: '+94704567892',
    assignedBus: null,
    rating: null,
    experience: '2yr Exp',
    trips: '0 Trips',
    status: 'Not Verified',
  },
  {
    id: '3',
    driverId: 'DRV-2022-110',
    name: 'Prashani Bhagya',
    initials: 'PB',
    licenseNo: 'L5468903',
    phone: '+94716543279',
    assignedBus: 'WP-3596',
    rating: 2.1,
    experience: '1yr Exp',
    trips: '80 Trips',
    status: 'Not Verified',
  },
  {
    id: '4',
    driverId: 'DRV-2023-044',
    name: 'Oshadi Liyanage',
    initials: 'OL',
    licenseNo: 'S6472267',
    phone: '+94701313658',
    assignedBus: 'NC-2345',
    rating: 5.0,
    experience: '8yr Exp',
    trips: '2.4k Trips',
    status: 'Verified',
  },
  {
    id: '5',
    driverId: 'DRV-2021-088',
    name: 'Kasun Perera',
    initials: 'KP',
    licenseNo: 'K7891234',
    phone: '+94775551234',
    assignedBus: 'NB-3301',
    rating: 4.2,
    experience: '6yr Exp',
    trips: '1.8k Trips',
    status: 'Verified',
  },
  {
    id: '6',
    driverId: 'DRV-2024-015',
    name: 'Nimal Silva',
    initials: 'NS',
    licenseNo: 'N3456789',
    phone: '+94712345678',
    assignedBus: 'ND-4420',
    rating: 3.5,
    experience: '3yr Exp',
    trips: '450 Trips',
    status: 'Verified',
  },
  {
    id: '7',
    driverId: 'DRV-2023-076',
    name: 'Amila Fernando',
    initials: 'AF',
    licenseNo: 'A9012345',
    phone: '+94769876543',
    assignedBus: 'NC-5501',
    rating: 4.5,
    experience: '4yr Exp',
    trips: '980 Trips',
    status: 'Verified',
  },
  {
    id: '8',
    driverId: 'DRV-2024-003',
    name: 'Dinesh Gamage',
    initials: 'DG',
    licenseNo: 'D2345678',
    phone: '+94781234567',
    assignedBus: 'NJ-6610',
    rating: 4.9,
    experience: '7yr Exp',
    trips: '2.1k Trips',
    status: 'Verified',
  },
]

const TOTAL_DRIVERS = 142
const PER_PAGE = 4

function statusBadge(status: VerificationStatus) {
  return status === 'Verified'
    ? 'bg-[#dcfce7] text-[#047857]'
    : 'bg-[#fee2e2] text-[#dc2626]'
}

function Driver() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'all' | 'verified' | 'not-verified'>('all')
  const [search, setSearch] = useState('')
  const [busFilter, setBusFilter] = useState('All')
  const [expFilter, setExpFilter] = useState('All')
  const [minRating, setMinRating] = useState(0)
  const [page, setPage] = useState(1)

  const tabFiltered = DRIVERS.filter((d) => {
    if (tab === 'verified') return d.status === 'Verified'
    if (tab === 'not-verified') return d.status === 'Not Verified'
    return true
  })

  const filtered = tabFiltered.filter((d) => {
    if (
      search &&
      !d.name.toLowerCase().includes(search.toLowerCase()) &&
      !d.licenseNo.toLowerCase().includes(search.toLowerCase()) &&
      !d.phone.includes(search)
    )
      return false
    if (busFilter === 'Assigned' && !d.assignedBus) return false
    if (busFilter === 'Unassigned' && d.assignedBus) return false
    if (expFilter !== 'All') {
      const years = parseInt(d.experience)
      if (expFilter === '0-2' && years > 2) return false
      if (expFilter === '3-5' && (years < 3 || years > 5)) return false
      if (expFilter === '6+' && years < 6) return false
    }
    if (minRating > 0 && (d.rating === null || d.rating < minRating)) return false
    return true
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const showFrom = filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const showTo = Math.min(page * PER_PAGE, filtered.length)

  const tabs = [
    { key: 'all' as const, label: 'All Drivers' },
    { key: 'verified' as const, label: 'Verified' },
    { key: 'not-verified' as const, label: 'Not Verified' },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Back Arrow */}
      <button
        type="button"
        onClick={() => navigate('/dashboard/users')}
        className="animate-dash-in grid h-9 w-9 place-items-center rounded-lg border border-[#d6dbe6] bg-white text-[#475569] transition hover:bg-[#f1f5f9]"
        style={{ animationDelay: '60ms' }}
      >
        <FontAwesomeIcon icon={faArrowLeft} />
      </button>

      {/* Header */}
      <div className="animate-dash-in flex flex-wrap items-start justify-between gap-4" style={{ animationDelay: '80ms' }}>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Driver Management</h1>
          <p className="mt-1 text-sm text-[#64748b]">Total Drivers: <span className="font-bold text-[#111827]">{TOTAL_DRIVERS}</span></p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
        >
          <FontAwesomeIcon icon={faPlus} className="text-xs" />
          Add Driver
        </button>
      </div>

      {/* Card */}
      <article className="animate-dash-in rounded-xl border border-[#e5e7eb] bg-white" style={{ animationDelay: '100ms' }}>
        {/* Tabs */}
        <div className="border-b border-[#e5e7eb] px-5 pt-4">
          <nav className="-mb-px flex gap-6">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => { setTab(t.key); setPage(1) }}
                className={`whitespace-nowrap border-b-2 pb-2.5 text-sm font-semibold transition ${
                  tab === t.key
                    ? 'border-[#2642a6] text-[#2642a6]'
                    : 'border-transparent text-[#64748b] hover:text-[#334155]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e7eb] px-5 py-3">
          <div className="relative flex-1 min-w-[200px]">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search by name, license number, or phone"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
            />
          </div>
          <div className="relative">
            <select
              value={busFilter}
              onChange={(e) => { setBusFilter(e.target.value); setPage(1) }}
              className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"
            >
              <option value="All">Assignment Bus</option>
              <option value="Assigned">Assigned</option>
              <option value="Unassigned">Unassigned</option>
            </select>
            <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
          </div>
          <div className="relative">
            <select
              value={expFilter}
              onChange={(e) => { setExpFilter(e.target.value); setPage(1) }}
              className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"
            >
              <option value="All">Experience</option>
              <option value="0-2">0–2 years</option>
              <option value="3-5">3–5 years</option>
              <option value="6+">6+ years</option>
            </select>
            <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-3 py-2">
            <span className="text-sm text-[#64748b]">Rating: {minRating > 0 ? `${minRating}+` : 'All'}</span>
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={minRating}
              onChange={(e) => { setMinRating(Number(e.target.value)); setPage(1) }}
              className="h-1.5 w-24 cursor-pointer accent-[#2642a6]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-left text-xs font-semibold text-[#64748b]">
                <th className="py-3 pl-5 pr-2">Driver Details</th>
                <th className="px-2 py-3">License / Phone</th>
                <th className="px-2 py-3">Assignment</th>
                <th className="px-2 py-3">Stats</th>
                <th className="px-2 py-3">Status</th>
                <th className="py-3 pl-2 pr-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((driver) => (
                <tr key={driver.id} className="border-b border-[#f1f5f9] last:border-0 transition hover:bg-[#f8fafc]">
                  {/* Driver Details */}
                  <td className="py-3.5 pl-5 pr-2">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e0e7ff] text-xs font-bold text-[#3b5998]">
                        {driver.initials}
                      </div>
                      <div>
                        <p className="font-semibold text-[#111827]">{driver.name}</p>
                        <p className="text-xs text-[#94a3b8]">ID: {driver.driverId}</p>
                      </div>
                    </div>
                  </td>
                  {/* License / Phone */}
                  <td className="px-2 py-3.5">
                    <p className="font-semibold text-[#111827]">{driver.licenseNo}</p>
                    <p className="text-xs text-[#94a3b8]">{driver.phone}</p>
                  </td>
                  {/* Assignment */}
                  <td className="px-2 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faBus} className="text-xs text-[#94a3b8]" />
                      <span className="font-medium text-[#334155]">{driver.assignedBus ?? 'Unassigned'}</span>
                    </div>
                  </td>
                  {/* Stats */}
                  <td className="px-2 py-3.5">
                    {driver.rating !== null ? (
                      <div>
                        <div className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faStar} className="text-xs text-[#eab308]" />
                          <span className="font-semibold text-[#111827]">{driver.rating.toFixed(1)}</span>
                        </div>
                        <p className="text-xs text-[#94a3b8]">{driver.experience} • {driver.trips}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-[#94a3b8]">New Driver</p>
                        <p className="text-xs text-[#94a3b8]">{driver.experience} • {driver.trips}</p>
                      </div>
                    )}
                  </td>
                  {/* Status */}
                  <td className="px-2 py-3.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(driver.status)}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {driver.status}
                    </span>
                  </td>
                  {/* Actions */}
                  <td className="py-3.5 pl-2 pr-5 text-center">
                    <button type="button" className="text-[#94a3b8] transition hover:text-[#334155]">
                      <FontAwesomeIcon icon={faEllipsisVertical} />
                    </button>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-[#64748b]">
                    No drivers match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-5 py-3">
          <p className="text-sm text-[#64748b]">
            Showing <span className="font-semibold text-[#2642a6]">{showFrom}</span> to{' '}
            <span className="font-semibold text-[#2642a6]">{showTo}</span> of{' '}
            <span className="font-semibold text-[#2642a6]">{filtered.length}</span> drivers
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[#d6dbe6] bg-white px-3.5 py-1.5 text-sm font-medium text-[#334155] transition hover:bg-[#f1f5f9] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#d6dbe6] bg-white px-3.5 py-1.5 text-sm font-medium text-[#334155] transition hover:bg-[#f1f5f9] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </article>
    </div>
  )
}

export default Driver
