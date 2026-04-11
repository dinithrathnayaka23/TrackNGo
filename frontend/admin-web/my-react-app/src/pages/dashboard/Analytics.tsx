import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowDown,
  faArrowRotateRight,
  faArrowUp,
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
    trend: '+12% vs last month',
    trendUp: true,
    icon: faUsers,
    iconWrap: 'bg-[#e8eeff] text-[#2f4fb5]',
  },
  {
    title: 'Active Bookings',
    value: '1,285',
    trend: '+8% vs last month',
    trendUp: true,
    icon: faTicketSimple,
    iconWrap: 'bg-[#e6f7ee] text-[#1aa56e]',
  },
  {
    title: 'Monthly Revenue',
    value: 'Rs. 4.2M',
    trend: '+15% vs last month',
    trendUp: true,
    icon: faMoneyBillWave,
    iconWrap: 'bg-[#e6f7ee] text-[#1aa56e]',
  },
  {
    title: 'Pending Complaints',
    value: '23',
    trend: 'Action Required',
    trendUp: null,
    icon: faCircleExclamation,
    iconWrap: 'bg-[#fff2e3] text-[#e68d10]',
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
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="animate-dash-in text-base font-extrabold tracking-tight text-[#1f2737]" style={{ animationDelay: '70ms' }}>Dashboard</h1>
        <div className="animate-dash-in flex flex-wrap items-center gap-3" style={{ animationDelay: '90ms' }}>
          <label className="inline-flex h-10 items-center rounded-lg border border-[#d8deea] bg-[#f7f8fc] px-3 text-sm font-medium text-[#5e6a82]">
            <select
              value={selectedRange}
              onChange={(event) => setSelectedRange(Number(event.target.value) as 7 | 30 | 90)}
              className="bg-transparent pr-1 font-semibold text-[#2f394d] outline-none"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
            </select>
          </label>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8deea] bg-white px-4 text-sm font-bold text-[#2f394d]"
          >
            <FontAwesomeIcon icon={faArrowRotateRight} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#2642a6] px-4 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96]"
          >
            <FontAwesomeIcon icon={faDownload} />
            Export
          </button>
        </div>
      </header>
      <p className="mb-3 text-sm text-[#7f899e]">Last refreshed: {formatTime(lastRefreshedAt)}</p>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, index) => (
          <article
            key={kpi.title}
            className="dashboard-card animate-dash-in rounded-xl border border-[#dee1e8] bg-[#f7f8fc] p-4 shadow-sm"
            style={{ animationDelay: `${120 + index * 40}ms` }}
          >
            <div className="mb-2 flex items-start justify-between">
              <p className="text-xs font-semibold text-[#758098]">{kpi.title}</p>
              <div className={`grid h-7 w-7 place-items-center rounded-md text-xs ${kpi.iconWrap}`}>
                <FontAwesomeIcon icon={kpi.icon} />
              </div>
            </div>
            <p className="text-sm font-extrabold leading-none text-[#1f2737]">{kpi.value}</p>
            <p className={`mt-1.5 text-xs font-semibold ${kpi.trendUp === true ? 'text-[#11a765]' : kpi.trendUp === false ? 'text-[#d74949]' : 'text-[#d9960a]'}`}>
              {kpi.trendUp !== null ? <FontAwesomeIcon icon={kpi.trendUp ? faArrowUp : faArrowDown} className="mr-1 text-xs" /> : null}
              {kpi.trend}
            </p>
          </article>
        ))}
      </section>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.58fr_1fr]">
        <article className="dashboard-card animate-dash-in rounded-xl border border-[#dee1e8] bg-[#f7f8fc] p-4 shadow-sm" style={{ animationDelay: '260ms' }}>
          <h2 className="text-sm font-bold text-[#1f2737]">Booking Trends</h2>
          <p className="text-sm text-[#7f899e]">{trend.description}</p>
          <div className="mt-4 h-[240px] rounded-xl bg-[#fafbff] p-4">
            <svg viewBox="0 0 740 300" className="h-full w-full">
              <line x1="60" y1="15" x2="60" y2="255" stroke="#d6dce8" />
              <line x1="60" y1="255" x2="705" y2="255" stroke="#d6dce8" />
              <line x1="60" y1="205" x2="705" y2="205" stroke="#e4e8f1" />
              <line x1="60" y1="155" x2="705" y2="155" stroke="#e4e8f1" />
              <line x1="60" y1="105" x2="705" y2="105" stroke="#e4e8f1" />
              <line x1="60" y1="55" x2="705" y2="55" stroke="#e4e8f1" />

              <polyline fill="none" stroke="#365fcf" strokeWidth="2.2" points={trend.highway} />
              <polyline fill="none" stroke="#3b82f6" strokeWidth="2.2" points={trend.corporate} />
              <polyline fill="none" stroke="#0ea5a3" strokeWidth="2.2" points={trend.longDistance} />

              <text x="13" y="258" fontSize="11" fill="#7d879b">0</text>
              <text x="8" y="208" fontSize="11" fill="#7d879b">200</text>
              <text x="8" y="158" fontSize="11" fill="#7d879b">400</text>
              <text x="8" y="108" fontSize="11" fill="#7d879b">600</text>
              <text x="8" y="58" fontSize="11" fill="#7d879b">800</text>
              <text x="5" y="18" fontSize="11" fill="#7d879b">1000</text>

              <text x="72" y="280" fontSize="11" fill="#7d879b">{trend.labels[0]}</text>
              <text x="180" y="280" fontSize="11" fill="#7d879b">{trend.labels[1]}</text>
              <text x="288" y="280" fontSize="11" fill="#7d879b">{trend.labels[2]}</text>
              <text x="396" y="280" fontSize="11" fill="#7d879b">{trend.labels[3]}</text>
              <text x="504" y="280" fontSize="11" fill="#7d879b">{trend.labels[4]}</text>
              <text x="612" y="280" fontSize="11" fill="#7d879b">{trend.labels[5]}</text>
            </svg>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm font-semibold text-[#2d3950]">
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

        <article className="dashboard-card animate-dash-in rounded-xl border border-[#dee1e8] bg-[#f7f8fc] p-4 shadow-sm" style={{ animationDelay: '300ms' }}>
          <h2 className="text-sm font-bold text-[#1f2737]">Revenue by Category</h2>
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
                <p className="text-sm text-[#7f899e]">Total</p>
                <p className="mt-1 text-[2.2rem] font-bold text-[#1f2737]">100%</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-[#f4f6fa] px-3 py-3">
              <p className="text-sm text-[#7f899e]">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#22449d]" />
                Corporate
              </p>
              <p className="text-sm font-semibold text-[#1f2737]">35%</p>
            </div>
            <div className="rounded-lg bg-[#f4f6fa] px-3 py-3">
              <p className="text-sm text-[#7f899e]">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#0f8f84]" />
                Trip
              </p>
              <p className="text-sm font-semibold text-[#1f2737]">25%</p>
            </div>
            <div className="rounded-lg bg-[#f4f6fa] px-3 py-3">
              <p className="text-sm text-[#7f899e]">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#3b82f6]" />
                Highway
              </p>
              <p className="text-sm font-semibold text-[#1f2737]">25%</p>
            </div>
            <div className="rounded-lg bg-[#f4f6fa] px-3 py-3">
              <p className="text-sm text-[#7f899e]">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                Long-distance
              </p>
              <p className="text-sm font-semibold text-[#1f2737]">15%</p>
            </div>
          </div>
        </article>
      </div>

      <article className="mt-3 dashboard-card animate-dash-in overflow-hidden rounded-xl border border-[#dee1e8] bg-[#f7f8fc] shadow-sm" style={{ animationDelay: '340ms' }}>
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-bold text-[#1f2737]">Recent Bookings</h2>
          <button
            type="button"
            onClick={() => navigate('/dashboard/booking')}
            className="text-sm font-semibold text-[#2642a6]"
          >
            View All
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px]">
            <thead>
              <tr className="bg-[#f1f4fa] text-left text-sm text-[#616f88]">
                <th className="px-4 py-3 font-semibold">Booking ID</th>
                <th className="px-4 py-3 font-semibold">Passenger</th>
                <th className="px-4 py-3 font-semibold">Route</th>
                <th className="px-4 py-3 font-semibold">Date & Time</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.map((row) => (
                <tr key={row.id} className="border-b border-[#e8ebf2] text-sm text-[#2a3448]">
                  <td className="px-4 py-3 font-semibold text-[#2642a6]">{row.id}</td>
                  <td className="px-4 py-3">{row.passenger}</td>
                  <td className="px-4 py-3 text-[#7d879b]">{row.route}</td>
                  <td className="px-4 py-3 text-[#7d879b]">
                    <span className="inline-flex items-center gap-2">
                      <FontAwesomeIcon icon={faCalendarDays} className="text-[#9ca3af]" />
                      {row.date}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{row.amount}</td>
                  <td className="px-4 py-3">
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
