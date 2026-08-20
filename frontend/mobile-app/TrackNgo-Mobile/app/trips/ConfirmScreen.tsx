import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { getTripBooking, TripBooking } from "../../services/tripBookingsApi";
import { API_BASE_URL } from "../../config/env";
import { LocalizedText as Text } from "../../utils/i18n";

export default function ConfirmScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ bookingId?: string; tripDetails?: string }>();
  const fallback = params.tripDetails ? JSON.parse(params.tripDetails) : {};
  const bookingId = Number(params.bookingId || fallback.bookingId || fallback.id);
  const [booking, setBooking] = useState<TripBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketVisible, setTicketVisible] = useState(false);
  const qrSize = Math.min(180, Math.max(140, width - 96));

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    getTripBooking(bookingId)
      .then(setBooking)
      .catch((error: any) => Alert.alert("Booking unavailable", error?.message || "Could not load the saved booking."))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading) {
    return (
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.muted}>Loading your confirmed booking...</Text>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.center}>
        <Text style={styles.muted}>The booking could not be loaded.</Text>
        <Pressable style={styles.button} onPress={() => router.replace("/tabs")}>
          <Text style={styles.buttonText}>Return Home</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const verifyUrl = `${API_BASE_URL}/api/trips/verify/${booking.id}`;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 28, 40) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.headerSide} onPress={() => router.replace("/tabs")} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            Booking #{booking.id}
          </Text>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.success}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={40} color="white" />
          </View>
          <Text style={styles.successTitle}>Booking Confirmed</Text>
          <Text style={styles.muted}>Your advance payment is recorded and your ticket is ready.</Text>
        </View>

        <View style={styles.progress}>
          <View style={styles.track}>
            <View style={styles.fill} />
          </View>
          <Text style={styles.progressText}>Sent · Negotiation · Payment · Confirmed</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.ref}>REF: #{booking.id}</Text>
          <View style={styles.routeRow}>
            <Text style={styles.routeCity} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
              {booking.startLocation}
            </Text>
            <Text style={styles.routeArrow}>→</Text>
            <Text style={[styles.routeCity, styles.routeDestination]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
              {booking.destination}
            </Text>
          </View>
          <View style={styles.divider} />
          <Row label="Departure" value={booking.startDate} />
          <Row label="Return" value={booking.returnDate || "Same day"} />
          <Row label="Passengers" value={String(booking.passengerCount)} />
          <Row label="Bus" value={booking.busNumber || "Assigned bus"} />
          <Row label="Advance paid" value={`LKR ${Number(booking.advancePayment).toLocaleString()}`} />
        </View>

        <Pressable style={styles.button} onPress={() => setTicketVisible(true)}>
          <Ionicons name="ticket-outline" size={20} color="white" />
          <Text style={styles.buttonText}>View Digital Ticket</Text>
        </Pressable>
        <Pressable style={styles.homeButton} onPress={() => router.replace("/tabs")}>
          <Text style={styles.homeText}>Return to Home</Text>
        </Pressable>

        <Modal visible={ticketVisible} transparent animationType="fade" onRequestClose={() => setTicketVisible(false)}>
          <View style={[styles.overlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.ticket}>
              <ScrollView contentContainerStyle={styles.ticketContent} showsVerticalScrollIndicator={false}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.brand}>TRACKNGo</Text>
                  <Text style={styles.eTicket}>E-TICKET</Text>
                </View>
                <View style={styles.ticketRouteRow}>
                  <Text style={styles.ticketRouteCity} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {booking.startLocation}
                  </Text>
                  <Text style={styles.ticketRouteArrow}>→</Text>
                  <Text style={[styles.ticketRouteCity, styles.ticketRouteDestination]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {booking.destination}
                  </Text>
                </View>
                <Row label="DATE" value={booking.startDate} />
                <Row label="BOOKING ID" value={`#${booking.id}`} />
                <Row label="BUS" value={booking.busNumber || "Assigned bus"} />
                <View style={styles.qr}>
                  <QRCode value={verifyUrl} size={qrSize} />
                  <Text style={styles.qrText}>Scan to verify this booking</Text>
                </View>
                <Pressable onPress={() => setTicketVisible(false)} style={styles.close}>
                  <Text style={styles.closeText}>Close</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7FB" },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#F6F7FB" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  headerSide: { width: 32, minWidth: 32, alignItems: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#111827", textAlign: "center", marginHorizontal: 8 },
  success: { alignItems: "center", marginBottom: 22 },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#22C55E", justifyContent: "center", alignItems: "center" },
  successTitle: { color: "#111827", fontSize: 20, fontWeight: "700", marginTop: 16, textAlign: "center" },
  muted: { color: "#6B7280", fontSize: 13, marginTop: 8, textAlign: "center", maxWidth: 340 },
  progress: { marginBottom: 20 },
  track: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 8, overflow: "hidden" },
  fill: { height: 6, width: "100%", backgroundColor: "#2563EB", borderRadius: 8 },
  progressText: { color: "#2563EB", fontSize: 11, textAlign: "center", marginTop: 8 },
  card: { backgroundColor: "white", borderRadius: 16, padding: 20, elevation: 2, marginBottom: 16 },
  ref: { color: "#94A3B8", fontSize: 12, fontWeight: "700" },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, minWidth: 0 },
  routeCity: { flex: 1, minWidth: 0, color: "#111827", fontSize: 18, fontWeight: "700" },
  routeDestination: { textAlign: "right" },
  routeArrow: { color: "#64748B", fontSize: 18, fontWeight: "700" },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16 },
  rowLabel: { color: "#64748B", fontSize: 11, fontWeight: "600", flexShrink: 0 },
  rowValue: { color: "#111827", fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right", flexShrink: 1 },
  button: { width: "100%", minHeight: 54, flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center", backgroundColor: "#2563EB", paddingHorizontal: 12, paddingVertical: 14, borderRadius: 14 },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16, flexShrink: 1, textAlign: "center" },
  homeButton: { padding: 16, alignItems: "center" },
  homeText: { color: "#64748B", fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,.8)", justifyContent: "center", paddingHorizontal: 16 },
  ticket: { width: "100%", maxWidth: 420, maxHeight: "100%", alignSelf: "center", backgroundColor: "white", borderRadius: 20 },
  ticketContent: { padding: 24 },
  ticketHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  brand: { color: "#2563EB", fontWeight: "800", letterSpacing: 1 },
  eTicket: { color: "#94A3B8", fontSize: 11, fontWeight: "700" },
  ticketRouteRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20, minWidth: 0 },
  ticketRouteCity: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: "800", color: "#111827" },
  ticketRouteDestination: { textAlign: "right" },
  ticketRouteArrow: { color: "#64748B", fontSize: 18, fontWeight: "800" },
  qr: { alignItems: "center", marginTop: 12 },
  qrText: { color: "#94A3B8", fontSize: 11, marginTop: 10, textAlign: "center" },
  close: { alignItems: "center", padding: 14, marginTop: 12 },
  closeText: { color: "#2563EB", fontWeight: "700" },
});
