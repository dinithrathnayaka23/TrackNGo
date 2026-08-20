import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  getUpcomingBookings,
  getPastBookings,
  cancelBooking,
  type BookingHistoryDto,
} from "../../services/bookingsApi";
import { useSession } from "../../store/sessionStore";
import { LocalizedText as Text } from "../../utils/i18n";

/**
 * BookingHistoryScreen - Manages and displays the user's trip history.
 * Divided into 'Upcoming' for future trips and 'Past' for completed or cancelled ones.
 */

type Tab = "upcoming" | "past";

export default function BookingHistoryScreen() {
  const router = useRouter();
  const { currentUser } = useSession();

  // State for tab selection and booking data
  const [tab, setTab] = useState<Tab>("upcoming");
  const [upcoming, setUpcoming] = useState<BookingHistoryDto[]>([]);
  const [past, setPast] = useState<BookingHistoryDto[]>([]);
  // The blocking spinner is only for the very first fetch; later refreshes keep
  // the existing list on screen so returning to this tab does not flash empty.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  /**
   * Fetches both upcoming and past bookings from the API in parallel.
   */
  const load = useCallback(async (mode: "initial" | "background" | "pull" = "background") => {
    if (inFlight.current) return; // A focus event mid-request must not queue a second fetch
    inFlight.current = true;
    if (mode === "pull") setRefreshing(true);
    try {
      const uid = currentUser?.userId ?? 0;
      const [u, p] = await Promise.all([
        getUpcomingBookings(uid),
        getPastBookings(uid),
      ]);
      setUpcoming(u);
      setPast(p);
    } catch (e) {
      console.error("[BookingHistory] load error", e);
    } finally {
      inFlight.current = false;
      if (mode === "pull") setRefreshing(false);
      setLoading(false);
    }
  }, [currentUser]);

  // Automatically refresh data whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void load("background");
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    void load("pull");
  }, [load]);

  /**
   * Triggers a confirmation dialog before cancelling a booking.
   */
  const handleCancel = useCallback((b: BookingHistoryDto) => {
    const ref = b.bookingReference;
    Alert.alert(
      "Cancel Booking",
      `Are you sure you want to cancel booking ${ref}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelBooking(ref);
              Alert.alert("Cancelled", "Your booking has been cancelled.");
              void load("background"); // Refresh the list
            } catch (e) {
              Alert.alert("Error", "Failed to cancel booking.");
            }
          },
        },
      ],
    );
  }, [load]);

  // ── Navigation Handlers ────────────────────────────────

  const navigateToTicket = useCallback((b: BookingHistoryDto) => {
    router.push({
      pathname: "/booking/view-ticket",
      params: {
        bookingRef: b.bookingReference,
        from: b.startLocation,
        to: b.endLocation,
        busNumber: b.busNumber,
        date: b.journeyDate,
        depart: b.journeyTime,
        seats: b.seatNumber,
        totalPrice: String(b.totalAmount),
        transactionId: b.transactionId ?? "",
        status: b.status,
        busType: b.busType,
      },
    });
  }, [router]);

  const navigateToRate = useCallback((b: BookingHistoryDto) => {
    router.push({
      pathname: "/booking/rate",
      params: {
        bookingRef: b.bookingReference,
        from: b.startLocation,
        to: b.endLocation,
        busNumber: b.busNumber,
        date: b.journeyDate,
        time: b.journeyTime,
      },
    });
  }, [router]);

  const navigateToComplaint = useCallback((b: BookingHistoryDto) => {
    router.push({
      pathname: "/booking/complaint",
      params: {
        bookingRef: b.bookingReference,
        from: b.startLocation,
        to: b.endLocation,
        busNumber: b.busNumber,
        date: b.journeyDate,
        time: b.journeyTime,
      },
    });
  }, [router]);

  const navigateToTrack = useCallback((b: BookingHistoryDto) => {
    router.push({
      pathname: "/map/live-map",
      params: {
        busNumber: b.busNumber,
        startLocation: b.startLocation,
        endLocation: b.endLocation,
        // Boarding is limited to the trip the seat is booked on,
        // so the map needs to know when that trip departs.
        journeyDate: b.journeyDate,
        journeyTime: b.journeyTime,
      },
    });
  }, [router]);

  const navigateToNegotiate = useCallback((b: BookingHistoryDto) => {
    if (b.busType !== "trip_booking") return;
    const tripId = b.bookingReference.replace("BK-", "");
    const advancePayment = Math.round(Number(b.totalAmount) * 0.15);
    router.push({
      pathname: "/trips/NegotiationScreen",
      params: {
        tripDetails: JSON.stringify({
          bookingId: tripId,
          pickup: b.startLocation,
          drop: b.endLocation,
          depart: b.journeyDate,
          busBrand: "Standard",
          busNumber: b.busNumber !== "PENDING" ? b.busNumber : "Pending Assignment",
          totalPayment: b.totalAmount,
          advancePayment,
          dueAmount: Number(b.totalAmount) - advancePayment,
        }),
      },
    });
  }, [router]);

  const data = tab === "upcoming" ? upcoming : past;
  const isUpcoming = tab === "upcoming";

  // Kept out of the render body so <BookingCard /> props stay referentially
  // stable and React.memo can skip untouched rows.
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BookingHistoryDto>) => (
      <BookingCard
        booking={item}
        isUpcoming={isUpcoming}
        onTicket={navigateToTicket}
        onRate={navigateToRate}
        onComplaint={navigateToComplaint}
        onCancel={handleCancel}
        onTrack={navigateToTrack}
        onNegotiate={navigateToNegotiate}
      />
    ),
    [
      isUpcoming,
      navigateToTicket,
      navigateToRate,
      navigateToComplaint,
      handleCancel,
      navigateToTrack,
      navigateToNegotiate,
    ],
  );

  const keyExtractor = useCallback((b: BookingHistoryDto) => b.bookingReference, []);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Tab Switcher: Upcoming vs Past */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabBtn, tab === "upcoming" && styles.tabBtnActive]}
          onPress={() => setTab("upcoming")}
        >
          <Text
            style={[
              styles.tabText,
              tab === "upcoming" && styles.tabTextActive,
            ]}
          >
            Upcoming
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabBtn, tab === "past" && styles.tabBtnActive]}
          onPress={() => setTab("past")}
        >
          <Text
            style={[styles.tabText, tab === "past" && styles.tabTextActive]}
          >
            Past
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2F6BFF" />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>
            No {tab === "upcoming" ? "upcoming" : "past"} bookings
          </Text>
        </View>
      ) : (
        <FlatList
          data={data}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          style={styles.bookingList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          // Only the visible window of cards is mounted; a long booking history
          // used to render every card up front, which is what made this screen lag.
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2F6BFF" />
          }
        />
      )}
    </SafeAreaView>
  );
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#16A34A",
  cancelled: "#DC2626",
  pending: "#F59E0B",
};

/** 24h "HH:mm[:ss]" -> "hh:mm AM/PM" without touching Intl, which is slow on device. */
function formatJourneyTime(value: string): string {
  const [h, m] = value.split(":");
  const hour = Number(h);
  const minute = Number(m);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** Groups the integer part in thousands and always shows 2 decimals. */
function formatAmount(value: number | string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  const [whole, fraction] = amount.toFixed(2).split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

/**
 * BookingCard - Individual card displaying trip details and contextual actions.
 */
const BookingCard = React.memo(function BookingCard({
  booking: b,
  isUpcoming,
  onTicket,
  onRate,
  onComplaint,
  onCancel,
  onTrack,
  onNegotiate,
}: {
  booking: BookingHistoryDto;
  isUpcoming: boolean;
  onTicket: (b: BookingHistoryDto) => void;
  onRate: (b: BookingHistoryDto) => void;
  onComplaint: (b: BookingHistoryDto) => void;
  onCancel: (b: BookingHistoryDto) => void;
  onTrack: (b: BookingHistoryDto) => void;
  onNegotiate: (b: BookingHistoryDto) => void;
}) {
  const status = b.status.toLowerCase();
  const paymentStatus = String(b.paymentStatus ?? "").toLowerCase();
  const isPaid = paymentStatus === "success" || paymentStatus === "paid";
  const isTripBooking = b.busType === "trip_booking";

  const statusColor = STATUS_COLORS[status] ?? "#6B7280";
  const statusLabel = b.status.charAt(0).toUpperCase() + b.status.slice(1);
  const formattedTime = useMemo(() => formatJourneyTime(b.journeyTime), [b.journeyTime]);
  const formattedAmount = useMemo(() => formatAmount(b.totalAmount), [b.totalAmount]);

  const handleTicket = useCallback(() => onTicket(b), [onTicket, b]);
  const handleRate = useCallback(() => onRate(b), [onRate, b]);
  const handleComplaint = useCallback(() => onComplaint(b), [onComplaint, b]);
  const handleCancelPress = useCallback(() => onCancel(b), [onCancel, b]);
  const handleTrack = useCallback(() => onTrack(b), [onTrack, b]);
  const handleNegotiate = useCallback(() => onNegotiate(b), [onNegotiate, b]);

  return (
    <View style={styles.card}>
      {/* Status & Ref */}
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {statusLabel}
          </Text>
        </View>
        <Text style={styles.refText}>{b.bookingReference}</Text>
      </View>

      {/* Route */}
      <View style={styles.routeRow}>
        <View style={styles.routeCol}>
          <Text style={styles.locationLabel}>From</Text>
          <Text style={styles.locationValue} numberOfLines={1}>
            {b.startLocation}
          </Text>
        </View>
        <View style={styles.arrowWrap}>
          <View style={styles.arrowLine} />
          <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
        </View>
        <View style={styles.routeColEnd}>
          <Text style={styles.locationLabel}>To</Text>
          <Text style={styles.locationValue} numberOfLines={1}>
            {b.endLocation}
          </Text>
        </View>
      </View>

      {/* Details Grid */}
      <View style={styles.detailsGrid}>
        <DetailItem icon="calendar-outline" label="Date" value={b.journeyDate} />
        <DetailItem icon="time-outline" label="Time" value={formattedTime} />
        <DetailItem icon="bus-outline" label="Bus" value={b.busNumber} />
        <DetailItem
          icon="grid-outline"
          label="Seat"
          value={b.seatNumber}
        />
      </View>

      {/* Price */}
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Total Amount</Text>
        <Text style={styles.priceValue}>LKR {formattedAmount}</Text>
      </View>

      {/* Actions */}
      {isUpcoming && status === "confirmed" && !(isTripBooking && !isPaid) ? (
        <View style={styles.actionRow}>
          <Pressable style={styles.primaryBtn} onPress={handleTicket}>
            <Ionicons name="ticket-outline" size={15} color="#FFF" />
            <Text style={styles.primaryBtnText}>View Ticket</Text>
          </Pressable>
          <Pressable style={styles.trackBtn} onPress={handleTrack}>
            <Ionicons name="location-outline" size={15} color="#2F6BFF" />
            <Text style={styles.trackBtnText}>Track</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={handleCancelPress}>
            <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
          </Pressable>
        </View>
      ) : isUpcoming &&
        isTripBooking &&
        (status === "pending" || status === "confirmed") &&
        !isPaid ? (
        <View style={styles.actionRow}>
          <Pressable style={styles.primaryBtn} onPress={handleNegotiate}>
            <Ionicons name="chatbubbles-outline" size={15} color="#FFF" />
            <Text style={styles.primaryBtnText}>{status === "confirmed" ? "Review Booking" : "Negotiate Booking"}</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={handleCancelPress}>
            <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
          </Pressable>
        </View>
      ) : null}

      {!isUpcoming && status !== "cancelled" ? (
        // "Submit Complain" needs a row of its own: three flex:1 buttons left it
        // about 60dp of text space, so the label broke mid-word.
        <View style={styles.pastActions}>
          <View style={styles.pastActionRow}>
            <Pressable style={styles.secondaryActionBtn} onPress={handleTicket}>
              <Ionicons name="ticket-outline" size={15} color="#475569" />
              <Text style={styles.secondaryActionText} numberOfLines={1}>
                View Ticket
              </Text>
            </Pressable>
            <Pressable style={styles.secondaryActionBtn} onPress={handleRate}>
              <Ionicons name="star" size={15} color="#F59E0B" />
              <Text style={styles.secondaryActionText} numberOfLines={1}>
                Rate
              </Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.secondaryActionBtn, styles.wideActionBtn]}
            onPress={handleComplaint}
          >
            <Ionicons name="chatbox-ellipses-outline" size={15} color="#475569" />
            <Text style={styles.secondaryActionText} numberOfLines={1}>
              Submit Complain
            </Text>
          </Pressable>
        </View>
      ) : !isUpcoming ? (
        <View style={styles.pastActionRow}>
          <Pressable style={styles.secondaryActionBtn} onPress={handleTicket}>
            <Ionicons name="ticket-outline" size={15} color="#475569" />
            <Text style={styles.secondaryActionText} numberOfLines={1}>
              View Ticket
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

const DetailItem = React.memo(function DetailItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={14} color="#94A3B8" />
      <View style={styles.detailTextWrap}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
});

// Stylesheet for the Booking History screen components
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F6F7F9" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937" },

  tabRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "#E9EDF3",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: "#FFFFFF", elevation: 1 },
  tabText: { fontSize: 13, fontWeight: "600", color: "#94A3B8" },
  tabTextActive: { color: "#2F6BFF" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 14, color: "#94A3B8", fontWeight: "600" },

  bookingList: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },
  refText: { fontSize: 11, color: "#94A3B8", fontWeight: "500" },

  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  routeCol: { flex: 1 },
  routeColEnd: { flex: 1, alignItems: "flex-end" },
  locationLabel: { fontSize: 11, fontWeight: "600", color: "#94A3B8", marginBottom: 2 },
  locationValue: { fontSize: 14, fontWeight: "600", color: "#1F2937" },
  arrowWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
  },
  arrowLine: {
    width: 24,
    height: 1,
    backgroundColor: "#E2E8F0",
    marginRight: 4,
  },

  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "45%",
  },
  detailTextWrap: { marginLeft: 6 },
  detailLabel: { fontSize: 11, fontWeight: "600", color: "#94A3B8" },
  detailValue: { fontSize: 13, fontWeight: "600", color: "#334155" },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E9EDF3",
  },
  priceLabel: { fontSize: 11, fontWeight: "600", color: "#64748B" },
  priceValue: { fontSize: 16, fontWeight: "700", color: "#1F2937" },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pastActions: {
    gap: 10,
  },
  pastActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  wideActionBtn: {
    // Cancels the flex:1 above so the button stretches across the row
    // instead of growing to fill the column.
    flex: 0,
    alignSelf: "stretch",
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2F6BFF",
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  primaryBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 5,
  },
  trackBtnText: { fontSize: 14, fontWeight: "700", color: "#2F6BFF" },
  cancelBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 10,
  },
  secondaryActionBtn: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
});
