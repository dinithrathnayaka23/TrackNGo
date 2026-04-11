import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  faBook,
  faBus,
  faChartColumn,
  faChartSimple,
  faComment,
  faDownload,
  faLocationDot,
  faTicket,
  faTriangleExclamation,
  faUsers,
  faWallet,
  faReceipt,
  faArrowUp,
  faArrowDown,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import Navbar from '../../components/layout/Navbar'
import Sidebar, { type SidebarMenuItem } from '../../components/layout/Sidebar'
import { logoutToLogin } from '../../utils/authSession'

type StatCard = {
  title: string
  value: string
  trend: string
  trendUp: boolean
  icon: typeof faBus
  iconWrap: string
}

type BookingTypeStatusRow = {
  type: string
  completed: number
  pending: number
  cancelled: number
}

type RangeKey = '7d' | '30d' | '3m' | 'custom'
type SeriesKey = 'total' | 'highway' | 'longDistance' | 'corporate'
type ChartRangeConfig = {
  labels: string[]
  yMax: number
  yTicks: number[]
  series: Record<SeriesKey, number[]>
}

type DailyAnalyticsPoint = {
  date: string
  total: number
  highway: number
  longDistance: number
  corporate: number
  bookings: number
  users: number
}

const mainMenu: SidebarMenuItem[] = [
  { label: 'Dashboard', icon: faChartSimple },
  { label: 'Users', icon: faUsers },
  { label: 'Buses', icon: faBus, path: '/dashboard/buses' },
  { label: 'Routes', icon: faLocationDot, path: '/dashboard/routes' },
  { label: 'Bookings', icon: faBook },
]

const systemMenu: SidebarMenuItem[] = [
  { label: 'Complaints', icon: faTriangleExclamation },
  { label: 'Analytics', icon: faChartColumn, active: true, path: '/dashboard/analytics' },
  { label: 'Chat', icon: faComment, path: '/dashboard/chat' },
]

const statByRange: Record<RangeKey, StatCard[]> = {
  '7d': [
    { title: 'Total Bookings', value: '3,240', trend: '+6% vs last period', trendUp: true, icon: faTicket, iconWrap: 'bg-[#e8eeff] text-[#2f4fb5]' },
    { title: 'Total Revenue', value: 'Rs. 1.4M', trend: '+9% vs last period', trendUp: true, icon: faWallet, iconWrap: 'bg-[#e6f7ee] text-[#1aa56e]' },
    { title: 'Active Users', value: '4,180', trend: '+3% vs last period', trendUp: true, icon: faUsers, iconWrap: 'bg-[#f1e8ff] text-[#8b3fd9]' },
    { title: 'Avg. Booking Value', value: 'Rs. 432', trend: '-1% vs last period', trendUp: false, icon: faReceipt, iconWrap: 'bg-[#fff2e3] text-[#e68d10]' },
  ],
  '30d': [
    { title: 'Total Bookings', value: '15,450', trend: '+12% vs last period', trendUp: true, icon: faTicket, iconWrap: 'bg-[#e8eeff] text-[#2f4fb5]' },
    { title: 'Total Revenue', value: 'Rs. 6.8M', trend: '+18% vs last period', trendUp: true, icon: faWallet, iconWrap: 'bg-[#e6f7ee] text-[#1aa56e]' },
    { title: 'Active Users', value: '12,450', trend: '+8% vs last period', trendUp: true, icon: faUsers, iconWrap: 'bg-[#f1e8ff] text-[#8b3fd9]' },
    { title: 'Avg. Booking Value', value: 'Rs. 440', trend: '-2% vs last period', trendUp: false, icon: faReceipt, iconWrap: 'bg-[#fff2e3] text-[#e68d10]' },
  ],
  '3m': [
    { title: 'Total Bookings', value: '47,920', trend: '+21% vs last period', trendUp: true, icon: faTicket, iconWrap: 'bg-[#e8eeff] text-[#2f4fb5]' },
    { title: 'Total Revenue', value: 'Rs. 19.2M', trend: '+25% vs last period', trendUp: true, icon: faWallet, iconWrap: 'bg-[#e6f7ee] text-[#1aa56e]' },
    { title: 'Active Users', value: '28,900', trend: '+11% vs last period', trendUp: true, icon: faUsers, iconWrap: 'bg-[#f1e8ff] text-[#8b3fd9]' },
    { title: 'Avg. Booking Value', value: 'Rs. 401', trend: '-4% vs last period', trendUp: false, icon: faReceipt, iconWrap: 'bg-[#fff2e3] text-[#e68d10]' },
  ],
  custom: [
    { title: 'Total Bookings', value: '9,870', trend: '+4% vs last period', trendUp: true, icon: faTicket, iconWrap: 'bg-[#e8eeff] text-[#2f4fb5]' },
    { title: 'Total Revenue', value: 'Rs. 4.1M', trend: '+5% vs last period', trendUp: true, icon: faWallet, iconWrap: 'bg-[#e6f7ee] text-[#1aa56e]' },
    { title: 'Active Users', value: '9,100', trend: '+2% vs last period', trendUp: true, icon: faUsers, iconWrap: 'bg-[#f1e8ff] text-[#8b3fd9]' },
    { title: 'Avg. Booking Value', value: 'Rs. 415', trend: '-1% vs last period', trendUp: false, icon: faReceipt, iconWrap: 'bg-[#fff2e3] text-[#e68d10]' },
  ],
}

const chartConfigByRange: Record<RangeKey, ChartRangeConfig> = {
  '7d': {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    yMax: 8000,
    yTicks: [0, 2000, 4000, 6000, 8000],
    series: {
      total: [2600, 4200, 4700, 5400, 6200, 6800, 7400],
      highway: [700, 1200, 1800, 2500, 2900, 3400, 3900],
      longDistance: [1200, 2400, 2200, 3100, 3600, 4100, 4800],
      corporate: [400, 650, 900, 1200, 1100, 1600, 2200],
    },
  },
  '30d': {
    labels: ['Oct 01', 'Oct 05', 'Oct 09', 'Oct 13', 'Oct 17', 'Oct 21', 'Oct 25', 'Oct 30'],
    yMax: 20000,
    yTicks: [0, 5000, 10000, 15000, 20000],
    series: {
      total: [7000, 12500, 11000, 14500, 16000, 17500, 18800, 19500],
      highway: [1200, 3000, 4200, 3600, 7800, 6900, 10100, 11800],
      longDistance: [2100, 8100, 6300, 10400, 12200, 13900, 15600, 17100],
      corporate: [800, 1400, 2100, 2600, 2100, 4300, 3500, 6200],
    },
  },
  '3m': {
    labels: ['Nov W1', 'Nov W3', 'Dec W1', 'Dec W3', 'Jan W1', 'Jan W3'],
    yMax: 60000,
    yTicks: [0, 15000, 30000, 45000, 60000],
    series: {
      total: [22000, 28000, 33000, 42000, 50000, 56000],
      highway: [9000, 12000, 16000, 21000, 25000, 30000],
      longDistance: [11000, 17000, 22000, 26000, 31000, 36000],
      corporate: [4000, 5200, 6100, 7800, 9200, 11000],
    },
  },
  custom: {
    labels: ['Day 1', 'Day 3', 'Day 5', 'Day 7', 'Day 9', 'Day 11', 'Day 14'],
    yMax: 12000,
    yTicks: [0, 3000, 6000, 9000, 12000],
    series: {
      total: [4200, 4800, 5300, 6100, 6800, 7300, 8200],
      highway: [1400, 1800, 2200, 2500, 3000, 3400, 3900],
      longDistance: [1700, 2300, 2700, 3300, 3700, 4200, 4800],
      corporate: [700, 900, 1200, 1300, 1650, 1900, 2400],
    },
  },
}

const generateDailyAnalytics = (): DailyAnalyticsPoint[] => {
  const start = new Date('2025-10-01')
  return Array.from({ length: 140 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)

    const highway = 1800 + ((index * 73) % 2200)
    const longDistance = 2200 + ((index * 61) % 2600)
    const corporate = 700 + ((index * 43) % 1200)
    const total = highway + longDistance + corporate
    const bookings = 140 + ((index * 19) % 230)
    const users = 700 + ((index * 17) % 900)

    return {
      date: date.toISOString().slice(0, 10),
      total,
      highway,
      longDistance,
      corporate,
      bookings,
      users,
    }
  })
}

const dailyAnalyticsData = generateDailyAnalytics()

const formatLabel = (isoDate: string) => {
  const date = new Date(isoDate)
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
}

const buildCustomChartConfig = (points: DailyAnalyticsPoint[]): ChartRangeConfig => {
  const safePoints = points.length ? points : dailyAnalyticsData.slice(-14)
  const sampleCount = Math.min(8, safePoints.length)
  const selected = Array.from({ length: sampleCount }, (_, idx) => {
    if (sampleCount === 1) {
      return safePoints[0]
    }
    const position = Math.round((idx * (safePoints.length - 1)) / (sampleCount - 1))
    return safePoints[position]
  })

  const maxValue = Math.max(...selected.map((item) => item.total), 1000)
  const yMax = Math.ceil(maxValue / 1000) * 1000
  const tickStep = Math.max(1000, Math.round(yMax / 4 / 500) * 500)
  const yTicks = [0, tickStep, tickStep * 2, tickStep * 3, tickStep * 4]

  return {
    labels: selected.map((item) => formatLabel(item.date)),
    yMax: yTicks[4],
    yTicks,
    series: {
      total: selected.map((item) => item.total),
      highway: selected.map((item) => item.highway),
      longDistance: selected.map((item) => item.longDistance),
      corporate: selected.map((item) => item.corporate),
    },
  }
}

const bookingTypeStatusByRange: Record<'7d' | '30d' | '3m', BookingTypeStatusRow[]> = {
  '7d': [
    { type: 'Highway', completed: 980, pending: 250, cancelled: 66 },
    { type: 'Long-distance', completed: 620, pending: 100, cancelled: 58 },
    { type: 'Trip Bookings', completed: 310, pending: 72, cancelled: 39 },
    { type: 'Corporate', completed: 230, pending: 38, cancelled: 31 },
  ],
  '30d': [
    { type: 'Highway', completed: 4120, pending: 1060, cancelled: 310 },
    { type: 'Long-distance', completed: 2680, pending: 400, cancelled: 180 },
    { type: 'Trip Bookings', completed: 1330, pending: 160, cancelled: 100 },
    { type: 'Corporate', completed: 980, pending: 120, cancelled: 60 },
  ],
  '3m': [
    { type: 'Highway', completed: 12600, pending: 3150, cancelled: 980 },
    { type: 'Long-distance', completed: 8240, pending: 1060, cancelled: 540 },
    { type: 'Trip Bookings', completed: 4080, pending: 610, cancelled: 320 },
    { type: 'Corporate', completed: 3010, pending: 300, cancelled: 180 },
  ],
}

function Analytics() {
  const navigate = useNavigate()
  // UI controls for filters, graph series visibility, and lightweight notifications.
  const [activeRange, setActiveRange] = useState<RangeKey>('30d')
  const [searchQuery, setSearchQuery] = useState('')
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({
    total: true,
    highway: true,
    longDistance: true,
    corporate: true,
  })
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(2)
  const [customFrom, setCustomFrom] = useState('2025-10-20')
  const [customTo, setCustomTo] = useState('2025-11-03')
  const [customPeriod, setCustomPeriod] = useState({ from: '2025-10-20', to: '2025-11-03' })

  const handleLogout = () => {
    logoutToLogin(navigate)
  }

  // Derive chart input points only when the selected custom period changes.
  const customPeriodPoints = useMemo(
    () =>
      dailyAnalyticsData.filter((item) => item.date >= customPeriod.from && item.date <= customPeriod.to),
    [customPeriod],
  )

  const customChartConfig = useMemo(
    () => buildCustomChartConfig(customPeriodPoints),
    [customPeriodPoints],
  )

  // Compute range-specific KPI cards from raw daily points.
  const customStats = useMemo(() => {
    const points = customPeriodPoints.length ? customPeriodPoints : dailyAnalyticsData.slice(-14)
    const previousWindow = dailyAnalyticsData.filter(
      (item) => item.date < points[0].date,
    ).slice(-points.length)

    const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0)
    const bookings = sum(points.map((item) => item.bookings))
    const revenue = sum(points.map((item) => item.total))
    const usersAvg = Math.round(sum(points.map((item) => item.users)) / points.length)
    const avgBookingValue = Math.round(revenue / Math.max(bookings, 1))

    const prevBookings = sum(previousWindow.map((item) => item.bookings))
    const prevRevenue = sum(previousWindow.map((item) => item.total))
    const prevUsersAvg = previousWindow.length
      ? Math.round(sum(previousWindow.map((item) => item.users)) / previousWindow.length)
      : usersAvg
    const prevAvgBookingValue = Math.round(prevRevenue / Math.max(prevBookings, 1))

    const trend = (current: number, previous: number) => {
      if (previous === 0) {
        return { text: '+0% vs last period', up: true }
      }
      const change = ((current - previous) / previous) * 100
      const rounded = Math.abs(Math.round(change))
      return {
        text: `${change >= 0 ? '+' : '-'}${rounded}% vs last period`,
        up: change >= 0,
      }
    }

    const bookingsTrend = trend(bookings, prevBookings)
    const revenueTrend = trend(revenue, prevRevenue)
    const usersTrend = trend(usersAvg, prevUsersAvg)
    const avgValueTrend = trend(avgBookingValue, prevAvgBookingValue)

    return {
      cards: [
        {
          title: 'Total Bookings',
          value: bookings.toLocaleString(),
          trend: bookingsTrend.text,
          trendUp: bookingsTrend.up,
          icon: faTicket,
          iconWrap: 'bg-[#e8eeff] text-[#2f4fb5]',
        },
        {
          title: 'Total Revenue',
          value: `Rs. ${(revenue / 1000000).toFixed(1)}M`,
          trend: revenueTrend.text,
          trendUp: revenueTrend.up,
          icon: faWallet,
          iconWrap: 'bg-[#e6f7ee] text-[#1aa56e]',
        },
        {
          title: 'Active Users',
          value: usersAvg.toLocaleString(),
          trend: usersTrend.text,
          trendUp: usersTrend.up,
          icon: faUsers,
          iconWrap: 'bg-[#f1e8ff] text-[#8b3fd9]',
        },
        {
          title: 'Avg. Booking Value',
          value: `Rs. ${avgBookingValue.toLocaleString()}`,
          trend: avgValueTrend.text,
          trendUp: avgValueTrend.up,
          icon: faReceipt,
          iconWrap: 'bg-[#fff2e3] text-[#e68d10]',
        },
      ] as StatCard[],
      totalBookings: bookings,
    }
  }, [customPeriodPoints])

  const stats = activeRange === 'custom' ? customStats.cards : statByRange[activeRange]
  const bookingTypeStatusRows = useMemo(() => {
    if (activeRange !== 'custom') {
      return bookingTypeStatusByRange[activeRange]
    }

    const total = customStats.totalBookings
    const mix = [
      { type: 'Highway', share: 0.45 },
      { type: 'Long-distance', share: 0.3 },
      { type: 'Trip Bookings', share: 0.15 },
      { type: 'Corporate', share: 0.1 },
    ]
    return mix.map((item) => {
      const typeTotal = Math.round(total * item.share)
      const completed = Math.round(typeTotal * 0.75)
      const pending = Math.round(typeTotal * 0.18)
      const cancelled = Math.max(0, typeTotal - completed - pending)
      return { type: item.type, completed, pending, cancelled }
    })
  }, [activeRange, customStats.totalBookings])
  const chartConfig = activeRange === 'custom' ? customChartConfig : chartConfigByRange[activeRange]
  const chartXStart = 110
  const chartXEnd = 1120
  const chartYTop = 40
  const chartYBottom = 300

  const getXPosition = (index: number) => {
    if (chartConfig.labels.length <= 1) {
      return (chartXStart + chartXEnd) / 2
    }
    const step = (chartXEnd - chartXStart) / (chartConfig.labels.length - 1)
    return chartXStart + step * index
  }

  const getYPosition = (value: number) =>
    chartYBottom - (value / chartConfig.yMax) * (chartYBottom - chartYTop)

  const buildPolylinePoints = (values: number[]) =>
    values.map((value, index) => `${getXPosition(index)},${getYPosition(value)}`).join(' ')

  const handleMenuAction = (label: string) => {
    // Placeholder for future route wiring.
    setToastMessage(`${label} page coming soon.`)
  }

  const handleExport = () => {
    setToastMessage(`Dummy export complete for ${activeRange.toUpperCase()} range.`)
  }

  const handleDownloadRevenueTrends = () => {
    const headers: string[] = ['Label']
    if (visibleSeries.total) headers.push('Total')
    if (visibleSeries.highway) headers.push('Highway')
    if (visibleSeries.longDistance) headers.push('Long-Distance')
    if (visibleSeries.corporate) headers.push('Corporate')

    const rows = chartConfig.labels.map((label, index) => {
      const row: string[] = [label]
      if (visibleSeries.total) row.push(String(chartConfig.series.total[index] ?? 0))
      if (visibleSeries.highway) row.push(String(chartConfig.series.highway[index] ?? 0))
      if (visibleSeries.longDistance) row.push(String(chartConfig.series.longDistance[index] ?? 0))
      if (visibleSeries.corporate) row.push(String(chartConfig.series.corporate[index] ?? 0))
      return row
    })

    const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = `revenue-trends-${activeRange}.csv`
    link.click()
    URL.revokeObjectURL(url)
    setToastMessage('Revenue trends CSV downloaded.')
  }

  const applyCustomPeriod = () => {
    if (!customFrom || !customTo) {
      setToastMessage('Please select both start and end dates.')
      return
    }
    if (customFrom > customTo) {
      setToastMessage('Start date must be before end date.')
      return
    }
    setCustomPeriod({ from: customFrom, to: customTo })
    setToastMessage(`Applied custom range: ${customFrom} to ${customTo}`)
  }

  const toggleSeries = (series: SeriesKey) => {
    setVisibleSeries((current) => ({ ...current, [series]: !current[series] }))
  }

  return (
    <div className="h-screen bg-[#efeff4]">
      <Sidebar mainMenu={mainMenu} systemMenu={systemMenu} onMenuAction={handleMenuAction} />

      <div className="ml-0 flex h-screen flex-col lg:ml-60">
        <Navbar
          breadcrumbs={['Home', 'Analytics']}
          onLogout={handleLogout}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          unreadCount={unreadCount}
          onToggleNotifications={() => setNotificationOpen((value) => !value)}
          notificationPanel={notificationOpen ? (
            <div className="absolute right-0 top-12 z-30 w-72 rounded-xl border border-[#dce1eb] bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-[#2b3448]">Notifications</p>
                <button
                  type="button"
                  onClick={() => setUnreadCount(0)}
                  className="text-xs font-semibold text-[#2642a6]"
                >
                  Mark all read
                </button>
              </div>
              <div className="space-y-2 text-sm text-[#546078]">
                <p className="rounded-md bg-[#f2f5fb] p-2">Revenue target reached 78%.</p>
                <p className="rounded-md bg-[#f2f5fb] p-2">3 new complaints need review.</p>
              </div>
            </div>
          ) : null}
        />

        <main className="flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-7xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="animate-dash-in text-base font-extrabold tracking-tight text-[#1f2737]" style={{ animationDelay: '70ms' }}>
                Analytics & Insights
              </h1>

              <div className="animate-dash-in flex items-center gap-3" style={{ animationDelay: '90ms' }}>
                <div className="flex items-center rounded-lg border border-[#d8deea] bg-[#f7f8fc] p-1 text-xs font-semibold text-[#5e6a82]">
                  {[
                    { label: '7 Days', value: '7d' as RangeKey },
                    { label: '30 Days', value: '30d' as RangeKey },
                    { label: '3 Months', value: '3m' as RangeKey },
                    { label: 'Custom', value: 'custom' as RangeKey },
                  ].map((range) => (
                    <button
                      key={range.value}
                      type="button"
                      onClick={() => {
                        setActiveRange(range.value)
                        setToastMessage(`Applied ${range.label} range.`)
                      }}
                      className={[
                        'rounded-md px-3 py-2 transition duration-200',
                        activeRange === range.value ? 'bg-[#e8edff] text-[#2f4fb5]' : 'hover:bg-[#eef2fa]',
                      ].join(' ')}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleExport}
                  className="flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96]"
                >
                  <FontAwesomeIcon icon={faDownload} />
                  Export All Data
                </button>
              </div>
            </div>

            {activeRange === 'custom' ? (
              <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#d8deea] bg-[#f7f8fc] p-3">
                <div>
                  <label htmlFor="custom-from" className="mb-1 block text-xs font-semibold text-[#5e6a82]">
                    From
                  </label>
                  <input
                    id="custom-from"
                    type="date"
                    value={customFrom}
                    onChange={(event) => setCustomFrom(event.target.value)}
                    className="h-8 rounded-lg border border-[#d8deea] bg-white px-3 text-sm text-[#2f394d] outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="custom-to" className="mb-1 block text-xs font-semibold text-[#5e6a82]">
                    To
                  </label>
                  <input
                    id="custom-to"
                    type="date"
                    value={customTo}
                    onChange={(event) => setCustomTo(event.target.value)}
                    className="h-8 rounded-lg border border-[#d8deea] bg-white px-3 text-sm text-[#2f394d] outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyCustomPeriod}
                  className="h-8 rounded-lg bg-[#2642a6] px-4 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96]"
                >
                  Apply Period
                </button>
              </div>
            ) : null}

            <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((card, index) => (
                <article
                  key={card.title}
                  className="dashboard-card animate-dash-in rounded-xl border border-[#dee1e8] bg-[#f7f8fc] p-4 shadow-sm"
                  style={{ animationDelay: `${120 + index * 40}ms` }}
                >
                  <div className="mb-2 flex items-start justify-between">
                    <p className="text-xs font-semibold text-[#758098]">{card.title}</p>
                    <div className={['grid h-7 w-7 place-items-center rounded-md text-xs', card.iconWrap].join(' ')}>
                      <FontAwesomeIcon icon={card.icon} />
                    </div>
                  </div>
                  <p className="text-sm font-extrabold leading-none text-[#1f2737]">{card.value}</p>
                  <p className={['mt-1.5 text-xs font-semibold', card.trendUp ? 'text-[#11a765]' : 'text-[#d74949]'].join(' ')}>
                    <FontAwesomeIcon icon={card.trendUp ? faArrowUp : faArrowDown} className="mr-1 text-xs" />
                    {card.trend}
                  </p>
                </article>
              ))}
            </section>

            <section className="dashboard-card animate-dash-in rounded-xl border border-[#dee1e8] bg-[#f7f8fc] p-4 shadow-sm" style={{ animationDelay: '260ms' }}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[#1f2737]">Revenue Trends</h2>
                  <p className="text-sm text-[#7f899e]">Breakdown of revenue streams over time</p>
                </div>

                <div className="flex items-center gap-3 text-sm text-[#5d6880]">
                  {[
                    { key: 'total' as SeriesKey, color: '#2741a0', label: 'Total', lineClass: 'chart-line-1' },
                    { key: 'highway' as SeriesKey, color: '#19a19a', label: 'Highway', lineClass: 'chart-line-2' },
                    { key: 'longDistance' as SeriesKey, color: '#ab9833', label: 'Long-Distance', lineClass: 'chart-line-3' },
                    { key: 'corporate' as SeriesKey, color: '#b77ae6', label: 'Corporate', lineClass: 'chart-line-4' },
                  ].map((series) => (
                    <button
                      key={series.key}
                      type="button"
                      onClick={() => toggleSeries(series.key)}
                      className={[
                        'flex items-center gap-2 rounded-md px-2 py-1 transition duration-200',
                        visibleSeries[series.key] ? 'bg-[#eef2fa]' : 'opacity-50',
                      ].join(' ')}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />
                      {series.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleDownloadRevenueTrends}
                    className="ml-1 flex items-center gap-2 rounded-md border border-[#d5dbea] bg-white px-3 py-1.5 text-xs font-bold text-[#2642a6] transition duration-200 hover:bg-[#f3f6fc]"
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    Download
                  </button>
                </div>
              </div>

              <svg viewBox="0 0 1200 360" className="h-[240px] w-full rounded-xl bg-[#fafbff]" role="img" aria-label="Revenue trends chart">
                <line x1="70" y1="40" x2="70" y2="300" stroke="#d6dce8" />
                <line x1="70" y1="300" x2="1140" y2="300" stroke="#d6dce8" />
                {chartConfig.yTicks
                  .filter((tick) => tick > 0)
                  .map((tick) => (
                    <line key={tick} x1="70" y1={getYPosition(tick)} x2="1140" y2={getYPosition(tick)} stroke="#e4e8f1" />
                  ))}

                {visibleSeries.total ? <polyline className="chart-line-1" fill="none" stroke="#2741a0" strokeWidth="3" points={buildPolylinePoints(chartConfig.series.total)} /> : null}
                {visibleSeries.highway ? <polyline className="chart-line-2" fill="none" stroke="#19a19a" strokeWidth="3" points={buildPolylinePoints(chartConfig.series.highway)} /> : null}
                {visibleSeries.longDistance ? <polyline className="chart-line-3" fill="none" stroke="#ab9833" strokeWidth="3" points={buildPolylinePoints(chartConfig.series.longDistance)} /> : null}
                {visibleSeries.corporate ? <polyline className="chart-line-4" fill="none" stroke="#b77ae6" strokeWidth="3" points={buildPolylinePoints(chartConfig.series.corporate)} /> : null}

                <g fill="#7d879b" fontSize="12">
                  {chartConfig.yTicks.map((tick) => (
                    <text key={tick} x="62" y={getYPosition(tick) + 4} textAnchor="end">
                      {tick.toLocaleString()}
                    </text>
                  ))}
                </g>
                <g fill="#7d879b" fontSize="12">
                  {chartConfig.labels.map((label, index) => (
                    <text key={label} x={getXPosition(index)} y="330" textAnchor="middle">
                      {label}
                    </text>
                  ))}
                </g>
              </svg>
            </section>

            <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <article className="dashboard-card animate-dash-in rounded-xl border border-[#dee1e8] bg-[#f7f8fc] p-4 shadow-sm" style={{ animationDelay: '300ms' }}>
                <h2 className="text-sm font-bold text-[#1f2737]">Bookings by Category</h2>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                <div className="animate-analytics-ring grid h-36 w-36 place-items-center rounded-full bg-[conic-gradient(#2741a0_0deg_162deg,#19a19a_162deg_270deg,#f1a21a_270deg_324deg,#5b64e5_324deg_360deg)]">
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-[#f7f8fc] text-center">
                      <p className="text-sm font-extrabold leading-none text-[#1f2737]">
                        {activeRange === '3m'
                          ? '47.9K'
                          : activeRange === '7d'
                            ? '3.2K'
                            : activeRange === 'custom'
                              ? `${(customStats.totalBookings / 1000).toFixed(1)}K`
                              : '15.4K'}
                      </p>
                      <p className="text-xs font-semibold text-[#7f899e]">Total</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <p className="flex items-center gap-2 text-[#2d3950]"><span className="h-3 w-3 rounded-sm bg-[#2741a0]" /> Highway <span className="font-bold">45%</span></p>
                    <p className="flex items-center gap-2 text-[#2d3950]"><span className="h-3 w-3 rounded-sm bg-[#19a19a]" /> Long-distance <span className="font-bold">30%</span></p>
                    <p className="flex items-center gap-2 text-[#2d3950]"><span className="h-3 w-3 rounded-sm bg-[#f1a21a]" /> Trip bookings <span className="font-bold">15%</span></p>
                    <p className="flex items-center gap-2 text-[#2d3950]"><span className="h-3 w-3 rounded-sm bg-[#5b64e5]" /> Corporate <span className="font-bold">10%</span></p>
                  </div>
                </div>
              </article>

              <article className="dashboard-card animate-dash-in rounded-xl border border-[#dee1e8] bg-[#f7f8fc] p-4 shadow-sm" style={{ animationDelay: '340ms' }}>
                <h2 className="text-sm font-bold text-[#1f2737]">Booking Status Overview</h2>
                <p className="mt-1 text-sm text-[#7f899e]">Completed and cancelled counts by booking type.</p>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full min-w-[620px]">
                    <thead>
                      <tr className="bg-[#f1f4fa] text-left text-sm text-[#616f88]">
                        <th className="px-4 py-3 font-semibold">Booking Type</th>
                        <th className="px-4 py-3 font-semibold text-[#1bb37f]">Completed</th>
                        <th className="px-4 py-3 font-semibold text-[#eb4f59]">Cancelled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookingTypeStatusRows.map((row) => (
                        <tr key={row.type} className="border-b border-[#e8ebf2] text-[#2a3448]">
                          <td className="px-4 py-3 text-sm font-semibold">{row.type}</td>
                          <td className="px-4 py-3 text-sm font-bold text-[#1bb37f]">{row.completed.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm font-bold text-[#eb4f59]">{row.cancelled.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>

          </div>
        </main>
      </div>

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-[#d8deea] bg-white px-4 py-3 shadow-lg">
          <p className="text-sm font-semibold text-[#2f394d]">{toastMessage}</p>
          <button type="button" onClick={() => setToastMessage(null)} className="text-[#5f6b82]">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default Analytics