import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as Print from "expo-print";
import { downloadTicketPdf, shareTicketPdf } from "../../utils/ticketPdf";
import {
  getPastBookings,
  getUpcomingBookings,
  type BookingHistoryDto,
} from "../../services/bookingsApi";
import { getUserProfile } from "../../services/userProfileApi";
import { formatBusTypeLabel } from "../../utils/busLabels";
import { useSession } from "../../store/sessionStore";
import { LocalizedText as Text } from "../../utils/i18n";

type TicketQueryParams = {
  bookingRef?: string;
  from?: string;
  to?: string;
  busNumber?: string;
  depart?: string;
  date?: string;
  seats?: string;
  totalPrice?: string;
  status?: string;
  transactionId?: string;
  routeName?: string;
  busType?: string;
  passengerName?: string;
};

type TicketSnapshot = {
  bookingRef: string;
  from: string;
  to: string;
  busNumber: string;
  depart: string;
  date: string;
  seats: string;
  totalPrice: number | null;
  status: string;
  transactionId: string;
  routeName: string;
  busType: string;
};

function toUpperTrimmed(value?: string | null): string {
  return (value ?? "").trim().toUpperCase();
}

function formatTicketTypeLabel(rawType?: string): string {
  const normalized = (rawType ?? "").toLowerCase().replace(/-/g, "_").trim();
  // Ticket-specific wording; everything else falls back to the shared bus
  // type label so the two never drift apart.
  if (!normalized) return "Bus Ticket";
  if (normalized === "highway") return "Highway Bus";
  if (normalized === "trip_booking" || normalized === "trip") return "Trip Booking";
  return formatBusTypeLabel(rawType);
}

function parsePrice(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildFromParams(params: TicketQueryParams): TicketSnapshot {
  return {
    bookingRef: (params.bookingRef ?? "").trim(),
    from: (params.from ?? "Colombo").trim(),
    to: (params.to ?? "Galle").trim(),
    busNumber: (params.busNumber ?? "--").trim(),
    depart: (params.depart ?? "").trim(),
    date: (params.date ?? "").trim(),
    seats: (params.seats ?? "").trim(),
    totalPrice: parsePrice(params.totalPrice),
    status: (params.status ?? "CONFIRMED").trim(),
    transactionId: (params.transactionId ?? "").trim(),
    routeName: (params.routeName ?? "").trim(),
    busType: (params.busType ?? "highway").trim(),
  };
}

function mergeWithBookingHistory(
  current: TicketSnapshot,
  booking: BookingHistoryDto,
): TicketSnapshot {
  return {
    bookingRef: booking.bookingReference?.trim() || current.bookingRef,
    from: booking.startLocation?.trim() || current.from,
    to: booking.endLocation?.trim() || current.to,
    busNumber: booking.busNumber?.trim() || current.busNumber,
    depart: booking.journeyTime?.trim() || current.depart,
    date: booking.journeyDate?.trim() || current.date,
    seats: booking.seatNumber?.trim() || current.seats,
    totalPrice:
      typeof booking.totalAmount === "number" && Number.isFinite(booking.totalAmount)
        ? booking.totalAmount
        : current.totalPrice,
    status: booking.status?.trim() || current.status,
    transactionId: booking.transactionId?.trim() || current.transactionId,
    routeName: current.routeName,
    busType: booking.busType?.trim() || current.busType,
  };
}

function formatTicketReference(reference: string): string {
  if (!reference) return "#--";
  const trimmed = reference.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function formatSeatLabel(seats: string): string {
  if (!seats) return "--";
  return seats
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");
}

function formatDateLabel(dateText: string): string {
  if (!dateText) return "--";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!match) return dateText;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day);
  if (Number.isNaN(parsed.getTime())) return dateText;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const parsedStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.round((parsedStart.getTime() - todayStart.getTime()) / 86400000);
  const datePart = parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });

  if (diffDays === 0) return `Today, ${datePart}`;
  if (diffDays === 1) return `Tomorrow, ${datePart}`;
  return datePart;
}

function formatDepartureLabel(timeText: string): string {
  if (!timeText) return "--";
  const upper = toUpperTrimmed(timeText);
  if (upper.includes("AM") || upper.includes("PM")) return upper;

  const parts = timeText.split(":").map((part) => part.trim());
  if (parts.length < 2) return timeText;
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return timeText;

  const converted = new Date(2000, 0, 1, hour, minute);
  return converted.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCurrency(amount: number | null): string {
  if (amount == null) return "LKR --";
  return `LKR ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getStatusBadge(statusRaw: string): { label: string; color: string } {
  const normalized = statusRaw.toLowerCase();
  if (normalized.includes("cancel")) {
    return { label: "Cancelled", color: "#ef4444" };
  }
  if (normalized.includes("pending")) {
    return { label: "Pending", color: "#f59e0b" };
  }
  return { label: "Confirmed", color: "#22c55e" };
}

export default function ViewTicketScreen() {
  const router = useRouter();
  const { currentUser } = useSession();
  const params = useLocalSearchParams<TicketQueryParams>();
  const qrSvgRef = useRef<any>(null);

  const paramsSnapshot = useMemo(
    () => buildFromParams(params),
    [
      params.bookingRef,
      params.from,
      params.to,
      params.busNumber,
      params.depart,
      params.date,
      params.seats,
      params.totalPrice,
      params.status,
      params.transactionId,
      params.routeName,
      params.busType,
    ],
  );

  const [ticket, setTicket] = useState<TicketSnapshot>(paramsSnapshot);
  const [passengerName, setPassengerName] = useState(
    (params.passengerName ?? "").trim() || "Passenger",
  );

  useEffect(() => {
    setTicket(paramsSnapshot);
  }, [paramsSnapshot]);

  useEffect(() => {
    if (!params.passengerName) return;
    setPassengerName(params.passengerName.trim() || "Passenger");
  }, [params.passengerName]);

  useEffect(() => {
    if (!currentUser || !ticket.bookingRef) return;
    let active = true;

    (async () => {
      try {
        const [upcoming, past] = await Promise.all([
          getUpcomingBookings(currentUser.userId),
          getPastBookings(currentUser.userId),
        ]);
        if (!active) return;
        const all = [...upcoming, ...past];
        const found = all.find((item) => item.bookingReference === ticket.bookingRef);
        if (!found) return;
        setTicket((prev) => mergeWithBookingHistory(prev, found));
      } catch (error) {
        console.error("[ViewTicket] Could not load booking details", error);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser, ticket.bookingRef]);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;

    (async () => {
      try {
        const profile = await getUserProfile(currentUser.userId);
        if (!active) return;
        const resolvedName =
          profile.fullName?.trim() ||
          profile.contactPersonName?.trim() ||
          profile.companyName?.trim() ||
          "Passenger";
        setPassengerName(resolvedName);
      } catch (error) {
        console.error("[ViewTicket] Could not load passenger name", error);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser]);

  const displayTicketType = useMemo(
    () => formatTicketTypeLabel(ticket.busType),
    [ticket.busType],
  );
  const displayDate = useMemo(() => formatDateLabel(ticket.date), [ticket.date]);
  const displayDepart = useMemo(
    () => formatDepartureLabel(ticket.depart),
    [ticket.depart],
  );
  const displaySeat = useMemo(() => formatSeatLabel(ticket.seats), [ticket.seats]);
  const displayPrice = useMemo(() => formatCurrency(ticket.totalPrice), [ticket.totalPrice]);
  const statusBadge = useMemo(() => getStatusBadge(ticket.status), [ticket.status]);
  const ticketReference = useMemo(
    () => formatTicketReference(ticket.bookingRef),
    [ticket.bookingRef],
  );

  const qrPayload = useMemo(
    () =>
      JSON.stringify({
        bookingRef: ticket.bookingRef,
        passengerName,
        from: ticket.from,
        to: ticket.to,
        date: ticket.date,
        depart: ticket.depart,
        seats: ticket.seats,
        busNumber: ticket.busNumber,
        status: ticket.status,
        totalPrice: ticket.totalPrice ?? 0,
        transactionId: ticket.transactionId,
      }),
    [ticket, passengerName],
  );

  const getQrBase64 = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!qrSvgRef.current) {
        reject(new Error("QR code is not ready"));
        return;
      }
      qrSvgRef.current.toDataURL((data: string) => {
        resolve(`data:image/png;base64,${data}`);
      });
    });
  }, []);

  const buildTicketPdf = useCallback(async (): Promise<string> => {
    const qrImageUri = await getQrBase64();
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f4f8; margin: 0; padding: 26px; }
            .card { max-width: 430px; margin: 0 auto; background: #fff; border-radius: 18px; padding: 24px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08); }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
            .chip { display: inline-block; background: #dbeafe; color: #1d4ed8; border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 700; }
            .ref-label { color: #64748b; font-size: 12px; margin-top: 6px; }
            .ref-value { color: #2563eb; font-size: 30px; font-weight: 800; margin: 4px 0 12px 0; }
            .route { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; margin-bottom: 12px; }
            .route-title { color: #94a3b8; font-size: 12px; font-weight: 700; margin-bottom: 4px; }
            .route-city { color: #0f172a; font-size: 24px; font-weight: 800; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 10px; }
            .meta-label { color: #94a3b8; font-size: 12px; font-weight: 700; margin-bottom: 3px; }
            .meta-value { color: #0f172a; font-size: 22px; font-weight: 800; }
            .meta-value.small { font-size: 20px; }
            .price { text-align: center; color: #16a34a; font-size: 30px; font-weight: 900; margin: 8px 0 16px; }
            .qr-section { border-top: 1px solid #edf2f7; border-bottom: 1px solid #edf2f7; padding: 18px 0; margin-bottom: 16px; text-align: center; }
            .qr-frame { box-sizing: border-box; width: 270px; margin: 0 auto; border: 1px solid #dbe3ee; border-radius: 16px; background: #fff; padding: 22px 26px 14px; text-align: center; }
            /* block + auto margins centres the QR whatever the print engine
               does with inline images */
            .qr-frame img { display: block; width: 170px; height: 170px; margin: 0 auto; }
            .scan { display: inline-block; margin-top: 12px; background: #0b0f18; color: #fff; padding: 5px 12px; font-size: 12px; font-weight: 800; letter-spacing: 1px; }
            .scan-title { margin-top: 14px; color: #172119; font-size: 22px; font-weight: 800; }
            .scan-sub { margin-top: 4px; color: #6b7280; font-size: 13px; }
            .footer { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
            .footer-label { color: #94a3b8; font-size: 11px; font-weight: 700; }
            .footer-value { color: #0f172a; font-size: 17px; font-weight: 700; margin-top: 4px; }
            .status { color: #22c55e; font-size: 18px; font-weight: 800; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <span class="chip">${displayTicketType}</span>
              <span style="font-size: 24px;">&#128652;</span>
            </div>
            <div class="ref-label">Ticket Reference</div>
            <div class="ref-value">${ticketReference}</div>

            <div class="route">
              <div>
                <div class="route-title">From</div>
                <div class="route-city">${ticket.from}</div>
              </div>
              <div style="font-size: 28px; font-weight: 700;">&rarr;</div>
              <div style="text-align:right;">
                <div class="route-title">To</div>
                <div class="route-city">${ticket.to}</div>
              </div>
            </div>

            <div class="meta-grid">
              <div><div class="meta-label">Date</div><div class="meta-value">${displayDate}</div></div>
              <div style="text-align:right;"><div class="meta-label">Departure</div><div class="meta-value">${displayDepart}</div></div>
              <div><div class="meta-label">Seat Number</div><div class="meta-value small">${displaySeat}</div></div>
              <div style="text-align:right;"><div class="meta-label">Bus Number</div><div class="meta-value small">${ticket.busNumber}</div></div>
            </div>

            <div class="price">${displayPrice}</div>

            <div class="qr-section">
              <div class="qr-frame">
                <img src="${qrImageUri}" alt="Ticket QR" />
                <div class="scan">SCAN ME</div>
              </div>
              <div class="scan-title">Scan at boarding</div>
              <div class="scan-sub">Show this QR code to the driver</div>
            </div>

            <div class="footer">
              <div>
                <div class="footer-label">Passenger</div>
                <div class="footer-value">${passengerName}</div>
              </div>
              <div style="text-align:right;">
                <div class="footer-label">Status</div>
                <div class="status">${statusBadge.label}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return uri;
  }, [
    displayDate,
    displayDepart,
    displayPrice,
    displaySeat,
    displayTicketType,
    getQrBase64,
    passengerName,
    statusBadge.label,
    ticket.busNumber,
    ticket.from,
    ticket.to,
    ticketReference,
  ]);

  const handleShare = useCallback(async () => {
    try {
      const pdfUri = await buildTicketPdf();
      await shareTicketPdf(pdfUri, "Share your TrackNGo bus ticket");
    } catch (error) {
      console.error("[ViewTicket] share failed", error);
      Alert.alert("Error", "Could not share this ticket right now.");
    }
  }, [buildTicketPdf]);

  const handleDownload = useCallback(async () => {
    try {
      const pdfUri = await buildTicketPdf();
      await downloadTicketPdf(pdfUri, `TrackNGo-Ticket-${ticketReference}.pdf`);
    } catch (error) {
      console.error("[ViewTicket] download failed", error);
      Alert.alert("Error", "Could not generate the ticket PDF. Please try again.");
    }
  }, [buildTicketPdf, ticketReference]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.headerIconButton}
            hitSlop={10}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#0f172a" />
          </Pressable>
          <Text style={styles.headerTitle}>View Ticket</Text>
          <Pressable style={styles.headerIconButton} hitSlop={10} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={21} color="#0f172a" />
          </Pressable>
        </View>

        <View style={styles.ticketCard}>
          <View style={styles.ticketTopRow}>
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>{displayTicketType}</Text>
            </View>
            <View style={styles.busIconWrap}>
              <Ionicons name="bus" size={22} color="#2871e6" />
            </View>
          </View>

          <Text style={styles.ticketRefLabel}>Ticket Reference</Text>
          <Text style={styles.ticketRefValue}>{ticketReference}</Text>

          <View style={styles.routeRow}>
            <View style={styles.routeCol}>
              <Text style={styles.routeMetaLabel}>From</Text>
              <Text numberOfLines={1} style={styles.routeCity}>
                {ticket.from}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={26} color="#111827" />
            <View style={[styles.routeCol, { alignItems: "flex-end" }]}>
              <Text style={styles.routeMetaLabel}>To</Text>
              <Text numberOfLines={1} style={styles.routeCity}>
                {ticket.to}
              </Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{displayDate}</Text>
            </View>
            <View style={[styles.metaItem, styles.metaRight]}>
              <Text style={styles.metaLabel}>Departure</Text>
              <Text style={styles.metaValue}>{displayDepart}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Seat Number</Text>
              <Text style={styles.metaValue}>{displaySeat}</Text>
            </View>
            <View style={[styles.metaItem, styles.metaRight]}>
              <Text style={styles.metaLabel}>Bus Number</Text>
              <Text style={styles.metaValue}>{ticket.busNumber || "--"}</Text>
            </View>
          </View>

          <Text style={styles.fareText}>{displayPrice}</Text>

          <View style={styles.qrSection}>
            <View style={styles.qrFrame}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
              <QRCode
                value={qrPayload}
                size={152}
                color="#0b0b0b"
                backgroundColor="#ffffff"
                ecl="M"
                getRef={(ref: any) => {
                  qrSvgRef.current = ref;
                }}
              />
              <View style={styles.scanBadge}>
                <Text style={styles.scanBadgeText}>SCAN ME</Text>
              </View>
            </View>
            <Text style={styles.scanTitle}>Scan at boarding</Text>
            <Text style={styles.scanSubtitle}>Show this QR code to the driver</Text>
          </View>

          <View style={styles.passengerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.footerLabel}>Passenger</Text>
              <Text style={styles.footerValue}>{passengerName}</Text>
            </View>
            <View style={styles.statusWrap}>
              <Text style={styles.footerLabel}>Status</Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusBadge.color }]} />
                <Text style={[styles.statusText, { color: statusBadge.color }]}>
                  {statusBadge.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Pressable style={styles.downloadButton} onPress={handleDownload}>
          <Ionicons name="download-outline" size={20} color="#ffffff" />
          <Text style={styles.downloadButtonText}>Download Ticket (PDF)</Text>
        </Pressable>

        <View style={styles.noteCard}>
          <View style={styles.noteHeader}>
            <Ionicons name="information-circle-outline" size={23} color="#111827" />
            <Text style={styles.noteTitle}>Important Note</Text>
          </View>
          <Text style={styles.noteBody}>
            Please arrive at the boarding point at least 15 minutes before departure.
            Keep your digital ticket ready for verification.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#edf1f6",
  },
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 26,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    color: "#111827",
  },
  ticketCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: "#e5eaf1",
  },
  ticketTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  typeChip: {
    borderRadius: 999,
    backgroundColor: "#dbeafe",
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  typeChipText: {
    color: "#266ddc",
    fontSize: 11,
    fontWeight: "700",
  },
  busIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#eaf1fb",
    alignItems: "center",
    justifyContent: "center",
  },
  ticketRefLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7a90",
    marginBottom: 3,
  },
  ticketRefValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1d6fe7",
    marginBottom: 10,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 6,
  },
  routeCol: {
    flex: 1,
  },
  routeMetaLabel: {
    fontSize: 11,
    color: "#7f90a8",
    fontWeight: "600",
    marginBottom: 3,
  },
  routeCity: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: "800",
    color: "#111827",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
    marginBottom: 8,
  },
  metaItem: {
    width: "50%",
    paddingRight: 6,
  },
  metaRight: {
    alignItems: "flex-end",
    paddingRight: 0,
    paddingLeft: 6,
  },
  metaLabel: {
    fontSize: 11,
    color: "#8b9cb4",
    fontWeight: "600",
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 20,
    lineHeight: 20,
    color: "#111827",
    fontWeight: "800",
  },
  fareText: {
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    color: "#0ea538",
    marginTop: 2,
    marginBottom: 10,
  },
  qrSection: {
    borderTopWidth: 1,
    borderTopColor: "#edf2f7",
    borderBottomWidth: 1,
    borderBottomColor: "#edf2f7",
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 14,
  },
  qrFrame: {
    position: "relative",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbe3ee",
    paddingHorizontal: 26,
    paddingTop: 22,
    paddingBottom: 14,
    alignItems: "center",
    width: "78%",
    maxWidth: 270,
  },
  corner: {
    position: "absolute",
    width: 20,
    height: 20,
    borderColor: "#111827",
  },
  cornerTopLeft: {
    top: 12,
    left: 12,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTopRight: {
    top: 12,
    right: 12,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBottomLeft: {
    bottom: 42,
    left: 12,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBottomRight: {
    bottom: 42,
    right: 12,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanBadge: {
    marginTop: 10,
    backgroundColor: "#0b0f18",
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  scanBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  scanTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "800",
    color: "#172119",
  },
  scanSubtitle: {
    marginTop: 3,
    color: "#6b7280",
    fontSize: 11,
  },
  passengerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  footerLabel: {
    color: "#8fa0b8",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 5,
  },
  footerValue: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
  },
  statusWrap: {
    alignItems: "flex-end",
    minWidth: 120,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  downloadButton: {
    marginTop: 18,
    marginHorizontal: 20,
    borderRadius: 15,
    backgroundColor: "#2c74e8",
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  downloadButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  noteCard: {
    marginTop: 22,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: "#fff4e7",
    borderWidth: 1,
    borderColor: "#f5dfc4",
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  noteTitle: {
    color: "#b45309",
    fontSize: 18,
    fontWeight: "800",
  },
  noteBody: {
    color: "#c2410c",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },
});
