import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  faBell,
  faBook,
  faBus,
  faChartColumn,
  faChartSimple,
  faComment,
  faDownload,
  faLocationDot,
  faMagnifyingGlass,
  faSignOutAlt,
  faTicket,
  faTriangleExclamation,
  faUsers,
  faWallet,
  faReceipt,
  faArrowUp,
  faArrowDown,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import adminProfileImage from '../../assets/images/adminProfile.png'

type MenuItem = {
  label: string
  icon: typeof faBus
  active?: boolean
  path?: string
}

type StatCard = {
  title: string
  value: string
  trend: string
  trendUp: boolean
  icon: typeof faBus
  iconWrap: string
}

type RoutePerformanceRow = {
  routeName: string
  totalBookings: string
  revenue: string
  rating: string
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

const mainMenu: MenuItem[] = [
  { label: 'Dashboard', icon: faChartSimple },
  { label: 'Users', icon: faUsers },
  { label: 'Buses', icon: faBus, path: '/dashboard/buses' },
  { label: 'Routes', icon: faLocationDot, path: '/dashboard/routes' },
  { label: 'Bookings', icon: faBook },
]

const systemMenu: MenuItem[] = [
  { label: 'Complaints', icon: faTriangleExclamation },
  { label: 'Analytics', icon: faChartColumn, active: true, path: '/dashboard/analytics' },
  { label: 'Chat', icon: faComment },
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

const allRouteRows: RoutePerformanceRow[] = [
  { routeName: 'Colombo - Kandy (Express)', totalBookings: '1,245', revenue: 'Rs. 850K', rating: '4.8 *' },
  { routeName: 'Colombo - Galle (Highway)', totalBookings: '980', revenue: 'Rs. 620K', rating: '4.7 *' },
  { routeName: 'Jaffna - Colombo', totalBookings: '650', revenue: 'Rs. 950K', rating: '4.5 *' },
  { routeName: 'Matara - Colombo', totalBookings: '540', revenue: 'Rs. 410K', rating: '4.2 *' },
  { routeName: 'Kandy - Negombo', totalBookings: '430', revenue: 'Rs. 310K', rating: '4.1 *' },
  { routeName: 'Colombo - Kurunegala', totalBookings: '390', revenue: 'Rs. 270K', rating: '4.0 *' },
  { routeName: 'Badulla - Colombo', totalBookings: '360', revenue: 'Rs. 340K', rating: '4.3 *' },
  { routeName: 'Galle - Matara', totalBookings: '330', revenue: 'Rs. 190K', rating: '3.9 *' },
]

function MenuSection({
  title,
  items,
  onMenuAction,
}: {
  title: string
  items: MenuItem[]
  onMenuAction: (label: string) => void
}) {
  return (
    <div>
      <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-wide text-[#9aa5bc]">{title}</p>
      <div className="space-y-1">
        {items.map((item) => {
          const itemClass = [
            'flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left text-[15px] font-semibold transition duration-200',
            item.active
              ? 'bg-[#2642a6] text-white shadow-[0_8px_16px_rgba(23,38,96,0.35)]'
              : 'text-[#d6dded] hover:bg-[#243456]',
          ].join(' ')

          if (item.path) {
            return (
              <Link key={item.label} to={item.path} className={itemClass}>
                <FontAwesomeIcon icon={item.icon} className="text-sm" />
                <span>{item.label}</span>
              </Link>
            )
          }

          return (
            <button
              type="button"
              key={item.label}
              className={itemClass}
              onClick={() => onMenuAction(item.label)}
            >
              <FontAwesomeIcon icon={item.icon} className="text-sm" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Analytics() {
  const navigate = useNavigate()
  const [activeRange, setActiveRange] = useState<RangeKey>('30d')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAllRoutes, setShowAllRoutes] = useState(false)
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
    localStorage.removeItem('authToken')
    localStorage.removeItem('admin')
    sessionStorage.removeItem('authToken')
    sessionStorage.removeItem('admin')
    navigate('/login', { replace: true })
  }

  const customPeriodPoints = useMemo(
    () =>
      dailyAnalyticsData.filter((item) => item.date >= customPeriod.from && item.date <= customPeriod.to),
    [customPeriod],
  )

  const customChartConfig = useMemo(
    () => buildCustomChartConfig(customPeriodPoints),
    [customPeriodPoints],
  )

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

  const filteredRoutes = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase()
    const rows = normalized.length
      ? allRouteRows.filter((row) => row.routeName.toLowerCase().includes(normalized))
      : allRouteRows
    return showAllRoutes ? rows : rows.slice(0, 5)
  }, [searchQuery, showAllRoutes])

  const handleMenuAction = (label: string) => {
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
    <div className="h-screen bg-[#efeff4]" style={{ fontFamily: 'Manrope, Segoe UI, sans-serif' }}>
      <aside className="fixed inset-y-0 left-0 z-20 w-[314px] border-r border-[#2f3f61] bg-[#1c2a44]">
        <div className="flex h-full flex-col">
          <div className="animate-dash-in border-b border-[#2f3f61] px-6 py-5" style={{ animationDelay: '20ms' }}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-[#2b4cad] text-white">
                <FontAwesomeIcon icon={faBus} className="text-lg" />
              </div>
              <span className="text-[32px] font-extrabold tracking-tight text-white">TrackNGo</span>
            </div>
          </div>

          <div className="flex-1 space-y-8 overflow-y-auto px-4 py-5">
            <div className="animate-dash-in" style={{ animationDelay: '80ms' }}>
              <MenuSection title="Main Menu" items={mainMenu} onMenuAction={handleMenuAction} />
            </div>
            <div className="animate-dash-in" style={{ animationDelay: '120ms' }}>
              <MenuSection title="System" items={systemMenu} onMenuAction={handleMenuAction} />
            </div>
          </div>

          <div className="animate-dash-in border-t border-[#2f3f61] p-4" style={{ animationDelay: '150ms' }}>
            <div className="flex items-center gap-3 rounded-lg bg-[#c8cdd8] px-3 py-2">
              <img
                src={adminProfileImage}
                alt="Administrator profile avatar"
                className="h-12 w-12 rounded-full object-cover"
              />
              <div>
                <p className="text-sm font-bold text-[#222a3b]">Dinith Rathnayaka</p>
                <p className="text-sm text-[#5c6679]">Admin</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="ml-[314px] flex h-screen flex-col">
        <header className="animate-dash-in z-10 flex h-[78px] shrink-0 items-center justify-between border-b border-[#dfe1e8] bg-[#f7f7fa] px-8" style={{ animationDelay: '40ms' }}>
          <div className="flex items-center gap-3 text-sm text-[#6a7284]">
            <span>Home</span>
            <span>{'>'}</span>
            <span className="font-bold text-[#2b3448]">Analytics</span>
          </div>

          <div className="w-full max-w-[560px] px-6">
            <div className="flex h-12 items-center gap-3 rounded-xl bg-[#eef0f5] px-4 text-[#7d8798]">
              <FontAwesomeIcon icon={faMagnifyingGlass} />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full bg-transparent text-sm text-[#2f394d] outline-none"
                placeholder="Search buses, drivers, or routes..."
              />
            </div>
          </div>

          <div className="relative flex items-center gap-8">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg bg-[#2642a6] px-5 py-2 text-sm font-bold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#203b96]"
            >
              <FontAwesomeIcon icon={faSignOutAlt} />
              Logout
            </button>
            <button
              type="button"
              onClick={() => setNotificationOpen((value) => !value)}
              className="relative text-lg text-[#3b4253] transition duration-200 hover:scale-105"
              aria-label="Notifications"
            >
              <FontAwesomeIcon icon={faBell} />
              {unreadCount > 0 ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#f24f4f]" /> : null}
            </button>

            {notificationOpen ? (
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
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-[1700px] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="animate-dash-in text-[48px] font-extrabold tracking-tight text-[#1f2737]" style={{ animationDelay: '70ms' }}>
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
                  className="flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2.5 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96]"
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
                    className="h-10 rounded-lg border border-[#d8deea] bg-white px-3 text-sm text-[#2f394d] outline-none"
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
                    className="h-10 rounded-lg border border-[#d8deea] bg-white px-3 text-sm text-[#2f394d] outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyCustomPeriod}
                  className="h-10 rounded-lg bg-[#2642a6] px-4 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96]"
                >
                  Apply Period
                </button>
              </div>
            ) : null}

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((card, index) => (
                <article
                  key={card.title}
                  className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm"
                  style={{ animationDelay: `${120 + index * 40}ms` }}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <p className="text-sm font-semibold text-[#758098]">{card.title}</p>
                    <div className={['grid h-9 w-9 place-items-center rounded-lg text-sm', card.iconWrap].join(' ')}>
                      <FontAwesomeIcon icon={card.icon} />
                    </div>
                  </div>
                  <p className="text-[40px] font-extrabold leading-none text-[#1f2737]">{card.value}</p>
                  <p className={['mt-2 text-sm font-semibold', card.trendUp ? 'text-[#11a765]' : 'text-[#d74949]'].join(' ')}>
                    <FontAwesomeIcon icon={card.trendUp ? faArrowUp : faArrowDown} className="mr-1 text-xs" />
                    {card.trend}
                  </p>
                </article>
              ))}
            </section>

            <section className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm" style={{ animationDelay: '260ms' }}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-[#1f2737]">Revenue Trends</h2>
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

              <svg viewBox="0 0 1200 360" className="h-[330px] w-full rounded-xl bg-[#fafbff]" role="img" aria-label="Revenue trends chart">
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

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm" style={{ animationDelay: '300ms' }}>
                <h2 className="text-3xl font-bold text-[#1f2737]">Bookings by Category</h2>
                <div className="mt-4 flex flex-wrap items-center gap-10">
                  <div className="animate-analytics-ring grid h-48 w-48 place-items-center rounded-full bg-[conic-gradient(#2741a0_0deg_162deg,#19a19a_162deg_270deg,#f1a21a_270deg_324deg,#5b64e5_324deg_360deg)]">
                    <div className="grid h-24 w-24 place-items-center rounded-full bg-[#f7f8fc] text-center">
                      <p className="text-[28px] font-extrabold leading-none text-[#1f2737]">
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

              <article className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm" style={{ animationDelay: '340ms' }}>
                <h2 className="text-3xl font-bold text-[#1f2737]">Booking Status Distribution</h2>
                <div className="mt-10 grid grid-cols-2 gap-4 xl:grid-cols-4">
                  {[
                    { label: 'Confirmed', value: 83, bar: '#2741a0', bg: '#dfe8fb' },
                    { label: 'Completed', value: 60, bar: '#1bb37f', bg: '#daf6ea' },
                    { label: 'Cancelled', value: 10, bar: '#eb4f59', bg: '#f8dfe2' },
                    { label: 'Pending', value: 24, bar: '#eea006', bg: '#f8efc7' },
                  ].map((item, index) => (
                    <div key={item.label} className="animate-dash-in rounded-lg border border-[#e2e6ef] bg-[#f9fafc] p-3" style={{ animationDelay: `${390 + index * 45}ms` }}>
                      <div className="relative h-28 overflow-hidden rounded-md" style={{ backgroundColor: item.bg }}>
                        <div
                          className="absolute bottom-0 left-0 right-0 rounded-md transition-all duration-300"
                          style={{ height: `${item.value}%`, backgroundColor: item.bar }}
                        />
                        <p
                          className="absolute inset-0 grid place-items-center text-4xl font-extrabold"
                          style={{ color: item.value < 30 || item.label === 'Pending' ? '#111827' : '#ffffff' }}
                        >
                          {item.value}%
                        </p>
                      </div>
                      <p className="mt-2 text-center text-sm font-semibold text-[#5f6b82]">{item.label}</p>
                    </div>
                  ))}
                </div>
              </article>
            </section>

            <section className="dashboard-card animate-dash-in rounded-2xl border border-[#dee1e8] bg-[#f7f8fc] p-5 shadow-sm" style={{ animationDelay: '460ms' }}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-3xl font-bold text-[#1f2737]">Route Performance</h2>
                <button
                  type="button"
                  onClick={() => setShowAllRoutes((value) => !value)}
                  className="text-sm font-bold text-[#2642a6] transition duration-200 hover:text-[#203b96]"
                >
                  {showAllRoutes ? 'Show Top 5' : 'View All'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px]">
                  <thead>
                    <tr className="bg-[#f1f4fa] text-left text-sm text-[#616f88]">
                      <th className="px-4 py-3 font-semibold">Route Name</th>
                      <th className="px-4 py-3 font-semibold">Total Bookings</th>
                      <th className="px-4 py-3 font-semibold">Revenue</th>
                      <th className="px-4 py-3 font-semibold">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRoutes.map((row) => (
                      <tr key={row.routeName} className="border-b border-[#e8ebf2] text-[#2a3448]">
                        <td className="px-4 py-4 text-sm font-semibold">{row.routeName}</td>
                        <td className="px-4 py-4 text-sm">{row.totalBookings}</td>
                        <td className="px-4 py-4 text-sm">{row.revenue}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-[#e6a20b]">{row.rating}</td>
                      </tr>
                    ))}
                    {filteredRoutes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-sm font-semibold text-[#6a7284]">
                          No routes match your search.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
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
