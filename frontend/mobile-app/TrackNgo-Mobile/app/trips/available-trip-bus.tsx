import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getBusImage } from "../../utils/busImage";
import { API_BASE_URL as ENV_API_BASE_URL } from "../../config/env";
import { LocalizedText as Text } from "../../utils/i18n";

// 🔹 CONFIG
const API_BASE_URL = `${ENV_API_BASE_URL}/api`; // Same as your BookATrip.tsx

interface Bus {
  busId: number;
  busNumber: string;
  busBrand: string;
  seatCapacity: number;
  amenities: string[];
}

export default function AvailableTripBus() {
  const router = useRouter();
  const { tripData } = useLocalSearchParams();
  const parsedTripData = tripData ? JSON.parse(tripData as string) : {};

  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBuses();
  }, []);

  const fetchBuses = async () => {
    try {
      setLoading(true);
      // 🔹 Use encodeURIComponent to handle spaces in "Mini Bus"
      const requirement = encodeURIComponent(parsedTripData.selectedRequirement || "");
      const response = await fetch(
        `${API_BASE_URL}/trips/available-buses?passengers=${parsedTripData.passengers || 1}&requirement=${requirement}`
      );
      
      if (!response.ok) {
        throw new Error("Server responded with error " + response.status);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setBuses(data);
      } else if (data.data && Array.isArray(data.data)) {
        // Fallback for the old wrapper style
        setBuses(data.data);
      }
    } catch (error: any) {
      console.error("Failed to fetch buses:", error);
      alert("Connection Error: Make sure your IP address is correct and backend is running. " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBus = (bus: Bus) => {
    // Add selected bus to trip details and move to negotiation
    const updatedTripDetails = {
      ...parsedTripData,
      selectedBusId: bus.busId,
      busNumber: bus.busNumber,
      busBrand: bus.busBrand,
    };

    router.push({
      pathname: "/trips/NegotiationScreen",
      params: { tripDetails: JSON.stringify(updatedTripDetails) },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select a Bus</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tripSummary}>
        <Text style={styles.summaryText}>
          {parsedTripData.pickup} → {parsedTripData.drop}
        </Text>
        <Text style={styles.passengerText}>
          {parsedTripData.passengers} Passengers • {parsedTripData.duration} Days
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Finding available buses...</Text>
        </View>
      ) : buses.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bus-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>No buses available for this group size.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchBuses}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {buses.map((bus) => (
            <TouchableOpacity
              key={bus.busId}
              style={styles.busCard}
              onPress={() => handleSelectBus(bus)}
            >
              <View style={styles.busIconContainer}>
                <Image 
                  source={getBusImage(bus.busBrand, bus.amenities)} 
                  style={styles.busImage} 
                />
              </View>
              
              <View style={styles.busInfo}>
                <View style={styles.busHeader}>
                  <Text style={styles.busNumber}>{bus.busNumber}</Text>
                  <Text style={styles.busCapacity}>{bus.seatCapacity} Seats</Text>
                </View>
                <Text style={styles.busBrand}>{bus.busBrand}</Text>
                
                <View style={styles.amenitiesContainer}>
                  {bus.amenities.map((amenity, index) => (
                    <View key={index} style={styles.amenityBadge}>
                      <Text style={styles.amenityText}>
                        {amenity.replace("_", " ").toUpperCase()}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Text style={styles.footerNote}>
        Prices are estimated. Final price may change after negotiation.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "white",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1E293B",
  },
  tripSummary: {
    padding: 15,
    backgroundColor: "#EFF6FF",
    borderBottomWidth: 1,
    borderBottomColor: "#DBEAFE",
  },
  summaryText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
  },
  passengerText: {
    fontSize: 12,
    color: "#60A5FA",
    marginTop: 4,
  },
  list: {
    padding: 15,
  },
  busCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  busIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
    overflow: "hidden",
  },
  busImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  busInfo: {
    flex: 1,
  },
  busHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  busNumber: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
  },
  busCapacity: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2563EB",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  busBrand: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },
  amenitiesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  amenityBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 5,
    marginBottom: 5,
  },
  amenityText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#475569",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 15,
    color: "#64748B",
    fontSize: 14,
  },
  emptyText: {
    marginTop: 20,
    textAlign: "center",
    color: "#64748B",
    fontSize: 16,
    fontWeight: "500",
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 25,
    paddingVertical: 10,
    backgroundColor: "#2563EB",
    borderRadius: 10,
  },
  retryText: {
    color: "white",
    fontWeight: "bold",
  },
  footerNote: {
    padding: 15,
    textAlign: "center",
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
  },
});
