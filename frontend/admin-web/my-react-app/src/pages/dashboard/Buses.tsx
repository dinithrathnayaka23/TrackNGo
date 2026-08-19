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
  faClock,
  faSpinner,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  fetchBuses,
  createBus,
  fetchDriverOptions,
  fetchRouteOptions,
  type BusListItem,
  type SaveBusRequest,
  type DriverOption,
  type RouteOption,
} from '../../services/busService'
import { getBusImage } from '../../utils/busImage'

type BusStatus = 'active' | 'maintenance' | 'inactive'

// Utility functions for status display
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

function formatSchedule(start?: string | null, end?: string | null, returnStart?: string | null, returnEnd?: string | null) {
  const forward = start && end ? `${start}-${end}` : null
  const backward = returnStart && returnEnd ? `${returnStart}-${returnEnd}` : null
  if (forward && backward) return `${forward} | ${backward}`
  if (forward) return forward
  if (backward) return backward
  return '--'
}

function formatClockTime(value?: string | null) {
  if (!value) return '--'
  const parts = value.split(':')
  if (parts.length < 2) return value

  const hour = Number(parts[0])
  const minute = parts[1]
  if (Number.isNaN(hour)) return value

  const period = hour >= 12 ? 'PM' : 'AM'
  const normalizedHour = hour % 12 || 12
  return `${normalizedHour}:${minute} ${period}`
}

function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start && !end) return 'Not scheduled'
  if (start && end) return `${formatClockTime(start)} - ${formatClockTime(end)}`
  if (start) return `${formatClockTime(start)} - --`
  return `-- - ${formatClockTime(end)}`
}

function formatBusTypeChipLabel(busType?: string | null) {
  if (!busType) return 'Bus'

  const normalized = busType.toLowerCase()
  if (normalized === 'long_distance') return 'Long Dist.'
  if (normalized === 'trip_booking') return 'Trip Booking'
  if (normalized === 'highway') return 'Highway'
  if (normalized === 'corporate') return 'Corporate'

  return busType.replace(/_/g, ' ')
}

/**
 * Buses Component - Main dashboard page for bus management
 * 
 * This component provides a comprehensive interface for administrators to:
 * - View all buses in a grid layout with key information
 * - Filter buses by search term, type (AC/Non-AC), status, and capacity range
 * - Add new buses through a modal form
 * - Export bus data to PDF reports
 * - Navigate to detailed bus views
 * 
 * Features include:
 * - Real-time bus statistics (total, active, maintenance, inactive counts)
 * - Responsive grid layout for bus cards
 * - Modal-based bus creation with validation
 * - PDF export with formatted tables and summaries
 */
function Buses() {
  const navigate = useNavigate()

  // State for bus data and loading
  const [buses, setBuses] = useState<BusListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter states
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'All Types' | 'AC' | 'Non-AC'>('All Types')
  const [statusFilter, setStatusFilter] = useState<'All' | BusStatus>('All')
  const [minCap, setMinCap] = useState(0)
  const [maxCap, setMaxCap] = useState(100)

  // Add Bus modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [driverOptions, setDriverOptions] = useState<DriverOption[]>([])
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Form state for new bus creation
  const emptyForm: SaveBusRequest = {
    busNumber: '',
    busBrand: '',
    seatCapacity: 40,
    busType: 'highway',
    busCondition: 'good',
    status: 'active',
    amenities: [],
    startTime: null,
    endTime: null,
    returnStartTime: null,
    returnEndTime: null,
    registrationNumber: '',
    insuranceExpDate: '',
    driverId: null,
    routeId: null,
  }
  const [form, setForm] = useState<SaveBusRequest>(emptyForm)

  // Load buses from API
  const loadBuses = () => {
    setLoading(true)
    fetchBuses()
      .then(setBuses)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadBuses() }, [])

  // Open add bus modal and fetch options
  const openAddModal = () => {
    setForm(emptyForm)
    setSaveError('')
    setShowAddModal(true)
    Promise.all([fetchDriverOptions(), fetchRouteOptions()])
      .then(([drivers, routes]) => {
        setDriverOptions(drivers)
        setRouteOptions(routes)
      })
      .catch(() => {})
  }

  // Handle bus creation with validation
  const handleAddBus = async () => {
    if (!form.busNumber.trim() || !form.busBrand.trim() || !form.registrationNumber.trim()) {
      setSaveError('Bus number, brand, and registration number are required.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      await createBus(form)
      setShowAddModal(false)
      loadBuses()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to create bus')
    } finally {
      setSaving(false)
    }
  }

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' })

    // Title
    doc.setFontSize(18)
    doc.setTextColor(38, 66, 166)
    doc.text('TrackNGo - Bus Fleet Report', 14, 18)

    // Summary line
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}   |   Total: ${TOTAL}   Active: ${ACTIVE_COUNT}   Maintenance: ${MAINTENANCE_COUNT}   Inactive: ${INACTIVE_COUNT}`,
      14, 26,
    )

    // Table
    const rows = filtered.map((b) => [
      b.busNumber,
      b.registrationNumber,
      b.busBrand,
      String(b.seatCapacity),
      hasAc(b.amenities) ? 'AC' : 'Non-AC',
      b.amenities.filter((a) => a.toLowerCase() !== 'ac').join(', ') || '—',
      b.status.charAt(0).toUpperCase() + b.status.slice(1),
      b.driverName || 'Unassigned',
      b.routeName || 'None',
      formatSchedule(b.startTime, b.endTime, b.returnStartTime, b.returnEndTime),
      b.insuranceExpDate || '—',
    ])

    autoTable(doc, {
      startY: 32,
      head: [['Bus #', 'Registration', 'Brand', 'Seats', 'Type', 'Amenities', 'Status', 'Driver', 'Route', 'Schedule', 'Insurance Exp']],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [38, 66, 166], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      columnStyles: {
        0: { cellWidth: 22 },
        3: { halign: 'center', cellWidth: 14 },
        4: { cellWidth: 16 },
      },
    })

    doc.save('TrackNGo_Bus_Report.pdf')
  }

  const toggleAmenity = (key: string) => {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(key)
        ? prev.amenities.filter((a) => a !== key)
        : [...prev.amenities, key],
    }))
  }

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
      {/* Header section with title and action buttons */}
      <div className="animate-dash-in flex flex-wrap items-center justify-between gap-4" style={{ animationDelay: '80ms' }}>
        <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Bus Management</h1>
        <div className="flex items-center gap-2">
          {/* Export to PDF button */}
          <button
            type="button"
            onClick={exportPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d6dbe6] bg-white px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]"
          >
            <FontAwesomeIcon icon={faArrowUpFromBracket} className="text-xs" />
            Export
          </button>
          {/* Add new bus button */}
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
          >
            <FontAwesomeIcon icon={faPlus} className="text-xs" />
            Add New Bus
          </button>
        </div>
      </div>

      {/* Statistics cards showing bus counts by status */}
      <div className="animate-dash-in grid gap-4 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '100ms' }}>
        <article className="flex items-center justify-between rounded-xl border border-[#e5e7eb] bg-white px-5 py-4">
          <div>
            <p className="text-sm text-[#64748b]">Total Buses</p>
            <p className="mt-1 text-2xl font-extrabold text-[#111827]">{TOTAL}</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-[#f1f5f9] text-[#334155]">
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

      {/* Filter controls for searching and filtering buses */}
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

      {/* Bus grid display with loading, error, and data states */}
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
            : '--'
          const outboundWindow = formatTimeRange(bus.startTime, bus.endTime)
          const returnWindow = formatTimeRange(bus.returnStartTime, bus.returnEndTime)
          const busTypeLabel = formatBusTypeChipLabel(bus.busType)
          return (
          <article
            key={bus.busId}
            className="animate-dash-in overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white shadow-[0_8px_22px_rgba(15,23,42,0.05)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,23,42,0.12)]"
            style={{ animationDelay: '150ms' }}
          >
            {/* Bus image section */}
            <div className="relative h-40 w-full overflow-hidden bg-[#f1f5f9]">
              {getBusImage(bus.busBrand, bus.amenities) ? (
                <img
                  src={getBusImage(bus.busBrand, bus.amenities)!}
                  alt={bus.busBrand}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#e0e7ff] to-[#f1f5f9]">
                  <FontAwesomeIcon icon={faBus} className="text-4xl text-[#94a3b8]" />
                </div>
              )}
              <span className={`absolute right-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(bus.status)}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {statusLabel(bus.status)}
              </span>
            </div>

            {/* Bus details section */}
            <div className="p-4">
              {/* Bus number and AC type badge */}
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-extrabold text-[#111827]">{bus.busNumber}</h3>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                  acType === 'AC'
                    ? 'bg-[#dbeafe] text-[#2563eb]'
                    : 'bg-[#f1f5f9] text-[#334155]'
                }`}>
                  {acType}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-[#64748b]">{bus.busBrand}</p>

              {/* Seat capacity display */}
              <div className="mt-3 flex items-center gap-1.5 text-sm text-[#334155]">
                <FontAwesomeIcon icon={faChair} className="text-xs text-[#94a3b8]" />
                <span>{bus.seatCapacity} Seats</span>
              </div>

              {/* Driver information */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-[#e0e7ff] text-[10px] font-bold text-[#3b5998]">
                    {initials}
                  </div>
                  <span className="text-sm font-medium text-[#334155]">{bus.driverName || 'Unassigned'}</span>
                </div>
                <span className="text-xs text-[#94a3b8]">Driver</span>
              </div>

              {/* Route + schedule */}
              <div className="mt-3 border-t border-[#eef2ff] pt-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[#94a3b8]">Route</p>
                    <p className="mt-0.5 break-words text-sm font-bold leading-snug text-[#111827]">{bus.routeName || 'None'}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[#eff6ff] px-2.5 py-1 text-[10px] font-semibold text-[#1d4ed8]">
                    {busTypeLabel}
                  </span>
                </div>

                <div className="mt-3 grid gap-2">
                  <div className="rounded-lg border border-[#dbeafe] bg-[#f8fbff] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Outbound</span>
                      <FontAwesomeIcon icon={faClock} className="text-[11px] text-[#60a5fa]" />
                    </div>
                    <p className="mt-1 text-sm font-bold text-[#1d4ed8]">{outboundWindow}</p>
                  </div>

                  <div className="rounded-lg border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Return</span>
                      <FontAwesomeIcon icon={faClock} className="text-[11px] text-[#94a3b8]" />
                    </div>
                    <p className="mt-1 text-sm font-bold text-[#334155]">{returnWindow}</p>
                  </div>
                </div>
              </div>

              {/* View details link */}
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

      {/* Modal for adding new bus */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 text-[#94a3b8] transition hover:text-[#334155]"
            >
              <FontAwesomeIcon icon={faXmark} className="text-lg" />
            </button>

            <h2 className="text-lg font-extrabold text-[#111827]">Add New Bus</h2>
            <p className="mt-1 text-sm text-[#64748b]">Fill in the details to register a new bus.</p>

            {saveError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {saveError}
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {/* Bus Number input */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Bus Number *</label>
                <input
                  type="text"
                  placeholder="e.g. NB-0012"
                  value={form.busNumber}
                  onChange={(e) => setForm({ ...form, busNumber: e.target.value })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                />
              </div>

              {/* Registration Number input */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Registration Number *</label>
                <input
                  type="text"
                  placeholder="e.g. WP CAB-0012"
                  value={form.registrationNumber}
                  onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                />
              </div>

              {/* Brand selection */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Brand *</label>
                <select
                  value={form.busBrand}
                  onChange={(e) => setForm({ ...form, busBrand: e.target.value })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6]"
                >
                  <option value="">Select brand</option>
                  <option value="Ashok Leyland">Ashok Leyland</option>
                  <option value="TATA Motors">TATA Motors</option>
                  <option value="Rosa Bus">Rosa Bus</option>
                </select>
              </div>

              {/* Seat Capacity input */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Seat Capacity</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.seatCapacity}
                  onChange={(e) => setForm({ ...form, seatCapacity: Number(e.target.value) })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                />
              </div>

              {/* Bus Type selection */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Bus Type</label>
                <select
                  value={form.busType}
                  onChange={(e) => setForm({ ...form, busType: e.target.value })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6]"
                >
                  <option value="highway">Highway</option>
                  <option value="long_distance">Long Distance</option>
                  <option value="trip_booking">Trip Booking</option>
                  <option value="corporate">Corporate</option>
                </select>
              </div>

              {/* Condition selection */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Condition</label>
                <select
                  value={form.busCondition}
                  onChange={(e) => setForm({ ...form, busCondition: e.target.value })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6]"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                </select>
              </div>

              {/* Status selection */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6]"
                >
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Insurance Expiry date input */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Insurance Expiry</label>
                <input
                  type="date"
                  value={form.insuranceExpDate}
                  onChange={(e) => setForm({ ...form, insuranceExpDate: e.target.value })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                />
              </div>

              {/* Start Time input */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Start Time</label>
                <input
                  type="time"
                  value={form.startTime ?? ''}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value || null })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                />
              </div>

              {/* End Time input */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">End Time</label>
                <input
                  type="time"
                  value={form.endTime ?? ''}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value || null })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                />
              </div>

              {/* Return Start Time */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Return Start Time</label>
                <input
                  type="time"
                  value={form.returnStartTime ?? ''}
                  onChange={(e) => setForm({ ...form, returnStartTime: e.target.value || null })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                />
              </div>

              {/* Return End Time */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Return End Time</label>
                <input
                  type="time"
                  value={form.returnEndTime ?? ''}
                  onChange={(e) => setForm({ ...form, returnEndTime: e.target.value || null })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                />
              </div>

              {/* Driver */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Driver</label>
                <select
                  value={form.driverId ?? ''}
                  onChange={(e) => setForm({ ...form, driverId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6]"
                >
                  <option value="">Unassigned</option>
                  {driverOptions.map((d) => (
                    <option key={d.driverId} value={d.driverId}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Route selection */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-[#334155]">Route</label>
                <select
                  value={form.routeId ?? ''}
                  onChange={(e) => setForm({ ...form, routeId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full rounded-lg border border-[#d6dbe6] px-3 py-2 text-sm outline-none focus:border-[#2642a6]"
                >
                  <option value="">No Route</option>
                  {routeOptions.map((r) => (
                    <option key={r.routeId} value={r.routeId}>{r.routeName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amenities selection */}
            <div className="mt-4">
              <label className="mb-2 block text-sm font-semibold text-[#334155]">Amenities</label>
              <div className="flex flex-wrap gap-2">
                {['ac', 'wifi', 'charging_ports', 'entertainment', 'cctv', 'restroom'].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAmenity(key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      form.amenities.includes(key)
                        ? 'bg-[#2642a6] text-white'
                        : 'bg-[#f1f5f9] text-[#334155] hover:bg-[#e2e8f0]'
                    }`}
                  >
                    {key === 'ac' ? 'AC' : key === 'wifi' ? 'WiFi' : key === 'charging_ports' ? 'Charging Ports' : key === 'entertainment' ? 'Entertainment' : key === 'cctv' ? 'CCTV' : 'Restroom'}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal action buttons */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-[#d6dbe6] px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f1f5f9]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddBus}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#203b96] disabled:opacity-60"
              >
                {saving && <FontAwesomeIcon icon={faSpinner} className="animate-spin" />}
                {saving ? 'Creating...' : 'Create Bus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Buses
