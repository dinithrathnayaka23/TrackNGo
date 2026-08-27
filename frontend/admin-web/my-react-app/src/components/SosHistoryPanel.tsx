import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCalendarDays,
  faChevronDown,
  faFilePdf,
  faMagnifyingGlass as faSearchGlass,
  faSpinner,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { fetchSosAlertHistory, type SosAlertData } from '../services/sosAlertService'
import {
  downloadSosHistoryPdf,
  formatMoment,
  responseMinutes,
  statusLabel,
} from '../utils/sosHistoryPdf'

type StatusFilter = 'All' | 'triggered' | 'resolved' | 'false_alarm'
type RaisedByFilter = 'All' | 'passenger' | 'driver'

function statusBadge(status: string) {
  switch (status) {
    case 'resolved':
      return 'bg-[#dcfce7] text-[#047857]'
    case 'false_alarm':
      return 'bg-[#f1f5f9] text-[#64748b]'
    default:
      return 'bg-[#fee2e2] text-[#dc2626]'
  }
}

/** The day an alert was raised, as YYYY-MM-DD, for comparing against the date pickers. */
function triggeredDay(alert: SosAlertData): string {
  return alert.triggeredAt ? alert.triggeredAt.slice(0, 10) : ''
}

export default function SosHistoryPanel() {
  const [alerts, setAlerts] = useState<SosAlertData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')
  const [raisedByFilter, setRaisedByFilter] = useState<RaisedByFilter>('All')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // The whole history is loaded once and narrowed in the browser, the way the
  // complaints screen works, so changing a filter reprints the table immediately
  // instead of waiting on a round trip.
  useEffect(() => {
    let active = true
    void fetchSosAlertHistory()
      .then((loaded) => { if (active) setAlerts(loaded) })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load SOS history')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    let list = alerts

    if (search) {
      const query = search.toLowerCase()
      list = list.filter((alert) =>
        (alert.name ?? '').toLowerCase().includes(query)
        || (alert.busNumber ?? '').toLowerCase().includes(query))
    }

    if (statusFilter !== 'All') {
      list = list.filter((alert) => alert.status === statusFilter)
    }

    if (raisedByFilter !== 'All') {
      list = list.filter((alert) => alert.triggeredByType === raisedByFilter)
    }

    if (fromDate) {
      list = list.filter((alert) => triggeredDay(alert) >= fromDate)
    }

    if (toDate) {
      list = list.filter((alert) => triggeredDay(alert) <= toDate)
    }

    return list
  }, [alerts, fromDate, raisedByFilter, search, statusFilter, toDate])

  const summary = useMemo(() => ({
    total: filtered.length,
    open: filtered.filter((alert) => alert.status === 'triggered').length,
    resolved: filtered.filter((alert) => alert.status === 'resolved').length,
    falseAlarms: filtered.filter((alert) => alert.status === 'false_alarm').length,
  }), [filtered])

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Alerts in view', value: summary.total, tone: 'text-[#111827]' },
          { label: 'Still open', value: summary.open, tone: 'text-[#dc2626]' },
          { label: 'Resolved', value: summary.resolved, tone: 'text-[#047857]' },
          { label: 'False alarms', value: summary.falseAlarms, tone: 'text-[#64748b]' },
        ].map((tile) => (
          <div key={tile.label} className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{tile.label}</p>
            <p className={`mt-1 text-2xl font-extrabold ${tile.tone}`}>{tile.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="text-sm font-semibold text-[#64748b]">Search</label>
          <div className="relative mt-1">
            <FontAwesomeIcon icon={faSearchGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Name or bus number..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-[#64748b]">Status</label>
          <div className="relative mt-1">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="w-full appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"
            >
              <option value="All">All Statuses</option>
              <option value="triggered">Triggered</option>
              <option value="resolved">Resolved</option>
              <option value="false_alarm">False Alarm</option>
            </select>
            <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-[#64748b]">Raised By</label>
          <div className="relative mt-1">
            <select
              value={raisedByFilter}
              onChange={(event) => setRaisedByFilter(event.target.value as RaisedByFilter)}
              className="w-full appearance-none rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-3 pr-8 text-sm font-medium text-[#334155] outline-none transition focus:border-[#2642a6]"
            >
              <option value="All">Anyone</option>
              <option value="passenger">Passenger</option>
              <option value="driver">Driver</option>
            </select>
            <FontAwesomeIcon icon={faChevronDown} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#64748b]" />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-[#64748b]">Date From</label>
          <div className="relative mt-1">
            <FontAwesomeIcon icon={faCalendarDays} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-40 rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-[#64748b]">Date To</label>
          <div className="relative mt-1">
            <FontAwesomeIcon icon={faCalendarDays} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]" />
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-40 rounded-lg border border-[#d6dbe6] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none transition focus:border-[#2642a6] focus:ring-1 focus:ring-[#2642a6]"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => downloadSosHistoryPdf(filtered, {
            from: fromDate,
            to: toDate,
            status: statusFilter === 'All' ? '' : statusFilter,
            triggeredBy: raisedByFilter === 'All' ? '' : raisedByFilter,
            search,
          })}
          disabled={loading || Boolean(error) || filtered.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[#b42318] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#96170f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FontAwesomeIcon icon={faFilePdf} className="text-xs" />
          Export Report
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e5e7eb]">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-[#e5e7eb] bg-[#f8fafc] text-left text-xs font-semibold uppercase tracking-wide text-[#64748b]">
              <th className="w-[8%] px-3 py-3">Alert</th>
              <th className="w-[13%] px-3 py-3">Triggered</th>
              <th className="w-[18%] px-3 py-3">Raised By</th>
              <th className="w-[13%] px-3 py-3">Bus / Route</th>
              <th className="w-[18%] px-3 py-3">Location</th>
              <th className="w-[13%] px-3 py-3">Resolved</th>
              <th className="w-[8%] px-3 py-3">Response</th>
              <th className="w-[9%] px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-[#64748b]">
                  <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                  Loading SOS history...
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-[#dc2626]">
                  <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />
                  {error}
                </td>
              </tr>
            )}

            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-[#64748b]">
                  No SOS alerts match these filters.
                </td>
              </tr>
            )}

            {!loading && !error && filtered.map((alert) => (
              <tr key={alert.sosId} className="border-b border-[#f1f5f9] align-top last:border-b-0 hover:bg-[#f8fafc]">
                <td className="px-3 py-3 font-bold text-[#111827]">#{alert.sosId}</td>
                <td className="px-3 py-3 text-[#334155]">{formatMoment(alert.triggeredAt)}</td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-[#111827] break-words">{alert.name || '--'}</p>
                  <p className="text-xs text-[#94a3b8]">
                    {alert.triggeredByType === 'passenger' ? 'Passenger' : 'Driver'}
                    {alert.phoneNumber ? ` · ${alert.phoneNumber}` : ''}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-[#111827] break-words">{alert.busNumber || '--'}</p>
                  <p className="text-xs text-[#94a3b8] break-words">{alert.routeName || 'No route'}</p>
                </td>
                <td className="px-3 py-3 text-[#334155] break-words">{alert.sharedLocation || '--'}</td>
                <td className="px-3 py-3 text-[#334155]">{formatMoment(alert.resolvedAt)}</td>
                <td className="px-3 py-3 text-[#334155]">{responseMinutes(alert)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${statusBadge(alert.status)}`}>
                    {statusLabel(alert.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
