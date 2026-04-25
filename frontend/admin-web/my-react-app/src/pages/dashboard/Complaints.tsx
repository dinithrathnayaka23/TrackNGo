import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDays,
  faCamera,
  faCheckCircle,
  faClipboardList,
  faDownload,
  faFileLines,
  faHourglassHalf,
  faImage,
  faMagnifyingGlass as faSearchGlass,
  faSort,
  faSortDown,
  faSortUp,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  fetchComplaintDetail,
  fetchComplaints,
  updateComplaint,
  type AdminComplaint,
  type AdminComplaintDetail,
} from '../../services/complaintService'

type Priority = 'High' | 'Medium' | 'Low'
type ComplaintStatus = 'Pending' | 'Under Review' | 'Resolved' | 'Rejected'
type ComplaintType = string
type Complaint = AdminComplaint
type SortDir = 'asc' | 'desc' | null

const PER_PAGE = 5
const BACKEND_BASE_URL = 'http://localhost:8080'

/** Returns the badge color classes used for complaint priority pills. */
export function priorityBadge(priority: string) {
  if (priority === 'High') return 'bg-[#dc2626] text-white'
  if (priority === 'Medium') return 'bg-[#f59e0b] text-white'
  return 'bg-[#64748b] text-white'
}

/** Returns the badge color classes used for complaint status pills. */
export function statusBadge(status: string) {
  if (status === 'Pending') return 'bg-[#fee2e2] text-[#dc2626]'
  if (status === 'Under Review') return 'bg-[#dbeafe] text-[#2563eb]'
  if (status === 'Rejected') return 'bg-[#f3f4f6] text-[#6b7280]'
  return 'bg-[#dcfce7] text-[#047857]'
}

/** Resolves relative evidence image paths against the backend base URL. */
export function resolveImageUrl(url: string) {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
    return url
  }

  const normalizedPath = url.startsWith('/') ? url : `/${url}`
  return new URL(normalizedPath, BACKEND_BASE_URL).toString()
}

/** Formats an ISO complaint date into a readable label for the admin UI. */
export function formatCreatedDate(isoDate: string | null) {
  if (!isoDate) {
    return '--'
  }

  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) {
    return isoDate
  }

  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Converts any stored complaint status into the editable select option set. */
export function toEditableStatus(status: string): ComplaintStatus {
  if (status === 'Under Review') return 'Under Review'
  if (status === 'Resolved') return 'Resolved'
  if (status === 'Rejected') return 'Rejected'
  return 'Pending'
}

/** Converts the admin-facing status label into the backend status payload. */
export function toApiStatus(status: ComplaintStatus): string {
  if (status === 'Under Review') {
    return 'under_review'
  }
  return status.toLowerCase()
}

/** Renders the complaints management dashboard used by admin users. */
function Complaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | ComplaintStatus>('All')
  const [priorityFilter, setPriorityFilter] = useState<'All' | Priority | string>('All')
  const [categoryFilter, setCategoryFilter] = useState<'All' | ComplaintType>('All')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [selectedComplaint, setSelectedComplaint] = useState<AdminComplaintDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [adminResponseDraft, setAdminResponseDraft] = useState('')
  const [statusDraft, setStatusDraft] = useState<ComplaintStatus>('Pending')
  const [savingComplaint, setSavingComplaint] = useState(false)
  const [saveError, setSaveError] = useState('')

  /** Loads the complaint list once when the page is opened. */
  useEffect(() => {
    let active = true

    void (async () => {
      try {
        setLoading(true)
        setError('')
        const data = await fetchComplaints()
        if (active) setComplaints(data)
      } catch (err) {
        if (active) {
          setComplaints([])
          setError(err instanceof Error ? err.message : 'Failed to load complaints')
        }
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  /** Keeps the modal editor state aligned with the currently selected complaint. */
  useEffect(() => {
    if (!selectedComplaint) {
      setAdminResponseDraft('')
      setStatusDraft('Pending')
      setSaveError('')
      return
    }

    setAdminResponseDraft(selectedComplaint.adminResponse === '--' ? '' : selectedComplaint.adminResponse)
    setStatusDraft(toEditableStatus(selectedComplaint.status))
    setSaveError('')
  }, [selectedComplaint])

  const TOTAL = complaints.length
  const PENDING_COUNT = complaints.filter((complaint) => complaint.status === 'Pending').length
  const REVIEW_COUNT = complaints.filter((complaint) => complaint.status === 'Under Review').length
  const RESOLVED_COUNT = complaints.filter((complaint) => complaint.status === 'Resolved').length
  const HIGH_COUNT = complaints.filter(
    (complaint) =>
      complaint.priority === 'High' &&
      (complaint.status === 'Pending' || complaint.status === 'Under Review'),
  ).length
  const CATEGORIES = useMemo(
    () => Array.from(new Set(complaints.map((complaint) => complaint.type))).sort(),
    [complaints],
  )

  const filtered = useMemo(() => {
    let list = complaints

    if (search) {
      const query = search.toLowerCase()
      list = list.filter((complaint) => complaint.passengerName.toLowerCase().includes(query))
    }

    if (statusFilter !== 'All') {
      list = list.filter((complaint) => complaint.status === statusFilter)
    }

    if (priorityFilter !== 'All') {
      list = list.filter((complaint) => complaint.priority === priorityFilter)
    }

    if (categoryFilter !== 'All') {
      list = list.filter((complaint) => complaint.type === categoryFilter)
    }

    if (fromDate) {
      list = list.filter((complaint) => {
        const createdDate = complaint.createdAt?.slice(0, 10)
        return createdDate ? createdDate >= fromDate : false
      })
    }

    if (toDate) {
      list = list.filter((complaint) => {
        const createdDate = complaint.createdAt?.slice(0, 10)
        return createdDate ? createdDate <= toDate : false
      })
    }

    if (sortDir) {
      const direction = sortDir === 'asc' ? 1 : -1
      list = [...list].sort((left, right) => left.id.localeCompare(right.id) * direction)
    }

    return list
  }, [categoryFilter, complaints, fromDate, priorityFilter, search, sortDir, statusFilter, toDate])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const showFrom = filtered.length === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const showTo = Math.min(page * PER_PAGE, filtered.length)

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages))
  }, [totalPages])

  /** Cycles the complaint id sort direction between ascending, descending, and default. */
  function toggleSort() {
    setSortDir((previous) => {
      if (!previous) return 'asc'
      if (previous === 'asc') return 'desc'
      return null
    })
  }

  /** Loads detailed complaint information and opens the modal view. */
  async function openComplaintDetail(complaintId: string) {
    try {
      setDetailLoading(true)
      setDetailError('')
      setSaveError('')
      setSelectedComplaint(null)
      const detail = await fetchComplaintDetail(complaintId)
      setSelectedComplaint(detail)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load complaint detail')
    } finally {
      setDetailLoading(false)
    }
  }

  /** Resets every modal-specific state field and closes the complaint detail view. */
  function closeDetailModal() {
    setSelectedComplaint(null)
    setDetailError('')
    setDetailLoading(false)
    setAdminResponseDraft('')
    setStatusDraft('Pending')
    setSaveError('')
    setSavingComplaint(false)
  }

  /** Saves complaint review changes and refreshes the complaint data shown in the dashboard. */
  async function handleComplaintUpdate() {
    if (!selectedComplaint) {
      return
    }

    try {
      setSavingComplaint(true)
      setSaveError('')

      await updateComplaint(selectedComplaint.id, {
        status: toApiStatus(statusDraft),
        adminResponse: adminResponseDraft.trim(),
      })

      if (statusDraft === 'Resolved' || statusDraft === 'Rejected') {
        const updatedComplaints = await fetchComplaints()
        setComplaints(updatedComplaints)
        closeDetailModal()
        return
      }

      const [updatedDetail, updatedComplaints] = await Promise.all([
        fetchComplaintDetail(selectedComplaint.id),
        fetchComplaints(),
      ])
      setSelectedComplaint(updatedDetail)
      setComplaints(updatedComplaints)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update complaint')
    } finally {
      setSavingComplaint(false)
    }
  }

  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let index = 1; index <= totalPages; index += 1) pages.push(index)
    } else {
      pages.push(1)
      if (page > 3) pages.push('...')
      for (let index = Math.max(2, page - 1); index <= Math.min(totalPages - 1, page + 1); index += 1) {
        pages.push(index)
      }
      if (page < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }, [page, totalPages])

  /** Exports the currently filtered complaint list as a PDF report. */
  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' })

    doc.setFontSize(18)
    doc.setTextColor(38, 66, 166)
    doc.text('TrackNGo - Complaints Report', 14, 18)

    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}   |   Total: ${TOTAL}   Pending: ${PENDING_COUNT}   Under Review: ${REVIEW_COUNT}   Resolved: ${RESOLVED_COUNT}   Active High Priority: ${HIGH_COUNT}`,
      14,
      26,
    )

    const rows = filtered.map((complaint) => [
      complaint.id,
      complaint.priority,
      complaint.type,
      complaint.passengerName,
      complaint.description,
      complaint.bookingId,
      complaint.busId,
      complaint.driverName || '--',
      complaint.hasImages ? 'Yes' : 'No',
      complaint.status,
      complaint.created,
    ])

    autoTable(doc, {
      startY: 32,
      head: [[
        'ID',
        'Priority',
        'Type',
        'Passenger',
        'Description',
        'Booking ID',
        'Bus',
        'Driver',
        'Images',
        'Status',
        'Created',
      ]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [38, 66, 166], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 252] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 18 },
        2: { cellWidth: 26 },
        4: { cellWidth: 58 },
        8: { halign: 'center', cellWidth: 16 },
      },
    })

    doc.save('TrackNGo_Complaints_Report.pdf')
  }

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="animate-dash-in flex flex-wrap items-center justify-between gap-4" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Complaints Management</h1>
            {HIGH_COUNT > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fee2e2] px-3 py-1 text-xs font-bold text-[#dc2626]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#dc2626]" />
                {HIGH_COUNT} high priority
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={exportPdf}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#203b96]"
          >
            <FontAwesomeIcon icon={faDownload} className="text-xs" />
            Export Report
          </button>
        </div>

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

        <div className="animate-dash-in flex flex-wrap items-end gap-3" style={{ animationDelay: '120ms' }}>
          <div className="min-w-[180px] flex-1">
            <label className="text-xs font-semibold text-[#64748b]">Search</label>
            <div className="relative mt-1">
              <FontAwesomeIcon icon={faSearchGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Passenger Name..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748b]">Status</label>
            <div className="mt-1">
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as typeof statusFilter)
                  setPage(1)
                }}
                className="rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm text-[#334155] outline-none transition focus:border-[#2642a6]"
              >
                <option value="All">All Statuses</option>
                <option>Pending</option>
                <option>Under Review</option>
                <option>Resolved</option>
                <option>Rejected</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748b]">Priority</label>
            <div className="mt-1">
              <select
                value={priorityFilter}
                onChange={(event) => {
                  setPriorityFilter(event.target.value as typeof priorityFilter)
                  setPage(1)
                }}
                className="rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm text-[#334155] outline-none transition focus:border-[#2642a6]"
              >
                <option value="All">All Priorities</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748b]">Category</label>
            <div className="mt-1">
              <select
                value={categoryFilter}
                onChange={(event) => {
                  setCategoryFilter(event.target.value as typeof categoryFilter)
                  setPage(1)
                }}
                className="rounded-lg border border-[#d6dbe6] bg-white px-3 py-2.5 text-sm text-[#334155] outline-none transition focus:border-[#2642a6]"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748b]">Date From</label>
            <div className="relative mt-1">
              <FontAwesomeIcon icon={faCalendarDays} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
              <input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value)
                  setPage(1)
                }}
                className="w-40 rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#64748b]">Date To</label>
            <div className="relative mt-1">
              <FontAwesomeIcon icon={faCalendarDays} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
              <input
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value)
                  setPage(1)
                }}
                className="w-40 rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
              />
            </div>
          </div>
        </div>

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
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-sm text-[#64748b]">Loading complaints...</td>
                  </tr>
                )}
                {!loading && error && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-sm text-[#dc2626]">{error}</td>
                  </tr>
                )}
                {!loading && !error && paginated.map((complaint) => (
                  <tr
                    key={complaint.id}
                    className="cursor-pointer border-b border-[#f1f5f9] transition hover:bg-[#f8fafc]"
                    onClick={() => void openComplaintDetail(complaint.id)}
                  >
                    <td className="py-3.5 pl-5 pr-2 font-bold text-[#2642a6]">{complaint.id}</td>
                    <td className="px-2 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${priorityBadge(complaint.priority)}`}>
                        {complaint.priority}
                      </span>
                    </td>
                    <td className="px-2 py-3.5">
                      <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium text-[#475569]">{complaint.type}</span>
                    </td>
                    <td className="px-2 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#e0e7ff] text-[10px] font-bold text-[#3b5998]">
                          {complaint.passengerInitials}
                        </div>
                        <span className="font-medium text-[#111827]">{complaint.passengerName}</span>
                      </div>
                    </td>
                    <td className="max-w-[180px] truncate px-2 py-3.5 text-[#475569]">{complaint.description}</td>
                    <td className="px-2 py-3.5 font-semibold text-[#2642a6]">{complaint.bookingId}</td>
                    <td className="px-2 py-3.5">
                      <p className="font-medium text-[#111827]">{complaint.busId}</p>
                      {complaint.driverName && <p className="text-xs text-[#94a3b8]">{complaint.driverName}</p>}
                    </td>
                    <td className="px-2 py-3.5 text-center">
                      {complaint.hasImages ? (
                        <FontAwesomeIcon
                          icon={complaint.imageType === 'camera' ? faCamera : faImage}
                          className="text-sm text-[#475569]"
                        />
                      ) : (
                        <span className="text-xs text-[#cbd5e1]">--</span>
                      )}
                    </td>
                    <td className="px-2 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(complaint.status)}`}>
                        {complaint.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-3.5 text-[#475569]">{complaint.created}</td>
                  </tr>
                ))}
                {!loading && !error && paginated.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-sm text-[#64748b]">No complaints match your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e7eb] px-5 py-3">
            <p className="text-sm text-[#64748b]">
              Showing <span className="font-semibold text-[#111827]">{showFrom}-{showTo}</span> of{' '}
              <span className="font-semibold text-[#111827]">{filtered.length}</span> complaints
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                className="rounded-lg border border-[#d6dbe6] bg-white px-3 py-1.5 text-sm font-medium text-[#334155] transition hover:bg-[#f1f5f9] disabled:opacity-40"
              >
                Previous
              </button>
              {pageNumbers.map((pageNumber, index) =>
                pageNumber === '...' ? (
                  <span key={`dots-${index}`} className="px-1 text-sm text-[#94a3b8]">...</span>
                ) : (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-medium transition ${
                      page === pageNumber
                        ? 'bg-[#2642a6] text-white'
                        : 'border border-[#d6dbe6] bg-white text-[#334155] hover:bg-[#f1f5f9]'
                    }`}
                  >
                    {pageNumber}
                  </button>
                ),
              )}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((currentPage) => currentPage + 1)}
                className="rounded-lg border border-[#d6dbe6] bg-white px-3 py-1.5 text-sm font-medium text-[#334155] transition hover:bg-[#f1f5f9] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {(selectedComplaint || detailLoading || detailError) && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]" />
      )}

      {(selectedComplaint || detailLoading || detailError) && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="relative w-full max-w-[860px] overflow-hidden rounded-2xl bg-white shadow-2xl animate-in">
            <button
              type="button"
              onClick={closeDetailModal}
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-[#f3f4f6] hover:text-[#374151]"
            >
              <FontAwesomeIcon icon={faXmark} className="text-sm" />
            </button>

            <div className="max-h-[90vh] overflow-y-auto">
              {detailLoading && (
                <div className="p-6">
                  <div className="rounded-2xl border border-[#e5e7eb] bg-[#f8fafc] px-5 py-8 text-center text-sm text-[#64748b]">
                    Loading complaint details...
                  </div>
                </div>
              )}

              {!detailLoading && detailError && (
                <div className="p-6">
                  <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-5 py-8 text-center text-sm font-medium text-[#dc2626]">
                    {detailError}
                  </div>
                </div>
              )}

              {!detailLoading && !detailError && selectedComplaint && (
                <div className="p-6">
                  <div className="rounded-xl border border-[#d9dee8] bg-white p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="mr-3 text-[22px] font-extrabold tracking-tight text-[#1a2340]">
                        {selectedComplaint.type}
                      </h2>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${priorityBadge(selectedComplaint.priority)}`}>
                        {selectedComplaint.priority}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${statusBadge(selectedComplaint.status)}`}>
                        {selectedComplaint.status}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[15px] text-[#334155]">
                      <p>
                        <span className="font-semibold text-[#1a2340]">Passenger:</span> {selectedComplaint.passengerName}
                      </p>
                      <p>
                        <span className="font-semibold text-[#1a2340]">Contact Number:</span> {selectedComplaint.passengerPhoneNumber}
                      </p>
                    </div>

                    <div className="mt-5 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <FontAwesomeIcon icon={faFileLines} className="text-sm text-[#f97316]" />
                        <p className="text-xs font-bold uppercase tracking-widest text-[#6b7280]">Complaint Description</p>
                      </div>
                      <p className="text-[15px] leading-7 text-[#334155]">{selectedComplaint.description}</p>
                    </div>

                    <div className="mt-5 space-y-1.5 text-[15px] text-[#334155]">
                      <p>
                        <span className="font-semibold text-[#1a2340]">Booking ID:</span> {selectedComplaint.bookingId}
                      </p>
                      <p>
                        <span className="font-semibold text-[#1a2340]">Bus/Driver:</span> {selectedComplaint.busId} / {selectedComplaint.driverName}
                        {selectedComplaint.driverPhoneNumber !== '--' ? ` / ${selectedComplaint.driverPhoneNumber}` : ''}
                      </p>
                      <p>
                        <span className="font-semibold text-[#1a2340]">Created:</span> {formatCreatedDate(selectedComplaint.createdAt)}
                      </p>
                    </div>

                    <div className="mt-6">
                      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-[#6b7280]">Evidence Images</p>
                      {selectedComplaint.images.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[#d6dbe6] bg-[#f8fafc] px-4 py-8 text-center text-sm text-[#94a3b8]">
                          No evidence images were attached to this complaint.
                        </div>
                      ) : (
                        <div className="overflow-x-auto pb-1">
                          <div className="flex min-w-max items-start gap-4">
                          {selectedComplaint.images.map((imageUrl, index) => {
                            const resolvedUrl = resolveImageUrl(imageUrl)
                            return (
                              <div
                                key={`${selectedComplaint.id}-image-${index + 1}`}
                                className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-md border border-[#cfd8e3] bg-white shadow-sm"
                              >
                                <a
                                  href={resolvedUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block h-full w-full"
                                  aria-label={`Open evidence image ${index + 1} in a new tab`}
                                >
                                  <img
                                    src={resolvedUrl}
                                    alt={`Complaint evidence ${index + 1}`}
                                    className="h-full w-full object-cover"
                                  />
                                </a>
                              </div>
                            )
                          })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-6">
                      <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6b7280]">
                        Admin Response
                      </p>
                      <textarea
                        value={adminResponseDraft}
                        onChange={(event) => setAdminResponseDraft(event.target.value)}
                        placeholder="Write admin response here..."
                        rows={5}
                        className="w-full resize-none rounded-lg border border-[#d6dbe6] bg-white px-4 py-3 text-sm text-[#1f2937] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-3">
                      <select
                        value={statusDraft}
                        onChange={(event) => setStatusDraft(event.target.value as ComplaintStatus)}
                        className="min-w-[170px] rounded-lg border border-[#d6dbe6] bg-white px-4 py-2.5 text-sm font-semibold text-[#1a2340] outline-none transition focus:border-[#2642a6]"
                      >
                        <option>Pending</option>
                        <option>Under Review</option>
                        <option>Resolved</option>
                        <option>Rejected</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => void handleComplaintUpdate()}
                        disabled={savingComplaint}
                        className="rounded-lg bg-[#2563eb] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingComplaint ? 'Saving...' : 'OK'}
                      </button>
                    </div>

                    {saveError && (
                      <p className="mt-3 text-xs font-medium text-[#dc2626]">{saveError}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes animate-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-in { animation: animate-in 0.3s ease-out; }
      `}</style>

    </>
  )
}

export default Complaints
