import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Image, Linking, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getBusImage } from "../../utils/busImage";
import { ADMIN_SUPPORT_USER_ID } from "../../config/env";
import { useSession } from "../../store/sessionStore";
import { createConversation } from "../../services/chatApi";
import { getUserProfile } from "../../services/userProfileApi";
import { getTripBooking, TripBooking } from "../../services/tripBookingsApi";
import { LocalizedText as Text } from "../../utils/i18n";

export default function NegotiationScreen() {
  const router = useRouter();
  const { currentUser } = useSession();
  const { tripDetails } = useLocalSearchParams<{ tripDetails?: string }>();
  const initial = tripDetails ? JSON.parse(tripDetails) : {};
  const [trip, setTrip] = useState<TripBooking & Record<string, any>>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  const refreshBooking = useCallback(async () => {
    const bookingId = Number(trip.bookingId || trip.id);
    if (!bookingId) return;
    setRefreshing(true);
    try {
      const booking = await getTripBooking(bookingId);
      setTrip((previous) => ({ ...previous, ...booking, bookingId: booking.id }));
    } catch (error) {
      console.warn("Could not refresh trip booking", error);
    } finally {
      setRefreshing(false);
    }
  }, [trip.bookingId, trip.id]);

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
    ]));
    animation.start();
    void refreshBooking();
    const interval = setInterval(() => void refreshBooking(), 5000);
    return () => { animation.stop(); clearInterval(interval); };
  }, [pulseAnim, refreshBooking]);

  const status = String(trip.bookingStatus || "pending").toLowerCase();
  // The review endpoint commits booking_status=confirmed. Use that persisted
  // state as the approval source of truth; negotiatedAt is audit metadata and
  // may be omitted by older API/database responses.
  const approved = ["confirmed", "approved"].includes(status)
    || (status === "pending" && Boolean(trip.negotiatedAt));
  const rejected = status === "cancelled";
  const estimated = Number(trip.estimatedPrice ?? trip.finalPrice ?? trip.totalPayment ?? 0);
  const finalPrice = Number(trip.finalPrice ?? estimated);
  const discount = Math.max(0, Number(trip.discountAmount ?? 0));
  const advance = Number(trip.advancePayment ?? finalPrice * 0.15);
  const balance = Math.max(0, finalPrice - advance);
  const routeStart = trip.startLocation || trip.pickup || "-";
  const routeEnd = trip.destination || trip.drop || "-";

  const handleCallAdmin = async () => {
    try {
      const profile = await getUserProfile(ADMIN_SUPPORT_USER_ID);
      const phone = profile.phoneNumber?.trim();
      if (!phone) { Alert.alert("Admin phone unavailable", "Please use the chat option to negotiate this booking."); return; }
      const url = `tel:${phone.replace(/[^+\d]/g, "")}`;
      if (!(await Linking.canOpenURL(url))) { Alert.alert("Calling unavailable", "Your phone cannot open the call application."); return; }
      await Linking.openURL(url);
    } catch (error: any) {
      Alert.alert("Could not call admin", error?.message || "Please use chat instead.");
    }
  };

  const handleChatAdmin = async () => {
    if (!currentUser?.userId) { Alert.alert("Sign in required", "Please sign in again to start a chat with TrackNGo admin."); return; }
    try {
      const conversation = await createConversation({ user1Id: currentUser.userId, user2Id: ADMIN_SUPPORT_USER_ID });
      router.push({ pathname: "/chat/chat-room", params: { conversationId: String(conversation.conversationId), otherUserId: String(ADMIN_SUPPORT_USER_ID), otherUserType: "ADMIN" } });
    } catch (error: any) {
      Alert.alert("Chat unavailable", error?.message || "Could not open the admin chat.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={24} color="#1E293B" /></TouchableOpacity><Text style={styles.headerTitle}>Booking Review</Text><TouchableOpacity onPress={() => void refreshBooking()} disabled={refreshing}>{refreshing ? <ActivityIndicator size="small" color="#2563EB" /> : <Ionicons name="refresh" size={20} color="#2563EB" />}</TouchableOpacity></View>
        <View style={styles.ticketHeader}><View><Text style={styles.bookingIdLabel}>BOOKING REQUEST</Text><Text style={styles.bookingIdValue}>#{trip.bookingId || trip.id || "-"}</Text></View><View style={[styles.statusBadge, approved ? styles.statusBadgeConfirmed : rejected ? styles.statusBadgeRejected : styles.statusBadgePending]}><Animated.View style={[styles.liveDot, { opacity: pulseAnim, backgroundColor: approved ? "#22C55E" : rejected ? "#EF4444" : "#60A5FA" }]} /><Text style={[styles.statusText, { color: approved ? "#22C55E" : rejected ? "#EF4444" : "#60A5FA" }]}>{approved ? "CONFIRMED" : rejected ? "REJECTED" : "PENDING"}</Text></View></View>
        <View style={styles.routeCard}><View style={styles.routePoint}><Ionicons name="location" size={18} color="#16A34A" /><Text style={styles.routeName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{routeStart}</Text></View><View style={styles.routeLine} /><View style={styles.routePoint}><Ionicons name="navigate" size={18} color="#EF4444" /><Text style={styles.routeName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{routeEnd}</Text></View><View style={styles.tripMeta}><Text style={styles.metaText}>{trip.startDate || trip.depart || "-"}</Text><Text style={styles.metaText}>{trip.passengerCount || trip.passengers || 0} Passengers</Text></View></View>
        <Text style={styles.sectionTitle}>Selected Vehicle</Text><View style={styles.busCard}><Image source={getBusImage(trip.busBrand || "Rosa", [])} style={styles.busImage} /><View style={styles.busInfo}><Text style={styles.busNumber}>{trip.busNumber || "Selected vehicle"}</Text><Text style={styles.busBrand}>{trip.busBrand || "Standard Bus"}</Text><Text style={styles.requirementText}>{trip.selectedRequirement || "Vehicle preference"}</Text></View></View>
        <Text style={styles.sectionTitle}>Payment Summary</Text><View style={styles.priceCard}>
          {!approved && !rejected ? <><View style={styles.estimateBanner}><Ionicons name="information-circle" size={20} color="#2563EB" /><Text style={styles.estimateText}>Note: this is only a rough amount calculated from the trip details. Call or chat with TrackNGo admin to finalize the amount before making any payment.</Text></View><View style={styles.priceRow}><Text style={styles.priceLabel}>Rough estimated amount</Text><Text style={styles.priceValue}>LKR {estimated.toLocaleString()}</Text></View><Text style={styles.priceNote}>The final negotiated amount, discount, 15% advance, and remaining balance will appear here after admin approval.</Text></> : rejected ? <View style={styles.rejectedBox}><Ionicons name="close-circle" size={22} color="#DC2626" /><Text style={styles.rejectedText}>{trip.adminNote || "This trip request was not approved. Please contact admin if you need more information."}</Text></View> : <><View style={styles.finalBanner}><Ionicons name="checkmark-circle" size={20} color="#15803D" /><Text style={styles.finalText}>Final amount approved by TrackNGo admin. You can now pay the 15% advance.</Text></View><View style={styles.priceRow}><Text style={styles.priceLabel}>Final negotiated amount</Text><Text style={styles.priceValue}>LKR {finalPrice.toLocaleString()}</Text></View>{discount > 0 && <View style={styles.priceRow}><Text style={styles.discountLabel}>Admin discount</Text><Text style={styles.discountValue}>- LKR {discount.toLocaleString()}</Text></View>}<View style={styles.divider} /><View style={styles.priceRow}><Text style={styles.advanceLabel}>Advance payment (15%)</Text><Text style={styles.advanceValue}>LKR {advance.toLocaleString()}</Text></View><View style={styles.priceRow}><Text style={styles.dueLabel}>Balance to hand over later</Text><Text style={styles.dueValue}>LKR {balance.toLocaleString()}</Text></View><Text style={styles.priceNote}>{trip.adminNote || "Your final amount was confirmed by TrackNGo admin."}</Text></>}
        </View>
        {!rejected && <View style={styles.actions}><Text style={styles.negotiateTitle}>Need to negotiate the amount?</Text><Text style={styles.negotiateText}>Talk with TrackNGo admin before approving the final price.</Text><View style={styles.buttonRow}><TouchableOpacity style={styles.secondaryBtn} onPress={() => void handleCallAdmin()}><Ionicons name="call-outline" size={20} color="#2563EB" /><Text style={styles.secondaryBtnText}>Call Admin</Text></TouchableOpacity><TouchableOpacity style={styles.secondaryBtn} onPress={() => void handleChatAdmin()}><Ionicons name="chatbox-ellipses-outline" size={20} color="#2563EB" /><Text style={styles.secondaryBtnText}>Chat Admin</Text></TouchableOpacity></View><TouchableOpacity style={[styles.primaryBtn, !approved && styles.disabledBtn]} disabled={!approved} onPress={() => router.push({ pathname: "/trips/PaymentScreen", params: { tripDetails: JSON.stringify(trip) } })}><Text style={[styles.primaryBtnText, !approved && styles.disabledText]}>{approved ? "Proceed to Pay 15% Advance" : "Waiting for Admin Approval"}</Text>{approved ? <Ionicons name="arrow-forward" size={20} color="white" /> : <Ionicons name="lock-closed" size={17} color="#94A3B8" />}</TouchableOpacity><TouchableOpacity style={styles.homeButton} onPress={() => router.replace("/tabs")}><Text style={styles.homeText}>Return to Home</Text></TouchableOpacity></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" }, content: { paddingBottom: 40 }, header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: "white" }, headerTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" }, ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 15, backgroundColor: "#1E293B" }, bookingIdLabel: { color: "#94A3B8", fontSize: 11, fontWeight: "600" }, bookingIdValue: { color: "#22C55E", fontSize: 20, fontWeight: "800" }, statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }, statusBadgePending: { backgroundColor: "rgba(96,165,250,.1)" }, statusBadgeConfirmed: { backgroundColor: "rgba(34,197,94,.1)" }, statusBadgeRejected: { backgroundColor: "rgba(239,68,68,.1)" }, statusText: { fontSize: 11, fontWeight: "700", marginLeft: 6 }, liveDot: { width: 6, height: 6, borderRadius: 3 }, routeCard: { backgroundColor: "white", margin: 20, padding: 20, borderRadius: 15, elevation: 2 }, routePoint: { flexDirection: "row", alignItems: "center", minWidth: 0 }, routeName: { marginLeft: 10, fontSize: 16, fontWeight: "600", color: "#1E293B", flex: 1, minWidth: 0 }, routeLine: { width: 2, height: 20, backgroundColor: "#E2E8F0", marginLeft: 8, marginVertical: 4 }, tripMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: "#F1F5F9" }, metaText: { fontSize: 12, color: "#64748B" }, sectionTitle: { paddingHorizontal: 20, marginBottom: 10, marginTop: 4, fontSize: 16, fontWeight: "700", color: "#64748B", textTransform: "uppercase" }, busCard: { flexDirection: "row", backgroundColor: "white", marginHorizontal: 20, padding: 15, borderRadius: 15, alignItems: "center" }, busImage: { width: 80, height: 60, borderRadius: 10, backgroundColor: "#F1F5F9" }, busInfo: { marginLeft: 15, flex: 1 }, busNumber: { fontSize: 16, fontWeight: "700", color: "#1E293B" }, busBrand: { fontSize: 13, color: "#64748B" }, requirementText: { color: "#2563EB", fontSize: 11, marginTop: 6 }, priceCard: { backgroundColor: "white", marginHorizontal: 20, padding: 20, borderRadius: 15 }, estimateBanner: { flexDirection: "row", gap: 10, backgroundColor: "#EFF6FF", padding: 12, borderRadius: 12, marginBottom: 14 }, estimateText: { flex: 1, color: "#1D4ED8", fontSize: 12, lineHeight: 18 }, finalBanner: { flexDirection: "row", gap: 10, backgroundColor: "#F0FDF4", padding: 12, borderRadius: 12, marginBottom: 14 }, finalText: { flex: 1, color: "#166534", fontSize: 12, lineHeight: 18 }, priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 5, gap: 12 }, priceLabel: { flex: 1, color: "#64748B", fontSize: 11, fontWeight: "600"}, priceValue: { fontSize: 16, fontWeight: "700", color: "#1E293B" }, divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 10 }, advanceLabel: { flex: 1, color: "#16A34A", fontWeight: "600", fontSize: 11}, advanceValue: { color: "#16A34A", fontWeight: "600", fontSize: 13}, dueLabel: { flex: 1, color: "#64748B", fontSize: 11, fontWeight: "600"}, dueValue: { color: "#1E293B", fontWeight: "600", fontSize: 13}, discountLabel: { flex: 1, color: "#16A34A", fontSize: 11, fontWeight: "600"}, discountValue: { color: "#16A34A", fontWeight: "600", fontSize: 13}, priceNote: { fontSize: 11, color: "#64748B", lineHeight: 17, marginTop: 12 }, rejectedBox: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12 }, rejectedText: { flex: 1, color: "#B91C1C", fontSize: 13, lineHeight: 19 }, actions: { padding: 20 }, negotiateTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" }, negotiateText: { color: "#64748B", fontSize: 12, marginTop: 4, marginBottom: 14 }, buttonRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15 }, secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "white", borderWidth: 1, borderColor: "#E2E8F0", paddingVertical: 12, borderRadius: 12, width: "48%" }, secondaryBtnText: { marginLeft: 8, color: "#1E293B", fontWeight: "600" }, primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#2563EB", paddingVertical: 16, borderRadius: 12, elevation: 5 }, primaryBtnText: { color: "white", fontWeight: "700", fontSize: 14, marginRight: 10 }, disabledBtn: { backgroundColor: "#E2E8F0", elevation: 0 }, disabledText: { color: "#64748B" }, homeButton: { alignItems: "center", paddingVertical: 14, marginTop: 10 }, homeText: { color: "#64748B", fontWeight: "600" },
});
