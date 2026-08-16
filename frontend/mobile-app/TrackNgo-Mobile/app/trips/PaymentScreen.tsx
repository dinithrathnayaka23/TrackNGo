import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { createStripeCheckoutSession, getStripeSessionStatus } from "../../services/bookingFlowApi";
import { confirmTripPayment, getTripBooking, TripBooking } from "../../services/tripBookingsApi";
import { getUserProfile } from "../../services/userProfileApi";
import { API_BASE_URL } from "../../config/env";
import { useSession } from "../../store/sessionStore";
import { LocalizedText as Text } from "../../utils/i18n";

export default function PaymentScreen() {
  const router = useRouter();
  const { currentUser } = useSession();
  const insets = useSafeAreaInsets();
  const { tripDetails: tripDetailsStr } = useLocalSearchParams<{ tripDetails?: string }>();
  const initialTrip = tripDetailsStr ? JSON.parse(tripDetailsStr) : {};
  const [trip, setTrip] = useState<TripBooking & Record<string, any>>(initialTrip);
  const bookingId = Number(trip.bookingId || trip.id);
  const advance = Number(trip.advancePayment || 0);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const completingRef = useRef(false);

  useEffect(() => {
    if (!bookingId) return;
    void getTripBooking(bookingId)
      .then((latest) => setTrip((previous) => ({ ...previous, ...latest, bookingId: latest.id })))
      .catch((error) => console.warn("Could not refresh payment details", error));
  }, [bookingId]);

  const completePayment = useCallback(async (completedSessionId = sessionId) => {
    if (!completedSessionId || processing || completingRef.current) return;
    completingRef.current = true;
    setProcessing(true);
    setCheckoutUrl("");
    try {
      const status = await getStripeSessionStatus(completedSessionId);
      if (status.orderId !== `TRIP-${bookingId}` || status.paymentStatus !== "paid") {
        throw new Error("Payment was not completed for this booking.");
      }
      await confirmTripPayment(bookingId, completedSessionId);
      router.replace({ pathname: "/trips/ConfirmScreen", params: { bookingId: String(bookingId) } });
    } catch (error: any) {
      Alert.alert("Payment could not be confirmed", error?.message || "Please try again.");
    } finally {
      completingRef.current = false;
      setProcessing(false);
    }
  }, [bookingId, processing, router, sessionId]);

  const startPayment = async () => {
    if (!bookingId || advance <= 0) {
      Alert.alert("Payment unavailable", "The negotiated advance amount is not available.");
      return;
    }
    setLoading(true);
    try {
      const latest = await getTripBooking(bookingId);
      const latestStatus = String(latest.bookingStatus || "").trim().toLowerCase();
      const latestApproved = ["confirmed", "approved"].includes(latestStatus)
        || (latestStatus === "pending" && Boolean(latest.negotiatedAt));
      if (!latestApproved) {
        throw new Error("Admin approval is required before paying the advance.");
      }
      setTrip((previous) => ({ ...previous, ...latest, bookingId: latest.id }));
      const currentAdvance = Number(latest.advancePayment || 0);
      if (currentAdvance <= 0) throw new Error("The negotiated advance amount is not available.");
      let email = "passenger@trackngo.lk";
      if (currentUser?.userId) {
        try {
          email = (await getUserProfile(currentUser.userId)).email || email;
        } catch {
          // Stripe accepts the fallback email.
        }
      }
      const checkout = await createStripeCheckoutSession({
        orderId: `TRIP-${bookingId}`,
        amount: currentAdvance,
        currency: "LKR",
        itemName: "TrackNGo Private Trip Advance",
        itemDescription: `${latest.startLocation} → ${latest.destination} | ${latest.startDate}`,
        email,
        successUrl: `${API_BASE_URL}/api/booking-flow/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${API_BASE_URL}/api/booking-flow/stripe/cancel?session_id={CHECKOUT_SESSION_ID}`,
      });
      setSessionId(checkout.sessionId);
      setCheckoutUrl(checkout.url);
    } catch (error: any) {
      Alert.alert("Payment Error", error?.message || "Could not initialize Stripe Checkout.");
    } finally {
      setLoading(false);
    }
  };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "completed") void completePayment(data.sessionId || sessionId);
      if (data.type === "cancelled") {
        setCheckoutUrl("");
        Alert.alert("Payment Cancelled", "You can try again when you are ready.");
      }
    } catch {
      // Ignore non-payment messages.
    }
  };

  if (checkoutUrl) {
    return (
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.safe}>
        <View style={styles.webHeader}>
          <Pressable
            style={styles.webHeaderSide}
            onPress={() => setCheckoutUrl("")}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color="#111827" />
          </Pressable>
          <Text
            style={styles.webTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            Secure Stripe Checkout
          </Text>
          <View style={styles.webHeaderSide}>
            <Ionicons name="lock-closed" size={16} color="#16A34A" />
          </View>
        </View>
        <WebView
          source={{ uri: checkoutUrl }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          startInLoadingState
          onShouldStartLoadWithRequest={(request) => {
            if (request.url.includes("/api/booking-flow/stripe/success")) {
              const match = request.url.match(/session_id=([^&]+)/);
              void completePayment(match ? decodeURIComponent(match[1]) : sessionId);
              return false;
            }
            if (request.url.includes("/api/booking-flow/stripe/cancel")) {
              setCheckoutUrl("");
              return false;
            }
            return true;
          }}
          renderLoading={() => (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.muted}>Loading Stripe...</Text>
            </View>
          )}
          style={styles.webView}
        />
      </SafeAreaView>
    );
  }

  // Admin approval is represented by the persisted confirmed status. Do not
  // block payment when the optional negotiatedAt audit field is unavailable.
  const tripStatus = String(trip.bookingStatus || "").trim().toLowerCase();
  const isConfirmed = ["confirmed", "approved"].includes(tripStatus)
    || (tripStatus === "pending" && Boolean(trip.negotiatedAt));

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 28, 40) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.headerSide} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </Pressable>
          <Text
            style={styles.title}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            Secure Checkout
          </Text>
          <View style={styles.headerSide} />
        </View>

        <View style={styles.progress}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: "75%" }]} />
          </View>
          <Text style={styles.progressText}>Request · Negotiation · Payment</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Negotiated advance (15%)</Text>
          <Text style={styles.amount}>LKR {advance.toLocaleString()}</Text>
          <Text style={styles.muted} numberOfLines={3}>
            Route: {trip.startLocation || trip.pickup} → {trip.destination || trip.drop}
          </Text>
          <Text style={styles.muted} numberOfLines={2}>
            Departure: {trip.startDate || trip.depart}
          </Text>
        </View>

        <View style={styles.info}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#2563EB" />
          <Text style={styles.infoText}>
            You will complete payment on Stripe's secure hosted checkout. Card details never enter the app.
          </Text>
        </View>

        <Pressable
          style={[styles.payButton, (!isConfirmed || loading || processing) && { opacity: 0.6 }]}
          onPress={() => void startPayment()}
          disabled={!isConfirmed || loading || processing}
        >
          {loading || processing ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={styles.payText} numberOfLines={2}>
                {isConfirmed ? `Pay LKR ${advance.toLocaleString()}` : "Waiting for admin approval"}
              </Text>
              <Ionicons name={isConfirmed ? "lock-closed" : "time-outline"} size={16} color="white" />
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F9" },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  headerSide: { width: 32, minWidth: 32, alignItems: "center" },
  title: { flex: 1, fontSize: 20, fontWeight: "700", color: "#111827", textAlign: "center", marginHorizontal: 8 },
  progress: { marginBottom: 20 },
  progressTrack: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: "#2563EB", borderRadius: 4 },
  progressText: { color: "#64748B", fontSize: 12, marginTop: 8, textAlign: "center" },
  card: { backgroundColor: "white", padding: 20, borderRadius: 16, alignItems: "center", elevation: 2 },
  label: { color: "#64748B", fontWeight: "600", textAlign: "center" },
  amount: { color: "#2563EB", fontSize: 30, fontWeight: "800", marginVertical: 8, textAlign: "center" },
  muted: { color: "#64748B", fontSize: 13, marginTop: 8, textAlign: "center", flexShrink: 1 },
  info: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#EFF6FF", padding: 16, borderRadius: 12, marginTop: 20 },
  infoText: { flex: 1, marginLeft: 10, color: "#2563EB", fontSize: 12, lineHeight: 18 },
  payButton: { width: "100%", minHeight: 54, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, backgroundColor: "#2563EB", paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12, marginTop: 28 },
  payText: { flexShrink: 1, color: "white", fontWeight: "700", fontSize: 15, textAlign: "center" },
  webHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 14, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  webHeaderSide: { width: 28, minWidth: 28, alignItems: "center" },
  webTitle: { flex: 1, fontSize: 16, fontWeight: "600", color: "#111827", textAlign: "center", marginHorizontal: 8 },
  webView: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
