import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  type ListRenderItemInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  getUpcomingBookings,
  getPastBookings,
  requestBookingCancellation,
  respondToBookingCancellation,
  type BookingHistoryDto,
} from "../../services/bookingsApi";
import {
  requestTripCancellation,
  respondToTripCancellation,
} from "../../services/tripBookingsApi";
import { useSession } from "../../store/sessionStore";
import { LocalizedText as Text } from "../../utils/i18n";

// Mirrors MAX_CANCEL_REASON_LENGTH in the backend's BookingFlowService/TripBookingService.
const MAX_CANCEL_REASON_LENGTH = 300;

/**
 * Calculates refund policy details based on departure date:
 * - If >= 3 days: 100% full refund within 10 business days.
 * - If < 3 days: 75% refund within 10 business days.
 */
function calculateRefundPolicy(journeyDateStr?: string | null) {
  if (!journeyDateStr) {
    return {
      percentage: 100,
      isFullRefund: true,
      message: "Full refund will be credited to your account within 10 working business days.",
    };
  }
  const [year, month, day] = journeyDateStr.split("-").map(Number);
  const journeyDate = new Date(year, (month || 1) - 1, day || 1);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const journeyStart = new Date(journeyDate.getFullYear(), journeyDate.getMonth(), journeyDate.getDate());
  const diffDays = Math.round((journeyStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays >= 3) {
    return {
      percentage: 100,
      isFullRefund: true,
      message: "Full refund will be credited to your account within 10 working business days.",
    };
  } else {
    return {
      percentage: 75,
      isFullRefund: false,
      message: "Only a 75% refund will be credited to your account within 10 working business days (25% cancellation penalty applied).",
    };
  }
}

type Tab = "upcoming" | "past";

export default function BookingHistoryScreen() {
  const router = useRouter();
  const { currentUser } = useSession();

  // State for tab selection and booking data
  const [tab, setTab] = useState<Tab>("upcoming");
  const [upcoming, setUpcoming] = useState<BookingHistoryDto[]>([]);
  const [past, setPast] = useState<BookingHistoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  // Cancellation Modal State
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<BookingHistoryDto | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Decline Admin Request Modal State
  const [declineModalVisible, setDeclineModalVisible] = useState(false);
  const [selectedBookingForDecline, setSelectedBookingForDecline] = useState<BookingHistoryDto | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [submittingDecline, setSubmittingDecline] = useState(false);

  /**
   * Fetches both upcoming and past bookings from the API in parallel.
   */
  const load = useCallback(async (mode: "initial" | "background" | "pull" = "background") => {
    if (inFlight.current) return;
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

  useFocusEffect(
    useCallback(() => {
      void load("background");
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    void load("pull");
  }, [load]);

  /**
   * Opens the Cancellation Request modal.
   */
  const handleOpenCancelModal = useCallback((b: BookingHistoryDto) => {
    setSelectedBookingForCancel(b);
    setCancelReason("");
    setCancelModalVisible(true);
  }, []);

  /**
   * Submits user's cancellation request with mandatory reason.
   */
  const handleSubmitCancellationRequest = useCallback(async () => {
    if (!selectedBookingForCancel) return;
    if (!cancelReason.trim()) {
      Alert.alert("Reason Required", "Please provide a reason for cancelling this booking.");
      return;
    }
    setSubmittingCancel(true);
    try {
      if (selectedBookingForCancel.busType === "trip_booking") {
        const numericId = Number(selectedBookingForCancel.bookingReference.replace(/^BK-/, ""));
        await requestTripCancellation(numericId, cancelReason.trim());
      } else {
        await requestBookingCancellation(selectedBookingForCancel.bookingReference, cancelReason.trim());
      }
      setCancelModalVisible(false);
      Alert.alert(
        "Cancellation Requested",
        "Your cancellation request has been sent to the admin team for review. You will receive an update shortly.",
      );
      void load("background");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit cancellation request.");
    } finally {
      setSubmittingCancel(false);
    }
  }, [selectedBookingForCancel, cancelReason, load]);

  /**
   * Accepts an admin-initiated cancellation.
   */
  const handleAcceptAdminCancellation = useCallback(async (b: BookingHistoryDto) => {
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
              if (b.busType === "trip_booking") {
                const numericId = Number(b.bookingReference.replace(/^BK-/, ""));
                await respondToTripCancellation(numericId, true);
              } else {
                await respondToBookingCancellation(b.bookingReference, true);
              }
              Alert.alert("Accepted", "Cancellation accepted. The refund will be redirected to your account within 10 working business days.");
              void load("background");
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to accept cancellation.");
            }
          },
        },
      ],
    );
  }, [load]);

  /**
   * Opens the Decline modal for admin cancellation.
   */
  const handleOpenDeclineModal = useCallback((b: BookingHistoryDto) => {
    setSelectedBookingForDecline(b);
    setDeclineReason("");
    setDeclineModalVisible(true);
  }, []);

  /**
   * Submits passenger's decline to an admin cancellation request.
   */
  const handleSubmitDeclineAdminCancellation = useCallback(async () => {
    if (!selectedBookingForDecline) return;
    setSubmittingDecline(true);
    try {
      if (selectedBookingForDecline.busType === "trip_booking") {
        const numericId = Number(selectedBookingForDecline.bookingReference.replace(/^BK-/, ""));
        await respondToTripCancellation(numericId, false, declineReason.trim() || undefined);
      } else {
        await respondToBookingCancellation(selectedBookingForDecline.bookingReference, false, declineReason.trim() || undefined);
      }
      setDeclineModalVisible(false);
      Alert.alert("Declined", "You have declined the cancellation request.");
      void load("background");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to decline cancellation.");
    } finally {
      setSubmittingDecline(false);
    }
  }, [selectedBookingForDecline, declineReason, load]);

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

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BookingHistoryDto>) => (
      <BookingCard
        booking={item}
        isUpcoming={isUpcoming}
        onTicket={navigateToTicket}
        onRate={navigateToRate}
        onComplaint={navigateToComplaint}
        onRequestCancel={handleOpenCancelModal}
        onAcceptAdminCancel={handleAcceptAdminCancellation}
        onDeclineAdminCancel={handleOpenDeclineModal}
        onTrack={navigateToTrack}
        onNegotiate={navigateToNegotiate}
      />
    ),
    [
      isUpcoming,
      navigateToTicket,
      navigateToRate,
      navigateToComplaint,
      handleOpenCancelModal,
      handleAcceptAdminCancellation,
      handleOpenDeclineModal,
      navigateToTrack,
      navigateToNegotiate,
    ],
  );

  const keyExtractor = useCallback((b: BookingHistoryDto) => b.bookingReference, []);

  const cancelPolicy = useMemo(
    () => calculateRefundPolicy(selectedBookingForCancel?.journeyDate),
    [selectedBookingForCancel],
  );

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
            style={[
              styles.tabText,
              tab === "past" && styles.tabTextActive,
            ]}
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
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
          removeClippedSubviews
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2F6BFF" />
          }
        />
      )}

      {/* ── Cancellation Request Modal ── */}
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
                <Text style={styles.modalTitle}>Request Cancellation</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedBookingForCancel?.bookingReference} • {selectedBookingForCancel?.startLocation} to {selectedBookingForCancel?.endLocation}
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
            <View style={[styles.policyBox, cancelPolicy.isFullRefund ? styles.policyBoxGreen : styles.policyBoxAmber]}>
              <View style={styles.policyHeaderRow}>
                <Ionicons
                  name={cancelPolicy.isFullRefund ? "checkmark-circle" : "information-circle"}
                  size={18}
                  color={cancelPolicy.isFullRefund ? "#16A34A" : "#D97706"}
                />
                <Text style={[styles.policyBadgeText, { color: cancelPolicy.isFullRefund ? "#16A34A" : "#D97706" }]}>
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
                onPress={handleSubmitCancellationRequest}
                disabled={!cancelReason.trim() || submittingCancel}
              >
                {submittingCancel ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Submit Request</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Decline Admin Cancellation Modal ── */}
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
                <Text style={styles.modalSubtitle}>
                  {selectedBookingForDecline?.bookingReference}
                </Text>
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

const STATUS_COLORS: Record<string, string> = {
  confirmed: "#16A34A",
  cancelled: "#DC2626",
  pending: "#F59E0B",
};

/** 24h "HH:mm[:ss]" -> "hh:mm AM/PM" */
function formatJourneyTime(value?: string): string {
  if (!value) return "--:--";
  const [h, m] = value.split(":");
  const hour = Number(h);
  const minute = Number(m);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
}

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
  onRequestCancel,
  onAcceptAdminCancel,
  onDeclineAdminCancel,
  onTrack,
  onNegotiate,
}: {
  booking: BookingHistoryDto;
  isUpcoming: boolean;
  onTicket: (b: BookingHistoryDto) => void;
  onRate: (b: BookingHistoryDto) => void;
  onComplaint: (b: BookingHistoryDto) => void;
  onRequestCancel: (b: BookingHistoryDto) => void;
  onAcceptAdminCancel: (b: BookingHistoryDto) => void;
  onDeclineAdminCancel: (b: BookingHistoryDto) => void;
  onTrack: (b: BookingHistoryDto) => void;
  onNegotiate: (b: BookingHistoryDto) => void;
}) {
  const status = (b.status || "").toLowerCase();
  const cancelStatus = (b.cancellationStatus || "none").toLowerCase();
  const paymentStatus = String(b.paymentStatus ?? "").toLowerCase();
  const isPaid = paymentStatus === "success" || paymentStatus === "paid";
  const isTripBooking = b.busType === "trip_booking";

  const isUserCancelRequested = cancelStatus === "requested_by_user";
  const isAdminCancelRequested = cancelStatus === "requested_by_admin";
  const isCancelRejected = cancelStatus === "rejected";

  const statusColor = isUserCancelRequested
    ? "#3B82F6"
    : isAdminCancelRequested
    ? "#D97706"
    : STATUS_COLORS[status] ?? "#6B7280";

  const statusLabel = isUserCancelRequested
    ? "Cancel Pending"
    : isAdminCancelRequested
    ? "Admin Cancel Req"
    : b.status.charAt(0).toUpperCase() + b.status.slice(1);

  const formattedTime = useMemo(() => formatJourneyTime(b.journeyTime), [b.journeyTime]);
  const formattedAmount = useMemo(() => formatAmount(b.totalAmount), [b.totalAmount]);

  const handleTicket = useCallback(() => onTicket(b), [onTicket, b]);
  const handleRate = useCallback(() => onRate(b), [onRate, b]);
  const handleComplaint = useCallback(() => onComplaint(b), [onComplaint, b]);
  const handleCancelPress = useCallback(() => onRequestCancel(b), [onRequestCancel, b]);
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
          value={b.seatNumber || "N/A"}
        />
      </View>

      {/* Price */}
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Total Amount</Text>
        <Text style={styles.priceValue}>LKR {formattedAmount}</Text>
      </View>

      {/* ── CANCELLATION STATUS BANNERS & TWO-WAY FLOWS ── */}

      {/* 1. Passenger-Requested Cancellation Banner */}
      {isUpcoming && isUserCancelRequested && (
        <View style={styles.userCancelBanner}>
          <View style={styles.bannerHeaderRow}>
            <Ionicons name="time" size={16} color="#2563EB" />
            <Text style={styles.userCancelBannerTitle}>Cancellation Requested</Text>
          </View>
          <Text style={styles.bannerBodyText}>
            Awaiting admin review. Reason: &ldquo;{b.cancellationReason || "Not specified"}&rdquo;
          </Text>
          <Text style={styles.bannerRefundSubText}>
            Policy: {b.refundPercentage ?? 100}% refund redirected within 10 business days upon acceptance.
          </Text>
        </View>
      )}

      {/* 2. Admin-Requested Cancellation Banner with Accept/Decline Actions */}
      {isUpcoming && isAdminCancelRequested && (
        <View style={styles.adminCancelBanner}>
          <View style={styles.bannerHeaderRow}>
            <Ionicons name="alert-circle" size={18} color="#D97706" />
            <Text style={styles.adminCancelBannerTitle}>Admin Requested Cancellation</Text>
          </View>
          <Text style={styles.bannerBodyText}>
            Reason: &ldquo;{b.cancellationReason || "Operational adjustment"}&rdquo;
          </Text>
          <Text style={styles.bannerRefundSubText}>
            The refund will be redirected to the account within 10 working business days.
          </Text>
          <View style={styles.adminCancelActionRow}>
            <Pressable style={styles.acceptAdminBtn} onPress={() => onAcceptAdminCancel(b)}>
              <Ionicons name="checkmark-circle-outline" size={15} color="#FFF" />
              <Text style={styles.acceptAdminBtnText}>Accept Cancel</Text>
            </Pressable>
            <Pressable style={styles.declineAdminBtn} onPress={() => onDeclineAdminCancel(b)}>
              <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
              <Text style={styles.declineAdminBtnText}>Decline</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 3. Rejection Notice with Re-Request Option */}
      {isUpcoming && isCancelRejected && (
        <View style={styles.rejectedCancelBanner}>
          <View style={styles.bannerHeaderRow}>
            <Ionicons name="information-circle" size={16} color="#DC2626" />
            <Text style={styles.rejectedCancelBannerTitle}>Cancellation Request Rejected</Text>
          </View>
          <Text style={styles.bannerBodyText}>
            Admin note: &ldquo;{b.cancellationRejectReason || "Request declined"}&rdquo;
          </Text>
          <Pressable style={styles.reRequestBtn} onPress={handleCancelPress}>
            <Ionicons name="refresh-outline" size={14} color="#DC2626" />
            <Text style={styles.reRequestBtnText}>Request Cancellation Again</Text>
          </Pressable>
        </View>
      )}

      {/* Standard Actions (When no active cancel request is pending) */}
      {isUpcoming && !isUserCancelRequested && !isAdminCancelRequested && status === "confirmed" && !(isTripBooking && !isPaid) ? (
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
        !isUserCancelRequested &&
        !isAdminCancelRequested &&
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

// Stylesheet for Booking History and Cancellation UI
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

  /* ── Cancellation Banners ── */
  userCancelBanner: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  userCancelBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  adminCancelBanner: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  adminCancelBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B45309",
  },
  rejectedCancelBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  rejectedCancelBannerTitle: {
    fontSize: 13,
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
    fontSize: 12,
    color: "#334155",
    lineHeight: 17,
    marginTop: 2,
  },
  bannerRefundSubText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "500",
  },
  adminCancelActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  acceptAdminBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16A34A",
    borderRadius: 8,
    paddingVertical: 8,
    gap: 5,
  },
  acceptAdminBtnText: {
    fontSize: 12,
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
    borderRadius: 8,
    paddingVertical: 8,
    gap: 5,
  },
  declineAdminBtnText: {
    fontSize: 12,
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
    borderRadius: 8,
    paddingVertical: 8,
    marginTop: 8,
    gap: 6,
  },
  reRequestBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },

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
