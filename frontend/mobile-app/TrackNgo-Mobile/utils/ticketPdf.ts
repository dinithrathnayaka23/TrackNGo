import { Alert, Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
// The Storage Access Framework only exists on the legacy file-system API in
// SDK 54; the rewritten module does not expose it.
import {
  EncodingType,
  StorageAccessFramework,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";

export interface TicketPdfDetails {
  bookingRef: string;
  from: string;
  to: string;
  busNumber: string;
  depart: string;
  date: string;
  /** Comma-separated seat numbers, e.g. "3A,3B". */
  seats: string;
  totalPrice: number | null;
  status?: string;
  passengerName?: string;
  busType?: string;
  routeName?: string;
  transactionId?: string;
  /** Base64 data URI, e.g. from a QR SVG ref's toDataURL(). Omitted from the PDF when missing. */
  qrDataUrl?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Builds the shared HTML ticket template used for both the download and share PDFs. */
function buildTicketHtml(details: TicketPdfDetails): string {
  const {
    bookingRef, from, to, busNumber, depart, date, seats, totalPrice,
    status, passengerName, busType, routeName, transactionId, qrDataUrl,
  } = details;
  const formattedSeats = seats ? seats.replace(/,/g, ", ") : "N/A";
  const formattedPrice = (totalPrice ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

  const extraRows = [
    status ? `<div class="info-box"><label>Status</label><span>${escapeHtml(status)}</span></div>` : "",
    passengerName ? `<div class="info-box"><label>Passenger</label><span>${escapeHtml(passengerName)}</span></div>` : "",
    busType ? `<div class="info-box"><label>Bus Type</label><span>${escapeHtml(busType)}</span></div>` : "",
    transactionId ? `<div class="info-box"><label>Transaction</label><span>${escapeHtml(transactionId)}</span></div>` : "",
  ].join("");

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 24px; background: #f6f7f9; }
          .ticket { background: #fff; border-radius: 16px; padding: 32px 28px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 22px; font-weight: 800; color: #22C55E; letter-spacing: 1px; }
          .subtitle { font-size: 11px; color: #94a3b8; margin-top: 2px; }
          .divider { border: none; border-top: 2px dashed #e2e8f0; margin: 18px 0; }
          .qr-section { text-align: center; margin: 18px 0; }
          .qr-section img { width: 180px; height: 180px; border: 3px solid #111827; border-radius: 8px; padding: 8px; background: #fff; }
          .scan-badge { display: inline-block; background: #111827; color: #fff; font-size: 10px; font-weight: 800; letter-spacing: 2px; padding: 4px 14px; border-radius: 4px; margin-top: -12px; }
          .scan-hint { font-size: 11px; color: #94a3b8; margin-top: 10px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 16px 0; }
          .info-box label { display: block; font-size: 9px; font-weight: 700; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 3px; }
          .info-box span { font-size: 14px; font-weight: 700; color: #111827; }
          .route { text-align: center; margin: 10px 0 6px; }
          .route-text { font-size: 20px; font-weight: 800; color: #111827; }
          .route-arrow { color: #22C55E; margin: 0 6px; }
          .price-row { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; background: #f0fdf4; padding: 14px 18px; border-radius: 10px; }
          .price-label { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 1px; }
          .price-value { font-size: 22px; font-weight: 800; color: #22C55E; }
          .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #cbd5e1; }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <div class="logo">TrackNGo</div>
            <div class="subtitle">E-Bus Ticket</div>
          </div>

          <div class="route">
            <span class="route-text">${escapeHtml(from)} <span class="route-arrow">&rarr;</span> ${escapeHtml(to)}</span>
            ${routeName ? `<div class="subtitle" style="font-size: 14px; font-weight: 700; color: #2563EB; margin-top: 4px;">${escapeHtml(routeName)}</div>` : ""}
          </div>

          <hr class="divider" />

          ${qrDataUrl ? `
          <div class="qr-section">
            <img src="${qrDataUrl}" alt="QR Ticket" /><br/>
            <span class="scan-badge">SCAN ME</span>
            <div class="scan-hint">Show this QR code to the driver at boarding</div>
          </div>
          <hr class="divider" />
          ` : ""}

          <div class="info-grid">
            <div class="info-box">
              <label>Booking ID</label>
              <span>${escapeHtml(bookingRef || "N/A")}</span>
            </div>
            <div class="info-box">
              <label>Bus Number</label>
              <span>${escapeHtml(busNumber || "N/A")}</span>
            </div>
            <div class="info-box">
              <label>Date</label>
              <span>${escapeHtml(date)}</span>
            </div>
            <div class="info-box">
              <label>Departure</label>
              <span>${escapeHtml(depart)}</span>
            </div>
            <div class="info-box">
              <label>Seats</label>
              <span>${escapeHtml(formattedSeats)}</span>
            </div>
            ${extraRows}
          </div>

          <div class="price-row">
            <div>
              <div class="price-label">TOTAL PAID</div>
            </div>
            <div class="price-value">LKR ${formattedPrice}</div>
          </div>

          <div class="footer">This is a system-generated ticket. No signature required.</div>
        </div>
      </body>
    </html>
  `;
}

/** Builds the ticket HTML and renders it to a PDF file, returning the file's uri. */
export async function generateTicketPdf(details: TicketPdfDetails): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: buildTicketHtml(details), base64: false });
  return uri;
}

/**
 * The Android folder picker lists a "Downloads" shortcut backed by a virtual
 * documents provider. That root rejects file creation, so writing to it fails
 * with "isn't writable". The real Download folder lives on the external
 * storage provider and is writable, so the picker is seeded there and a
 * shortcut selection is caught before we attempt the write.
 */
const ANDROID_DOWNLOADS_SHORTCUT_AUTHORITY =
  "com.android.providers.downloads.documents";

type TicketSaveOutcome = "saved" | "declined" | "unwritable" | "failed";

/** Hands the PDF to the system share sheet. */
export async function shareTicketPdf(pdfUri: string, dialogTitle: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert("Unavailable", "Sharing is not available on this device.");
    return;
  }
  await Sharing.shareAsync(pdfUri, {
    mimeType: "application/pdf",
    dialogTitle,
    UTI: "com.adobe.pdf",
  });
}

/**
 * Writes the PDF into a folder the passenger picks. Returns why it did not
 * save so the caller can explain, rather than throwing a raw IOException that
 * reads like the PDF itself failed to build.
 */
async function savePdfToDevice(
  pdfUri: string,
  fileName: string,
): Promise<TicketSaveOutcome> {
  const permission =
    await StorageAccessFramework.requestDirectoryPermissionsAsync(
      StorageAccessFramework.getUriForDirectoryInRoot("Download"),
    );

  if (!permission.granted) {
    return "declined";
  }
  if (permission.directoryUri.includes(ANDROID_DOWNLOADS_SHORTCUT_AUTHORITY)) {
    return "unwritable";
  }

  try {
    const base64 = await readAsStringAsync(pdfUri, {
      encoding: EncodingType.Base64,
    });
    const targetUri = await StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      fileName,
      "application/pdf",
    );
    await writeAsStringAsync(targetUri, base64, {
      encoding: EncodingType.Base64,
    });
    return "saved";
  } catch (error) {
    console.error("[TicketPdf] writing to the chosen folder failed", error);
    return "failed";
  }
}

/**
 * Saves a generated ticket PDF to the device.
 *
 * Android gets a real file save into a folder the passenger chooses. iOS has
 * no user-facing Downloads folder, so there the share sheet is the save flow:
 * it is where "Save to Files" lives. Every ticket screen goes through here so
 * the two behave identically.
 */
export async function downloadTicketPdf(pdfUri: string, fileName: string) {
  if (Platform.OS === "android") {
    const outcome = await savePdfToDevice(pdfUri, fileName);

    if (outcome === "saved") {
      Alert.alert("Ticket saved", `${fileName} was saved to the folder you chose.`);
      return;
    }

    if (outcome === "unwritable") {
      Alert.alert(
        "Pick a different folder",
        "Android does not let apps write to that Downloads shortcut. " +
          "Open the menu in the picker, choose your phone storage, then " +
          "select a folder such as Download or Documents.",
        [
          {
            text: "Share instead",
            onPress: () => {
              void shareTicketPdf(pdfUri, "Save your TrackNGo bus ticket");
            },
          },
          { text: "OK", style: "cancel" },
        ],
      );
      return;
    }

    // "declined" or "failed": fall through to the share sheet so the passenger
    // still has a way to keep the ticket.
  }

  await shareTicketPdf(pdfUri, "Save your TrackNGo bus ticket");
}
