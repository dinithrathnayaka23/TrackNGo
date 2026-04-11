import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faClipboardList,
  faHourglassHalf,
  faMagnifyingGlass as faSearchGlass,
  faCheckCircle,
  faChevronDown,
  faCalendarDays,
  faDownload,
  faSort,
  faSortUp,
  faSortDown,
  faEllipsisVertical,
  faCamera,
  faImage,
} from '@fortawesome/free-solid-svg-icons'
import { useMemo, useState } from 'react'

type Priority = 'High' | 'Medium' | 'Low'
type ComplaintStatus = 'Pending' | 'Under Review' | 'Resolved'
type ComplaintType = 'Bus Condition' | 'Driver Behavior' | 'Payment Issue' | 'Safety Issue' | 'Other'

type Complaint = {
  id: string
  priority: Priority
  type: ComplaintType
  passengerName: string
  passengerInitials: string
  description: string
  bookingId: string
  busId: string
  driverName: string
  hasImages: boolean
  imageType: 'camera' | 'gallery' | 'none'
  status: ComplaintStatus
  created: string
  createdSort: number
}

const COMPLAINTS: Complaint[] = [
  {
    id: '#CP-8921',
    priority: 'High',
    type: 'Bus Condition',
    passengerName: 'Prashani Bhagya',
    passengerInitials: 'PB',
    description: 'AC not working on route...',
    bookingId: '#BK-4821',
    busId: 'ND-6398',
    driverName: 'Dinith Rathnayaka',
    hasImages: true,
    imageType: 'camera',
    status: 'Pending',
    created: 'Oct 24, 10:30 AM',
    createdSort: 20231024103000,
  },
  {
    id: '#CP-8922',
    priority: 'Medium',
    type: 'Driver Behavior',
    passengerName: 'Oshadi Liyanage',
    passengerInitials: 'OL',
    description: 'Driver was rude during boarding...',
    bookingId: '#BK-4822',
    busId: 'WP-2596',
    driverName: 'Anjana Lakshan',
    hasImages: true,
    imageType: 'gallery',
    status: 'Under Review',
    created: 'Oct 24, 09:15 AM',
    createdSort: 20231024091500,
  },
  {
    id: '#CP-8923',
    priority: 'Low',
    type: 'Payment Issue',
    passengerName: 'Janani Pitawala',
    passengerInitials: 'JP',
    description: 'Double deduction on credit card...',
    bookingId: '#BK-4825',
    busId: 'SP-2596',
    driverName: 'Anjana Lakshan',
    hasImages: true,
    imageType: 'camera',
    status: 'Resolved',
    created: 'Oct 23, 02:30 PM',
    createdSort: 20231023143000,
  },
  {
    id: '#CP-8924',
    priority: 'High',
    type: 'Safety Issue',
    passengerName: 'Ashini Maduka',
    passengerInitials: 'AM',
    description: 'Bus overspeeding on highway consistently',
    bookingId: '#BK-4830',
    busId: 'WP-8969',
    driverName: 'Janani Pitawala',
    hasImages: true,
    imageType: 'camera',
    status: 'Pending',
    created: 'Oct 24, 08:00 AM',
    createdSort: 20231024080000,
  },
  {
    id: '#CP-8925',
    priority: 'Low',
    type: 'Other',
    passengerName: 'Ramesh Kalana',
    passengerInitials: 'RK',
    description: 'Found a bag on seat 12, left at office',
    bookingId: '#BK-4832',
    busId: 'NC-1120',
    driverName: '',
    hasImages: true,
    imageType: 'gallery',
    status: 'Resolved',
    created: 'Oct 22, 05:00 PM',
    createdSort: 20231022170000,
  },
  {
    id: '#CP-8926',
    priority: 'High',
    type: 'Bus Condition',
    passengerName: 'Kasun Perera',
    passengerInitials: 'KP',
    description: 'Seat cushion torn and springs exposed',
    bookingId: '#BK-4826',
    busId: 'NB-3301',
    driverName: 'Nimal Silva',
    hasImages: true,
    imageType: 'camera',
    status: 'Pending',
    created: 'Oct 21, 11:45 AM',
    createdSort: 20231021114500,
  },
  {
    id: '#CP-8927',
    priority: 'Medium',
    type: 'Driver Behavior',
    passengerName: 'Dinith Rathnayaka',
    passengerInitials: 'DR',
    description: 'Driver skipped designated bus stop',
    bookingId: '#BK-4827',
    busId: 'NJ-6610',
    driverName: 'Dinesh Gamage',
    hasImages: false,
    imageType: 'none',
    status: 'Under Review',
    created: 'Oct 20, 09:00 PM',
    createdSort: 20231020210000,
  },
  {
    id: '#CP-8928',
    priority: 'Low',
    type: 'Payment Issue',
    passengerName: 'Amila Fernando',
    passengerInitials: 'AF',
    description: 'Refund not credited after cancellation',
    bookingId: '#BK-4828',
    busId: 'NB-0088',
    driverName: 'Kasun Perera',
    hasImages: false,
    imageType: 'none',
    status: 'Resolved',
    created: 'Oct 19, 03:20 PM',
    createdSort: 20231019152000,
  },
  {
    id: '#CP-8929',
    priority: 'High',
    type: 'Safety Issue',
    passengerName: 'Nimal Silva',
    passengerInitials: 'NS',
    description: 'Emergency exit door jammed during trip',
    bookingId: '#BK-4829',
    busId: 'NJ-3300',
    driverName: 'Amila Fernando',
    hasImages: true,
    imageType: 'camera',
    status: 'Under Review',
    created: 'Oct 18, 06:15 PM',
    createdSort: 20231018181500,
  },
  {
    id: '#CP-8930',
    priority: 'Medium',
    type: 'Other',
    passengerName: 'Dinesh Gamage',
    passengerInitials: 'DG',
    description: 'Wrong bus number displayed on app',
    bookingId: '#BK-4830',
    busId: 'ND-4420',
    driverName: 'Nimal Silva',
    hasImages: false,
    imageType: 'none',
    status: 'Resolved',
    created: 'Oct 17, 07:30 AM',
    createdSort: 20231017073000,
  },
]

const TOTAL = COMPLAINTS.length
const PENDING_COUNT = COMPLAINTS.filter((c) => c.status === 'Pending').length
const REVIEW_COUNT = COMPLAINTS.filter((c) => c.status === 'Under Review').length
const RESOLVED_COUNT = COMPLAINTS.filter((c) => c.status === 'Resolved').length
const HIGH_COUNT = COMPLAINTS.filter((c) => c.priority === 'High').length

const CATEGORIES: ComplaintType[] = ['Bus Condition', 'Driver Behavior', 'Payment Issue', 'Safety Issue', 'Other']
const PER_PAGE = 5

type SortDir = 'asc' | 'desc' | null

function priorityBadge(p: Priority) {
  if (p === 'High') return 'bg-[#dc2626] text-white'
  if (p === 'Medium') return 'bg-[#f59e0b] text-white'
  return 'bg-[#64748b] text-white'
}

function statusBadge(s: ComplaintStatus) {
  if (s === 'Pending') return 'bg-[#fee2e2] text-[#dc2626]'
  if (s === 'Under Review') return 'bg-[#dbeafe] text-[#2563eb]'
  return 'bg-[#dcfce7] text-[#047857]'
}

function Complaints() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | ComplaintStatus>('All')
  const [priorityFilter, setPriorityFilter] = useState<'All' | Priority>('All')
  const [categoryFilter, setCategoryFilter] = useState<'All' | ComplaintType>('All')
  const [assignedFilter, setAssignedFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  const filtered = useMemo(() => {
    let list = COMPLAINTS

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.passengerName.toLowerCase().includes(q),
      )
    }
    if (statusFilter !== 'All') list = list.filter((c) => c.status === statusFilter)
    if (priorityFilter !== 'All') list = list.filter((c) => c.priority === priorityFilter)
    if (categoryFilter !== 'All') list = list.filter((c) => c.type === categoryFilter)

    if (sortDir) {
      const dir = sortDir === 'asc' ? 1 : -1
      list = [...list].sort((a, b) => a.id.localeCompare(b.id) * dir)
    }

    return list
  }, [search, statusFilter, priorityFilter, categoryFilter, sortDir])

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const showFrom = filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const showTo = Math.min(page * PER_PAGE, filtered.length)

  function toggleSort() {
    setSortDir((prev) => {
      if (!prev) return 'asc'
      if (prev === 'asc') return 'desc'
      return null
    })
  }

  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (page > 3) pages.push('...')
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
      if (page < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }, [page, totalPages])

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Header */}
      <div className="animate-dash-in flex flex-wrap items-center justify-between gap-4" style={{ animationDelay: '80ms' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Complaints Management</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fee2e2] px-3 py-1 text-xs font-bold text-[#dc2626]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" />
            {HIGH_COUNT} high priority
          </span>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
        >
          <FontAwesomeIcon icon={faDownload} className="text-xs" />
          Export Report
        </button>
      </div>

      {/* Stat Cards */}
      <div className="animate-dash-in grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '100ms' }}>
        <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Total Complaints</p>
            <p className="mt-1 text-2xl font-extrabold text-[#111827]">{TOTAL}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#f1f5f9] text-[#475569]">
            <FontAwesomeIcon icon={faClipboardList} />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-xl border border-[#fecaca] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Pending</p>
            <p className="mt-1 text-2xl font-extrabold text-[#dc2626]">{PENDING_COUNT}</p>
            <p className="mt-0.5 text-xs font-semibold text-[#dc2626]">Action Required (&gt;20)</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#fee2e2] text-[#dc2626]">
            <FontAwesomeIcon icon={faClipboardList} />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Under Review</p>
            <p className="mt-1 text-2xl font-extrabold text-[#111827]">{REVIEW_COUNT}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#fef3c7] text-[#f59e0b]">
            <FontAwesomeIcon icon={faHourglassHalf} />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Resolved</p>
            <p className="mt-1 text-2xl font-extrabold text-[#16a34a]">{RESOLVED_COUNT}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
            <FontAwesomeIcon icon={faCheckCircle} />
          </div>
        </article>
      </div>

      {/* Filters Row */}
      <div className="animate-dash-in flex flex-wrap items-end gap-3" style={{ animationDelay: '120ms' }}>
        <div className="min-w-[160px] flex-1">
          <label className="text-xs font-semibold text-[#64748b]">Search</label>
          <div className="relative mt-1">
            <FontAwesomeIcon icon={faSearchGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
            <input
              type="text"
              placeholder="ID, Passenger Name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-[#64748b]">Status</label>
          <div className="relative mt-1">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}
              className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm text-[#334155] outline-none transition focus:border-[#2642a6]"
            >
              <option value="All">All Statuses</option>
              <option>Pending</option>
              <option>Under Review</option>
              <option>Resolved</option>
            </select>
            <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-[#64748b]">Priority</label>
          <div className="relative mt-1">
            <select
              value={priorityFilter}
              onChange={(e) => { setPriorityFilter(e.target.value as typeof priorityFilter); setPage(1) }}
              className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm text-[#334155] outline-none transition focus:border-[#2642a6]"
            >
              <option value="All">All Priorities</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
            <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-[#64748b]">Category</label>
          <div className="relative mt-1">
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value as typeof categoryFilter); setPage(1) }}
              className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm text-[#334155] outline-none transition focus:border-[#2642a6]"
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-[#64748b]">Date Range</label>
          <div className="relative mt-1">
            <FontAwesomeIcon icon={faCalendarDays} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Select dates"
              className="w-36 rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-[#64748b]">Assigned To</label>
          <div className="relative mt-1">
            <select
              value={assignedFilter}
              onChange={(e) => { setAssignedFilter(e.target.value); setPage(1) }}
              className="appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm text-[#334155] outline-none transition focus:border-[#2642a6]"
            >
              <option>All</option>
            </select>
            <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="animate-dash-in overflow-hidden rounded-xl border border-[#e5e7eb] bg-white" style={{ animationDelay: '140ms' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-left text-xs font-semibold text-[#64748b]">
                <th className="py-3 pl-5 pr-2">
                  <button type="button" onClick={toggleSort} className="inline-flex items-center gap-1 hover:text-[#334155]">
                    ID
                    <FontAwesomeIcon icon={!sortDir ? faSort : sortDir === 'asc' ? faSortUp : faSortDown} className="text-[10px]" />
                  </button>
                </th>
                <th className="px-2 py-3">Priority</th>
                <th className="px-2 py-3">Type</th>
                <th className="px-2 py-3">Passenger</th>
                <th className="px-2 py-3">Description</th>
                <th className="px-2 py-3">Booking ID</th>
                <th className="px-2 py-3">Bus/Driver</th>
                <th className="px-2 py-3">Images</th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3">Created</th>
                <th className="py-3 pl-2 pr-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => (
                <tr key={c.id} className="border-b border-[#f1f5f9] last:border-0 transition hover:bg-[#f8fafc]">
                  <td className="py-3.5 pl-5 pr-2 font-bold text-[#2642a6]">{c.id}</td>
                  <td className="px-2 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${priorityBadge(c.priority)}`}>
                      {c.priority}
                    </span>
                  </td>
                  <td className="px-2 py-3.5">
                    <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium text-[#475569]">{c.type}</span>
                  </td>
                  <td className="px-2 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e0e7ff] text-[10px] font-bold text-[#3b5998]">
                        {c.passengerInitials}
                      </div>
                      <span className="font-medium text-[#111827]">{c.passengerName}</span>
                    </div>
                  </td>
                  <td className="max-w-[160px] truncate px-2 py-3.5 text-[#475569]">{c.description}</td>
                  <td className="px-2 py-3.5 font-semibold text-[#2642a6]">{c.bookingId}</td>
                  <td className="px-2 py-3.5">
                    <p className="font-medium text-[#111827]">{c.busId}</p>
                    {c.driverName && <p className="text-xs text-[#94a3b8]">{c.driverName}</p>}
                  </td>
                  <td className="px-2 py-3.5 text-center">
                    {c.hasImages ? (
                      <FontAwesomeIcon
                        icon={c.imageType === 'camera' ? faCamera : faImage}
                        className="text-sm text-[#475569]"
                      />
                    ) : (
                      <span className="text-xs text-[#cbd5e1]">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3.5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-3.5 text-[#475569]">{c.created}</td>
                  <td className="py-3.5 pl-2 pr-5 text-center">
                    <button type="button" className="text-[#94a3b8] transition hover:text-[#334155]">
                      <FontAwesomeIcon icon={faEllipsisVertical} />
                    </button>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-sm text-[#64748b]">No complaints match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-5 py-3">
          <p className="text-sm text-[#64748b]">
            Showing <span className="font-semibold text-[#111827]">{showFrom}-{showTo}</span> of{' '}
            <span className="font-semibold text-[#111827]">{filtered.length}</span> complaints
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[#d6dbe6] bg-white px-3 py-1.5 text-sm font-medium text-[#334155] transition hover:bg-[#f1f5f9] disabled:opacity-40"
            >
              Previous
            </button>
            {pageNumbers.map((n, i) =>
              n === '...' ? (
                <span key={`dots-${i}`} className="px-1 text-sm text-[#94a3b8]">...</span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-medium transition ${
                    page === n
                      ? 'bg-[#2642a6] text-white'
                      : 'border border-[#d6dbe6] bg-white text-[#334155] hover:bg-[#f1f5f9]'
                  }`}
                >
                  {n}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#d6dbe6] bg-white px-3 py-1.5 text-sm font-medium text-[#334155] transition hover:bg-[#f1f5f9] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Complaints
