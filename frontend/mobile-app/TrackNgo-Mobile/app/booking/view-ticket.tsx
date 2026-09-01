import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { downloadTicketPdf, generateTicketPdf, shareTicketPdf } from "../../utils/ticketPdf";
import {
  getPastBookings,
  getUpcomingBookings,
  requestBookingCancellation,
  respondToBookingCancellation,
  type BookingHistoryDto,
} from "../../services/bookingsApi";
import {
  requestTripCancellation,
  respondToTripCancellation,
} from "../../services/tripBookingsApi";
import { getUserProfile } from "../../services/userProfileApi";
import { formatBusTypeLabel } from "../../utils/busLabels";
import { useSession } from "../../store/sessionStore";
import { LocalizedText as Text } from "../../utils/i18n";

// Mirrors MAX_CANCEL_REASON_LENGTH in the backend's BookingFlowService/TripBookingService.
const MAX_CANCEL_REASON_LENGTH = 300;

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
  cancellationStatus?: string | null;
  cancellationReason?: string | null;
  cancellationRequestedBy?: string | null;
  cancellationRejectReason?: string | null;
  refundPercentage?: number | null;
};

function toUpperTrimmed(value?: string | null): string {
  return (value ?? "").trim().toUpperCase();
}

function formatTicketTypeLabel(rawType?: string): string {
  const normalized = (rawType ?? "").toLowerCase().replace(/-/g, "_").trim();
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
    cancellationStatus: booking.cancellationStatus || current.cancellationStatus,
    cancellationReason: booking.cancellationReason || current.cancellationReason,
    cancellationRequestedBy: booking.cancellationRequestedBy || current.cancellationRequestedBy,
    cancellationRejectReason: booking.cancellationRejectReason || current.cancellationRejectReason,
    refundPercentage: booking.refundPercentage ?? current.refundPercentage,
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

function getStatusBadge(statusRaw: string, cancelStatus?: string | null): { label: string; color: string } {
  const cancel = (cancelStatus || "").toLowerCase();
  if (cancel === "requested_by_admin") {
    return { label: "Admin Cancel Req", color: "#D97706" };
  }
  if (cancel === "requested_by_user") {
    return { label: "Cancel Pending", color: "#2563EB" };
  }
  const normalized = statusRaw.toLowerCase();
  if (normalized.includes("cancel")) {
    return { label: "Cancelled", color: "#ef4444" };
  }
  if (normalized.includes("pending")) {
    return { label: "Pending", color: "#f59e0b" };
  }
  return { label: "Confirmed", color: "#22c55e" };
}

// Mirrors REFUND_CUTOFF_HOURS / REFUND_PERCENTAGE_BEFORE_CUTOFF /
// REFUND_PERCENTAGE_AFTER_CUTOFF in the backend's BookingFlowService.
const REFUND_CUTOFF_HOURS = 5;

function calculateRefundPolicy(journeyDateStr?: string | null, journeyTimeStr?: string | null) {
  const refundMessage = "A 75% refund will be credited to your account within 10 working business days.";
  const noRefundMessage =
    `This booking is less than ${REFUND_CUTOFF_HOURS} hours from departure, so it will not be eligible for a refund.`;

  if (!journeyDateStr) {
    return { percentage: 75, severity: "amber" as const, message: refundMessage };
  }
  const [year, month, day] = journeyDateStr.split("-").map(Number);
  const [hour, minute] = (journeyTimeStr ?? "").split(":").map(Number);
  const departure = new Date(
    year,
    (month || 1) - 1,
    day || 1,
    Number.isFinite(hour) ? hour : 0,
    Number.isFinite(minute) ? minute : 0,
  );
  const hoursUntilDeparture = (departure.getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursUntilDeparture >= REFUND_CUTOFF_HOURS) {
    return { percentage: 75, severity: "amber" as const, message: refundMessage };
  }
  return { percentage: 0, severity: "red" as const, message: noRefundMessage };
}

// Trip-booking cancellation still goes through admin approval and keeps its
// own day-based refund policy in the backend's TripBookingService (100% if
// cancelled ≥3 days before departure, 75% otherwise) — unlike seat bookings,
// this is unaffected by the 5-hour rule above.
function calculateTripRefundPolicy(journeyDateStr?: string | null) {
  const fullRefundMessage = "Full refund will be credited to your account within 10 working business days.";
  const partialRefundMessage =
    "Only a 75% refund will be credited to your account within 10 working business days (25% cancellation penalty applied).";

  if (!journeyDateStr) {
    return { percentage: 100, severity: "green" as const, message: fullRefundMessage };
  }
  const [year, month, day] = journeyDateStr.split("-").map(Number);
  const journeyDate = new Date(year, (month || 1) - 1, day || 1);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const journeyStart = new Date(journeyDate.getFullYear(), journeyDate.getMonth(), journeyDate.getDate());
  const diffDays = Math.round((journeyStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays >= 3) {
    return { percentage: 100, severity: "green" as const, message: fullRefundMessage };
  }
  return { percentage: 75, severity: "amber" as const, message: partialRefundMessage };
}

export default function ViewTicketScreen() {
  const router = useRouter();
  const { currentUser } = useSession();
  const params = useLocalSearchParams<TicketQueryParams>();
  const qrSvgRef = useRef<any>(null);

  // Cancellation Modal State
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Decline Admin Request Modal State
  const [declineModalVisible, setDeclineModalVisible] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submittingDecline, setSubmittingDecline] = useState(false);

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

  const cancelPolicy = useMemo(() => {
    const isTrip = ticket.busType === "trip_booking" || ticket.busType === "trip";
    return isTrip
      ? calculateTripRefundPolicy(ticket.date)
      : calculateRefundPolicy(ticket.date, ticket.depart);
  }, [ticket.date, ticket.depart, ticket.busType]);

  const reloadBookingDetails = useCallback(async () => {
    if (!currentUser || !ticket.bookingRef) return;
    try {
      const [upcoming, past] = await Promise.all([
        getUpcomingBookings(currentUser.userId),
        getPastBookings(currentUser.userId),
      ]);
      const all = [...upcoming, ...past];
      const found = all.find((item) => item.bookingReference === ticket.bookingRef);
      if (found) {
        setTicket((prev) => mergeWithBookingHistory(prev, found));
      }
    } catch (error) {
      console.error("[ViewTicket] Could not load booking details", error);
    }
  }, [currentUser, ticket.bookingRef]);

  useEffect(() => {
    setTicket(paramsSnapshot);
  }, [paramsSnapshot]);

  useEffect(() => {
    if (!params.passengerName) return;
    setPassengerName(params.passengerName.trim() || "Passenger");
  }, [params.passengerName]);

  useEffect(() => {
    void reloadBookingDetails();
  }, [reloadBookingDetails]);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;

    (async () => {
      try {
        const profile = await getUserProfile(currentUser.userId);
        if (!active) return;
        const resolvedName = profile.fullName?.trim();
        if (resolvedName) {
          setPassengerName(resolvedName);
        }
      } catch (error) {
        console.error("[ViewTicket] Failed to fetch passenger name", error);
      }
    })();

    return () => {
      active = false;
    };
  }, [currentUser]);

  const qrPayload = useMemo(() => {
    return JSON.stringify({
      bookingRef: ticket.bookingRef,
      from: ticket.from,
      to: ticket.to,
      busNumber: ticket.busNumber,
      seats: ticket.seats,
      date: ticket.date,
      depart: ticket.depart,
      passenger: passengerName,
      status: ticket.status,
    });
  }, [ticket, passengerName]);

  const captureQrDataUrl = useCallback(async (): Promise<string | undefined> => {
    if (!qrSvgRef.current?.toDataURL) return undefined;
    return new Promise<string | undefined>((resolve) => {
      try {
        qrSvgRef.current.toDataURL((data: string) => {
          resolve(data ? `data:image/png;base64,${data}` : undefined);
        });
      } catch {
        resolve(undefined);
      }
    });
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const qrDataUrl = await captureQrDataUrl();
      const uri = await generateTicketPdf({
        bookingRef: ticket.bookingRef,
        from: ticket.from,
        to: ticket.to,
        busNumber: ticket.busNumber,
        depart: ticket.depart,
        date: ticket.date,
        seats: ticket.seats,
        totalPrice: ticket.totalPrice,
        status: ticket.status,
        passengerName,
        busType: ticket.busType,
        qrDataUrl,
      });
      await downloadTicketPdf(uri, `TrackNGo-Ticket-${ticket.bookingRef}.pdf`);
    } catch (error) {
      console.error("[ViewTicket] Download ticket failed", error);
      Alert.alert("Error", "Could not generate or open the PDF.");
    }
  }, [captureQrDataUrl, passengerName, ticket]);

  const handleShare = useCallback(async () => {
    try {
      const qrDataUrl = await captureQrDataUrl();
      const uri = await generateTicketPdf({
        bookingRef: ticket.bookingRef,
        from: ticket.from,
        to: ticket.to,
        busNumber: ticket.busNumber,
        depart: ticket.depart,
        date: ticket.date,
        seats: ticket.seats,
        totalPrice: ticket.totalPrice,
        status: ticket.status,
        passengerName,
        busType: ticket.busType,
        qrDataUrl,
      });
      await shareTicketPdf(uri, "Share your TrackNGo bus ticket");
    } catch (error) {
      console.error("[ViewTicket] Share ticket failed", error);
      Alert.alert("Error", "Could not share the ticket PDF.");
    }
  }, [captureQrDataUrl, passengerName, ticket]);

  /**
   * Accepts an admin-initiated cancellation.
   */
  const handleAcceptAdminCancellation = useCallback(async () => {
    Alert.alert(
      "Accept Cancellation",
      "Are you sure you want to accept this cancellation? The refund will be redirected to your account within 10 working business days.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Accept Cancellation",
          style: "destructive",
          onPress: async () => {
            try {
              if (ticket.busType === "trip_booking" || ticket.busType === "trip") {
                const numericId = Number(ticket.bookingRef.replace(/^BK-/, ""));
                await respondToTripCancellation(numericId, true);
              } else {
                await respondToBookingCancellation(ticket.bookingRef, true);
              }
              Alert.alert(
                "Accepted",
                "Cancellation accepted. The refund will be redirected to your account within 10 working business days.",
                [{ text: "OK", onPress: () => router.back() }]
              );
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to accept cancellation.");
            }
          },
        },
      ],
    );
  }, [ticket, router]);

  /**
   * Submits passenger's decline to an admin cancellation request.
   */
  const handleSubmitDeclineAdminCancellation = useCallback(async () => {
    setSubmittingDecline(true);
    try {
      if (ticket.busType === "trip_booking" || ticket.busType === "trip") {
        const numericId = Number(ticket.bookingRef.replace(/^BK-/, ""));
        await respondToTripCancellation(numericId, false, declineReason.trim() || undefined);
      } else {
        await respondToBookingCancellation(ticket.bookingRef, false, declineReason.trim() || undefined);
      }
      setDeclineModalVisible(false);
      Alert.alert("Declined", "You have declined the cancellation request.");
      void reloadBookingDetails();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to decline cancellation.");
    } finally {
      setSubmittingDecline(false);
    }
  }, [ticket, declineReason, reloadBookingDetails]);

  const displayDate = formatDateLabel(ticket.date);
  const displayTime = formatDepartureLabel(ticket.depart);
  const displaySeat = formatSeatLabel(ticket.seats);
  const displayPrice = formatCurrency(ticket.totalPrice);
  const typeLabel = formatTicketTypeLabel(ticket.busType);
  const statusBadge = getStatusBadge(ticket.status, ticket.cancellationStatus);

  const isUserCancelRequested = ticket.cancellationStatus === "requested_by_user";
  const isAdminCancelRequested = ticket.cancellationStatus === "requested_by_admin";
  const isCancelRejected = ticket.cancellationStatus === "rejected";
  const isTripBooking = ticket.busType === "trip_booking" || ticket.busType === "trip";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle}>View Ticket</Text>
          <Pressable style={styles.iconButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color="#111827" />
          </Pressable>
        </View>

        {/* ── Cancellation Banners in View Ticket ── */}
        {isAdminCancelRequested && (
          <View style={styles.adminCancelBanner}>
            <View style={styles.bannerHeaderRow}>
              <Ionicons name="alert-circle" size={20} color="#D97706" />
              <Text style={styles.adminCancelBannerTitle}>Admin Requested Cancellation</Text>
            </View>
            <Text style={styles.bannerBodyText}>
              Reason: &ldquo;{ticket.cancellationReason || "Operational adjustment"}&rdquo;
            </Text>
            <Text style={styles.bannerRefundSubText}>
              The refund will be redirected to the account within 10 working business days.
            </Text>
            <View style={styles.adminCancelActionRow}>
              <Pressable style={styles.acceptAdminBtn} onPress={handleAcceptAdminCancellation}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
                <Text style={styles.acceptAdminBtnText}>Accept Cancellation</Text>
              </Pressable>
              <Pressable
                style={styles.declineAdminBtn}
                onPress={() => {
                  setDeclineReason("");
                  setDeclineModalVisible(true);
                }}
              >
                <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                <Text style={styles.declineAdminBtnText}>Decline</Text>
              </Pressable>
            </View>
          </View>
        )}

        {isUserCancelRequested && (
          <View style={styles.userCancelBanner}>
            <View style={styles.bannerHeaderRow}>
              <Ionicons name="time" size={18} color="#2563EB" />
              <Text style={styles.userCancelBannerTitle}>Cancellation Requested</Text>
            </View>
            <Text style={styles.bannerBodyText}>
              Awaiting admin review. Reason: &ldquo;{ticket.cancellationReason || "Not specified"}&rdquo;
            </Text>
            <Text style={styles.bannerRefundSubText}>
              Policy: {ticket.refundPercentage ?? 100}% refund redirected within 10 business days upon approval.
            </Text>
          </View>
        )}

        {isCancelRejected && (
          <View style={styles.rejectedCancelBanner}>
            <View style={styles.bannerHeaderRow}>
              <Ionicons name="information-circle" size={18} color="#DC2626" />
              <Text style={styles.rejectedCancelBannerTitle}>Cancellation Request Rejected</Text>
            </View>
            <Text style={styles.bannerBodyText}>
              Admin note: &ldquo;{ticket.cancellationRejectReason || "Request declined"}&rdquo;
            </Text>
            <Pressable
              style={styles.reRequestBtn}
              onPress={() => {
                setCancelReason("");
                setCancelModalVisible(true);
              }}
            >
              <Ionicons name="refresh-outline" size={15} color="#DC2626" />
              <Text style={styles.reRequestBtnText}>Request Cancellation Again</Text>
            </Pressable>
          </View>
        )}

        {/* Ticket Card */}
        <View style={styles.ticketCard}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Ionicons name="bus-outline" size={18} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ticketType}>{typeLabel}</Text>
              <Text style={styles.ticketRef}>{formatTicketReference(ticket.bookingRef)}</Text>
            </View>
          </View>

          <View style={styles.dashedDivider} />

          <View style={styles.routeContainer}>
            <View style={styles.routeLeft}>
              <View style={styles.circleMarker} />
              <View style={styles.dottedTrack} />
              <View style={styles.squareMarker} />
            </View>
            <View style={styles.routeRight}>
              <View style={styles.locationBlock}>
                <Text style={styles.locationHeading}>FROM</Text>
                <Text style={styles.locationTitle}>{ticket.from}</Text>
              </View>
              <View style={[styles.locationBlock, { marginTop: 22 }]}>
                <Text style={styles.locationHeading}>TO</Text>
                <Text style={styles.locationTitle}>{ticket.to}</Text>
              </View>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{displayDate}</Text>
            </View>
            <View style={[styles.metaItem, styles.metaRight]}>
              <Text style={styles.metaLabel}>Departure</Text>
              <Text style={styles.metaValue}>{displayTime}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Seat</Text>
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

        {/* Cancellation Action Button (Only when not already requested or cancelled) */}
        {!isUserCancelRequested && !isAdminCancelRequested && ticket.status.toLowerCase() === "confirmed" && (
          <Pressable
            style={styles.cancelTicketButton}
            onPress={() => {
              setCancelReason("");
              setCancelModalVisible(true);
            }}
          >
            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
            <Text style={styles.cancelTicketButtonText}>
              {isTripBooking ? "Request Cancellation" : "Cancel Booking"}
            </Text>
          </Pressable>
        )}

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

      {/* Cancellation Request Modal */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submittingCancel) setCancelModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="alert-circle" size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{isTripBooking ? "Request Cancellation" : "Cancel Booking"}</Text>
                <Text style={styles.modalSubtitle}>
                  {ticket.bookingRef} • {ticket.from} to {ticket.to}
                </Text>
              </View>
              <Pressable
                onPress={() => setCancelModalVisible(false)}
                disabled={submittingCancel}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            {/* Refund Policy Box */}
            <View style={[
              styles.policyBox,
              cancelPolicy.severity === "green"
                ? styles.policyBoxGreen
                : cancelPolicy.severity === "amber"
                ? styles.policyBoxAmber
                : styles.policyBoxRed,
            ]}>
              <View style={styles.policyHeaderRow}>
                <Ionicons
                  name={cancelPolicy.severity === "green" ? "checkmark-circle" : cancelPolicy.severity === "amber" ? "information-circle" : "alert-circle"}
                  size={18}
                  color={cancelPolicy.severity === "green" ? "#16A34A" : cancelPolicy.severity === "amber" ? "#D97706" : "#DC2626"}
                />
                <Text style={[styles.policyBadgeText, { color: cancelPolicy.severity === "green" ? "#16A34A" : cancelPolicy.severity === "amber" ? "#D97706" : "#DC2626" }]}>
                  {cancelPolicy.percentage}% Refund Policy
                </Text>
              </View>
              <Text style={styles.policyDescription}>{cancelPolicy.message}</Text>
            </View>

            {/* Reason Input */}
            <Text style={styles.inputLabel}>
              Reason for Cancellation <Text style={{ color: "#DC2626" }}>*</Text>
            </Text>
            <TextInput
              style={styles.textArea}
              placeholder="Please explain why you need to cancel this booking..."
              placeholderTextColor="#94A3B8"
              value={cancelReason}
              onChangeText={(text) => setCancelReason(text.slice(0, MAX_CANCEL_REASON_LENGTH))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!submittingCancel}
              maxLength={MAX_CANCEL_REASON_LENGTH}
            />
            <Text style={styles.charCount}>{cancelReason.length}/{MAX_CANCEL_REASON_LENGTH}</Text>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setCancelModalVisible(false)}
                disabled={submittingCancel}
              >
                <Text style={styles.modalCancelBtnText}>Keep Booking</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmitBtn, (!cancelReason.trim() || submittingCancel) && styles.btnDisabled]}
                onPress={async () => {
                  if (!cancelReason.trim()) {
                    Alert.alert("Reason Required", "Please provide a reason for cancelling this booking.");
                    return;
                  }
                  setSubmittingCancel(true);
                  try {
                    if (ticket.busType === "trip_booking" || ticket.busType === "trip") {
                      const numericId = Number(ticket.bookingRef.replace(/^BK-/, ""));
                      await requestTripCancellation(numericId, cancelReason.trim());
                      setCancelModalVisible(false);
                      Alert.alert(
                        "Cancellation Requested",
                        "Your cancellation request has been sent to the admin team for review.",
                      );
                    } else {
                      const result = await requestBookingCancellation(ticket.bookingRef, cancelReason.trim());
                      setCancelModalVisible(false);
                      Alert.alert("Booking Cancelled", result.refundMessage);
                    }
                    void reloadBookingDetails();
                  } catch (err: any) {
                    Alert.alert("Error", err.message || "Failed to cancel this booking.");
                  } finally {
                    setSubmittingCancel(false);
                  }
                }}
                disabled={!cancelReason.trim() || submittingCancel}
              >
                {submittingCancel ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>
                    {isTripBooking ? "Submit Request" : "Cancel Booking"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Decline Admin Cancellation Modal */}
      <Modal
        visible={declineModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submittingDecline) setDeclineModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: "#FEF2F2" }]}>
                <Ionicons name="close-circle" size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Decline Admin Cancellation</Text>
                <Text style={styles.modalSubtitle}>{ticket.bookingRef}</Text>
              </View>
              <Pressable
                onPress={() => setDeclineModalVisible(false)}
                disabled={submittingDecline}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Reason (Optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="State why you wish to keep this booking active..."
              placeholderTextColor="#94A3B8"
              value={declineReason}
              onChangeText={(text) => setDeclineReason(text.slice(0, MAX_CANCEL_REASON_LENGTH))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!submittingDecline}
              maxLength={MAX_CANCEL_REASON_LENGTH}
            />
            <Text style={styles.charCount}>{declineReason.length}/{MAX_CANCEL_REASON_LENGTH}</Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setDeclineModalVisible(false)}
                disabled={submittingDecline}
              >
                <Text style={styles.modalCancelBtnText}>Dismiss</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSubmitBtn, { backgroundColor: "#DC2626" }, submittingDecline && styles.btnDisabled]}
                onPress={handleSubmitDeclineAdminCancellation}
                disabled={submittingDecline}
              >
                {submittingDecline ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Decline Request</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },

  /* ── Cancellation Banners ── */
  userCancelBanner: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  userCancelBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  adminCancelBanner: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  adminCancelBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#B45309",
  },
  rejectedCancelBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  rejectedCancelBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#B91C1C",
  },
  bannerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  bannerBodyText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
    marginTop: 2,
  },
  bannerRefundSubText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 5,
    fontWeight: "500",
  },
  adminCancelActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  acceptAdminBtn: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16A34A",
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  acceptAdminBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  declineAdminBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DC2626",
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  declineAdminBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },
  reRequestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DC2626",
    borderRadius: 10,
    paddingVertical: 9,
    marginTop: 10,
    gap: 6,
  },
  reRequestBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },

  ticketCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#2c74e8",
    alignItems: "center",
    justifyContent: "center",
  },
  ticketType: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  ticketRef: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 1,
    fontWeight: "500",
  },
  dashedDivider: {
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginVertical: 14,
  },
  routeContainer: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 16,
  },
  routeLeft: {
    width: 22,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  circleMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2c74e8",
  },
  dottedTrack: {
    width: 2,
    flex: 1,
    marginVertical: 4,
    borderStyle: "dotted",
    borderWidth: 1,
    borderColor: "#94a3b8",
  },
  squareMarker: {
    width: 9,
    height: 9,
    backgroundColor: "#0ea5e9",
  },
  routeRight: {
    flex: 1,
    marginLeft: 8,
  },
  locationBlock: {
    justifyContent: "center",
  },
  locationHeading: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  locationTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 1,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  metaItem: {
    width: "50%",
  },
  metaRight: {
    alignItems: "flex-end",
  },
  metaLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  fareText: {
    marginTop: 14,
    textAlign: "center",
    color: "#16a34a",
    fontSize: 16,
    fontWeight: "800",
  },
  qrSection: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  qrFrame: {
    position: "relative",
    padding: 10,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  corner: {
    position: "absolute",
    width: 14,
    height: 14,
    borderColor: "#2c74e8",
  },
  cornerTopLeft: {
    top: 2,
    left: 2,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
  },
  cornerTopRight: {
    top: 2,
    right: 2,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
  },
  cornerBottomLeft: {
    bottom: 2,
    left: 2,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
  },
  cornerBottomRight: {
    bottom: 2,
    right: 2,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
  },
  scanBadge: {
    marginTop: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  scanBadgeText: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  scanTitle: {
    marginTop: 10,
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  scanSubtitle: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
  passengerRow: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  footerValue: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  statusWrap: {
    alignItems: "flex-end",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
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
    marginHorizontal: 10,
    borderRadius: 15,
    backgroundColor: "#2c74e8",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  downloadButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  cancelTicketButton: {
    marginTop: 10,
    marginHorizontal: 10,
    borderRadius: 15,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cancelTicketButtonText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "700",
  },
  noteCard: {
    marginTop: 18,
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
    marginBottom: 6,
  },
  noteTitle: {
    color: "#b45309",
    fontSize: 16,
    fontWeight: "800",
  },
  noteBody: {
    color: "#c2410c",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "500",
  },

  /* ── Modal Styles ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  modalHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  policyBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  policyBoxGreen: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  policyBoxAmber: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  policyBoxRed: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  policyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  policyBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  policyDescription: {
    fontSize: 12,
    color: "#334155",
    lineHeight: 17,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  textArea: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#0F172A",
    minHeight: 80,
    marginBottom: 4,
  },
  charCount: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    textAlign: "right",
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  modalSubmitBtn: {
    flex: 1.3,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSubmitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
