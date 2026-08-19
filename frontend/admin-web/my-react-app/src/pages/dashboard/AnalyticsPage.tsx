import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  faDownload,
  faTicket,
  faUsers,
  faWallet,
  faReceipt,
  faArrowUp,
  faArrowDown,
  faXmark,
  faRotate,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  fetchAnalytics,
  type AnalyticsResponse,
  type AnalyticsDailyPoint,
} from '../../services/analyticsService'
import { buildAnalyticsPdf } from '../../utils/analyticsPdf'

type StatCard = {
  title: string
  value: string
  trend: string
  trendUp: boolean
  icon: IconDefinition
  iconWrap: string
}

type RangeKey = '7d' | '30d' | '3m' | 'custom'
type SeriesKey = 'total' | 'highway' | 'longDistance' | 'corporate'

/** Number of points plotted on the x-axis; longer ranges are evenly sampled down to this. */
const MAX_CHART_POINTS = 8

const toIso = (date: Date) => date.toISOString().slice(0, 10)

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Maps a preset to an inclusive [from, to] pair ending today. */
const rangeToDates = (range: Exclude<RangeKey, 'custom'>) => {
  const today = new Date()
  const spanDays = range === '7d' ? 7 : range === '30d' ? 30 : 90
  return { from: toIso(addDays(today, -(spanDays - 1))), to: toIso(today) }
}

const formatLabel = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })

const formatCurrency = (value: number) => {
  if (value >= 1_000_000) return `Rs. ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `Rs. ${(value / 1_000).toFixed(1)}K`
  return `Rs. ${Math.round(value).toLocaleString()}`
}

const formatTrend = (pct: number | null) =>
  pct === null ? 'No prior period data' : `${pct >= 0 ? '+' : ''}${pct}% vs last period`

/** Evenly samples the series down to at most MAX_CHART_POINTS, always keeping first and last. */
const sampleSeries = (points: AnalyticsDailyPoint[]): AnalyticsDailyPoint[] => {
  if (points.length <= MAX_CHART_POINTS) return points
  const count = MAX_CHART_POINTS
  return Array.from({ length: count }, (_, idx) => {
    const position = Math.round((idx * (points.length - 1)) / (count - 1))
    return points[position]
  })
}

/** Rounds the axis maximum up to a clean number and derives five ticks from it. */
const buildYAxis = (maxValue: number) => {
  if (maxValue <= 0) return { yMax: 1000, yTicks: [0, 250, 500, 750, 1000] }
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)))
  const yMax = Math.ceil(maxValue / magnitude) * magnitude
  const step = yMax / 4
  return { yMax, yTicks: [0, step, step * 2, step * 3, yMax] }
}

const CATEGORY_COLORS: Record<string, string> = {
  Highway: '#2741a0',
  'Long-distance': '#19a19a',
  'Trip Bookings': '#f1a21a',
  Corporate: '#5b64e5',
}

function AnalyticsPage() {
  const [activeRange, setActiveRange] = useState<RangeKey>('30d')
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({
    total: true,
    highway: true,
    longDistance: true,
    corporate: true,
  })
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const defaultCustom = useMemo(() => rangeToDates('30d'), [])
  const [customFrom, setCustomFrom] = useState(defaultCustom.from)
  const [customTo, setCustomTo] = useState(defaultCustom.to)
  const [customPeriod, setCustomPeriod] = useState(defaultCustom)

  // Incremented by the retry button to re-run the fetch for an unchanged period.
  const [reloadCount, setReloadCount] = useState(0)
  const [result, setResult] = useState<{ key: string; data: AnalyticsResponse } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)

  const period = useMemo(
    () => (activeRange === 'custom' ? customPeriod : rangeToDates(activeRange)),
    [activeRange, customPeriod],
  )

  // Identifies the request currently in flight, so stale responses are ignored and
  // loading state is derived rather than set synchronously inside the effect.
  const periodKey = `${period.from}_${period.to}_${reloadCount}`

  useEffect(() => {
    const controller = new AbortController()
    const [from, to] = periodKey.split('_')

    fetchAnalytics(from, to, controller.signal)
      .then((response) => setResult({ key: periodKey, data: response }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setFailure({
          key: periodKey,
          message: err instanceof Error ? err.message : 'Failed to load analytics',
        })
      })

    return () => controller.abort()
  }, [periodKey])

  const data = result?.key === periodKey ? result.data : null
  const error = failure?.key === periodKey ? failure.message : null
  const loading = !data && !error

  const load = useCallback(() => setReloadCount((count) => count + 1), [])

  const chartPoints = useMemo(() => sampleSeries(data?.series ?? []), [data])

  const chartConfig = useMemo(() => {
    const labels = chartPoints.map((point) => formatLabel(point.date))
    const series = {
      total: chartPoints.map((point) => point.total),
      highway: chartPoints.map((point) => point.highway),
      longDistance: chartPoints.map((point) => point.longDistance),
      corporate: chartPoints.map((point) => point.corporate),
    }
    const visibleValues = (Object.keys(series) as SeriesKey[])
      .filter((key) => visibleSeries[key])
      .flatMap((key) => series[key])
    const { yMax, yTicks } = buildYAxis(Math.max(...visibleValues, 0))
    return { labels, series, yMax, yTicks }
  }, [chartPoints, visibleSeries])

  const stats: StatCard[] = useMemo(() => {
    const summary = data?.summary
    return [
      {
        title: 'Total Bookings',
        value: (summary?.bookings ?? 0).toLocaleString(),
        trend: formatTrend(summary?.bookingsTrendPct ?? null),
        trendUp: (summary?.bookingsTrendPct ?? 0) >= 0,
        icon: faTicket,
        iconWrap: 'bg-[#e8eeff] text-[#2f4fb5]',
      },
      {
        title: 'Total Revenue',
        value: formatCurrency(summary?.revenue ?? 0),
        trend: formatTrend(summary?.revenueTrendPct ?? null),
        trendUp: (summary?.revenueTrendPct ?? 0) >= 0,
        icon: faWallet,
        iconWrap: 'bg-[#e6f7ee] text-[#1aa56e]',
      },
      {
        title: 'Active Users',
        value: (summary?.activeUsers ?? 0).toLocaleString(),
        trend: formatTrend(summary?.activeUsersTrendPct ?? null),
        trendUp: (summary?.activeUsersTrendPct ?? 0) >= 0,
        icon: faUsers,
        iconWrap: 'bg-[#f1e8ff] text-[#8b3fd9]',
      },
      {
        title: 'Avg. Booking Value',
        value: `Rs. ${Math.round(summary?.avgBookingValue ?? 0).toLocaleString()}`,
        trend: formatTrend(summary?.avgBookingValueTrendPct ?? null),
        trendUp: (summary?.avgBookingValueTrendPct ?? 0) >= 0,
        icon: faReceipt,
        iconWrap: 'bg-[#fff2e3] text-[#e68d10]',
      },
    ]
  }, [data])

  const categoryMix = useMemo(() => data?.categoryMix ?? [], [data])
  const totalCategoryBookings = categoryMix.reduce((sum, slice) => sum + slice.bookings, 0)

  /** Builds the donut's conic-gradient stops from the real category shares. */
  const donutGradient = useMemo(() => {
    if (!totalCategoryBookings) return '#e4e8f1'
    let cursor = 0
    const stops = categoryMix.map((slice) => {
      const start = cursor
      cursor += (slice.bookings / totalCategoryBookings) * 360
      return `${CATEGORY_COLORS[slice.type] ?? '#9aa4bd'} ${start}deg ${cursor}deg`
    })
    return `conic-gradient(${stops.join(',')})`
  }, [categoryMix, totalCategoryBookings])

  const chartXStart = 110
  const chartXEnd = 1120
  const chartYTop = 40
  const chartYBottom = 300

  const getXPosition = (index: number) => {
    if (chartConfig.labels.length <= 1) return (chartXStart + chartXEnd) / 2
    const step = (chartXEnd - chartXStart) / (chartConfig.labels.length - 1)
    return chartXStart + step * index
  }

  const getYPosition = (value: number) =>
    chartYBottom - (value / chartConfig.yMax) * (chartYBottom - chartYTop)

  const buildPolylinePoints = (values: number[]) =>
    values.map((value, index) => `${getXPosition(index)},${getYPosition(value)}`).join(' ')

  const downloadCsv = (filename: string, rows: string[][]) => {
    const csv = rows.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  /**
   * Exports the full period as a PDF: headline figures, the category mix, the
   * status breakdown, and every daily point — not just the sampled chart points.
   */
  const handleExport = () => {
    if (!data) return
    buildAnalyticsPdf(data).save(`TrackNGo_Analytics_${data.from}_to_${data.to}.pdf`)
    setToastMessage(`Exported ${data.series.length} days of data as PDF.`)
  }

  const handleDownloadRevenueTrends = () => {
    if (!data) return
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

    downloadCsv(`revenue-trends-${activeRange}.csv`, [headers, ...rows])
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

  const hasData = Boolean(data && data.summary.bookings > 0)

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="animate-dash-in text-xl font-extrabold tracking-tight text-[#111827]" style={{ animationDelay: '70ms' }}>
              Analytics &amp; Insights
            </h1>
            {data ? (
              <p className="mt-0.5 text-xs text-[#64748b]">
                {data.from} to {data.to}
              </p>
            ) : null}
          </div>

          <div className="animate-dash-in flex items-center gap-3" style={{ animationDelay: '90ms' }}>
            <div className="flex items-center rounded-lg border border-[#d6dbe6] bg-[#f7f8fc] p-1 text-xs font-semibold text-[#64748b]">
              {[
                { label: '7 Days', value: '7d' as RangeKey },
                { label: '30 Days', value: '30d' as RangeKey },
                { label: '3 Months', value: '3m' as RangeKey },
                { label: 'Custom', value: 'custom' as RangeKey },
              ].map((range) => (
                <button
                  key={range.value}
                  type="button"
                  onClick={() => setActiveRange(range.value)}
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
              disabled={!data}
              className="flex items-center gap-2 rounded-lg bg-[#2642a6] px-4 py-2 text-sm font-bold text-white transition duration-200 hover:bg-[#203b96] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faDownload} />
              Export All Data
            </button>
          </div>
        </div>

        {activeRange === 'custom' ? (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[#d6dbe6] bg-[#f7f8fc] p-3">
            <div>
              <label htmlFor="custom-from" className="mb-1 block text-xs font-semibold text-[#64748b]">
                From
              </label>
              <input
                id="custom-from"
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="h-8 rounded-lg border border-[#d6dbe6] bg-white px-3 text-sm text-[#334155] outline-none"
              />
            </div>
            <div>
              <label htmlFor="custom-to" className="mb-1 block text-xs font-semibold text-[#64748b]">
                To
              </label>
              <input
                id="custom-to"
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="h-8 rounded-lg border border-[#d6dbe6] bg-white px-3 text-sm text-[#334155] outline-none"
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

        {error ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#f3c9c9] bg-[#fdf2f2] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#b5312f]">
              <FontAwesomeIcon icon={faTriangleExclamation} />
              {error}
            </p>
            <button
              type="button"
              onClick={load}
              className="flex items-center gap-2 rounded-lg border border-[#e3b5b5] bg-white px-3 py-1.5 text-xs font-bold text-[#b5312f]"
            >
              <FontAwesomeIcon icon={faRotate} />
              Retry
            </button>
          </div>
        ) : null}

        {!error && !loading && !hasData ? (
          <div className="rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-4 text-sm text-[#64748b]">
            No bookings were recorded in this period.
          </div>
        ) : null}

        <section
          className={[
            'grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 transition-opacity duration-200',
            loading ? 'opacity-50' : 'opacity-100',
          ].join(' ')}
        >
          {stats.map((card, index) => (
            <article
              key={card.title}
              className="dashboard-card animate-dash-in rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-4 shadow-sm"
              style={{ animationDelay: `${120 + index * 40}ms` }}
            >
              <div className="mb-2 flex items-start justify-between">
                <p className="text-xs font-semibold text-[#64748b]">{card.title}</p>
                <div className={['grid h-7 w-7 place-items-center rounded-md text-xs', card.iconWrap].join(' ')}>
                  <FontAwesomeIcon icon={card.icon} />
                </div>
              </div>
              <p className="text-sm font-extrabold leading-none text-[#111827]">{loading ? '—' : card.value}</p>
              <p className={['mt-1.5 text-xs font-semibold', card.trendUp ? 'text-[#11a765]' : 'text-[#d74949]'].join(' ')}>
                {!loading && card.trend !== 'No prior period data' ? (
                  <FontAwesomeIcon icon={card.trendUp ? faArrowUp : faArrowDown} className="mr-1 text-xs" />
                ) : null}
                {loading ? 'Loading…' : card.trend}
              </p>
            </article>
          ))}
        </section>

        <section className="dashboard-card animate-dash-in rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-4 shadow-sm" style={{ animationDelay: '260ms' }}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#111827]">Revenue Trends</h2>
              <p className="text-sm text-[#64748b]">Breakdown of revenue streams over time</p>
            </div>

            <div className="flex items-center gap-3 text-sm text-[#64748b]">
              {[
                { key: 'total' as SeriesKey, color: '#2741a0', label: 'Total' },
                { key: 'highway' as SeriesKey, color: '#19a19a', label: 'Highway' },
                { key: 'longDistance' as SeriesKey, color: '#ab9833', label: 'Long-Distance' },
                { key: 'corporate' as SeriesKey, color: '#b77ae6', label: 'Corporate' },
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
                disabled={!data}
                className="ml-1 flex items-center gap-2 rounded-md border border-[#d6dbe6] bg-white px-3 py-1.5 text-xs font-bold text-[#2642a6] transition duration-200 hover:bg-[#f3f6fc] disabled:cursor-not-allowed disabled:opacity-50"
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
                  {Math.round(tick).toLocaleString()}
                </text>
              ))}
            </g>
            <g fill="#7d879b" fontSize="12">
              {chartConfig.labels.map((label, index) => (
                <text key={`${label}-${index}`} x={getXPosition(index)} y="330" textAnchor="middle">
                  {label}
                </text>
              ))}
            </g>
          </svg>
        </section>

        <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <article className="dashboard-card animate-dash-in rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-4 shadow-sm" style={{ animationDelay: '300ms' }}>
            <h2 className="text-sm font-bold text-[#111827]">Bookings by Category</h2>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div
                className="animate-analytics-ring grid h-36 w-36 place-items-center rounded-full"
                style={{ background: donutGradient }}
              >
                <div className="grid h-20 w-20 place-items-center rounded-full bg-[#f7f8fc] text-center">
                  <p className="text-sm font-extrabold leading-none text-[#111827]">
                    {totalCategoryBookings >= 1000
                      ? `${(totalCategoryBookings / 1000).toFixed(1)}K`
                      : totalCategoryBookings.toLocaleString()}
                  </p>
                  <p className="text-xs font-semibold text-[#64748b]">Total</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                {categoryMix.map((slice) => (
                  <p key={slice.type} className="flex items-center gap-2 text-[#334155]">
                    <span
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: CATEGORY_COLORS[slice.type] ?? '#9aa4bd' }}
                    />
                    {slice.type} <span className="font-bold">{slice.sharePct}%</span>
                  </p>
                ))}
              </div>
            </div>
          </article>

          <article className="dashboard-card animate-dash-in rounded-xl border border-[#e5e7eb] bg-[#f7f8fc] p-4 shadow-sm" style={{ animationDelay: '340ms' }}>
            <h2 className="text-sm font-bold text-[#111827]">Booking Status Overview</h2>
            <p className="mt-1 text-sm text-[#64748b]">Completed, upcoming and cancelled counts by booking type.</p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="bg-[#f1f4fa] text-left text-sm text-[#64748b]">
                    <th className="px-4 py-3 font-semibold">Booking Type</th>
                    <th className="px-4 py-3 font-semibold text-[#1bb37f]">Completed</th>
                    <th className="px-4 py-3 font-semibold text-[#2f4fb5]">Upcoming</th>
                    <th className="px-4 py-3 font-semibold text-[#eb4f59]">Cancelled</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.statusByType ?? []).map((row) => (
                    <tr key={row.type} className="border-b border-[#e5e7eb] text-[#111827]">
                      <td className="px-4 py-3 text-sm font-semibold">{row.type}</td>
                      <td className="px-4 py-3 text-sm font-bold text-[#1bb37f]">{row.completed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-bold text-[#2f4fb5]">{row.pending.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-bold text-[#eb4f59]">{row.cancelled.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </div>

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg border border-[#d6dbe6] bg-white px-4 py-3 shadow-lg">
          <p className="text-sm font-semibold text-[#334155]">{toastMessage}</p>
          <button type="button" onClick={() => setToastMessage(null)} className="text-[#64748b]">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>
      ) : null}
    </>
  )
}

export default AnalyticsPage
