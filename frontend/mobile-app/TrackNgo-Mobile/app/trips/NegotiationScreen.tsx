import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  Animated,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getBusImage } from "../../utils/busImage";
import { API_BASE_URL as ENV_API_BASE_URL } from "../../config/env";

// 🔹 CONFIG
const API_BASE_URL = `${ENV_API_BASE_URL}/api`;

export default function NegotiationScreen() {
  const router = useRouter();
  const { tripDetails: tripDetailsStr } = useLocalSearchParams<{ tripDetails: string }>();
  const [trip, setTrip] = useState<any>(tripDetailsStr ? JSON.parse(tripDetailsStr) : {});
  const [loading, setLoading] = useState(false);

  const driverPhone = "+94771234567"; 
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // 🔹 EFFECT: Pulsing Live Indicator
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // 🔹 EFFECT: Refresh data from backend to check for Admin Approval
  useEffect(() => {
    const refreshBooking = async () => {
      if (!trip.bookingId) return;
      try {
        const response = await fetch(`${API_BASE_URL}/trips/book/${trip.bookingId}`);
        const data = await response.json();
        if (data) {
          // If the backend has a newer status, update it
          setTrip((prev: any) => ({ ...prev, bookingStatus: data.bookingStatus }));
        }
      } catch (error) {
        console.log("Could not refresh booking status");
      }
    };

    const interval = setInterval(refreshBooking, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [trip.bookingId]);

  const handleCall = () => {
    Linking.openURL(`tel:${driverPhone}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* 🔹 HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Booking Review</Text>
          <TouchableOpacity onPress={() => {/* Refresh manually */}}>
            <Ionicons name="refresh" size={20} color="#2563EB" />
          </TouchableOpacity>
        </View>

        {/* 🔹 TICKET HEADER */}
        <View style={styles.ticketHeader}>
          <View>
            <Text style={styles.bookingIdLabel}>OFFICIAL BOOKING ID</Text>
            <Text style={styles.bookingIdValue}>#{trip.bookingId || "0000"}</Text>
          </View>
          <View style={[
            styles.statusBadge, 
            (trip.bookingStatus?.toLowerCase() === 'confirmed' || trip.bookingStatus?.toLowerCase() === 'approved') ? styles.statusBadgeConfirmed : styles.statusBadgePending
          ]}>
            <Animated.View style={[
              styles.liveDot, 
              { opacity: pulseAnim },
              (trip.bookingStatus?.toLowerCase() === 'confirmed' || trip.bookingStatus?.toLowerCase() === 'approved') ? { backgroundColor: '#22C55E' } : { backgroundColor: '#60A5FA' }
            ]} />
            <Text style={[
              styles.statusText,
              (trip.bookingStatus?.toLowerCase() === 'confirmed' || trip.bookingStatus?.toLowerCase() === 'approved') ? { color: '#22C55E' } : { color: '#60A5FA' }
            ]}>
              {trip.bookingStatus?.toUpperCase() || "NEGOTIATING"}
            </Text>
          </View>
        </View>

        {/* 🔹 ROUTE INFO */}
        <View style={styles.routeCard}>
          <View style={styles.routePoint}>
            <Ionicons name="location" size={18} color="#16A34A" />
            <Text style={styles.routeName}>{trip.pickup}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <Ionicons name="navigate" size={18} color="#EF4444" />
            <Text style={styles.routeName}>{trip.drop}</Text>
          </View>
          
          <View style={styles.tripMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={14} color="#64748B" />
              <Text style={styles.metaText}>{trip.depart}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={14} color="#64748B" />
              <Text style={styles.metaText}>{trip.passengers} Passengers</Text>
            </View>
          </View>
        </View>

        {/* 🔹 SELECTED BUS CARD (Dynamic!) */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Selected Vehicle</Text>
        </View>
        <View style={styles.busCard}>
          <Image 
            source={getBusImage(trip.busBrand || "Rosa", [])} 
            style={styles.busImage} 
          />
          <View style={styles.busInfo}>
            <Text style={styles.busNumber}>{trip.busNumber || "Pending Assignment"}</Text>
            <Text style={styles.busBrand}>{trip.busBrand || "Standard Bus"}</Text>
            <View style={styles.requirementBadge}>
              <Text style={styles.requirementText}>{trip.selectedRequirement || "Standard"}</Text>
            </View>
          </View>
        </View>

        {/* 🔹 PRICING SUMMARY */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
        </View>
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Total Estimated Price</Text>
            <Text style={styles.priceValue}>LKR {trip.totalPayment?.toLocaleString()}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.advanceLabel}>Advance to Pay (15%)</Text>
            <Text style={styles.advanceValue}>LKR {trip.advancePayment?.toLocaleString()}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.dueLabel}>Balance after Trip</Text>
            <Text style={styles.dueValue}>LKR {trip.dueAmount?.toLocaleString()}</Text>
          </View>
          <Text style={styles.priceNote}>* Final price is subject to admin approval.</Text>
        </View>

        {/* 🔹 ACTIONS */}
        <View style={styles.actionContainer}>
          <Text style={styles.actionPrompt}>Need to discuss the price?</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleCall}>
              <Ionicons name="call-outline" size={20} color="#2563EB" />
              <Text style={styles.secondaryBtnText}>Call Admin</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn}>
              <Ionicons name="chatbox-ellipses-outline" size={20} color="#2563EB" />
              <Text style={styles.secondaryBtnText}>Chat</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn, 
              (trip.bookingStatus?.toLowerCase() !== 'confirmed' && trip.bookingStatus?.toLowerCase() !== 'approved') && styles.disabledBtn
            ]}
            disabled={trip.bookingStatus?.toLowerCase() !== 'confirmed' && trip.bookingStatus?.toLowerCase() !== 'approved'}
            onPress={() => router.push({ pathname: '/trips/PaymentScreen', params: { tripDetails: JSON.stringify(trip) } })}
          >
            <Text style={styles.primaryBtnText}>
              {(trip.bookingStatus?.toLowerCase() === 'confirmed' || trip.bookingStatus?.toLowerCase() === 'approved') ? "Proceed to Payment" : "Waiting for Approval..."}
            </Text>
            {(trip.bookingStatus?.toLowerCase() === 'confirmed' || trip.bookingStatus?.toLowerCase() === 'approved') ? (
              <Ionicons name="arrow-forward" size={20} color="white" />
            ) : (
              <ActivityIndicator size="small" color="#94A3B8" style={{ marginLeft: 10 }} />
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "white",
  },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: "#1E293B" },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#1E293B",
  },
  bookingIdLabel: { color: "#94A3B8", fontSize: 10, fontWeight: "bold" },
  bookingIdValue: { color: "#22C55E", fontSize: 18, fontWeight: "bold" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgePending: { backgroundColor: "rgba(96, 165, 250, 0.1)" },
  statusBadgeConfirmed: { backgroundColor: "rgba(34, 197, 94, 0.1)" },
  statusText: { fontSize: 11, fontWeight: "bold", marginLeft: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  routeCard: {
    backgroundColor: "white",
    margin: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  routePoint: { flexDirection: "row", alignItems: "center" },
  routeName: { marginLeft: 10, fontSize: 16, fontWeight: "600", color: "#1E293B" },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: "#E2E8F0",
    marginLeft: 8,
    marginVertical: 4,
  },
  tripMeta: {
    flexDirection: "row",
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  metaItem: { flexDirection: "row", alignItems: "center", marginRight: 20 },
  metaText: { marginLeft: 5, fontSize: 12, color: "#64748B" },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", color: "#64748B", textTransform: "uppercase" },
  busCard: {
    flexDirection: "row",
    backgroundColor: "white",
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
  },
  busImage: { width: 80, height: 60, borderRadius: 10, backgroundColor: "#F1F5F9" },
  busInfo: { marginLeft: 15, flex: 1 },
  busNumber: { fontSize: 16, fontWeight: "bold", color: "#1E293B" },
  busBrand: { fontSize: 13, color: "#64748B" },
  requirementBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 5,
  },
  requirementText: { fontSize: 10, color: "#2563EB", fontWeight: "bold" },
  priceCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 15,
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 4 },
  priceLabel: { color: "#64748B", fontSize: 14 },
  priceValue: { fontSize: 20, fontWeight: "bold", color: "#1E293B" },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 10 },
  advanceLabel: { color: "#16A34A", fontWeight: "600", fontSize: 13 },
  advanceValue: { color: "#16A34A", fontWeight: "bold", fontSize: 16 },
  dueLabel: { color: "#64748B", fontSize: 13 },
  dueValue: { color: "#1E293B", fontWeight: "bold", fontSize: 16 },
  priceNote: { fontSize: 11, color: "#94A3B8", marginTop: 10, fontStyle: "italic" },
  actionContainer: { padding: 20 },
  actionPrompt: { textAlign: "center", color: "#64748B", marginBottom: 15, fontSize: 13 },
  buttonRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    borderRadius: 12,
    width: "48%",
  },
  secondaryBtnText: { marginLeft: 8, color: "#1E293B", fontWeight: "600" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#2563EB",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnText: { color: "white", fontWeight: "bold", fontSize: 16, marginRight: 10 },
  disabledBtn: {
    backgroundColor: "#E2E8F0",
    shadowOpacity: 0,
    elevation: 0,
  },
});
