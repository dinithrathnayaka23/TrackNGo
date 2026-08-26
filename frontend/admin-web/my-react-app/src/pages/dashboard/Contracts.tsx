import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faFileContract,
  faFilter,
  faSearch,
  faBus,
  faCalendarDays,
  faDollarSign,
  faEye,
  faXmark,
  faCheckCircle,
  faExclamationTriangle,
  faTimesCircle,
  faArrowLeft,
  faBuilding,
  faSpinner,
  faRotateLeft,
  faThumbsUp,
  faThumbsDown,
  faBan,
  faHourglassHalf,
  faSun,
  faMoon,
  faSyncAlt,
  faSnowflake,
  faShuttleVan,
} from '@fortawesome/free-solid-svg-icons'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchAllCorporateContracts,
  fetchCorporateContractDetail,
  requestContractCancellation,
  respondToContractCancellation,
  updateContractStatus,
  waiveAdvanceDeposit,
  type AdminContractSummary,
  type CorporateContractDetail,
} from '../../services/corporateService'

// ─── Types ───────────────────────────────────────────────────────────────────

type ContractStatus = AdminContractSummary['status']
type FilterStatus = 'all' | ContractStatus
type ViewMode = 'table' | 'cards'
type PendingAction = { contract: AdminContractSummary; nextStatus: 'active' | 'cancelled' | 'expired' }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  if (value >= 1_000_000) return `Rs.${(value / 1_000_000).toFixed(2)}M`
  return `Rs.${value.toLocaleString('en-US')}`
}

function statusLabel(status: ContractStatus) {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'active':
      return 'Active'
    case 'expired':
      return 'Expired'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}

function statusBadgeClass(status: ContractStatus) {
  switch (status) {
    case 'active':
      return 'bg-[#dcfce7] text-[#047857]'
    case 'expired':
      return 'bg-[#fee2e2] text-[#b91c1c]'
    case 'cancelled':
      return 'bg-[#f1f5f9] text-[#475569]'
    case 'pending':
      return 'bg-[#fef3c7] text-[#b45309]'
    default:
      return 'bg-[#f1f5f9] text-[#334155]'
  }
}

function statusIcon(status: ContractStatus) {
  switch (status) {
    case 'active':
      return faCheckCircle
    case 'expired':
      return faTimesCircle
    case 'cancelled':
      return faBan
    case 'pending':
      return faHourglassHalf
    default:
      return faSpinner
  }
}

function shiftLabel(shiftType: AdminContractSummary['shiftType']) {
  switch (shiftType) {
    case 'morning':
      return 'Morning Only'
    case 'evening':
      return 'Evening Only'
    case 'both':
      return 'Morning & Evening'
    default:
      return shiftType
  }
}

function shiftIcon(shiftType: AdminContractSummary['shiftType']) {
  switch (shiftType) {
    case 'morning':
      return faSun
    case 'evening':
      return faMoon
    default:
      return faSyncAlt
  }
}

function busTypeLabel(busType: AdminContractSummary['busType']) {
  switch (busType) {
    case 'ac':
      return 'AC'
    case 'mini':
      return 'Mini Bus'
    default:
      return 'Standard'
  }
}

function daysUntilExpiry(validTo: string | null) {
  if (!validTo) return null
  const today = new Date()
  const expiry = new Date(validTo)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatTime(timeStr: string | null | undefined) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const displayHour = h % 12 || 12
  return `${displayHour}:${String(m).padStart(2, '0')} ${suffix}`
}

function companyInitials(name: string | null) {
  if (!name) return '—'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

// ─── Modal: View Contract ─────────────────────────────────────────────────────

function ViewContractModal({
  contractId,
  onClose,
}: {
  contractId: number
  onClose: () => void
}) {
  const [detail, setDetail] = useState<CorporateContractDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchCorporateContractDetail(contractId)
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load contract detail.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [contractId])

  const days = detail ? daysUntilExpiry(detail.endDate) : null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f172a]/50 p-4 backdrop-blur-[2px]">
      <div className="animate-dash-in w-full max-w-[720px] max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] bg-gradient-to-r from-[#1c2a44] to-[#2642a6] p-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
                <FontAwesomeIcon icon={faFileContract} className="text-white" />
              </div>
              <p className="text-xs font-semibold text-white/60">Contract #{contractId}</p>
            </div>
            <h2 className="mt-2 text-lg font-extrabold text-white">{detail?.contractName ?? 'Loading...'}</h2>
            <p className="mt-0.5 text-sm text-white/70">{detail?.companyName ?? ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {detail && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(detail.status as ContractStatus)}`}>
                <FontAwesomeIcon icon={statusIcon(detail.status as ContractStatus)} className="text-xs" />
                {statusLabel(detail.status as ContractStatus)}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading && <p className="py-10 text-center text-sm text-[#64748b]">Loading contract detail...</p>}
          {error && <p className="py-10 text-center text-sm font-semibold text-[#b91c1c]">{error}</p>}
          {detail && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Company</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#e0e7ff] text-xs font-bold text-[#2642a6]">
                    {companyInitials(detail.companyName)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{detail.companyName ?? '—'}</p>
                    <p className="text-xs text-[#64748b]">{detail.contactPersonName ?? ''} {detail.contactPhone ? `· ${detail.contactPhone}` : ''}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Monthly Billing</p>
                {detail.discountAmount != null && detail.discountAmount > 0 && detail.originalBillingAmount != null && (
                  <p className="mt-2 text-sm text-[#94a3b8] line-through">{formatCurrency(detail.originalBillingAmount)}</p>
                )}
                <p className="mt-1 text-xl font-extrabold text-[#047857]">{formatCurrency(detail.billingAmount)}</p>
                {detail.discountAmount != null && detail.discountAmount > 0 && (
                  <p className="mt-1 text-xs font-semibold text-[#b45309]">
                    Discount applied: −{formatCurrency(detail.discountAmount)}
                  </p>
                )}
                <p className="mt-1 text-xs text-[#64748b]">
                  {detail.employeeCount} employees · {busTypeLabel(detail.busType)} bus
                </p>
                {detail.adminNote && (
                  <p className="mt-2 rounded-lg bg-white px-2 py-1.5 text-xs text-[#334155]">"{detail.adminNote}"</p>
                )}
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Advance Deposit</p>
                <p className="mt-2 text-xl font-extrabold text-[#047857]">
                  {detail.advanceAmount ? formatCurrency(detail.advanceAmount) : '—'}
                </p>
                <p className="text-xs text-[#64748b]">
                  Status: <span className="font-semibold capitalize">{detail.advancePaymentStatus.replace('_', ' ')}</span>
                  {detail.advancePaidAt && ` on ${formatDate(detail.advancePaidAt)}`}
                </p>
                {detail.advanceTransactionId && (
                  <p className="mt-1 text-xs text-[#94a3b8]">Ref: {detail.advanceTransactionId}</p>
                )}
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Contract Term</p>
                <p className="mt-2 text-sm font-semibold text-[#111827]">
                  {formatDate(detail.startDate)} → {formatDate(detail.endDate)}
                </p>
                {days !== null && (days > 0 ? (
                  <p className={`mt-1 text-xs font-medium ${days <= 30 ? 'text-[#b45309]' : 'text-[#64748b]'}`}>
                    {days} days remaining
                  </p>
                ) : (
                  <p className="mt-1 text-xs font-medium text-[#b91c1c]">Ended {Math.abs(days)} days ago</p>
                ))}
              </div>

              <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Shift & Working Days</p>
                <p className="mt-2 text-sm font-semibold text-[#111827]">
                  <FontAwesomeIcon icon={shiftIcon(detail.shiftType)} className="mr-2 text-[#2642a6]" />
                  {shiftLabel(detail.shiftType)}
                </p>
                <p className="text-xs text-[#64748b]">
                  {detail.workingDays === 'all_days' ? 'All days' : 'Weekdays (Mon–Fri)'}
                </p>
              </div>

              {detail.morningPickup && detail.morningDropoff && (
                <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Morning Route</p>
                  <p className="mt-2 text-sm font-semibold text-[#111827]">
                    {detail.morningPickup.location} → {detail.morningDropoff.location}
                  </p>
                  <p className="text-xs text-[#64748b]">
                    Pickup {formatTime(detail.morningPickup.time)} · Arrival {formatTime(detail.morningDropoff.time)}
                    {detail.morningDistanceKm ? ` · ${detail.morningDistanceKm} km` : ''}
                  </p>
                </div>
              )}

              {detail.eveningPickup && detail.eveningDropoff && (
                <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Evening Route</p>
                  <p className="mt-2 text-sm font-semibold text-[#111827]">
                    {detail.eveningPickup.location} → {detail.eveningDropoff.location}
                  </p>
                  <p className="text-xs text-[#64748b]">
                    Departure {formatTime(detail.eveningPickup.time)} · Drop-off {formatTime(detail.eveningDropoff.time)}
                    {detail.eveningDistanceKm ? ` · ${detail.eveningDistanceKm} km` : ''}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Assigned Buses ({detail.buses.length})
                </p>
                {detail.buses.length === 0 ? (
                  <p className="mt-2 text-sm text-[#94a3b8]">No buses assigned yet.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {detail.buses.map((bus) => (
                      <div key={bus.busId} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 border border-[#f1f5f9]">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon icon={faBus} className="text-xs text-[#2642a6]" />
                          <span className="text-sm font-semibold text-[#111827]">{bus.busBrand} · {bus.busNumber}</span>
                        </div>
                        <span className="text-xs text-[#64748b]">{bus.seatCapacity ?? '—'} seats</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detail.outstandingAmount > 0 && (
                <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4 sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#b91c1c]">Outstanding Balance</p>
                  <p className="mt-2 text-lg font-extrabold text-[#b91c1c]">{formatCurrency(detail.outstandingAmount)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[#e5e7eb] bg-[#f8fafc] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#203b96]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function Contracts() {
  const navigate = useNavigate()

  const [contracts, setContracts] = useState<AdminContractSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterQuery, setFilterQuery] = useState('')

  const [viewContractId, setViewContractId] = useState<number | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionBusyId, setActionBusyId] = useState<number | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [cancelRequestTarget, setCancelRequestTarget] = useState<AdminContractSummary | null>(null)
  const [cancelReasonInput, setCancelReasonInput] = useState('')
  const [cancelRespondTarget, setCancelRespondTarget] = useState<{ contract: AdminContractSummary; accept: boolean } | null>(null)
  const [cancelResponseReasonInput, setCancelResponseReasonInput] = useState('')
  const [discountInput, setDiscountInput] = useState('0')
  const [noteInput, setNoteInput] = useState('')

  const openPendingAction = (contract: AdminContractSummary, nextStatus: PendingAction['nextStatus']) => {
    setDiscountInput('0')
    setNoteInput('')
    setPendingAction({ contract, nextStatus })
  }

  const loadContracts = () => {
    setLoading(true)
    setLoadError(null)
    fetchAllCorporateContracts(filterStatus)
      .then(setContracts)
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load contracts.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadContracts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus])

  // ── Filtered contracts (search only — status is filtered server-side) ──
  const filteredContracts = useMemo(() => {
    const q = filterQuery.trim().toLowerCase()
    if (q.length === 0) return contracts
    return contracts.filter((c) =>
      c.contractName.toLowerCase().includes(q) ||
      (c.companyName ?? '').toLowerCase().includes(q) ||
      (c.contactPersonName ?? '').toLowerCase().includes(q),
    )
  }, [contracts, filterQuery])

  // ── Stats ──
  const stats = useMemo(
    () => [
      {
        label: 'Total Contracts',
        value: String(contracts.length),
        sub: `${contracts.filter((c) => c.status === 'active').length} Active`,
        color: 'text-[#2642a6]',
        bg: 'bg-[#e0e7ff]',
        icon: faFileContract,
      },
      {
        label: 'Pending Approval',
        value: String(contracts.filter((c) => c.status === 'pending').length),
        sub: 'Awaiting review',
        color: 'text-[#b45309]',
        bg: 'bg-[#fef3c7]',
        icon: faHourglassHalf,
      },
      {
        label: 'Total Buses',
        value: String(contracts.filter((c) => c.status === 'active').reduce((s, c) => s + c.busCount, 0)),
        sub: 'On active contracts',
        color: 'text-[#0369a1]',
        bg: 'bg-[#dbeafe]',
        icon: faBus,
      },
      {
        label: 'Monthly Revenue',
        value: formatCurrency(contracts.filter((c) => c.status === 'active').reduce((s, c) => s + c.billingAmount, 0)),
        sub: 'From active contracts',
        color: 'text-[#047857]',
        bg: 'bg-[#dcfce7]',
        icon: faDollarSign,
      },
    ],
    [contracts],
  )

  const clearFilters = () => {
    setFilterQuery('')
    setFilterStatus('all')
  }

  const activeFilters = filterStatus !== 'all' || filterQuery.trim().length > 0

  const parsedDiscount = Math.max(0, Number(discountInput) || 0)
  const originalAmountForPending = pendingAction
    ? pendingAction.contract.originalBillingAmount ?? pendingAction.contract.billingAmount
    : 0
  const finalAmountPreview = Math.max(0, originalAmountForPending - parsedDiscount)

  const runStatusChange = async () => {
    if (!pendingAction) return
    const { contract, nextStatus } = pendingAction
    setActionBusyId(contract.contractId)
    try {
      const options =
        nextStatus === 'active'
          ? { discountAmount: parsedDiscount, adminNote: noteInput.trim() || undefined }
          : undefined
      await updateContractStatus(contract.contractId, nextStatus, options)
      setContracts((cur) =>
        cur.map((c) =>
          c.contractId === contract.contractId
            ? {
                ...c,
                status: nextStatus,
                ...(nextStatus === 'active'
                  ? { billingAmount: finalAmountPreview, discountAmount: parsedDiscount }
                  : {}),
              }
            : c,
        ),
      )
      setToastMessage(
        nextStatus === 'active'
          ? `Approved "${contract.contractName}" — the company has been notified.`
          : nextStatus === 'cancelled'
          ? `Cancelled "${contract.contractName}".`
          : `Marked "${contract.contractName}" as expired.`,
      )
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Failed to update contract status.')
    } finally {
      setActionBusyId(null)
      setPendingAction(null)
    }
  }

  const handleWaiveDeposit = async (contract: AdminContractSummary) => {
    if (!window.confirm(`Are you sure you want to waive the advance deposit for "${contract.contractName}"?`)) return
    setActionBusyId(contract.contractId)
    try {
      await waiveAdvanceDeposit(contract.contractId)
      setContracts((cur) =>
        cur.map((c) => (c.contractId === contract.contractId ? { ...c, advancePaymentStatus: 'waived' } : c))
      )
      setToastMessage(`Waived deposit for "${contract.contractName}".`)
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Failed to waive deposit.')
    } finally {
      setActionBusyId(null)
    }
  }

  const submitCancelRequest = async () => {
    if (!cancelRequestTarget) return
    if (!cancelReasonInput.trim()) {
      setToastMessage('A reason is required to request cancellation.')
      return
    }
    setActionBusyId(cancelRequestTarget.contractId)
    try {
      const updated = await requestContractCancellation(cancelRequestTarget.contractId, cancelReasonInput.trim())
      setContracts((cur) =>
        cur.map((c) => (c.contractId === cancelRequestTarget.contractId ? { ...c, cancellation: updated.cancellation } : c)),
      )
      setToastMessage(`Cancellation requested for "${cancelRequestTarget.contractName}" — awaiting the client's response.`)
      setCancelRequestTarget(null)
      loadContracts()
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Failed to request cancellation.')
    } finally {
      setActionBusyId(null)
    }
  }

  const submitCancelResponse = async () => {
    if (!cancelRespondTarget) return
    const { contract, accept } = cancelRespondTarget
    setActionBusyId(contract.contractId)
    try {
      await respondToContractCancellation(contract.contractId, accept, cancelResponseReasonInput.trim() || undefined)
      setToastMessage(
        accept
          ? `Accepted the cancellation request for "${contract.contractName}".`
          : `Declined the cancellation request for "${contract.contractName}".`,
      )
      setCancelRespondTarget(null)
      setCancelResponseReasonInput('')
      loadContracts()
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Failed to respond to cancellation request.')
    } finally {
      setActionBusyId(null)
    }
  }

  const renderActions = (contract: AdminContractSummary, compact?: boolean) => {
    const busy = actionBusyId === contract.contractId
    const btnBase = compact
      ? 'grid h-7 w-7 place-items-center rounded-lg border text-xs transition'
      : 'grid h-8 w-8 place-items-center rounded-lg border transition'
    return (
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          title="View"
          onClick={() => setViewContractId(contract.contractId)}
          className={`${btnBase} border-[#e5e7eb] text-[#64748b] hover:border-[#2642a6] hover:text-[#2642a6]`}
        >
          <FontAwesomeIcon icon={faEye} className="text-xs" />
        </button>
        {contract.status === 'pending' && (
          <>
            <button
              type="button"
              title="Approve"
              disabled={busy}
              onClick={() => openPendingAction(contract, 'active')}
              className={`${btnBase} border-[#bbf7d0] text-[#059669] hover:bg-[#f0fdf4] disabled:opacity-50`}
            >
              <FontAwesomeIcon icon={faThumbsUp} className="text-xs" />
            </button>
            <button
              type="button"
              title="Reject"
              disabled={busy}
              onClick={() => openPendingAction(contract, 'cancelled')}
              className={`${btnBase} border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50`}
            >
              <FontAwesomeIcon icon={faThumbsDown} className="text-xs" />
            </button>
          </>
        )}
        {contract.status === 'active' && contract.advancePaymentStatus === 'pending' && (
          <button
            type="button"
            title="Waive Deposit"
            disabled={busy}
            onClick={() => handleWaiveDeposit(contract)}
            className={`${btnBase} border-[#e5e7eb] text-[#0369a1] hover:border-[#0369a1] hover:bg-[#f0f9ff] disabled:opacity-50`}
          >
            <FontAwesomeIcon icon={faCheckCircle} className="text-xs" />
          </button>
        )}
        {contract.status === 'active' && contract.cancellation.status !== 'pending' && (
          <button
            type="button"
            title="Cancel Contract"
            disabled={busy}
            onClick={() => { setCancelRequestTarget(contract); setCancelReasonInput('') }}
            className={`${btnBase} border-[#e5e7eb] text-[#64748b] hover:border-[#dc2626] hover:text-[#dc2626] disabled:opacity-50`}
          >
            <FontAwesomeIcon icon={faBan} className="text-xs" />
          </button>
        )}
        {contract.cancellation.status === 'pending' && contract.cancellation.requestedBy === 'corporate' && (
          <>
            <button
              type="button"
              title="Accept cancellation request"
              disabled={busy}
              onClick={() => { setCancelRespondTarget({ contract, accept: true }); setCancelResponseReasonInput('') }}
              className={`${btnBase} border-[#bbf7d0] text-[#059669] hover:bg-[#f0fdf4] disabled:opacity-50`}
            >
              <FontAwesomeIcon icon={faThumbsUp} className="text-xs" />
            </button>
            <button
              type="button"
              title="Decline cancellation request"
              disabled={busy}
              onClick={() => { setCancelRespondTarget({ contract, accept: false }); setCancelResponseReasonInput('') }}
              className={`${btnBase} border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50`}
            >
              <FontAwesomeIcon icon={faThumbsDown} className="text-xs" />
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <section className="mx-auto w-full max-w-[1340px]">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate('/dashboard/corporate')}
        className="mb-5 grid h-9 w-9 place-items-center rounded-lg border border-[#d6dbe6] bg-white text-[#334155] transition hover:bg-[#f1f5f9]"
      >
        <FontAwesomeIcon icon={faArrowLeft} />
      </button>

      {/* Header */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 md:items-center">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Corporate Contracts</h1>
          <p className="mt-1 text-sm text-[#64748b]">
            Review contract requests submitted by corporate clients and approve, reject, or manage active ones.
          </p>
        </div>

        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 md:w-auto">
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-xl border border-[#d6dbe6] bg-white">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm font-semibold transition ${
                viewMode === 'table' ? 'bg-[#2642a6] text-white' : 'text-[#334155] hover:bg-[#f1f5f9]'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`px-3 py-2 text-sm font-semibold transition ${
                viewMode === 'cards' ? 'bg-[#2642a6] text-white' : 'text-[#334155] hover:bg-[#f1f5f9]'
              }`}
            >
              Cards
            </button>
          </div>

          <button
            type="button"
            onClick={() => setFilterOpen((cur) => !cur)}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${
              activeFilters
                ? 'border-[#2642a6] bg-[#eff2ff] text-[#2642a6]'
                : 'border-[#d6dbe6] bg-white text-[#111827] hover:bg-[#f8fafc]'
            }`}
          >
            <FontAwesomeIcon icon={faFilter} />
            Filter
            {activeFilters && (
              <span className="grid h-4 w-4 place-items-center rounded-full bg-[#2642a6] text-[10px] text-white">
                •
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={loadContracts}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d6dbe6] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
          >
            <FontAwesomeIcon icon={faRotateLeft} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard/corporate/pricing-settings')}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d6dbe6] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
          >
            Pricing Settings
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, i) => (
          <article
            key={stat.label}
            className="animate-dash-in dashboard-card rounded-xl border border-[#e5e7eb] bg-white p-5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">{stat.label}</p>
                <p className="mt-1.5 text-2xl font-extrabold leading-none tracking-tight text-[#111827]">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-[#94a3b8]">{stat.sub}</p>
              </div>
              <div className={`grid h-10 w-10 place-items-center rounded-xl ${stat.bg}`}>
                <FontAwesomeIcon icon={stat.icon} className={`text-base ${stat.color}`} />
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Filter Panel */}
      {filterOpen && (
        <article className="animate-dash-in mt-5 rounded-xl border border-[#e5e7eb] bg-white p-5">
          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_auto]">
            {/* Search */}
            <label className="flex h-11 items-center gap-2 rounded-xl border border-[#d6dbe6] px-3">
              <FontAwesomeIcon icon={faSearch} className="shrink-0 text-[#94a3b8]" />
              <input
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search by contract name, company, contact..."
                className="w-full bg-transparent text-sm outline-none placeholder:text-[#94a3b8]"
              />
            </label>

            {/* Status */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="h-11 rounded-xl border border-[#d6dbe6] px-3 text-sm outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>

            {/* Clear */}
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#d6dbe6] bg-white px-4 text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
            >
              <FontAwesomeIcon icon={faRotateLeft} />
              Clear
            </button>
          </div>
        </article>
      )}

      {/* Content */}
      <div className="mt-5">
        {/* Result count */}
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-[#64748b]">
            {loading ? 'Loading contracts...' : (
              <>
                Showing <span className="font-semibold text-[#111827]">{filteredContracts.length}</span> of{' '}
                <span className="font-semibold text-[#111827]">{contracts.length}</span> contracts
              </>
            )}
          </p>
        </div>

        {loadError && !loading && (
          <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-6 text-center">
            <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl text-[#dc2626]" />
            <p className="mt-3 text-sm font-semibold text-[#b91c1c]">{loadError}</p>
            <button
              type="button"
              onClick={loadContracts}
              className="mt-3 text-sm font-semibold text-[#2642a6] hover:text-[#203b96]"
            >
              Retry
            </button>
          </div>
        )}

        {!loadError && (
          <>
            {/* Table View */}
            {viewMode === 'table' && (
              <div className="animate-dash-in overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#e5e7eb] bg-[#f8fafc] text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]">
                        <th className="px-5 py-3.5">Contract</th>
                        <th className="px-5 py-3.5">Company</th>
                        <th className="px-5 py-3.5">Shift</th>
                        <th className="px-5 py-3.5">Employees</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5">Deposit</th>
                        <th className="px-5 py-3.5">Buses</th>
                        <th className="px-5 py-3.5">Term</th>
                        <th className="px-5 py-3.5">Monthly</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f1f5f9]">
                      {filteredContracts.map((contract) => {
                        const days = daysUntilExpiry(contract.endDate)
                        return (
                          <tr key={contract.contractId} className="group transition hover:bg-[#fafbff]">
                            <td className="px-5 py-4">
                              <p className="text-xs text-[#94a3b8]">#{contract.contractId}</p>
                              <p className="mt-0.5 font-semibold text-[#111827]">{contract.contractName}</p>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e0e7ff] text-xs font-bold text-[#2642a6]">
                                  {companyInitials(contract.companyName)}
                                </div>
                                <span className="font-medium text-[#334155]">{contract.companyName ?? '—'}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-[#64748b]">
                              <FontAwesomeIcon icon={shiftIcon(contract.shiftType)} className="mr-1.5 text-[#2642a6]" />
                              {shiftLabel(contract.shiftType)}
                            </td>
                            <td className="px-5 py-4 text-[#334155]">{contract.employeeCount}</td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(contract.status)}`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {statusLabel(contract.status)}
                              </span>
                              {contract.cancellation.status === 'pending' && (
                                <p className="mt-1 text-[10px] font-semibold text-[#b45309]">
                                  {contract.cancellation.requestedBy === 'admin' ? 'Cancellation sent — awaiting client' : 'Client requested cancellation'}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {contract.advancePaymentStatus === 'paid' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                  Paid
                                </span>
                              ) : contract.advancePaymentStatus === 'waived' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                                  Waived
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-1.5 text-[#334155]">
                                <FontAwesomeIcon icon={faBus} className="text-xs text-[#2642a6]" />
                                <span className="font-semibold">{contract.busCount}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-[#334155]">
                                {formatDate(contract.startDate)} – {formatDate(contract.endDate)}
                              </p>
                              {days !== null && (days > 0 ? (
                                <p className={`mt-0.5 text-xs ${days <= 30 ? 'font-semibold text-[#b45309]' : 'text-[#94a3b8]'}`}>
                                  {days}d remaining
                                </p>
                              ) : (
                                <p className="mt-0.5 text-xs font-semibold text-[#b91c1c]">Ended</p>
                              ))}
                            </td>
                            <td className="px-5 py-4 font-semibold text-[#047857]">
                              {formatCurrency(contract.billingAmount)}
                            </td>
                            <td className="px-5 py-4">{renderActions(contract)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {!loading && filteredContracts.length === 0 && (
                  <div className="py-14 text-center">
                    <FontAwesomeIcon icon={faFileContract} className="text-3xl text-[#d6dbe6]" />
                    <p className="mt-3 text-sm font-semibold text-[#64748b]">No contracts match your filters.</p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-2 text-sm font-semibold text-[#2642a6] hover:text-[#203b96]"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Cards View */}
            {viewMode === 'cards' && (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredContracts.map((contract, i) => {
                    const days = daysUntilExpiry(contract.endDate)
                    return (
                      <article
                        key={contract.contractId}
                        className="animate-dash-in dashboard-card flex h-full flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white"
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3 p-5">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e0e7ff] text-sm font-extrabold text-[#2642a6]">
                              {companyInitials(contract.companyName)}
                            </div>
                            <div>
                              <p className="text-xs text-[#94a3b8]">#{contract.contractId}</p>
                              <p className="mt-0.5 text-sm font-bold leading-tight text-[#111827]">{contract.contractName}</p>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(contract.status)}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {statusLabel(contract.status)}
                          </span>
                        </div>

                        {/* Company */}
                        <div className="flex items-center gap-2 border-t border-[#f1f5f9] px-5 py-3">
                          <FontAwesomeIcon icon={faBuilding} className="text-xs text-[#94a3b8]" />
                          <span className="text-sm font-medium text-[#334155]">{contract.companyName ?? '—'}</span>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-2 gap-px bg-[#f1f5f9] border-t border-[#f1f5f9]">
                          <div className="bg-white px-4 py-3">
                            <p className="text-xs text-[#94a3b8]">Buses</p>
                            <p className="mt-0.5 text-sm font-bold text-[#111827]">
                              <FontAwesomeIcon icon={faBus} className="mr-1 text-[#2642a6]" />
                              {contract.busCount} Assigned
                            </p>
                          </div>
                          <div className="bg-white px-4 py-3">
                            <p className="text-xs text-[#94a3b8]">Monthly</p>
                            <p className="mt-0.5 text-sm font-bold text-[#047857]">{formatCurrency(contract.billingAmount)}</p>
                          </div>
                          <div className="bg-white px-4 py-3 col-span-2">
                            <p className="text-xs text-[#94a3b8]">Advance Deposit</p>
                            <div className="mt-0.5 flex items-center gap-2">
                              {contract.advancePaymentStatus === 'paid' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                  Paid
                                </span>
                              ) : contract.advancePaymentStatus === 'waived' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">
                                  Waived
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="bg-white px-4 py-3">
                            <p className="text-xs text-[#94a3b8]">Valid Until</p>
                            <p className="mt-0.5 text-sm font-bold text-[#111827]">{formatDate(contract.endDate)}</p>
                          </div>
                          <div className="bg-white px-4 py-3">
                            <p className="text-xs text-[#94a3b8]">Days Left</p>
                            <p
                              className={`mt-0.5 text-sm font-bold ${
                                days === null ? 'text-[#111827]' : days <= 0 ? 'text-[#b91c1c]' : days <= 30 ? 'text-[#b45309]' : 'text-[#111827]'
                              }`}
                            >
                              {days === null ? '—' : days > 0 ? `${days}d` : 'Ended'}
                            </p>
                          </div>
                        </div>

                        {/* Shift + Employees */}
                        <div className="flex items-center gap-4 border-t border-[#f1f5f9] px-5 py-3">
                          <span className="flex items-center gap-1.5 text-xs text-[#64748b]">
                            <FontAwesomeIcon icon={shiftIcon(contract.shiftType)} className="text-[#2642a6]" />
                            {shiftLabel(contract.shiftType)}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-[#64748b]">
                            <FontAwesomeIcon icon={faCalendarDays} />
                            {contract.employeeCount} employees
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-[#64748b]">
                            <FontAwesomeIcon icon={contract.busType === 'ac' ? faSnowflake : faShuttleVan} />
                            {busTypeLabel(contract.busType)}
                          </span>
                        </div>

                        {/* Footer Actions */}
                        <div className="mt-auto flex items-center justify-between border-t border-[#e5e7eb] px-5 py-3">
                          <button
                            type="button"
                            onClick={() => setViewContractId(contract.contractId)}
                            className="text-sm font-semibold text-[#2642a6] hover:text-[#203b96]"
                          >
                            View Details
                          </button>
                          {renderActions(contract, true)}
                        </div>
                      </article>
                    )
                  })}
                </div>

                {!loading && filteredContracts.length === 0 && (
                  <div className="py-14 text-center">
                    <FontAwesomeIcon icon={faFileContract} className="text-3xl text-[#d6dbe6]" />
                    <p className="mt-3 text-sm font-semibold text-[#64748b]">No contracts match your filters.</p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-2 text-sm font-semibold text-[#2642a6] hover:text-[#203b96]"
                    >
                      Clear Filters
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {viewContractId !== null && (
        <ViewContractModal contractId={viewContractId} onClose={() => setViewContractId(null)} />
      )}

      {cancelRequestTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f172a]/50 p-4 backdrop-blur-[2px]">
          <div className="animate-dash-in w-full max-w-[460px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fee2e2]">
                <FontAwesomeIcon icon={faBan} className="text-lg text-[#dc2626]" />
              </div>
              <h3 className="mt-4 text-base font-extrabold text-[#111827]">Request to cancel this contract?</h3>
              <p className="mt-2 text-sm text-[#64748b]">
                The client must accept before "{cancelRequestTarget.contractName}" is actually cancelled.
                {' '}Since this contract is active, cancellation won't take effect until at least{' '}
                <strong>{new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</strong> (2 weeks' notice).
              </p>
              <label className="mt-4 block text-xs font-semibold text-[#334155]">
                Reason for cancellation
                <textarea
                  value={cancelReasonInput}
                  onChange={(event) => setCancelReasonInput(event.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Explain why this contract is being cancelled"
                  className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm outline-none focus:border-[#2642a6]"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#f1f5f9] px-6 py-4">
              <button
                type="button"
                onClick={() => setCancelRequestTarget(null)}
                className="rounded-xl border border-[#d6dbe6] px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submitCancelRequest}
                disabled={actionBusyId === cancelRequestTarget.contractId || !cancelReasonInput.trim()}
                className="rounded-xl bg-[#dc2626] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b91c1c] disabled:opacity-60"
              >
                {actionBusyId === cancelRequestTarget.contractId ? 'Sending...' : 'Send Cancellation Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelRespondTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f172a]/50 p-4 backdrop-blur-[2px]">
          <div className="animate-dash-in w-full max-w-[460px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="p-6">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${cancelRespondTarget.accept ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]'}`}>
                <FontAwesomeIcon
                  icon={cancelRespondTarget.accept ? faThumbsUp : faThumbsDown}
                  className={`text-lg ${cancelRespondTarget.accept ? 'text-[#059669]' : 'text-[#dc2626]'}`}
                />
              </div>
              <h3 className="mt-4 text-base font-extrabold text-[#111827]">
                {cancelRespondTarget.accept ? 'Accept this cancellation request?' : 'Decline this cancellation request?'}
              </h3>
              <p className="mt-2 text-sm text-[#64748b]">
                Reason given by the client: "{cancelRespondTarget.contract.cancellation.reason}"
              </p>
              <label className="mt-4 block text-xs font-semibold text-[#334155]">
                Note (optional)
                <textarea
                  value={cancelResponseReasonInput}
                  onChange={(event) => setCancelResponseReasonInput(event.target.value)}
                  maxLength={500}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm outline-none focus:border-[#2642a6]"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#f1f5f9] px-6 py-4">
              <button
                type="button"
                onClick={() => setCancelRespondTarget(null)}
                className="rounded-xl border border-[#d6dbe6] px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submitCancelResponse}
                disabled={actionBusyId === cancelRespondTarget.contract.contractId}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${cancelRespondTarget.accept ? 'bg-[#059669] hover:bg-[#047857]' : 'bg-[#dc2626] hover:bg-[#b91c1c]'}`}
              >
                {actionBusyId === cancelRespondTarget.contract.contractId ? 'Working...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingAction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f172a]/50 p-4 backdrop-blur-[2px]">
          <div className={`animate-dash-in w-full overflow-hidden rounded-2xl bg-white shadow-2xl ${pendingAction.nextStatus === 'active' ? 'max-w-[480px]' : 'max-w-[420px]'}`}>
            <div className="p-6">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  pendingAction.nextStatus === 'active' ? 'bg-[#dcfce7]' : 'bg-[#fee2e2]'
                }`}
              >
                <FontAwesomeIcon
                  icon={pendingAction.nextStatus === 'active' ? faThumbsUp : pendingAction.nextStatus === 'cancelled' ? faThumbsDown : faBan}
                  className={`text-lg ${pendingAction.nextStatus === 'active' ? 'text-[#059669]' : 'text-[#dc2626]'}`}
                />
              </div>
              <h3 className="mt-4 text-base font-extrabold text-[#111827]">
                {pendingAction.nextStatus === 'active'
                  ? 'Approve this contract?'
                  : pendingAction.nextStatus === 'cancelled'
                  ? 'Cancel this contract?'
                  : 'Mark this contract expired?'}
              </h3>
              <p className="mt-2 text-sm text-[#64748b]">
                {pendingAction.nextStatus === 'active'
                  ? `"${pendingAction.contract.contractName}" will become active and the company will be notified.`
                  : `"${pendingAction.contract.contractName}" will be ${pendingAction.nextStatus} and the company will be notified. This cannot be undone.`}
              </p>

              {pendingAction.nextStatus === 'active' && (
                <div className="mt-4 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#64748b]">Original monthly amount</span>
                    <span className="font-semibold text-[#111827]">{formatCurrency(originalAmountForPending)}</span>
                  </div>
                  <label className="mt-3 block text-xs font-semibold text-[#334155]">
                    Discount (LKR)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountInput}
                      onChange={(event) => setDiscountInput(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm outline-none focus:border-[#2642a6]"
                    />
                  </label>
                  <label className="mt-3 block text-xs font-semibold text-[#334155]">
                    Note to company (optional)
                    <textarea
                      value={noteInput}
                      onChange={(event) => setNoteInput(event.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="e.g. Loyalty discount for renewal"
                      className="mt-1 w-full rounded-lg border border-[#d6dbe6] bg-white px-3 py-2 text-sm outline-none focus:border-[#2642a6]"
                    />
                  </label>
                  <div className="mt-3 flex items-center justify-between border-t border-[#e5e7eb] pt-3 text-sm">
                    <span className="font-semibold text-[#111827]">Final monthly amount</span>
                    <span className="font-extrabold text-[#047857]">{formatCurrency(finalAmountPreview)}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#f1f5f9] px-6 py-4">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="rounded-xl border border-[#d6dbe6] px-4 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#f8fafc]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runStatusChange}
                disabled={actionBusyId === pendingAction.contract.contractId}
                className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 ${
                  pendingAction.nextStatus === 'active' ? 'bg-[#059669] hover:bg-[#047857]' : 'bg-[#dc2626] hover:bg-[#b91c1c]'
                }`}
              >
                {actionBusyId === pendingAction.contract.contractId ? 'Working...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-[#d6dbe6] bg-white px-4 py-3 shadow-lg">
          <p className="text-sm font-semibold text-[#334155]">{toastMessage}</p>
          <button type="button" onClick={() => setToastMessage(null)} className="text-[#64748b]">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      ) : null}
    </section>
  )
}

export default Contracts
