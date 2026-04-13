import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import {
  BusTrackingSocket,
  getLatestBusLocation,
  getRouteGeometry,
  type LiveBusLocation,
  type RouteStopGeo,
} from "../../services/trackingApi";

/* ── Constants ────────────────────────────────────────────── */
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DEFAULT_REGION = {
  latitude: 6.927,
  longitude: 79.861,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const LIGHT_MAP_STYLE = [
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels",
    stylers: [{ visibility: "simplified" }],
  },
];

/* ── Helpers ──────────────────────────────────────────────── */

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatETA(distanceKm: number, speedKmh: number = 30): string {
  if (distanceKm <= 0) return "Arrived";
  const mins = Math.round((distanceKm / speedKmh) * 60);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/* ── Component ────────────────────────────────────────────── */

export default function LiveMapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    busNumber?: string;
    startLocation?: string;
    endLocation?: string;
    bookingRef?: string;
  }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  /* State */
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [busLocation, setBusLocation] = useState<LiveBusLocation | null>(null);
  const [routeStops, setRouteStops] = useState<RouteStopGeo[]>([]);
  const [isBoarded, setIsBoarded] = useState(false);
  const [showBoardingModal, setShowBoardingModal] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  /* Animations */
  const sheetTranslateY = useRef(new Animated.Value(100)).current;
  const boardingPulse = useRef(new Animated.Value(1)).current;
  const busPulse = useRef(new Animated.Value(0)).current;

  /* Derived */
  const busNumber = params.busNumber ?? "ND-4589";
  const startLoc = params.startLocation ?? "Colombo";
  const endLoc = params.endLocation ?? "Kandy";

  // Route polyline coordinates (from route stops)
  const routeCoords = useMemo(() => {
    return routeStops
      .filter((s) => s.latitude != null && s.longitude != null)
      .sort((a, b) => a.priority - b.priority)
      .map((s) => ({ latitude: s.latitude!, longitude: s.longitude! }));
  }, [routeStops]);

  // Distance & ETA from bus to user
  const distanceToUser = useMemo(() => {
    if (!busLocation || !userLocation) return null;
    return haversineDistance(
      busLocation.latitude,
      busLocation.longitude,
      userLocation.latitude,
      userLocation.longitude,
    );
  }, [busLocation, userLocation]);

  const etaText = useMemo(() => {
    if (!distanceToUser) return "Calculating...";
    const speed = busLocation?.speed && busLocation.speed > 0 ? busLocation.speed * 3.6 : 30;
    return formatETA(distanceToUser, speed);
  }, [distanceToUser, busLocation]);

  const distanceText = useMemo(() => {
    if (!distanceToUser) return "—";
    return formatDistance(distanceToUser);
  }, [distanceToUser]);

  /* ── Effects ────────────────────────────────────────────── */

  // Entrance animation
  useEffect(() => {
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 12,
      bounciness: 4,
    }).start();
  }, [sheetTranslateY]);

  // Bus pulse animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(busPulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(busPulse, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [busPulse]);

  // User location tracking
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError(true);
        return;
      }
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (loc) => {
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        },
      );
    })();
    return () => {
      subscription?.remove();
    };
  }, []);

  // Fit map to show both user and bus
  const fitMapToMarkers = useCallback(() => {
    const coords: { latitude: number; longitude: number }[] = [];
    if (userLocation) coords.push(userLocation);
    if (busLocation) coords.push({ latitude: busLocation.latitude, longitude: busLocation.longitude });
    if (routeCoords.length > 0) coords.push(...routeCoords);

    if (coords.length >= 2 && mapRef.current) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 120, right: 60, bottom: 300, left: 60 },
        animated: true,
      });
    } else if (coords.length === 1 && mapRef.current) {
      mapRef.current.animateToRegion(
        { ...coords[0], latitudeDelta: 0.05, longitudeDelta: 0.05 },
        600,
      );
    }
  }, [userLocation, busLocation, routeCoords]);

  // Initial map fit when we get data
  const initialFitDone = useRef(false);
  useEffect(() => {
    if (!initialFitDone.current && (userLocation || busLocation)) {
      initialFitDone.current = true;
      setTimeout(fitMapToMarkers, 500);
    }
  }, [userLocation, busLocation, fitMapToMarkers]);

  // WebSocket for live bus location
  useEffect(() => {
    const socket = new BusTrackingSocket();
    socket.connect();
    setWsConnected(true);

    socket.subscribe(busNumber, (loc) => {
      setBusLocation(loc);
    });

    // Also fetch last known location immediately
    getLatestBusLocation(busNumber).then((loc) => {
      if (loc) setBusLocation(loc);
    }).catch(() => {});

    return () => {
      setWsConnected(false);
      socket.disconnect();
    };
  }, [busNumber]);

  // Load route geometry
  useEffect(() => {
    getRouteGeometry(startLoc, endLoc)
      .then((geo) => {
        if (geo?.stops) setRouteStops(geo.stops);
      })
      .catch(() => {});
  }, [startLoc, endLoc]);

  // When user is boarded, follow bus location on map
  useEffect(() => {
    if (isBoarded && busLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: busLocation.latitude,
          longitude: busLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        800,
      );
    }
  }, [isBoarded, busLocation]);

  /* ── Boarding confirmation ──────────────────────────────── */
  const handleBoardingConfirm = () => {
    setIsBoarded(true);
    setShowBoardingModal(false);

    // Start pulse animation on boarding
    Animated.loop(
      Animated.sequence([
        Animated.timing(boardingPulse, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(boardingPulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  };

  /* ── Bus marker with bus icon ───────────────────────────── */
  const BusMarkerView = () => (
    <View style={styles.busMarkerContainer}>
      <Animated.View
        style={[
          styles.busMarkerPulse,
          {
            opacity: busPulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 0],
            }),
            transform: [
              {
                scale: busPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2.5],
                }),
              },
            ],
          },
        ]}
      />
      <View style={styles.busMarkerOuter}>
        <View style={styles.busMarkerInner}>
          <Ionicons name="bus" size={18} color="#FFFFFF" />
        </View>
      </View>
      <View style={styles.busMarkerArrow} />
    </View>
  );

  /* ── User marker ────────────────────────────────────────── */
  const UserMarkerView = () => (
    <View style={styles.userMarkerContainer}>
      <View style={styles.userMarkerPulseRing} />
      <View style={styles.userMarkerOuter}>
        <View style={styles.userMarkerDot} />
      </View>
    </View>
  );

  /* ── Stop marker ────────────────────────────────────────── */
  const StopMarkerView = ({ name, index }: { name: string; index: number }) => (
    <View style={styles.stopMarkerContainer}>
      <View
        style={[
          styles.stopDot,
          index === 0 && styles.stopDotStart,
          index === routeStops.length - 1 && styles.stopDotEnd,
        ]}
      />
    </View>
  );

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={undefined}
          initialRegion={DEFAULT_REGION}
          customMapStyle={LIGHT_MAP_STYLE}
          showsCompass={false}
          showsTraffic={true}
          showsUserLocation={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          mapPadding={{ top: 0, right: 0, bottom: 280, left: 0 }}
        >
          {/* Route polyline */}
          {routeCoords.length >= 2 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="#2F6BFF"
              strokeWidth={4}
              lineDashPattern={[0]}
            />
          )}

          {/* Route polyline shadow */}
          {routeCoords.length >= 2 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="rgba(47,107,255,0.15)"
              strokeWidth={10}
            />
          )}

          {/* Stop markers */}
          {routeCoords.map((coord, idx) => (
            <Marker
              key={`stop-${idx}`}
              coordinate={coord}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <StopMarkerView
                name={routeStops[idx]?.name ?? ""}
                index={idx}
              />
            </Marker>
          ))}

          {/* Bus marker */}
          {busLocation && (
            <Marker
              coordinate={{
                latitude: busLocation.latitude,
                longitude: busLocation.longitude,
              }}
              anchor={{ x: 0.5, y: 0.9 }}
              tracksViewChanges={true}
            >
              <BusMarkerView />
            </Marker>
          )}

          {/* User marker */}
          {userLocation && !isBoarded && (
            <Marker
              coordinate={userLocation}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <UserMarkerView />
            </Marker>
          )}
        </MapView>

        {/* Top Bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#1F2937" />
          </Pressable>
          <View style={styles.topInfo}>
            <Text style={styles.topTitle}>Live Tracking</Text>
            <View style={styles.topBusRow}>
              <Ionicons name="bus" size={12} color="#2F6BFF" />
              <Text style={styles.topBusText}>{busNumber}</Text>
            </View>
          </View>
          <View style={styles.connectionDot}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: wsConnected ? "#22C55E" : "#EF4444" },
              ]}
            />
            <Text style={styles.statusText}>
              {wsConnected ? "LIVE" : "OFFLINE"}
            </Text>
          </View>
        </View>

        {/* Route info strip */}
        <View style={styles.routeStrip}>
          <View style={styles.routeStripDot}>
            <View style={[styles.routeDotInner, { backgroundColor: "#22C55E" }]} />
          </View>
          <Text style={styles.routeStripText} numberOfLines={1}>
            {startLoc}
          </Text>
          <View style={styles.routeStripDash} />
          <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
          <View style={styles.routeStripDash} />
          <View style={styles.routeStripDot}>
            <View style={[styles.routeDotInner, { backgroundColor: "#EF4444" }]} />
          </View>
          <Text style={styles.routeStripText} numberOfLines={1}>
            {endLoc}
          </Text>
        </View>

        {/* Floating action buttons */}
        <View style={styles.fabColumn}>
          <Pressable style={styles.fabButton} onPress={fitMapToMarkers}>
            <Ionicons name="expand" size={18} color="#475569" />
          </Pressable>
          <Pressable
            style={styles.fabButton}
            onPress={() => {
              if (!userLocation) return;
              mapRef.current?.animateToRegion(
                { ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 },
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
          {busLocation && (
            <Pressable
              style={styles.fabButton}
              onPress={() => {
                mapRef.current?.animateToRegion(
                  {
                    latitude: busLocation.latitude,
                    longitude: busLocation.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  },
                  600,
                );
              }}
            >
              <Ionicons name="bus" size={18} color="#F97316" />
            </Pressable>
          )}
        </View>

        {/* Bottom Sheet */}
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY: sheetTranslateY }],
            },
          ]}
        >
          <View style={styles.sheetHandle} />

          {/* Bus info header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetBusIcon}>
              <Ionicons name="bus" size={20} color="#FFFFFF" />
            </View>
            <View style={styles.sheetHeaderInfo}>
              <Text style={styles.sheetBusNumber}>{busNumber}</Text>
              <Text style={styles.sheetRoute}>
                {startLoc} → {endLoc}
              </Text>
            </View>
            {isBoarded && userLocation && (
              <Pressable
                style={styles.sosBtn}
                onPress={() =>
                  router.push({
                    pathname: "/sos/sos",
                    params: {
                      busNumber,
                      startLocation: startLoc,
                      endLocation: endLoc,
                      userLatitude: String(userLocation.latitude),
                      userLongitude: String(userLocation.longitude),
                    },
                  })
                }
              >
                <Ionicons name="warning" size={12} color="#FFFFFF" />
                <Text style={styles.sosBtnText}>SOS</Text>
              </Pressable>
            )}
          </View>

          {/* Metrics row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <View
                style={[styles.metricIconBg, { backgroundColor: "#EFF6FF" }]}
              >
                <Ionicons name="time-outline" size={16} color="#2F6BFF" />
              </View>
              <Text style={styles.metricLabel}>ETA</Text>
              <Text style={styles.metricValue}>{etaText}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCard}>
              <View
                style={[styles.metricIconBg, { backgroundColor: "#ECFDF5" }]}
              >
                <Ionicons name="navigate-outline" size={16} color="#22C55E" />
              </View>
              <Text style={styles.metricLabel}>Distance</Text>
              <Text style={styles.metricValue}>{distanceText}</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricCard}>
              <View
                style={[styles.metricIconBg, { backgroundColor: "#FFF7ED" }]}
              >
                <Ionicons name="speedometer-outline" size={16} color="#F97316" />
              </View>
              <Text style={styles.metricLabel}>Speed</Text>
              <Text style={styles.metricValue}>
                {busLocation?.speed
                  ? `${Math.round(busLocation.speed * 3.6)} km/h`
                  : "—"}
              </Text>
            </View>
          </View>

          {/* Status indicator */}
          {isBoarded ? (
            <Animated.View
              style={[
                styles.boardedBanner,
                { transform: [{ scale: boardingPulse }] },
              ]}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.boardedText}>You are on the bus</Text>
            </Animated.View>
          ) : busLocation ? (
            <View style={styles.approachingBanner}>
              <Ionicons name="location" size={16} color="#2F6BFF" />
              <Text style={styles.approachingText}>
                Bus is {distanceText} away • ETA {etaText}
              </Text>
            </View>
          ) : (
            <View style={styles.waitingBanner}>
              <MaterialCommunityIcons
                name="bus-clock"
                size={16}
                color="#94A3B8"
              />
              <Text style={styles.waitingText}>
                Waiting for bus location...
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={styles.actionRow}>
            {!isBoarded && busLocation && (
              <Pressable
                style={styles.boardBtn}
                onPress={() => setShowBoardingModal(true)}
              >
                <Ionicons name="enter-outline" size={16} color="#FFFFFF" />
                <Text style={styles.boardBtnText}>I'm on the Bus</Text>
              </Pressable>
            )}
            {isBoarded && (
              <Pressable
                style={styles.alightBtn}
                onPress={() => setIsBoarded(false)}
              >
                <Ionicons name="exit-outline" size={16} color="#FFFFFF" />
                <Text style={styles.alightBtnText}>I've Alighted</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.msgBtn}
              onPress={() => router.push("/chat/chat-list")}
            >
              <Ionicons name="chatbubble-outline" size={16} color="#2F6BFF" />
              <Text style={styles.msgBtnText}>Message</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Boarding Confirmation Modal */}
        <Modal
          visible={showBoardingModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBoardingModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconBg}>
                <Ionicons name="bus" size={32} color="#2F6BFF" />
              </View>
              <Text style={styles.modalTitle}>Are you on the bus?</Text>
              <Text style={styles.modalSubtitle}>
                Confirm that you've boarded {busNumber}. Your location will
                sync with the bus route.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalConfirm}
                  onPress={handleBoardingConfirm}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#FFFFFF"
                  />
                  <Text style={styles.modalConfirmText}>
                    Yes, I'm on Board
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.modalCancel}
                  onPress={() => setShowBoardingModal(false)}
                >
                  <Text style={styles.modalCancelText}>Not Yet</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  /* Top Bar */
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  topInfo: {
    flex: 1,
    marginLeft: 12,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  topBusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  topBusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2F6BFF",
  },
  connectionDot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },

  /* Route strip */
  routeStrip: {
    position: "absolute",
    top: 96,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  routeStripDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  routeDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeStripText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    flex: 1,
  },
  routeStripDash: {
    width: 8,
    borderTopWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
  },

  /* FABs */
  fabColumn: {
    position: "absolute",
    right: 16,
    bottom: 310,
    gap: 10,
    zIndex: 10,
  },
  fabButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },

  /* Bottom Sheet */
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 4,
  },

  /* Sheet Header */
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetBusIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#2F6BFF",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHeaderInfo: {
    flex: 1,
  },
  sheetBusNumber: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  sheetRoute: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  sosBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  sosBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Metrics */
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  metricCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: "#E2E8F0",
  },
  metricIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },

  /* Status banners */
  boardedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#22C55E",
    paddingVertical: 10,
    borderRadius: 12,
  },
  boardedText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  approachingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    paddingVertical: 10,
    borderRadius: 12,
  },
  approachingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2F6BFF",
  },
  waitingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  waitingText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#94A3B8",
  },

  /* Action buttons */
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  boardBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2F6BFF",
    paddingVertical: 14,
    borderRadius: 14,
  },
  boardBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  alightBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F97316",
    paddingVertical: 14,
    borderRadius: 14,
  },
  alightBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  msgBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#2F6BFF",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  msgBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2F6BFF",
  },

  /* Bus Marker */
  busMarkerContainer: {
    alignItems: "center",
    width: 60,
    height: 70,
  },
  busMarkerPulse: {
    position: "absolute",
    top: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F97316",
    alignSelf: "center",
  },
  busMarkerOuter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  busMarkerInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
  },
  busMarkerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#FFFFFF",
    marginTop: -2,
  },

  /* User Marker */
  userMarkerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
  },
  userMarkerPulseRing: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(47,107,255,0.12)",
  },
  userMarkerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  userMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2F6BFF",
  },

  /* Stop Markers */
  stopMarkerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 16,
    height: 16,
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 2.5,
    borderColor: "#2F6BFF",
  },
  stopDotStart: {
    borderColor: "#22C55E",
    backgroundColor: "#22C55E",
  },
  stopDotEnd: {
    borderColor: "#EF4444",
    backgroundColor: "#EF4444",
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
  },
  modalIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: "column",
    gap: 10,
    marginTop: 20,
    width: "100%",
  },
  modalCancel: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
  },
  modalConfirm: {
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#2F6BFF",
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
