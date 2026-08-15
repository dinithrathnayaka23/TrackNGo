import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  const [loading, setLoading] = useState(true);

  /**
   * Fetches both upcoming and past bookings from the API in parallel.
   */
  const load = useCallback(async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  }, []);

  // Automatically refresh data whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /**
   * Triggers a confirmation dialog before cancelling a booking.
   */
  const handleCancel = (ref: string) => {
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
              void load(); // Refresh the list
            } catch (e) {
              Alert.alert("Error", "Failed to cancel booking.");
            }
          },
        },
      ],
    );
  };

  // ── Navigation Handlers ────────────────────────────────

  const navigateToTicket = (b: BookingHistoryDto) => {
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
  };

  const navigateToRate = (b: BookingHistoryDto) => {
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
  };

  const navigateToComplaint = (b: BookingHistoryDto) => {
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
  };

  const data = tab === "upcoming" ? upcoming : past;

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
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {data.map((b) => (
            <BookingCard
              key={b.bookingReference}
              booking={b}
              isUpcoming={tab === "upcoming"}
              onTicket={() => navigateToTicket(b)}
              onRate={() => navigateToRate(b)}
              onComplaint={() => navigateToComplaint(b)}
              onCancel={() => handleCancel(b.bookingReference)}
              onTrack={() =>
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
                })
              }
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/**
 * BookingCard - Individual card displaying trip details and contextual actions.
 */
function BookingCard({
  booking: b,
  isUpcoming,
  onTicket,
  onRate,
  onComplaint,
  onCancel,
  onTrack,
}: {
  booking: BookingHistoryDto;
  isUpcoming: boolean;
  onTicket: () => void;
  onRate: () => void;
  onComplaint: () => void;
  onCancel: () => void;
  onTrack: () => void;
}) {
  const statusColor =
    b.status === "confirmed"
      ? "#16A34A"
      : b.status === "cancelled"
        ? "#DC2626"
        : "#6B7280";

  const statusLabel =
    b.status.charAt(0).toUpperCase() + b.status.slice(1);

  const formattedTime = (() => {
    try {
      const [h, m] = b.journeyTime.split(":");
      const d = new Date();
      d.setHours(Number(h), Number(m));
      return d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return b.journeyTime;
    }
  })();

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
        <View style={{ flex: 1 }}>
          <Text style={styles.locationLabel}>From</Text>
          <Text style={styles.locationValue} numberOfLines={1}>
            {b.startLocation}
          </Text>
        </View>
        <View style={styles.arrowWrap}>
          <View style={styles.arrowLine} />
          <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
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
        <Text style={styles.priceValue}>
          LKR {Number(b.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </Text>
      </View>

      {/* Actions */}
      {isUpcoming && b.status === "confirmed" ? (
        <View style={styles.actionRow}>
          <Pressable style={styles.primaryBtn} onPress={onTicket}>
            <Ionicons name="ticket-outline" size={15} color="#FFF" />
            <Text style={styles.primaryBtnText}>View Ticket</Text>
          </Pressable>
          <Pressable style={styles.trackBtn} onPress={onTrack}>
            <Ionicons name="location-outline" size={15} color="#2F6BFF" />
            <Text style={styles.trackBtnText}>Track</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
          </Pressable>
        </View>
      ) : null}

      {!isUpcoming && b.status !== "cancelled" ? (
        <View style={styles.pastActionRow}>
          <Pressable style={styles.secondaryActionBtn} onPress={onRate}>
            <Ionicons name="star" size={15} color="#475569" />
            <Text style={styles.secondaryActionText}>Rate</Text>
          </Pressable>
          <Pressable style={styles.secondaryActionBtn} onPress={onComplaint}>
            <Text style={styles.secondaryActionText}>Submit Complain</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function DetailItem({
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
      <View style={{ marginLeft: 6 }}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

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
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1F2937" },

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
  emptyText: { fontSize: 14, color: "#94A3B8", fontWeight: "500" },

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
  locationLabel: { fontSize: 11, color: "#94A3B8", marginBottom: 2 },
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
  detailLabel: { fontSize: 10, color: "#94A3B8" },
  detailValue: { fontSize: 12, fontWeight: "600", color: "#334155" },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E9EDF3",
  },
  priceLabel: { fontSize: 12, color: "#64748B" },
  priceValue: { fontSize: 16, fontWeight: "700", color: "#1F2937" },

  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pastActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  primaryBtnText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
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
  trackBtnText: { fontSize: 13, fontWeight: "600", color: "#2F6BFF" },
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
