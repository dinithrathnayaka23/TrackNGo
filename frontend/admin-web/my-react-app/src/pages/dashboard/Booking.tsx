import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBus,
  faCheckCircle,
  faHourglassHalf,
  faTimesCircle,
  faSearch,
  faChevronDown,
  faCalendarDays,
  faDownload,
  faSort,
  faSortUp,
  faSortDown,
  faSliders,
} from '@fortawesome/free-solid-svg-icons'
import { useMemo, useState, useEffect } from 'react'

type BookingStatus = 'Confirmed' | 'Pending' | 'Cancelled'
type PaymentStatus = 'Paid' | 'Refunded' | 'App Amount' | 'Unpaid'
type BusType = 'AC' | 'Non-AC'
type BookingCategory = 'All Bookings' | 'Highway/Long-distance' | 'Trip Bookings'
type SortField = 'bookingId' | 'dateTime' | 'amount'
type SortDir = 'asc' | 'desc' | null

type BookingRecord = {
  bookingId: string
  passengerName: string
  passengerInitials: string
  route: string
  bus: string
  busType: BusType
  dateTime: string
  dateSort: number
  seats: string
  amount: string
  amountNum: number
  paymentStatus: PaymentStatus
  status: BookingStatus
  category: BookingCategory
}

const BOOKINGS: BookingRecord[] = [
  {
    bookingId: '#BK-4821',
    passengerName: 'Oshadi Liyanage',
    passengerInitials: 'OL',
    route: 'Kadawatha - Moratuwa',
    bus: 'Bus 102 (AC)',
    busType: 'AC',
    dateTime: 'Oct 24, 2023\n08:30 AM',
    dateSort: 20231024083000,
    seats: '2A, 2B',
    amount: 'Rs.145.00',
    amountNum: 145,
    paymentStatus: 'Paid',
    status: 'Confirmed',
    category: 'All Bookings',
  },
  {
    bookingId: '#BK-4822',
    passengerName: 'Mayura Ranasinghe',
    passengerInitials: 'MR',
    route: 'Colombo - Kandy',
    bus: 'Bus 305 (Non-AC)',
    busType: 'Non-AC',
    dateTime: 'Oct 24, 2023\n09:15 AM',
    dateSort: 20231024091500,
    seats: '5C',
    amount: 'Rs.325.00',
    amountNum: 325,
    paymentStatus: 'Paid',
    status: 'Confirmed',
    category: 'Highway/Long-distance',
  },
  {
    bookingId: '#BK-4823',
    passengerName: 'Prashani Bhagya',
    passengerInitials: 'PB',
    route: 'Colombo - Kandy',
    bus: 'Bus 440 (AC)',
    busType: 'AC',
    dateTime: 'Oct 23, 2023\n11:00 PM',
    dateSort: 20231023230000,
    seats: '12A, 12B',
    amount: 'Rs.185.00',
    amountNum: 185,
    paymentStatus: 'Paid',
    status: 'Confirmed',
    category: 'Highway/Long-distance',
  },
  {
    bookingId: '#BK-4824',
    passengerName: 'Esandi Liyanage',
    passengerInitials: 'EL',
    route: 'Mawanella - Colombo',
    bus: 'Bus 201 (AC)',
    busType: 'AC',
    dateTime: 'Oct 22, 2023\n02:45 PM',
    dateSort: 20231022144500,
    seats: '4A',
    amount: 'Rs.128.00',
    amountNum: 128,
    paymentStatus: 'Refunded',
    status: 'Cancelled',
    category: 'All Bookings',
  },
  {
    bookingId: '#BK-4825',
    passengerName: 'Janani Pitawala',
    passengerInitials: 'JP',
    route: 'Colombo - Galle',
    bus: 'Bus 102 (AC)',
    busType: 'AC',
    dateTime: 'Oct 24, 2023\n08:30 AM',
    dateSort: 20231024083001,
    seats: 'Full Bus',
    amount: 'Rs.50,200.00',
    amountNum: 50200,
    paymentStatus: 'App Amount',
    status: 'Pending',
    category: 'Trip Bookings',
  },
  {
    bookingId: '#BK-4826',
    passengerName: 'Kasun Perera',
    passengerInitials: 'KP',
    route: 'Kandy - Matale',
    bus: 'Bus 550 (Non-AC)',
    busType: 'Non-AC',
    dateTime: 'Oct 21, 2023\n06:00 AM',
    dateSort: 20231021060000,
    seats: '8A, 8B',
    amount: 'Rs.90.00',
    amountNum: 90,
    paymentStatus: 'Paid',
    status: 'Confirmed',
    category: 'All Bookings',
  },
  {
    bookingId: '#BK-4827',
    passengerName: 'Dinith Rathnayaka',
    passengerInitials: 'DR',
    route: 'Colombo - Jaffna',
    bus: 'Bus 710 (AC)',
    busType: 'AC',
    dateTime: 'Oct 20, 2023\n10:00 PM',
    dateSort: 20231020220000,
    seats: '1A, 1B, 1C',
    amount: 'Rs.1,250.00',
    amountNum: 1250,
    paymentStatus: 'Paid',
    status: 'Confirmed',
    category: 'Highway/Long-distance',
  },
  {
    bookingId: '#BK-4828',
    passengerName: 'Amila Fernando',
    passengerInitials: 'AF',
    route: 'Negombo - Colombo',
    bus: 'Bus 88 (Non-AC)',
    busType: 'Non-AC',
    dateTime: 'Oct 19, 2023\n07:30 AM',
    dateSort: 20231019073000,
    seats: '3D',
    amount: 'Rs.65.00',
    amountNum: 65,
    paymentStatus: 'Unpaid',
    status: 'Pending',
    category: 'All Bookings',
  },
  {
    bookingId: '#BK-4829',
    passengerName: 'Nimal Silva',
    passengerInitials: 'NS',
    route: 'Galle - Matara',
    bus: 'Bus 330 (AC)',
    busType: 'AC',
    dateTime: 'Oct 18, 2023\n03:15 PM',
    dateSort: 20231018151500,
    seats: '6A',
    amount: 'Rs.110.00',
    amountNum: 110,
    paymentStatus: 'Refunded',
    status: 'Cancelled',
    category: 'All Bookings',
  },
  {
    bookingId: '#BK-4830',
    passengerName: 'Dinesh Gamage',
    passengerInitials: 'DG',
    route: 'Colombo - Kandy',
    bus: 'Bus 305 (Non-AC)',
    busType: 'Non-AC',
    dateTime: 'Oct 17, 2023\n05:45 AM',
    dateSort: 20231017054500,
    seats: '9B',
    amount: 'Rs.325.00',
    amountNum: 325,
    paymentStatus: 'Paid',
    status: 'Confirmed',
    category: 'Highway/Long-distance',
  },
]

const TOTAL = BOOKINGS.length
const CONFIRMED_COUNT = BOOKINGS.filter((b) => b.status === 'Confirmed').length
const PENDING_COUNT = BOOKINGS.filter((b) => b.status === 'Pending').length
const CANCELLED_COUNT = BOOKINGS.filter((b) => b.status === 'Cancelled').length

const ROUTES = ['All Routes', ...Array.from(new Set(BOOKINGS.map((b) => b.route)))]
const PER_PAGE = 5

function bookingStatusBadge(status: BookingStatus) {
  if (status === 'Confirmed') return 'bg-[#dcfce7] text-[#047857]'
  if (status === 'Pending') return 'bg-[#fef3c7] text-[#b45309]'
  return 'bg-[#fee2e2] text-[#dc2626]'
}

function paymentStatusColor(status: PaymentStatus) {
  if (status === 'Paid') return 'text-[#16a34a]'
  if (status === 'Refunded') return 'text-[#dc2626]'
  if (status === 'App Amount') return 'text-[#f59e0b]'
  return 'text-[#64748b]'
}

function Booking() {
  const [activeTab, setActiveTab] = useState<BookingCategory>('All Bookings')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All Statuses' | BookingStatus>('All Statuses')
  const [routeFilter, setRouteFilter] = useState('All Routes')
  const [busTypeFilter, setBusTypeFilter] = useState<'All' | BusType>('All')
  const [paymentFilter, setPaymentFilter] = useState<'All' | PaymentStatus>('All')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'bookingId', dir: null })
  const [realBookings, setRealBookings] = useState<BookingRecord[]>([])

  // 🔹 FETCH REAL TRIP BOOKINGS FROM BACKEND
  useEffect(() => {
    const fetchTripBookings = async () => {
      try {
        console.log("Fetching trip bookings from backend...");
        const response = await fetch('http://localhost:8080/api/trips/all');
        if (!response.ok) throw new Error("Backend error: " + response.status);
        
        const data = await response.json();
        console.log("Real Bookings Data:", data);

        const formatted: BookingRecord[] = data.map((b: any) => ({
          bookingId: `#BK-${b.id}`,
          passengerIdRaw: b.id, 
          passengerName: `User #${b.passengerId || "Unknown"}`, 
          passengerInitials: 'U',
          route: `${b.startLocation} to ${b.destination}`,
          bus: 'Trip Booking',
          busType: 'AC',
          dateTime: `${b.startDate || "Today"}\nPending`,
          dateSort: Date.now(), 
          seats: `${b.passengerCount || 0} Seats`,
          amount: `Rs.${(b.finalPrice || 0).toLocaleString()}`,
          amountNum: b.finalPrice || 0,
          paymentStatus: b.bookingStatus === 'PAID' ? 'Paid' : 'Unpaid',
          status: b.bookingStatus?.toLowerCase() === 'confirmed' ? 'Confirmed' : (b.bookingStatus?.toLowerCase() === 'pending' ? 'Pending' : 'Pending'),
          category: 'Trip Bookings',
        }));
        setRealBookings(formatted);
      } catch (error) {
        console.error("❌ ADMIN FETCH ERROR:", error);
      }
    };
    fetchTripBookings();
  }, []);

  const approveBooking = async (id: any) => {
    try {
      const response = await fetch(`http://localhost:8080/api/trips/update-status/${id}?status=confirmed`, { method: 'POST' });
      if (!response.ok) throw new Error("Failed to update status");
      
      alert("Booking Approved Successfully!");
      window.location.reload(); 
    } catch (error) {
      console.error(error);
      alert("Failed to approve booking. Check backend logs.");
    }
  };

  const ALL_COMBINED_BOOKINGS = useMemo(() => [...realBookings, ...BOOKINGS], [realBookings]);


  const tabCounts = useMemo(() => ({
    'All Bookings': ALL_COMBINED_BOOKINGS.length,
    'Highway/Long-distance': ALL_COMBINED_BOOKINGS.filter((b) => b.category === 'Highway/Long-distance' || b.category === 'All Bookings').length,
    'Trip Bookings': ALL_COMBINED_BOOKINGS.filter((b) => b.category === 'Trip Bookings').length,
  }), [ALL_COMBINED_BOOKINGS])

  const filtered = useMemo(() => {
    if (activeTab === 'Trip Bookings') {
      return ALL_COMBINED_BOOKINGS.filter((b) => b.category === 'Trip Bookings');
    }

    let list = ALL_COMBINED_BOOKINGS
    if (activeTab === 'Highway/Long-distance') {
      list = list.filter((b) => b.category === 'Highway/Long-distance' || b.category === 'All Bookings')
    }

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (b) =>
          b.bookingId.toLowerCase().includes(q) ||
          b.passengerName.toLowerCase().includes(q),
      )
    }
    if (statusFilter !== 'All Statuses') list = list.filter((b) => b.status === statusFilter)
    if (routeFilter !== 'All Routes') list = list.filter((b) => b.route === routeFilter)
    if (busTypeFilter !== 'All') list = list.filter((b) => b.busType === busTypeFilter)
    if (paymentFilter !== 'All') list = list.filter((b) => b.paymentStatus === paymentFilter)

    if (sort.dir) {
      const dir = sort.dir === 'asc' ? 1 : -1
      list = [...list].sort((a, b) => {
        if (sort.field === 'bookingId') return a.bookingId.localeCompare(b.bookingId) * dir
        if (sort.field === 'dateTime') return (a.dateSort - b.dateSort) * dir
        return (a.amountNum - b.amountNum) * dir
      })
    }

    return list
  }, [activeTab, search, statusFilter, routeFilter, busTypeFilter, paymentFilter, sort])

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const showFrom = filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const showTo = Math.min(page * PER_PAGE, filtered.length)

  function toggleSort(field: SortField) {
    setSort((prev) => {
      if (prev.field !== field) return { field, dir: 'asc' }
      if (prev.dir === 'asc') return { field, dir: 'desc' }
      if (prev.dir === 'desc') return { field, dir: null }
      return { field, dir: 'asc' }
    })
  }

  function sortIcon(field: SortField) {
    if (sort.field !== field || !sort.dir) return faSort
    return sort.dir === 'asc' ? faSortUp : faSortDown
  }

  function resetFilters() {
    setSearch('')
    setStatusFilter('All Statuses')
    setRouteFilter('All Routes')
    setBusTypeFilter('All')
    setPaymentFilter('All')
    setPage(1)
  }

  function applyFilters() {
    setPage(1)
  }

  const tabs: { key: BookingCategory; label: string; count: number }[] = [
    { key: 'All Bookings', label: 'All Bookings', count: tabCounts['All Bookings'] },
    { key: 'Highway/Long-distance', label: 'Highway/Long-distance', count: tabCounts['Highway/Long-distance'] },
    { key: 'Trip Bookings', label: 'Trip Bookings', count: tabCounts['Trip Bookings'] },
  ]

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
        <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Bookings Management</h1>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
        >
          <FontAwesomeIcon icon={faDownload} className="text-xs" />
          Export Bookings
        </button>
      </div>

      {/* Stat Cards */}
      <div className="animate-dash-in grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '100ms' }}>
        <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Total Bookings</p>
            <p className="mt-1 text-2xl font-extrabold text-[#111827]">{TOTAL.toLocaleString()}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#f1f5f9] text-[#475569]">
            <FontAwesomeIcon icon={faBus} />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Confirmed</p>
            <p className="mt-1 text-2xl font-extrabold text-[#16a34a]">{CONFIRMED_COUNT.toLocaleString()}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#dcfce7] text-[#16a34a]">
            <FontAwesomeIcon icon={faCheckCircle} />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Pending</p>
            <p className="mt-1 text-2xl font-extrabold text-[#f59e0b]">{PENDING_COUNT}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#fef3c7] text-[#f59e0b]">
            <FontAwesomeIcon icon={faHourglassHalf} />
          </div>
        </article>
        <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Cancelled</p>
            <p className="mt-1 text-2xl font-extrabold text-[#dc2626]">{CANCELLED_COUNT}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#fee2e2] text-[#dc2626]">
            <FontAwesomeIcon icon={faTimesCircle} />
          </div>
        </article>
      </div>

      {/* Tabs */}
      <div className="animate-dash-in border-b border-[#e5e7eb]" style={{ animationDelay: '120ms' }}>
        <nav className="-mb-px flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setActiveTab(t.key); setPage(1) }}
              className={`whitespace-nowrap border-b-2 pb-2.5 text-sm font-semibold transition ${
                activeTab === t.key
                  ? 'border-[#2642a6] text-[#2642a6]'
                  : 'border-transparent text-[#64748b] hover:text-[#334155]'
              }`}
            >
              {t.label}
              <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === t.key ? 'bg-[#e0e7ff] text-[#2642a6]' : 'bg-[#f1f5f9] text-[#64748b]'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content: Filters + Table */}
      <div className="animate-dash-in flex gap-5" style={{ animationDelay: '140ms' }}>
        {/* Left Filters Panel */}
        <aside className="w-64 shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#111827]">Filters</h2>
            <FontAwesomeIcon icon={faSliders} className="text-sm text-[#94a3b8]" />
          </div>

          {/* Search */}
          <div>
            <label className="text-xs font-semibold text-[#64748b]">Search</label>
            <div className="relative mt-1">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Booking ID, Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
              />
            </div>
          </div>

          {/* Booking Status */}
          <div>
            <label className="text-xs font-semibold text-[#64748b]">Booking Status</label>
            <div className="relative mt-1">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm text-[#334155] outline-none transition focus:border-[#2642a6]"
              >
                <option>All Statuses</option>
                <option>Confirmed</option>
                <option>Pending</option>
                <option>Cancelled</option>
              </select>
              <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-xs font-semibold text-[#64748b]">Date Range</label>
            <div className="relative mt-1">
              <FontAwesomeIcon icon={faCalendarDays} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Select dates"
                className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
              />
            </div>
          </div>

          {/* Route */}
          <div>
            <label className="text-xs font-semibold text-[#64748b]">Route</label>
            <div className="relative mt-1">
              <select
                value={routeFilter}
                onChange={(e) => setRouteFilter(e.target.value)}
                className="w-full appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm text-[#334155] outline-none transition focus:border-[#2642a6]"
              >
                {ROUTES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
            </div>
          </div>

          {/* Bus Type */}
          <div>
            <label className="text-xs font-semibold text-[#64748b]">Bus Type</label>
            <div className="mt-1.5 flex items-center gap-4">
              {(['All', 'AC', 'Non-AC'] as const).map((opt) => (
                <label key={opt} className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-[#334155]">
                  <input
                    type="radio"
                    name="busType"
                    checked={busTypeFilter === opt}
                    onChange={() => setBusTypeFilter(opt)}
                    className="accent-[#2642a6]"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          {/* Payment Status */}
          <div>
            <label className="text-xs font-semibold text-[#64748b]">Payment Status</label>
            <div className="relative mt-1">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as typeof paymentFilter)}
                className="w-full appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm text-[#334155] outline-none transition focus:border-[#2642a6]"
              >
                <option>All</option>
                <option>Paid</option>
                <option>Refunded</option>
                <option>App Amount</option>
                <option>Unpaid</option>
              </select>
              <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
            </div>
          </div>

          {/* Apply / Reset */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={applyFilters}
              className="flex-1 rounded-lg bg-[#2642a6] py-2.5 text-sm font-bold text-white transition hover:bg-[#203b96]"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="flex-1 rounded-lg border border-[#d6dbe6] bg-white py-2.5 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]"
            >
              Reset
            </button>
          </div>
        </aside>

        {/* Right Table */}
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e5e7eb] text-left text-xs font-semibold text-[#64748b]">
                  <th className="py-3 pl-5 pr-2">
                    <button type="button" onClick={() => toggleSort('bookingId')} className="inline-flex items-center gap-1 hover:text-[#334155]">
                      Booking ID
                      <FontAwesomeIcon icon={sortIcon('bookingId')} className="text-[10px]" />
                    </button>
                  </th>
                  <th className="px-2 py-3">Passenger</th>
                  <th className="px-2 py-3">Route / Bus</th>
                  <th className="px-2 py-3">
                    <button type="button" onClick={() => toggleSort('dateTime')} className="inline-flex items-center gap-1 hover:text-[#334155]">
                      Date &amp; Time
                      <FontAwesomeIcon icon={sortIcon('dateTime')} className="text-[10px]" />
                    </button>
                  </th>
                  <th className="px-2 py-3">Seats</th>
                  <th className="px-2 py-3">
                    <button type="button" onClick={() => toggleSort('amount')} className="inline-flex items-center gap-1 hover:text-[#334155]">
                      Amount
                      <FontAwesomeIcon icon={sortIcon('amount')} className="text-[10px]" />
                    </button>
                  </th>
                  <th className="py-3 pl-2 pr-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((booking) => {
                  const [datePart, timePart] = booking.dateTime.split('\n')
                  return (
                    <tr key={booking.bookingId} className="border-b border-[#f1f5f9] last:border-0 transition hover:bg-[#f8fafc]">
                      <td className="py-3.5 pl-5 pr-2 font-bold text-[#2642a6]">{booking.bookingId}</td>
                      <td className="px-2 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#e0e7ff] text-[10px] font-bold text-[#3b5998]">
                            {booking.passengerInitials}
                          </div>
                          <span className="font-medium text-[#111827]">{booking.passengerName}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3.5">
                        <p className="font-medium text-[#111827]">{booking.route}</p>
                        <p className="text-xs text-[#94a3b8]">{booking.bus}</p>
                      </td>
                      <td className="px-2 py-3.5">
                        <p className="text-[#111827]">{datePart}</p>
                        <p className="text-xs text-[#94a3b8]">{timePart}</p>
                      </td>
                      <td className="px-2 py-3.5 text-[#334155]">{booking.seats}</td>
                      <td className="px-2 py-3.5">
                        <p className="font-semibold text-[#111827]">{booking.amount}</p>
                        <p className={`text-xs font-medium ${paymentStatusColor(booking.paymentStatus)}`}>{booking.paymentStatus}</p>
                      </td>
                      <td className="py-3.5 pl-2 pr-5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${bookingStatusBadge(booking.status)}`}>
                          {booking.status}
                        </span>
                        {booking.category === 'Trip Bookings' && (
                          booking.status === 'Pending' ? (
                            <button 
                              onClick={() => approveBooking((booking as any).passengerIdRaw)}
                              className="ml-2 rounded bg-[#16a34a] px-2 py-1 text-[10px] text-white hover:bg-[#15803d] transition-colors"
                            >
                              Approve
                            </button>
                          ) : booking.status === 'Confirmed' ? (
                            <button disabled className="ml-2 rounded bg-[#dcfce7] px-2 py-1 text-[10px] text-[#16a34a] border border-[#16a34a]/20 cursor-default font-bold">
                              Approved
                            </button>
                          ) : null
                        )}
                      </td>
                    </tr>
                  )
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-[#64748b]">No bookings match your filters.</td>
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
              <span className="font-semibold text-[#2642a6]">{filtered.length.toLocaleString()}</span> results
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
    </div>
  )
}

export default Booking
