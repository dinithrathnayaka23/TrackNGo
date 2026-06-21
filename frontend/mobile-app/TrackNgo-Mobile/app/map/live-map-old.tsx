/**
 * LiveMapScreen - A legacy map screen implementation for tracking bus locations in real-time.
 * Features:
 * - Real-time user location tracking
 * - Simulated bus movement on a predefined route
 * - Geocoding search functionality
 * - Emergency SOS and Driver Chat integration
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";

// Mock coordinates for the bus route path
const routeCoords = [
  { latitude: 6.929, longitude: 79.861 },
  { latitude: 6.971, longitude: 79.93 },
  { latitude: 7.025, longitude: 80.01 },
  { latitude: 7.08, longitude: 80.08 },
];

// Initial map region focused on the general Colombo area
const defaultRegion = {
  latitude: 6.99,
  longitude: 79.95,
  latitudeDelta: 0.35,
  longitudeDelta: 0.35,
};

/**
 * Utility to pick a random point along the route segments
 * Used to simulate a "live" bus position for demonstration
 */
const randomPointOnRoute = (
  points: { latitude: number; longitude: number }[],
) => {
  if (points.length < 2) return points[0] ?? defaultRegion;
  const segmentIndex = Math.floor(Math.random() * (points.length - 1));
  const start = points[segmentIndex];
  const end = points[segmentIndex + 1];
  const t = Math.random();
  return {
    latitude: start.latitude + (end.latitude - start.latitude) * t,
    longitude: start.longitude + (end.longitude - start.longitude) * t,
  };
};

// Custom map styling for a premium dark-blue aesthetic
const blueMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1f3b73" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8fb5ff" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#12224b" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#2b4f8a" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#1a2e5c" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#7aa2ff" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2f5fb3" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1b376e" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#c2d6ff" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3a78ff" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#1a2e5c" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0b1b3a" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4e7bd8" }],
  },
];

export default function LiveMapScreen() {
  const router = useRouter();
  
  // Extract bus and route details from navigation parameters
  const params = useLocalSearchParams<{
    busNumber?: string;
    startLocation?: string;
    endLocation?: string;
  }>();
  
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // State Management
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [destination, setDestination] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [searching, setSearching] = useState(false);

  // Memoized bus location to prevent rerenders unless the component mounts
  const busLocation = useMemo(() => randomPointOnRoute(routeCoords), []);
  
  const busNumber = params.busNumber ?? "ND-4589";
  const startLocation = params.startLocation ?? "Colombo Port";
  const endLocation = params.endLocation ?? "Kandy";

  /**
   * Effect: Request location permissions and start watching user position.
   * Animates the map to follow the user as they move.
   */
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    const startLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission denied");
        return;
      }
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (loc) => {
          const next = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setUserLocation(next);
          mapRef.current?.animateToRegion(
            {
              ...next,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            },
            600,
          );
        },
      );
    };
    startLocation();

    return () => {
      subscription?.remove();
    };
  }, []);

  /**
   * Geocodes the search query and marks the destination on the map.
   */
  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(trimmed);
      if (!results.length) {
        setDestination(null);
        return;
      }
      const next = {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
      };
      setDestination(next);
      mapRef.current?.animateToRegion(
        {
          ...next,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        },
        700,
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Main Map View */}
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={defaultRegion}
          customMapStyle={blueMapStyle}
          showsCompass={false}
          showsTraffic={false}
          showsUserLocation={false}
          toolbarEnabled={false}
        >
          {/* Bus Location Marker */}
          <Marker coordinate={busLocation}>
            <View style={styles.busMarker}>
              <Ionicons name="bus" size={16} color="#FFFFFF" />
            </View>
          </Marker>

          {/* User Location Marker (Pulse effect styled in CSS) */}
          {userLocation && (
            <Marker coordinate={userLocation}>
              <View style={styles.userMarker}>
                <View style={styles.userMarkerInner} />
              </View>
            </Marker>
          )}

          {/* Search Destination Marker */}
          {destination && (
            <Marker coordinate={destination} pinColor="#60A5FA" />
          )}
        </MapView>

        {/* Top Search & Navigation Bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#2F6BFF" />
            <TextInput
              placeholder="Where to?"
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              editable={!searching}
            />
          </View>
          <Pressable
            style={styles.searchAction}
            onPress={handleSearch}
            disabled={searching}
          >
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Floating "Center on Me" Button */}
        <Pressable
          style={styles.locationButton}
          onPress={() => {
            if (!userLocation) return;
            mapRef.current?.animateToRegion(
              {
                ...userLocation,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              },
              600,
            );
          }}
        >
          <MaterialCommunityIcons
            name="crosshairs-gps"
            size={18}
            color="#2F6BFF"
          />
        </Pressable>

        {/* Bottom Sheet: Bus Details & Journey Metrics */}
        <View
          style={[
            styles.bottomSheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{busNumber}</Text>
              <Text style={styles.sheetSubtitle}>
                {startLocation} - {endLocation}
              </Text>
            </View>
            <View style={styles.sheetActions}>
              <Pressable
                style={styles.sosButton}
                onPress={() =>
                  router.push({
                    pathname: "/sos/sos",
                    params: {
                      busNumber,
                      startLocation,
                      endLocation,
                      userLatitude: userLocation
                        ? String(userLocation.latitude)
                        : undefined,
                      userLongitude: userLocation
                        ? String(userLocation.longitude)
                        : undefined,
                    },
                  })
                }
              >
                <Ionicons name="warning" size={14} color="#FFFFFF" />
                <Text style={styles.sosText}>SOS</Text>
              </Pressable>
              <Pressable style={styles.iconCircle}>
                <Ionicons name="bus" size={16} color="#64748B" />
              </Pressable>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <View style={styles.metricIcon}>
                <Ionicons name="location" size={14} color="#2F6BFF" />
              </View>
              <View>
                <Text style={styles.metricLabel}>Current</Text>
                <Text style={styles.metricValue}>
                  {locationError
                    ? "Location off"
                    : userLocation
                      ? "Live location"
                      : "Locating..."}
                </Text>
              </View>
            </View>
            <View style={styles.metricItem}>
              <View style={styles.metricIcon}>
                <Ionicons name="time" size={14} color="#2F6BFF" />
              </View>
              <View>
                <Text style={styles.metricLabel}>ETA</Text>
                <Text style={styles.metricValue}>12 mins</Text>
              </View>
            </View>
            <View style={styles.metricItem}>
              <View style={styles.metricIcon}>
                <Ionicons name="people" size={14} color="#2F6BFF" />
              </View>
              <View>
                <Text style={styles.metricLabel}>Seats</Text>
                <Text style={styles.metricValue}>4 Left</Text>
              </View>
            </View>
          </View>

          <View style={styles.sheetButtons}>
            <Pressable style={styles.outlineButton}>
              <Text style={styles.outlineButtonText}>View Details</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push("/chat/chat-list")}
            >
              <Ionicons name="chatbubble" size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Message Driver</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#0F1B3D",
  },
  container: {
    flex: 1,
    backgroundColor: "#0F1B3D",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    fontSize: 13,
    color: "#111827",
  },
  searchAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#2F6BFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  busMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  userMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  userMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563EB",
  },
  locationButton: {
    position: "absolute",
    right: 18,
    bottom: 110,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  sheetSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sosButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EF4444",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sosText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metricIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#EAF1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    fontSize: 10,
    color: "#94A3B8",
  },
  metricValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1F2937",
  },
  sheetButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  outlineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  outlineButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#1474F2",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
