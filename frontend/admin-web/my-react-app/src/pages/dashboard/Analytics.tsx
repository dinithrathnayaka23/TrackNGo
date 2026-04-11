import { useMemo, useState } from 'react'
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

const kpis = [
  {
    title: 'Total Users',
    value: '12,450',
    trend: '+12%',
    subtitle: 'vs last month',
    icon: faUsers,
    iconBox: 'bg-[#e8edf8] text-[#25409a]',
    trendBox: 'bg-[#d5f3e3] text-[#0e9f6e]',
  },
  {
    title: 'Active Bookings',
    value: '1,285',
    trend: '+8%',
    subtitle: 'vs last month',
    icon: faTicketSimple,
    iconBox: 'bg-[#ddf4eb] text-[#159c71]',
    trendBox: 'bg-[#d5f3e3] text-[#0e9f6e]',
  },
  {
    title: 'Monthly Revenue',
    value: 'Rs. 4.2M',
    trend: '+15%',
    subtitle: 'vs last month',
    icon: faMoneyBillWave,
    iconBox: 'bg-[#ddf4eb] text-[#159c71]',
    trendBox: 'bg-[#d5f3e3] text-[#0e9f6e]',
  },
  {
    title: 'Pending Complaints',
    value: '23',
    trend: 'Action Required',
    subtitle: '',
    icon: faCircleExclamation,
    iconBox: 'bg-[#f9f1dc] text-[#d99a0b]',
    trendBox: 'bg-[#fff1d8] text-[#d9960a]',
  },
]

const rows = [
  {
    id: '#BK-4821',
    passenger: 'Janani Pitawala',
    route: 'Colombo - Kandy',
    date: 'Oct 24, 08:30 AM',
    amount: 'Rs.345.00',
    status: 'Confirmed',
    statusClass: 'bg-[#cdeed9] text-[#1f9d60]',
  },
  {
    id: '#BK-4822',
    passenger: 'Anjana Lakshan',
    route: 'Colombo - Rathnapura',
    date: 'Oct 24, 09:15 AM',
    amount: 'Rs.500.00',
    status: 'Confirmed',
    statusClass: 'bg-[#cdeed9] text-[#1f9d60]',
  },
  {
    id: '#BK-4823',
    passenger: 'Nadeesha Perera',
    route: 'Kaduwela - Matara',
    date: 'Oct 24, 10:40 AM',
    amount: 'Rs.880.00',
    status: 'Cancelled',
    statusClass: 'bg-[#ffe2e2] text-[#dc2626]',
  },
]

const trendByRange = {
  7: {
    description: 'Number of Bookings per Route Type (Last 7 Days)',
    labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
    highway: '80,165 180,155 280,150 380,142 480,135 580,125 680,118',
    corporate: '80,182 180,165 280,140 380,120 480,95 580,70 680,58',
    longDistance: '80,225 180,220 280,228 380,215 480,210 580,205 680,198',
  },
  30: {
    description: 'Number of Bookings per Route Type (Last 30 Days)',
    labels: ['Oct 01', 'Oct 06', 'Oct 11', 'Oct 16', 'Oct 21', 'Oct 26', 'Oct 30'],
    highway: '80,170 140,160 200,165 260,110 320,130 380,115 440,95 500,92 560,90 620,88 680,80',
    corporate: '80,210 140,185 200,198 260,120 320,125 380,70 440,60 500,48 560,25 620,14 680,8',
    longDistance: '80,240 140,230 200,235 260,238 320,220 380,225 440,230 500,215 560,218 620,221 680,208',
  },
  90: {
    description: 'Number of Bookings per Route Type (Last 90 Days)',
    labels: ['Jul 01', 'Jul 15', 'Aug 01', 'Aug 15', 'Sep 01', 'Sep 15', 'Sep 30'],
    highway: '80,190 180,175 280,160 380,138 480,120 580,102 680,82',
    corporate: '80,228 180,205 280,178 380,150 480,120 580,88 680,52',
    longDistance: '80,246 180,236 280,230 380,220 480,212 580,204 680,192',
  },
} as const

function formatTime(value: Date) {
  return value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function Analytics() {
  const navigate = useNavigate()
  const [selectedRange, setSelectedRange] = useState<7 | 30 | 90>(30)
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date())

  const trend = trendByRange[selectedRange]

  const displayedRows = useMemo(() => {
    if (selectedRange === 7) return rows.slice(0, 2)
    if (selectedRange === 30) return rows

    return [...rows, ...rows].map((row, index) => ({
      ...row,
      id: `${row.id}-${index + 1}`,
    }))
  }, [selectedRange])

  const handleRefresh = () => {
    setLastRefreshedAt(new Date())
  }

  const handleExport = () => {
    const headers = ['Booking ID', 'Passenger', 'Route', 'Date & Time', 'Amount', 'Status']
    const csvRows = displayedRows.map((row) => [
      row.id,
      row.passenger,
      row.route,
      row.date,
      row.amount,
      row.status,
    ])

    const csvContent = [headers, ...csvRows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = `analytics-bookings-${selectedRange}-days.csv`
    link.click()
    URL.revokeObjectURL(downloadUrl)
  }

  return (
    <section className="mx-auto w-full max-w-[1320px]">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-extrabold tracking-tight text-[#171923]">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-10 items-center rounded-lg border border-[#d9dde5] bg-white px-3 text-sm font-medium text-[#374151]">
            <select
              value={selectedRange}
              onChange={(event) => setSelectedRange(Number(event.target.value) as 7 | 30 | 90)}
              className="bg-transparent pr-1 font-semibold text-[#1f2937] outline-none"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </label>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d9dde5] bg-white px-4 text-sm font-semibold text-[#1f2937]"
          >
            <FontAwesomeIcon icon={faArrowRotateRight} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#22449d] px-4 text-sm font-semibold text-white"
          >
            <FontAwesomeIcon icon={faDownload} />
            Export
          </button>
        </div>
      </header>
      <p className="mb-4 text-sm text-[#6b7280]">Last refreshed: {formatTime(lastRefreshedAt)}</p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article key={kpi.title} className="rounded-2xl border border-[#eceef2] bg-[#f9fafc] p-5">
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium text-[#667085]">{kpi.title}</p>
              <div className={`grid h-12 w-12 place-items-center rounded-xl ${kpi.iconBox}`}>
                <FontAwesomeIcon icon={kpi.icon} />
              </div>
            </div>
            <p className="mt-1 text-sm font-extrabold text-[#111827]">{kpi.value}</p>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className={`rounded-md px-2 py-0.5 font-semibold ${kpi.trendBox}`}>{kpi.trend}</span>
              {kpi.subtitle ? <span className="text-[#6b7280]">{kpi.subtitle}</span> : null}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.58fr_1fr]">
        <article className="rounded-2xl border border-[#e8ebf2] bg-white p-5">
          <h2 className="text-sm font-bold text-[#111827]">Booking Trends</h2>
          <p className="text-sm text-[#667085]">{trend.description}</p>
          <div className="mt-4 h-[240px] rounded-xl border border-[#edf0f6] bg-[#fbfcff] p-4">
            <svg viewBox="0 0 740 300" className="h-full w-full">
              <line x1="60" y1="15" x2="60" y2="255" stroke="#d7deea" />
              <line x1="60" y1="255" x2="705" y2="255" stroke="#d7deea" />
              <line x1="60" y1="205" x2="705" y2="205" stroke="#edf2fa" />
              <line x1="60" y1="155" x2="705" y2="155" stroke="#edf2fa" />
              <line x1="60" y1="105" x2="705" y2="105" stroke="#edf2fa" />
              <line x1="60" y1="55" x2="705" y2="55" stroke="#edf2fa" />

              <polyline fill="none" stroke="#365fcf" strokeWidth="2.2" points={trend.highway} />
              <polyline fill="none" stroke="#3b82f6" strokeWidth="2.2" points={trend.corporate} />
              <polyline fill="none" stroke="#0ea5a3" strokeWidth="2.2" points={trend.longDistance} />

              <text x="13" y="258" fontSize="11" fill="#64748b">0</text>
              <text x="8" y="208" fontSize="11" fill="#64748b">200</text>
              <text x="8" y="158" fontSize="11" fill="#64748b">400</text>
              <text x="8" y="108" fontSize="11" fill="#64748b">600</text>
              <text x="8" y="58" fontSize="11" fill="#64748b">800</text>
              <text x="5" y="18" fontSize="11" fill="#64748b">1000</text>

              <text x="72" y="280" fontSize="11" fill="#64748b">{trend.labels[0]}</text>
              <text x="180" y="280" fontSize="11" fill="#64748b">{trend.labels[1]}</text>
              <text x="288" y="280" fontSize="11" fill="#64748b">{trend.labels[2]}</text>
              <text x="396" y="280" fontSize="11" fill="#64748b">{trend.labels[3]}</text>
              <text x="504" y="280" fontSize="11" fill="#64748b">{trend.labels[4]}</text>
              <text x="612" y="280" fontSize="11" fill="#64748b">{trend.labels[5]}</text>
            </svg>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-[#111827]">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-[#365fcf]" />
              Highway
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-[#0ea5a3]" />
              Long-distance
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-[#3b82f6]" />
              Corporate
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-[#e8ebf2] bg-white p-5">
          <h2 className="text-sm font-bold text-[#111827]">Revenue by Category</h2>
          <div className="mt-6 grid place-items-center">
            <div className="relative h-56 w-56">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle cx="60" cy="60" r="38" fill="none" stroke="#e5e7eb" strokeWidth="14" />
                <circle cx="60" cy="60" r="38" fill="none" stroke="#22449d" strokeWidth="14" strokeDasharray="83.57 238.76" strokeLinecap="butt" />
                <circle cx="60" cy="60" r="38" fill="none" stroke="#0f8f84" strokeWidth="14" strokeDasharray="59.69 262.64" strokeDashoffset="-83.57" strokeLinecap="butt" />
                <circle cx="60" cy="60" r="38" fill="none" stroke="#3b82f6" strokeWidth="14" strokeDasharray="59.69 262.64" strokeDashoffset="-143.26" strokeLinecap="butt" />
                <circle cx="60" cy="60" r="38" fill="none" stroke="#f59e0b" strokeWidth="14" strokeDasharray="35.82 286.51" strokeDashoffset="-202.95" strokeLinecap="butt" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
                <p className="text-sm text-[#6b7280]">Total</p>
                <p className="mt-1 text-[2.2rem] font-bold text-[#111827]">100%</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-[#f4f6fa] px-3 py-3">
              <p className="text-sm text-[#6b7280]">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#22449d]" />
                Corporate
              </p>
              <p className="text-sm font-semibold text-[#111827]">35%</p>
            </div>
            <div className="rounded-lg bg-[#f4f6fa] px-3 py-3">
              <p className="text-sm text-[#6b7280]">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#0f8f84]" />
                Trip
              </p>
              <p className="text-sm font-semibold text-[#111827]">25%</p>
            </div>
            <div className="rounded-lg bg-[#f4f6fa] px-3 py-3">
              <p className="text-sm text-[#6b7280]">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />
                Highway
              </p>
              <p className="text-sm font-semibold text-[#111827]">25%</p>
            </div>
            <div className="rounded-lg bg-[#f4f6fa] px-3 py-3">
              <p className="text-sm text-[#6b7280]">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                Long-distance
              </p>
              <p className="text-sm font-semibold text-[#111827]">15%</p>
            </div>
          </div>
        </article>
      </div>

      <article className="mt-4 overflow-hidden rounded-2xl border border-[#e8ebf2] bg-white">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-bold text-[#111827]">Recent Bookings</h2>
          <button
            type="button"
            onClick={() => navigate('/dashboard/booking')}
            className="text-sm font-semibold text-[#22449d]"
          >
            View All
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-t border-[#eef1f5]">
            <thead className="bg-[#f7f8fb] text-left text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
              <tr>
                <th className="px-5 py-3">Booking ID</th>
                <th className="px-5 py-3">Passenger</th>
                <th className="px-5 py-3">Route</th>
                <th className="px-5 py-3">Date & Time</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row) => (
                <tr key={row.id} className="border-t border-[#eef1f5] text-sm text-[#374151]">
                  <td className="px-5 py-4 font-semibold text-[#22449d]">{row.id}</td>
                  <td className="px-5 py-4">{row.passenger}</td>
                  <td className="px-5 py-4 text-[#64748b]">{row.route}</td>
                  <td className="px-5 py-4 text-[#64748b]">
                    <span className="inline-flex items-center gap-2">
                      <FontAwesomeIcon icon={faCalendarDays} className="text-[#9ca3af]" />
                      {row.date}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-semibold">{row.amount}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.statusClass}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}

export default Analytics
