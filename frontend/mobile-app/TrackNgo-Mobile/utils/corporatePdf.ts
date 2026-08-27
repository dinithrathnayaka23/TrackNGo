import * as Print from "expo-print";
import { downloadTicketPdf } from "./ticketPdf";
import {
  formatAmount,
  formatContractDate,
  displayContractStatus,
  type CorporateContractDetail,
} from "../services/corporateApi";

/** Opens the native print/preview sheet so the user can look at the PDF before deciding to save or print it. */
export async function viewCorporatePdf(html: string): Promise<void> {
  await Print.printAsync({ html });
}

/** Rasterizes the HTML to a local PDF file, then saves/shares it via the same plumbing used for bus tickets. */
export async function downloadCorporatePdf(html: string, fileName: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await downloadTicketPdf(uri, fileName);
}

function busTypeLabel(type: string | null | undefined): string {
  if (type === "ac") return "AC";
  if (type === "mini") return "Mini Bus";
  return "Standard";
}

const DOCUMENT_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f4f8; margin: 0; padding: 28px; }
  .sheet { max-width: 620px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }
  .brand { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }
  .brand-name { font-size: 20px; font-weight: 800; color: #067BF9; }
  .brand-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .doc-title { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
  .doc-ref { font-size: 12px; color: #64748b; margin-bottom: 18px; }
  .status-chip { display: inline-block; border-radius: 999px; padding: 5px 14px; font-size: 11px; font-weight: 700; background: #d1fae5; color: #065f46; }
  .section { margin-top: 20px; padding-top: 16px; border-top: 1px solid #edf2f7; }
  .section-title { font-size: 12px; font-weight: 700; color: #94a3b8; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 10px; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
  .row .label { color: #64748b; }
  .row .value { color: #0f172a; font-weight: 700; text-align: right; }
  .amount { text-align: center; margin-top: 22px; padding: 18px; background: #f8fafc; border-radius: 12px; }
  .amount .label { font-size: 11px; color: #94a3b8; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; }
  .amount .value { font-size: 30px; font-weight: 900; color: #16a34a; margin-top: 6px; }
  .footer { margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
`;

export function buildContractPdfHtml(contract: CorporateContractDetail): string {
  const busLabel = contract.buses && contract.buses.length > 0
    ? contract.buses.map((bus) => bus.busNumber || `Bus #${bus.busId}`).join(", ")
    : contract.bus?.busNumber || "Not yet assigned";

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${DOCUMENT_STYLES}</style>
      </head>
      <body>
        <div class="sheet">
          <div class="brand">
            <div>
              <div class="brand-name">TrackNGo</div>
              <div class="brand-sub">Corporate Transport Contract</div>
            </div>
            <span class="status-chip">${displayContractStatus(contract.status)}</span>
          </div>

          <div class="doc-title">${contract.contractName}</div>
          <div class="doc-ref">Contract #CNT-${String(contract.contractId).padStart(4, "0")}</div>

          <div class="section">
            <div class="section-title">Company</div>
            <div class="row"><span class="label">Company Name</span><span class="value">${contract.companyName || "—"}</span></div>
            <div class="row"><span class="label">Contact Person</span><span class="value">${contract.contactPersonName || "—"}</span></div>
            <div class="row"><span class="label">Contact Phone</span><span class="value">${contract.contactPhone || "—"}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Route &amp; Schedule</div>
            <div class="row"><span class="label">Pickup</span><span class="value">${contract.startingLocation}</span></div>
            <div class="row"><span class="label">Drop-off</span><span class="value">${contract.destination}</span></div>
            <div class="row"><span class="label">Working Days</span><span class="value">${contract.workingDays === "all_days" ? "All Days" : "Weekdays (Mon–Fri)"}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Service Details</div>
            <div class="row"><span class="label">Employee Count</span><span class="value">${contract.employeeCount}</span></div>
            <div class="row"><span class="label">Bus Type</span><span class="value">${busTypeLabel(contract.busType)}</span></div>
            <div class="row"><span class="label">Assigned Bus(es)</span><span class="value">${busLabel}</span></div>
            <div class="row"><span class="label">Contract Period</span><span class="value">${formatContractDate(contract.startDate)} – ${formatContractDate(contract.endDate)}</span></div>
          </div>

          <div class="amount">
            <div class="label">Monthly Billing Amount</div>
            <div class="value">${formatAmount(contract.billingAmount)}</div>
          </div>

          <div class="footer">Generated by TrackNGo on ${formatContractDate(new Date().toISOString().substring(0, 10))}. This document reflects the contract terms at time of generation.</div>
        </div>
      </body>
    </html>
  `;
}

export function buildPaymentReceiptHtml(params: {
  title: string;
  referenceValue: string;
  companyName?: string | null;
  contactPersonName?: string | null;
  contractName: string;
  description: string;
  amount: number;
  paidAt: string | null;
  transactionId?: string | null;
}): string {
  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${DOCUMENT_STYLES}</style>
      </head>
      <body>
        <div class="sheet">
          <div class="brand">
            <div>
              <div class="brand-name">TrackNGo</div>
              <div class="brand-sub">Payment Receipt</div>
            </div>
            <span class="status-chip">Paid</span>
          </div>

          <div class="doc-title">${params.title}</div>
          <div class="doc-ref">Reference ${params.referenceValue}</div>

          <div class="section">
            <div class="section-title">Payer</div>
            <div class="row"><span class="label">Company Name</span><span class="value">${params.companyName || "—"}</span></div>
            <div class="row"><span class="label">Contact Person</span><span class="value">${params.contactPersonName || "—"}</span></div>
            <div class="row"><span class="label">Contract</span><span class="value">${params.contractName}</span></div>
          </div>

          <div class="section">
            <div class="section-title">Payment Details</div>
            <div class="row"><span class="label">Description</span><span class="value">${params.description}</span></div>
            <div class="row"><span class="label">Paid On</span><span class="value">${formatContractDate((params.paidAt || "").substring(0, 10)) || "—"}</span></div>
            ${params.transactionId ? `<div class="row"><span class="label">Transaction ID</span><span class="value">${params.transactionId}</span></div>` : ""}
          </div>

          <div class="amount">
            <div class="label">Amount Paid</div>
            <div class="value">${formatAmount(params.amount)}</div>
          </div>

          <div class="footer">This is a computer-generated receipt from TrackNGo and does not require a signature.</div>
        </div>
      </body>
    </html>
  `;
}
