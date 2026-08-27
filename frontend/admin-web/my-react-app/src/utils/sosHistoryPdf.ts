import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { SosAlertData } from '../services/sosAlertService'

/**
 * Renders the SOS alert history as a PDF report.
 *
 * The report is the record an operator hands to a supervisor or an insurer, so it
 * repeats the filters it was run under: a page of alerts means nothing without the
 * range and status it was drawn from.
 */

export type SosHistoryReportFilters = {
  from?: string
  to?: string
  status?: string
  triggeredBy?: string
  search?: string
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'triggered':
      return 'Triggered'
    case 'resolved':
      return 'Resolved'
    case 'false_alarm':
      return 'False alarm'
    default:
      return status
  }
}

/** Formats an ISO timestamp for the report; blank when the alert has no such moment. */
export function formatMoment(value: string | null): string {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Minutes between trigger and resolution, or a dash while an alert is still open. */
export function responseMinutes(alert: SosAlertData): string {
  if (!alert.resolvedAt) return '--'
  const triggered = new Date(alert.triggeredAt).getTime()
  const resolved = new Date(alert.resolvedAt).getTime()
  if (Number.isNaN(triggered) || Number.isNaN(resolved) || resolved < triggered) return '--'
  return `${Math.round((resolved - triggered) / 60000)} min`
}

function describeFilters(filters: SosHistoryReportFilters): string {
  const parts: string[] = []
  parts.push(`Range: ${filters.from || 'earliest'} to ${filters.to || 'today'}`)
  parts.push(`Status: ${filters.status ? statusLabel(filters.status) : 'All'}`)
  parts.push(`Raised by: ${filters.triggeredBy ? filters.triggeredBy : 'Anyone'}`)
  if (filters.search) {
    parts.push(`Search: "${filters.search}"`)
  }
  return parts.join('   |   ')
}

export function downloadSosHistoryPdf(alerts: SosAlertData[], filters: SosHistoryReportFilters): void {
  const doc = new jsPDF({ orientation: 'landscape' })

  doc.setFontSize(16)
  doc.setTextColor(17, 24, 39)
  doc.text('TrackNGo - SOS Alert History', 14, 18)

  const triggered = alerts.filter((alert) => alert.status === 'triggered').length
  const resolved = alerts.filter((alert) => alert.status === 'resolved').length
  const falseAlarms = alerts.filter((alert) => alert.status === 'false_alarm').length

  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Generated: ${new Date().toLocaleString('en-GB')}   |   Total: ${alerts.length}   Open: ${triggered}   Resolved: ${resolved}   False alarms: ${falseAlarms}`,
    14,
    26,
  )
  doc.text(describeFilters(filters), 14, 32)

  autoTable(doc, {
    startY: 38,
    head: [[
      'ID',
      'Triggered at',
      'Status',
      'By',
      'Name',
      'Phone',
      'Bus',
      'Route',
      'Location',
      'Resolved at',
      'Response',
    ]],
    body: alerts.map((alert) => [
      alert.sosId,
      formatMoment(alert.triggeredAt),
      statusLabel(alert.status),
      alert.triggeredByType === 'passenger' ? 'Passenger' : 'Driver',
      alert.name || '--',
      alert.phoneNumber || '--',
      alert.busNumber || '--',
      alert.routeName || '--',
      alert.sharedLocation || '--',
      formatMoment(alert.resolvedAt),
      responseMinutes(alert),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [38, 66, 166], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 252] },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 34 },
      2: { cellWidth: 22 },
      3: { cellWidth: 20 },
      8: { cellWidth: 46 },
      9: { cellWidth: 34 },
      10: { cellWidth: 20, halign: 'center' },
    },
  })

  doc.save('TrackNGo_SOS_History_Report.pdf')
}
