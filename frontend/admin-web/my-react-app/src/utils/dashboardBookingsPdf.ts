import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { AdminBooking } from '../services/bookingService'

/**
 * Renders the admin dashboard's "Recent Bookings" export as a multi-page PDF,
 * mirroring the KPI/trend/donut/status/detail layout used elsewhere in the
 * admin app. Charts are drawn with jsPDF vector primitives (no rasterised
 * chart images), consistent with `utils/analyticsPdf.ts`.
 */

type Rgb = [number, number, number]

const NAVY: Rgb = [28, 42, 74]
const TEXT: Rgb = [20, 33, 61]
const MUTED: Rgb = [107, 114, 128]
const BORDER: Rgb = [224, 231, 255]
const SUCCESS: Rgb = [16, 185, 129]
const DANGER: Rgb = [239, 68, 68]
const CARD_BG: Rgb = [248, 250, 255]
const WHITE: Rgb = [255, 255, 255]
const ALERT_BG: Rgb = [255, 251, 235]
const ALERT_BORDER: Rgb = [253, 230, 138]
const ALERT_TEXT: Rgb = [120, 53, 15]

type Category = 'Highway' | 'Long-distance' | 'Corporate' | 'Trip'

const CATEGORY_COLORS: Record<Category, Rgb> = {
  Corporate: [34, 68, 157],
  Trip: [15, 143, 132],
  Highway: [59, 130, 246],
  'Long-distance': [245, 158, 11],
}

const CATEGORY_ORDER: Category[] = ['Corporate', 'Trip', 'Highway', 'Long-distance']

/* ── Shared helpers (kept in sync with pages/dashboard/Analytics.tsx) ──── */

function normalise(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase().replace(/[_\s]+/g, '-')
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isPaid(booking: AdminBooking) {
  const status = normalise(booking.paymentStatus)
  return status === 'paid' || status === 'completed' || status === 'success' || status === 'successful'
}

function isFailedPayment(booking: AdminBooking) {
  const status = normalise(booking.paymentStatus)
  return status === 'failed' || status === 'unpaid' || status === 'declined'
}

function isCancelled(booking: AdminBooking) {
  return ['cancelled', 'canceled', 'rejected'].includes(normalise(booking.status))
}

function isCompleted(booking: AdminBooking) {
  return ['completed', 'refunded'].includes(normalise(booking.status))
}

function bookingAmount(booking: AdminBooking) {
  return Number.isFinite(booking.amount) ? Number(booking.amount) : 0
}

function bookingCategory(booking: AdminBooking): Category {
  const type = normalise(booking.busType)
  const category = normalise(booking.category)
  if (type.includes('corporate') || category.includes('corporate')) return 'Corporate'
  if (type.includes('long') || type.includes('distance')) return 'Long-distance'
  if (type.includes('highway')) return 'Highway'
  if (category.includes('trip')) return 'Trip'
  return category.includes('long') ? 'Long-distance' : 'Highway'
}

function money(value: number) {
  return `Rs. ${Math.round(value).toLocaleString()}`
}

function pct(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function changeFrom(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / previous) * 100
}

function formatDateTime(dateValue: string | null, timeValue: string | null) {
  const date = parseDate(dateValue)
  if (!date) return 'Date unavailable'
  const dateText = date.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })
  return `${dateText}${timeValue ? `, ${timeValue}` : ''}`
}

function toTitle(value: string) {
  const text = String(value ?? '')
  return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : '-'
}

/* ── PDF geometry ─────────────────────────────────────────── */

const M = 28

/* ── Entry point ──────────────────────────────────────────── */

export function buildDashboardBookingsPdf(
  bookings: AdminBooking[],
  selectedRange: 7 | 30 | 90,
  generatedBy: string,
): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = pageW - M * 2

  const now = new Date()
  const rangeStart = new Date(now)
  rangeStart.setDate(now.getDate() - selectedRange)
  const prevStart = new Date(rangeStart)
  prevStart.setDate(rangeStart.getDate() - selectedRange)

  const inRange = (booking: AdminBooking, from: Date, to: Date) => {
    const date = parseDate(booking.journeyDate)
    return !!date && date >= from && date < to
  }

  const currentBookings = bookings.filter((booking) => inRange(booking, rangeStart, now))
  const previousBookings = bookings.filter((booking) => inRange(booking, prevStart, rangeStart))

  const totalRevenue = currentBookings.reduce((sum, b) => (isPaid(b) ? sum + bookingAmount(b) : sum), 0)
  const prevRevenue = previousBookings.reduce((sum, b) => (isPaid(b) ? sum + bookingAmount(b) : sum), 0)
  const activeUsers = new Set(currentBookings.map((b) => b.passengerName)).size
  const prevActiveUsers = new Set(previousBookings.map((b) => b.passengerName)).size
  const avgBookingValue = currentBookings.length ? totalRevenue / currentBookings.length : 0
  const prevAvgBookingValue = previousBookings.length ? prevRevenue / previousBookings.length : 0

  const kpis = {
    totalBookings: currentBookings.length,
    totalRevenue,
    activeUsers,
    avgBookingValue,
    changes: {
      bookingsPct: changeFrom(currentBookings.length, previousBookings.length),
      revenuePct: changeFrom(totalRevenue, prevRevenue),
      activeUsersPct: changeFrom(activeUsers, prevActiveUsers),
      avgValuePct: changeFrom(avgBookingValue, prevAvgBookingValue),
    },
  }

  const rangeLabel = `${rangeStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const generatedAt = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  let y = M

  const drawText = (text: string, x: number, yPos: number, opts: { size?: number; color?: Rgb; style?: 'normal' | 'bold'; align?: 'left' | 'center' | 'right' } = {}) => {
    const { size = 10, color = TEXT, style = 'normal', align = 'left' } = opts
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.text(text, x, yPos, { align })
  }

  const drawRect = (x: number, yPos: number, w: number, h: number, fill: Rgb | null, stroke: Rgb | null, radius = 0) => {
    if (fill) {
      doc.setFillColor(...fill)
      if (radius > 0) doc.roundedRect(x, yPos, w, h, radius, radius, 'F')
      else doc.rect(x, yPos, w, h, 'F')
    }
    if (stroke) {
      doc.setDrawColor(...stroke)
      if (radius > 0) doc.roundedRect(x, yPos, w, h, radius, radius, 'S')
      else doc.rect(x, yPos, w, h, 'S')
    }
  }

  const drawFooter = (pageNo: number) => {
    doc.setPage(pageNo)
    doc.setDrawColor(220, 227, 240)
    doc.line(M, pageH - 24, pageW - M, pageH - 24)
    drawText('TrackNGo Dashboard · Bookings Report', M, pageH - 10, { size: 8, color: MUTED })
    drawText(`Page ${pageNo}`, pageW - M, pageH - 10, { size: 8, color: MUTED, align: 'right' })
  }

  /* ---- Header ---- */
  drawText('TrackNGo - Dashboard Bookings Report', M, y + 4, { size: 16, style: 'bold', color: NAVY })
  y += 20
  drawText(`Range: ${rangeLabel}   |   Generated: ${generatedAt}   |   By: ${generatedBy}   |   TZ: ${timezone}`, M, y, { size: 9, color: MUTED })
  y += 14
  drawText('Filters: Booking Type=All, Payment=All, Route=All', M, y, { size: 9, color: MUTED })
  y += 18

  /* ---- KPI row ---- */
  const gap = 10
  const cardW = (contentW - gap * 3) / 4
  const cardH = 64

  const drawKpiCard = (x: number, yPos: number, title: string, value: string, delta: number) => {
    drawRect(x, yPos, cardW, cardH, CARD_BG, BORDER, 8)
    drawText(title, x + 12, yPos + 18, { size: 9, color: MUTED })
    drawText(value, x + 12, yPos + 38, { size: 16, style: 'bold' })
    const deltaColor = delta >= 0 ? SUCCESS : DANGER
    const arrow = delta >= 0 ? '↑' : '↓'
    drawText(`${arrow} ${pct(delta)} vs last period`, x + 12, yPos + 54, { size: 8.5, color: deltaColor })
  }

  drawKpiCard(M, y, 'Total Bookings', `${kpis.totalBookings}`, kpis.changes.bookingsPct)
  drawKpiCard(M + (cardW + gap) * 1, y, 'Total Revenue', money(kpis.totalRevenue), kpis.changes.revenuePct)
  drawKpiCard(M + (cardW + gap) * 2, y, 'Active Users', `${kpis.activeUsers}`, kpis.changes.activeUsersPct)
  drawKpiCard(M + (cardW + gap) * 3, y, 'Avg. Booking Value', money(kpis.avgBookingValue), kpis.changes.avgValuePct)
  y += cardH + 14

  /* ---- Revenue trend (vector line chart) ---- */
  drawText('Revenue Trends', M, y + 2, { size: 12, style: 'bold' })
  y += 8
  const trendH = 150
  drawRect(M, y, contentW, trendH, WHITE, BORDER, 8)

  const days = Array.from({ length: selectedRange }, (_, i) => {
    const d = new Date(rangeStart)
    d.setDate(rangeStart.getDate() + i)
    return d
  })
  const dayKey = (d: Date) => d.toISOString().slice(0, 10)
  const revenueByDay = days.map((day) =>
    currentBookings.reduce((sum, b) => {
      const date = parseDate(b.journeyDate)
      return date && dayKey(date) === dayKey(day) && isPaid(b) ? sum + bookingAmount(b) : sum
    }, 0),
  )
  const maxDaily = Math.max(1, ...revenueByDay)

  const plot = { x: M + 45, y: y + 14, w: contentW - 65, h: trendH - 36 }
  doc.setLineWidth(0.5)
  for (let i = 0; i <= 4; i += 1) {
    const value = (maxDaily / 4) * i
    const gy = plot.y + plot.h - (plot.h * i) / 4
    doc.setDrawColor(237, 239, 243)
    doc.line(plot.x, gy, plot.x + plot.w, gy)
    drawText(money(value), plot.x - 4, gy + 3, { size: 7, color: MUTED, align: 'right' })
  }
  const points = revenueByDay.map((value, i) => {
    const px = plot.x + (plot.w * i) / Math.max(1, revenueByDay.length - 1)
    const py = plot.y + plot.h - (plot.h * value) / maxDaily
    return [px, py] as const
  })
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(1.4)
  for (let i = 1; i < points.length; i += 1) {
    doc.line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1])
  }
  const labelStep = Math.max(1, Math.ceil(days.length / 6))
  days.forEach((day, i) => {
    if (i % labelStep !== 0 && i !== days.length - 1) return
    drawText(day.toLocaleDateString([], { month: 'short', day: 'numeric' }), points[i][0], plot.y + plot.h + 12, { size: 7, color: MUTED, align: 'center' })
  })
  y += trendH + 14

  /* ---- Donut + status overview ---- */
  const leftW = (contentW - gap) * 0.42
  const rightW = contentW - gap - leftW
  const blockH = 170

  drawRect(M, y, leftW, blockH, WHITE, BORDER, 8)
  drawText('Bookings by Category', M + 12, y + 18, { size: 11, style: 'bold' })

  const totalsByCategory = CATEGORY_ORDER.reduce((result, category) => {
    result[category] = currentBookings.reduce((sum, b) => (bookingCategory(b) === category && isPaid(b) ? sum + bookingAmount(b) : sum), 0)
    return result
  }, {} as Record<Category, number>)
  const totalCategoryRevenue = Object.values(totalsByCategory).reduce((sum, v) => sum + v, 0)

  const cx = M + leftW / 2
  const cyDonut = y + blockH / 2 + 6
  const outerR = 52
  const innerR = 28
  if (totalCategoryRevenue > 0) {
    let startAngle = -Math.PI / 2
    for (const category of CATEGORY_ORDER) {
      const value = totalsByCategory[category]
      if (value <= 0) continue
      const sweep = (value / totalCategoryRevenue) * Math.PI * 2
      const endAngle = startAngle + sweep
      const steps = Math.max(2, Math.ceil((sweep * outerR) / 4))
      doc.setFillColor(...CATEGORY_COLORS[category])
      for (let s = 0; s < steps; s += 1) {
        const a0 = startAngle + (sweep * s) / steps
        const a1 = startAngle + (sweep * (s + 1)) / steps
        doc.triangle(cx, cyDonut, cx + outerR * Math.cos(a0), cyDonut + outerR * Math.sin(a0), cx + outerR * Math.cos(a1), cyDonut + outerR * Math.sin(a1), 'F')
      }
      startAngle = endAngle
    }
    doc.setFillColor(...WHITE)
    doc.circle(cx, cyDonut, innerR, 'F')
  } else {
    drawText('No revenue in range', cx, cyDonut, { size: 9, color: MUTED, align: 'center' })
  }

  let legendY = y + blockH - 20
  CATEGORY_ORDER.forEach((category, index) => {
    const lx = M + 10 + (index % 2) * (leftW / 2)
    const ly = legendY - Math.floor(index / 2) * 12
    doc.setFillColor(...CATEGORY_COLORS[category])
    doc.roundedRect(lx, ly - 6, 6, 6, 1, 1, 'F')
    const share = totalCategoryRevenue > 0 ? (totalsByCategory[category] / totalCategoryRevenue) * 100 : 0
    drawText(`${category} ${share.toFixed(0)}%`, lx + 9, ly, { size: 7.5, color: TEXT })
  })
  legendY -= 12

  const rightX = M + leftW + gap
  drawRect(rightX, y, rightW, blockH, WHITE, BORDER, 8)
  drawText('Booking Status Overview', rightX + 12, y + 18, { size: 11, style: 'bold' })

  const statusRows = CATEGORY_ORDER.map((category) => {
    const rows = currentBookings.filter((b) => bookingCategory(b) === category)
    return {
      type: category,
      completed: rows.filter(isCompleted).length,
      upcoming: rows.filter((b) => !isCompleted(b) && !isCancelled(b)).length,
      cancelled: rows.filter(isCancelled).length,
    }
  })

  autoTable(doc, {
    startY: y + 28,
    margin: { left: rightX + 10, right: pageW - (rightX + rightW) + 10 },
    tableWidth: rightW - 20,
    head: [['BOOKING TYPE', 'COMPLETED', 'UPCOMING', 'CANCELLED']],
    body: statusRows.map((r) => [r.type, String(r.completed), String(r.upcoming), String(r.cancelled)]),
    styles: { fontSize: 8.5, textColor: TEXT, cellPadding: 6, lineColor: BORDER, lineWidth: 0.5 },
    headStyles: { fillColor: [243, 246, 255], textColor: NAVY, fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'center', textColor: SUCCESS },
      2: { halign: 'center', textColor: [37, 99, 235] },
      3: { halign: 'center', textColor: DANGER },
    },
    theme: 'grid',
  })

  y += blockH + 14

  /* ---- Exceptions & alerts ---- */
  drawText('Exceptions & Alerts', M, y + 2, { size: 12, style: 'bold' })
  y += 10
  drawRect(M, y, contentW, 48, ALERT_BG, ALERT_BORDER, 8)

  const cancelledCount = currentBookings.filter(isCancelled).length
  const failedPaymentCount = currentBookings.filter(isFailedPayment).length
  const revenueByRoute = new Map<string, number>()
  for (const booking of currentBookings) {
    if (!isPaid(booking)) continue
    revenueByRoute.set(booking.route, (revenueByRoute.get(booking.route) ?? 0) + bookingAmount(booking))
  }
  const topRoute = [...revenueByRoute.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'
  const hourCounts = new Map<number, number>()
  for (const booking of currentBookings) {
    const hour = Number(String(booking.journeyTime ?? '').split(':')[0])
    if (Number.isFinite(hour)) hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1)
  }
  const peakHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const peakWindow = peakHour === undefined ? '-' : `${String(peakHour).padStart(2, '0')}:00 - ${String((peakHour + 1) % 24).padStart(2, '0')}:00`

  drawText(
    `Cancelled: ${cancelledCount}   |   Failed Payments: ${failedPaymentCount}   |   Top Route: ${topRoute}   |   Peak Window: ${peakWindow}`,
    M + 12,
    y + 28,
    { size: 9.5, color: ALERT_TEXT },
  )

  /* ---- Detailed bookings (new page) ---- */
  doc.addPage()
  y = M
  drawText('Detailed Bookings', M, y + 4, { size: 14, style: 'bold', color: NAVY })
  y += 16
  drawText(`Range: ${rangeLabel}`, M, y, { size: 9, color: MUTED })

  const sortedBookings = [...currentBookings].sort(
    (left, right) => (parseDate(right.journeyDate)?.getTime() ?? 0) - (parseDate(left.journeyDate)?.getTime() ?? 0),
  )

  autoTable(doc, {
    startY: y + 8,
    margin: { left: M, right: M },
    head: [['Booking ID', 'Passenger', 'Route', 'Date & Time', 'Amount', 'Payment', 'Status']],
    body: sortedBookings.map((b) => [
      b.bookingId,
      b.passengerName,
      b.route,
      formatDateTime(b.journeyDate, b.journeyTime),
      money(bookingAmount(b)),
      toTitle(b.paymentStatus),
      toTitle(b.status),
    ]),
    styles: { fontSize: 8.5, textColor: TEXT, cellPadding: 6, lineColor: BORDER, lineWidth: 0.4, overflow: 'linebreak' },
    headStyles: { fillColor: NAVY, textColor: WHITE, fontStyle: 'bold' },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'center' }, 6: { halign: 'center' } },
    alternateRowStyles: { fillColor: [249, 250, 252] },
    theme: 'grid',
    foot: [[
      'TOTAL',
      '',
      '',
      `${sortedBookings.length} bookings`,
      money(sortedBookings.reduce((sum, b) => sum + bookingAmount(b), 0)),
      '',
      '',
    ]],
    footStyles: { fillColor: [239, 246, 255], textColor: NAVY, fontStyle: 'bold' },
  })

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) drawFooter(page)

  return doc
}
