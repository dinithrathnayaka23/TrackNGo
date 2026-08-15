import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AnalyticsResponse, AnalyticsDailyPoint } from '../services/analyticsService'

/**
 * Renders the analytics period as a multi-page PDF report.
 *
 * Charts are drawn with jsPDF's vector primitives rather than rasterised from a
 * charting library, so they stay sharp at any zoom and the export pulls in no
 * extra dependencies.
 */

/* ── Palette ──────────────────────────────────────────────── */

type Rgb = [number, number, number]

const NAVY: Rgb = [27, 42, 74]
const INK: Rgb = [20, 33, 61]
const MUTED: Rgb = [107, 114, 128]
const LINE: Rgb = [229, 232, 238]
const CARD: Rgb = [247, 248, 250]
const GRID: Rgb = [237, 239, 243]
const WHITE: Rgb = [255, 255, 255]

const GREEN: Rgb = [12, 163, 12]
const GREEN_BG: Rgb = [231, 247, 231]
const RED: Rgb = [180, 35, 24]
const RED_BG: Rgb = [254, 228, 226]
const GRAY_FLAT: Rgb = [138, 143, 152]
const GRAY_FLAT_BG: Rgb = [240, 241, 243]

/** One colour per booking category, matching the on-screen dashboard legend. */
const CATEGORY_COLORS: Record<string, Rgb> = {
  Highway: [42, 120, 214],
  'Long-distance': [235, 104, 52],
  'Trip Bookings': [27, 175, 122],
  Corporate: [237, 161, 0],
}

const CATEGORY_ORDER = ['Highway', 'Long-distance', 'Trip Bookings', 'Corporate'] as const
type CategoryName = (typeof CATEGORY_ORDER)[number]

/** Maps a category to its key on a daily series point. */
const SERIES_KEY: Record<CategoryName, keyof Pick<AnalyticsDailyPoint, 'highway' | 'longDistance' | 'tripBooking' | 'corporate'>> = {
  Highway: 'highway',
  'Long-distance': 'longDistance',
  'Trip Bookings': 'tripBooking',
  Corporate: 'corporate',
}

/* ── Page geometry (A4 landscape, millimetres) ────────────── */

const PAGE_W = 297
const PAGE_H = 210
const MARGIN = 14
const CONTENT_W = PAGE_W - MARGIN * 2

/** Daily bars beyond this count are aggregated into equal buckets to stay legible. */
const MAX_CHART_COLUMNS = 14

/* ── Formatting ───────────────────────────────────────────── */

const rupees = (value: number) => `Rs ${Math.round(value).toLocaleString()}`

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

/** Rounds an axis maximum up to a clean 1/2/5 x 10^n value. */
const niceMax = (value: number) => {
  if (value <= 0) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)))
  const normalised = value / magnitude
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10
  return step * magnitude
}

/* ── Derived figures ──────────────────────────────────────── */

type CategoryTotals = {
  type: CategoryName
  /** Every booking in the period, cancelled ones included. */
  bookings: number
  completed: number
  upcoming: number
  cancelled: number
  /** Revenue excludes cancelled bookings, which never earned anything. */
  revenue: number
  /** Bookings that still stand; the denominator for revenue per booking. */
  activeBookings: number
  revenuePerBooking: number
  bookingSharePct: number
  revenueSharePct: number
  cancellationRatePct: number
}

/**
 * Combines the API's two views of a category into one reconciled row.
 *
 * The API reports `categoryMix.bookings` excluding cancellations (it is the
 * revenue-bearing count) while `statusByType` includes them. Rather than surface
 * both and leave the reader to spot the discrepancy, every column here is derived
 * from an explicit definition: bookings counts everything, revenue counts only
 * what was not cancelled.
 */
const computeCategoryTotals = (data: AnalyticsResponse): CategoryTotals[] => {
  const revenueByCategory = new Map<CategoryName, number>()
  for (const category of CATEGORY_ORDER) {
    const key = SERIES_KEY[category]
    revenueByCategory.set(
      category,
      data.series.reduce((sum, point) => sum + point[key], 0),
    )
  }

  const totalRevenue = [...revenueByCategory.values()].reduce((sum, value) => sum + value, 0)
  const rows: CategoryTotals[] = CATEGORY_ORDER.map((category) => {
    const status = data.statusByType.find((row) => row.type === category)
    const completed = status?.completed ?? 0
    const upcoming = status?.pending ?? 0
    const cancelled = status?.cancelled ?? 0
    const bookings = completed + upcoming + cancelled
    const activeBookings = completed + upcoming
    const revenue = revenueByCategory.get(category) ?? 0

    return {
      type: category,
      bookings,
      completed,
      upcoming,
      cancelled,
      revenue,
      activeBookings,
      revenuePerBooking: activeBookings > 0 ? revenue / activeBookings : 0,
      bookingSharePct: 0,
      revenueSharePct: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
      cancellationRatePct: bookings > 0 ? (cancelled / bookings) * 100 : 0,
    }
  })

  const totalBookings = rows.reduce((sum, row) => sum + row.bookings, 0)
  for (const row of rows) {
    row.bookingSharePct = totalBookings > 0 ? (row.bookings / totalBookings) * 100 : 0
  }
  return rows
}

type Bucket = {
  label: string
  values: Record<CategoryName, number>
  total: number
}

/** Groups daily points into at most MAX_CHART_COLUMNS contiguous buckets, summing revenue. */
const bucketSeries = (series: AnalyticsDailyPoint[]): Bucket[] => {
  if (series.length === 0) return []
  const size = Math.ceil(series.length / MAX_CHART_COLUMNS)
  const buckets: Bucket[] = []

  for (let start = 0; start < series.length; start += size) {
    const slice = series.slice(start, start + size)
    const values = {} as Record<CategoryName, number>
    let total = 0
    for (const category of CATEGORY_ORDER) {
      const key = SERIES_KEY[category]
      const sum = slice.reduce((acc, point) => acc + point[key], 0)
      values[category] = sum
      total += sum
    }
    const first = shortDate(slice[0].date)
    const label = slice.length === 1 ? first : `${first}+`
    buckets.push({ label, values, total })
  }
  return buckets
}

/* ── Drawing primitives ───────────────────────────────────── */

const setFill = (doc: jsPDF, [r, g, b]: Rgb) => doc.setFillColor(r, g, b)
const setDraw = (doc: jsPDF, [r, g, b]: Rgb) => doc.setDrawColor(r, g, b)
const setText = (doc: jsPDF, [r, g, b]: Rgb) => doc.setTextColor(r, g, b)

const sectionTitle = (doc: jsPDF, text: string, y: number) => {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  setText(doc, NAVY)
  doc.text(text, MARGIN, y)
}

const card = (doc: jsPDF, x: number, y: number, w: number, h: number) => {
  setFill(doc, CARD)
  setDraw(doc, LINE)
  doc.setLineWidth(0.2)
  doc.roundedRect(x, y, w, h, 2, 2, 'FD')
}

const legend = (doc: jsPDF, x: number, y: number, entries: { label: string; color: Rgb }[]) => {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  let cursor = x
  for (const entry of entries) {
    setFill(doc, entry.color)
    doc.roundedRect(cursor, y - 2, 2.4, 2.4, 0.4, 0.4, 'F')
    setText(doc, MUTED)
    doc.text(entry.label, cursor + 3.6, y)
    cursor += 3.6 + doc.getTextWidth(entry.label) + 7
  }
}

/** Draws horizontal gridlines plus their axis labels, returning the value-to-y mapper. */
const drawYAxis = (
  doc: jsPDF,
  plot: { x: number; y: number; w: number; h: number },
  max: number,
  format: (value: number) => string,
) => {
  const steps = 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setLineWidth(0.15)

  for (let i = 0; i <= steps; i += 1) {
    const value = (max / steps) * i
    const y = plot.y + plot.h - (plot.h * i) / steps
    setDraw(doc, GRID)
    doc.line(plot.x, y, plot.x + plot.w, y)
    setText(doc, MUTED)
    doc.text(format(value), plot.x - 2, y + 1, { align: 'right' })
  }

  return (value: number) => plot.y + plot.h - (plot.h * value) / max
}

/* ── Report sections ──────────────────────────────────────── */

const drawHeader = (doc: jsPDF, data: AnalyticsResponse) => {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  setText(doc, NAVY)
  doc.text('TrackNGo - Analytics & Insights Report', MARGIN, 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setText(doc, MUTED)
  doc.text(
    `Period: ${shortDate(data.from)} - ${longDate(data.to)}   |   Generated ${longDate(new Date().toISOString())}`,
    MARGIN,
    24.5,
  )
}

const drawKpiRow = (doc: jsPDF, data: AnalyticsResponse, y: number) => {
  const gap = 5
  const w = (CONTENT_W - gap * 3) / 4
  const h = 26

  const cards = [
    { label: 'Total bookings', value: data.summary.bookings.toLocaleString(), trend: data.summary.bookingsTrendPct },
    { label: 'Total revenue', value: rupees(data.summary.revenue), trend: data.summary.revenueTrendPct },
    { label: 'Active users', value: data.summary.activeUsers.toLocaleString(), trend: data.summary.activeUsersTrendPct },
    { label: 'Avg. booking value', value: rupees(data.summary.avgBookingValue), trend: data.summary.avgBookingValueTrendPct },
  ]

  cards.forEach((item, index) => {
    const x = MARGIN + index * (w + gap)
    card(doc, x, y, w, h)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setText(doc, MUTED)
    doc.text(item.label, x + 5, y + 7)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    setText(doc, INK)
    doc.text(item.value, x + 5, y + 15.5)

    // A null trend means the preceding period had nothing to compare against.
    const flat = item.trend === null || item.trend === 0
    const up = (item.trend ?? 0) > 0
    const pillBg = flat ? GRAY_FLAT_BG : up ? GREEN_BG : RED_BG
    const pillFg = flat ? GRAY_FLAT : up ? GREEN : RED
    const arrow = flat ? '-' : up ? '^' : 'v'
    const label = item.trend === null ? 'no prior data' : `${arrow} ${Math.abs(item.trend)}%`

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    const textW = doc.getTextWidth(label)
    setFill(doc, pillBg)
    doc.roundedRect(x + 5, y + 18.5, textW + 4, 4.6, 1, 1, 'F')
    setText(doc, pillFg)
    doc.text(label, x + 7, y + 21.7)
  })

  return y + h
}

const drawRevenueByDay = (doc: jsPDF, data: AnalyticsResponse, y: number) => {
  const h = 78
  card(doc, MARGIN, y, CONTENT_W, h)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setText(doc, INK)
  doc.text('Daily revenue, split by booking type', MARGIN + 6, y + 8)

  const buckets = bucketSeries(data.series)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  setText(doc, MUTED)
  const grouped = data.series.length > MAX_CHART_COLUMNS
  doc.text(
    grouped
      ? `Rs, ${shortDate(data.from)} - ${shortDate(data.to)}. Each bar groups ${Math.ceil(data.series.length / MAX_CHART_COLUMNS)} days.`
      : `Rs, ${shortDate(data.from)} - ${shortDate(data.to)}.`,
    MARGIN + 6,
    y + 13,
  )

  legend(
    doc,
    MARGIN + 6,
    y + 20,
    CATEGORY_ORDER.map((category) => ({ label: category, color: CATEGORY_COLORS[category] })),
  )

  const plot = { x: MARGIN + 26, y: y + 25, w: CONTENT_W - 34, h: h - 38 }
  const max = niceMax(Math.max(...buckets.map((bucket) => bucket.total), 1))
  const toY = drawYAxis(doc, plot, max, (value) => rupees(value))

  const slot = plot.w / Math.max(buckets.length, 1)
  const barW = Math.min(slot * 0.6, 12)

  buckets.forEach((bucket, index) => {
    const centre = plot.x + slot * index + slot / 2
    let baseline = plot.y + plot.h

    // Stack the categories bottom-up in a fixed order so colours stay comparable.
    for (const category of CATEGORY_ORDER) {
      const value = bucket.values[category]
      if (value <= 0) continue
      const segmentH = plot.y + plot.h - toY(value)
      setFill(doc, CATEGORY_COLORS[category])
      doc.rect(centre - barW / 2, baseline - segmentH, barW, segmentH, 'F')
      baseline -= segmentH
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    setText(doc, MUTED)
    doc.text(bucket.label, centre, plot.y + plot.h + 4, { align: 'center' })
  })

  return y + h
}

const drawMixChart = (doc: jsPDF, rows: CategoryTotals[], x: number, y: number, w: number, h: number) => {
  card(doc, x, y, w, h)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setText(doc, INK)
  doc.text('Share of bookings vs. share of revenue', x + 6, y + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  setText(doc, MUTED)
  doc.text('Where volume and value diverge.', x + 6, y + 13)

  legend(doc, x + 6, y + 20, [
    { label: '% of bookings', color: CATEGORY_COLORS.Highway },
    { label: '% of revenue', color: CATEGORY_COLORS['Trip Bookings'] },
  ])

  const plot = { x: x + 30, y: y + 25, w: w - 38, h: h - 34 }
  const max = niceMax(Math.max(...rows.flatMap((row) => [row.bookingSharePct, row.revenueSharePct]), 10))

  // Vertical gridlines, since the bars run horizontally here.
  doc.setLineWidth(0.15)
  doc.setFontSize(7)
  for (let i = 0; i <= 4; i += 1) {
    const value = (max / 4) * i
    const gx = plot.x + (plot.w * i) / 4
    setDraw(doc, GRID)
    doc.line(gx, plot.y, gx, plot.y + plot.h)
    setText(doc, MUTED)
    doc.text(`${Math.round(value)}%`, gx, plot.y + plot.h + 4, { align: 'center' })
  }

  const slot = plot.h / rows.length
  const barH = Math.min(slot * 0.3, 4)

  rows.forEach((row, index) => {
    const centre = plot.y + slot * index + slot / 2

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    setText(doc, INK)
    doc.text(row.type, plot.x - 2, centre + 1, { align: 'right' })

    setFill(doc, CATEGORY_COLORS.Highway)
    doc.rect(plot.x, centre - barH - 0.6, (plot.w * row.bookingSharePct) / max, barH, 'F')

    setFill(doc, CATEGORY_COLORS['Trip Bookings'])
    doc.rect(plot.x, centre + 0.6, (plot.w * row.revenueSharePct) / max, barH, 'F')
  })
}

const drawRevenuePerBooking = (doc: jsPDF, rows: CategoryTotals[], x: number, y: number, w: number, h: number) => {
  card(doc, x, y, w, h)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  setText(doc, INK)
  doc.text('Revenue per booking', x + 6, y + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  setText(doc, MUTED)
  doc.text('Average value of each booking that still stands.', x + 6, y + 13)

  const plot = { x: x + 26, y: y + 19, w: w - 34, h: h - 28 }
  const max = niceMax(Math.max(...rows.map((row) => row.revenuePerBooking), 1))
  const toY = drawYAxis(doc, plot, max, (value) => rupees(value))

  const slot = plot.w / rows.length
  const barW = Math.min(slot * 0.5, 14)

  rows.forEach((row, index) => {
    const centre = plot.x + slot * index + slot / 2
    const barH = plot.y + plot.h - toY(row.revenuePerBooking)
    if (barH > 0) {
      setFill(doc, CATEGORY_COLORS[row.type])
      doc.rect(centre - barW / 2, plot.y + plot.h - barH, barW, barH, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    setText(doc, MUTED)
    doc.text(row.type, centre, plot.y + plot.h + 4, { align: 'center' })
  })
}

const drawFooter = (doc: jsPDF, data: AnalyticsResponse) => {
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    setDraw(doc, LINE)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    setText(doc, MUTED)
    doc.text(`TrackNGo Analytics  ·  Source data: ${data.from} to ${data.to}`, MARGIN, PAGE_H - 7)
    doc.text(`Page ${page} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' })
  }
}

/* ── Entry point ──────────────────────────────────────────── */

export function buildAnalyticsPdf(data: AnalyticsResponse): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const rows = computeCategoryTotals(data)

  // Page 1 — headline figures and the revenue trend.
  drawHeader(doc, data)
  const afterKpis = drawKpiRow(doc, data, 30)
  sectionTitle(doc, 'Revenue by day', afterKpis + 10)
  drawRevenueByDay(doc, data, afterKpis + 14)

  // Page 2 — mix comparison and the reconciled per-category table.
  doc.addPage()
  sectionTitle(doc, 'Booking mix vs. revenue mix', 20)
  const halfW = (CONTENT_W - 8) / 2
  drawMixChart(doc, rows, MARGIN, 24, halfW, 62)
  drawRevenuePerBooking(doc, rows, MARGIN + halfW + 8, 24, halfW, 62)

  sectionTitle(doc, 'Booking type detail', 98)
  autoTable(doc, {
    startY: 102,
    head: [['Booking type', 'Bookings', 'Revenue', 'Rs / booking', 'Completed', 'Upcoming', 'Cancelled', 'Cancellation rate']],
    body: rows.map((row) => [
      row.type,
      row.bookings.toLocaleString(),
      rupees(row.revenue),
      rupees(row.revenuePerBooking),
      row.completed.toLocaleString(),
      row.upcoming.toLocaleString(),
      row.cancelled.toLocaleString(),
      `${row.cancellationRatePct.toFixed(0)}%`,
    ]),
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: INK },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
    margin: { left: MARGIN, right: MARGIN },
  })

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  setText(doc, MUTED)
  doc.text(
    'Bookings counts every booking in the period, cancellations included. Revenue and Rs / booking exclude cancelled bookings, which earned nothing.',
    MARGIN,
    afterTable + 5,
  )

  // Page 3 onward — the full daily breakdown behind the chart.
  doc.addPage()
  sectionTitle(doc, 'Daily detail', 20)
  autoTable(doc, {
    startY: 24,
    head: [['Date', 'Total', 'Highway', 'Long-distance', 'Trip bookings', 'Corporate']],
    body: data.series.map((point) => [
      point.date,
      rupees(point.total),
      rupees(point.highway),
      rupees(point.longDistance),
      rupees(point.tripBooking),
      rupees(point.corporate),
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.6, textColor: INK },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 16 },
  })

  drawFooter(doc, data)
  return doc
}
