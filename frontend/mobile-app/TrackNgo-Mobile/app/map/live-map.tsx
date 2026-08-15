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
import MapView, { Circle, Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import {
  MARKER_TRANSITION_MS,
  boardingEligibility,
  confidencePercent,
  distanceAlongRoute,
  distanceKm,
  formatFixAge,
  interpolatePosition,
  shouldApplyFix,
  snapToRoute,
  trackingFreshness,
  type LatLng,
} from "../../utils/liveTracking";

/* ── Constants ────────────────────────────────────────────── */
const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * How far off the drawn route line the bus must be before we call it a
 * diversion. The line joins the stops we have coordinates for with straight
 * segments, so on a Colombo-Kandy route with a handful of stops the real road
 * wanders kilometres away from it. Anything tighter cries wolf constantly.
 */
const OFF_ROUTE_ALERT_METERS = 3000;

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

/**
 * Great-circle distance in kilometres between two lat/lng pairs.
 * Thin wrapper over the shared, unit-tested helper in utils/liveTracking.
 */
//Standard formula even used in Uber,Pickme like apps
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  return distanceKm(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 },
  );
}

/**
 * Formats the Estimated Time of Arrival (ETA) string based on distance and speed.
 * Defaults to 30 km/h if speed is not provided or zero.
 */
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
    busDestination?: string;
    bookingRef?: string;
    /* Journey date/time of the booking being tracked, so boarding can be
       limited to the trip the passenger actually holds a seat on. */
    journeyDate?: string;
    journeyTime?: string;
  }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  /* ── State & Refs ───────────────────────────────────────── */
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
  const [wsConnected, setWsConnected] = useState(false); // WebSocket connection status

  /* Where the bus marker is drawn right now. This trails busLocation: each new
     fix is slid into over about a second rather than jumped to, so the marker
     reads as a bus driving rather than a dot teleporting every few seconds. */
  const [displayPosition, setDisplayPosition] = useState<LatLng | null>(null);
  /* Re-rendered on a timer so the "updated 8s ago" caption and the confidence
     badge keep counting while no new fix arrives. */
  const [clockTick, setClockTick] = useState(0);

  /* Speed & distance smoothing for accurate ETA */
  // Stores recent bus positions to calculate a more stable "ground speed"
  const busHistory = useRef<{ lat: number; lng: number; time: number }[]>([]);
  // Sliding window buffer for speed readings to filter out GPS jitter
  const speedBuffer = useRef<number[]>([]);
  const SPEED_BUFFER_SIZE = 5;// Used to smooth out the speed readings
  const HISTORY_MAX = 10;//Used to track the previous locations of the bus

  /* Animations */
  // Controls the slide-up entrance and visibility of the bottom details sheet
  const sheetTranslateY = useRef(new Animated.Value(100)).current;
  // Pulsing animation for the "Boarded" status indicator
  const boardingPulse = useRef(new Animated.Value(1)).current;
  // Pulsing animation for the bus marker on the map
  const busPulse = useRef(new Animated.Value(0)).current;

  /* Derived Values */
  const busNumber = params.busNumber ?? "ND-4589";
  const startLoc = params.startLocation ?? "Colombo";
  const endLoc = params.endLocation ?? "Kandy";
  const busEndLoc = params.busDestination ?? endLoc;

  // Process and sort stops by their priority sequence
  const sortedStops = useMemo(() => {
    return routeStops
      .filter((s) => s.latitude != null && s.longitude != null)
      .sort((a, b) => a.priority - b.priority);
  }, [routeStops]);

  // Convert stops into a simple coordinate array for Polyline rendering
  const routeCoords = useMemo(() => {
    return sortedStops.map((s) => ({
      latitude: s.latitude!,
      longitude: s.longitude!,
    }));
  }, [sortedStops]);

  // Logic to identify which stop in the list is the passenger's actual destination
  // based on the location name passed via route params.
  const passengerDestIndex = useMemo(() => {
    if (!sortedStops.length) return -1;
    if (endLoc === busEndLoc) return sortedStops.length - 1;
    const needle = endLoc.toLowerCase().trim();
    const idx = sortedStops.findIndex(
      (s) =>
        s.name.toLowerCase().trim() === needle ||
        s.name.toLowerCase().trim().includes(needle) ||
        needle.includes(s.name.toLowerCase().trim()),
    );
    return idx >= 0 ? idx : sortedStops.length - 1;
  }, [sortedStops, endLoc, busEndLoc]);

  const passengerDestCoord = useMemo(() => {
    if (passengerDestIndex < 0 || passengerDestIndex >= routeCoords.length)
      return null;
    return routeCoords[passengerDestIndex];
  }, [routeCoords, passengerDestIndex]);

  /* ── Fix quality ──────────────────────────────────────────
     How old the fix is, and therefore how much of its quality score still
     stands. clockTick is in the dependency list purely to re-run this every
     second while no new fix arrives, so the badge counts down rather than
     freezing at whatever it read when the last packet landed. */
  const fixAgeMs = useMemo(() => {
    if (!busLocation?.timestamp) return null;
    return Math.max(0, Date.now() - busLocation.timestamp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busLocation, clockTick]);

  const busConfidence = useMemo(() => {
    if (!busLocation || fixAgeMs == null) return null;
    /* accuracyPercent is scored by the server; 50 is its "device reported no
       accuracy" default, used here too so old servers stay usable. */
    return confidencePercent(busLocation.accuracyPercent ?? 50, fixAgeMs);
  }, [busLocation, fixAgeMs]);

  const freshness = useMemo(
    () => (fixAgeMs == null ? "lost" : trackingFreshness(fixAgeMs)),
    [fixAgeMs],
  );
  const isStale = busLocation != null && freshness === "lost";

  /* Whether the passenger may mark themselves aboard. Tracking a future
     booking is fine and useful; boarding one is not, so the button is
     disabled with the reason shown rather than silently missing. clockTick
     re-evaluates it so the button unlocks on time without a screen reload. */
  const boarding = useMemo(
    () =>
      boardingEligibility({
        journeyDate: params.journeyDate,
        journeyTime: params.journeyTime,
        busIsLive: busLocation != null && freshness !== "lost",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.journeyDate, params.journeyTime, busLocation, freshness, clockTick],
  );

  /* Colour and wording for the tracking-quality badge. */
  const trackingStatus = useMemo(() => {
    if (!busLocation) {
      return { label: "WAITING", colour: "#94A3B8", detail: "Waiting for the bus to start sharing" };
    }
    if (freshness === "lost") {
      return {
        label: "NO SIGNAL",
        colour: "#EF4444",
        detail: `Last seen ${formatFixAge(fixAgeMs ?? 0)}`,
      };
    }
    if (freshness === "delayed") {
      return {
        label: `${busConfidence ?? 0}%`,
        colour: "#F59E0B",
        detail: `Updated ${formatFixAge(fixAgeMs ?? 0)}`,
      };
    }
    return {
      label: `${busConfidence ?? 0}%`,
      colour: (busConfidence ?? 0) >= 70 ? "#22C55E" : "#F59E0B",
      detail:
        busLocation.accuracy != null
          ? `Accurate to ~${Math.round(busLocation.accuracy)} m`
          : `Updated ${formatFixAge(fixAgeMs ?? 0)}`,
    };
  }, [busLocation, freshness, busConfidence, fixAgeMs]);

  /* Pull the bus onto the route line when the fix is close enough that the bus
     must be on it. When it is not, the marker stays where GPS put it - an
     off-route bus is information the passenger needs, not an error to hide. */
  const snapped = useMemo(() => {
    if (!busLocation) return null;
    return snapToRoute(
      { latitude: busLocation.latitude, longitude: busLocation.longitude },
      routeCoords,
      busLocation.accuracy,
    );
  }, [busLocation, routeCoords]);

  /* The position the rest of the screen should treat as the bus. */
  const busPosition = useMemo<LatLng | null>(
    () => snapped?.position ?? null,
    [snapped],
  );

  // Calculate real-time speed by comparing timestamps and distances between 
  // consecutive bus location updates. This is often more accurate than 
  // raw GPS speed reported by low-end tracking devices.
  useEffect(() => {
    if (!busLocation || !busPosition) return;
    // Time the fix was taken, not the time it reached us: network delay would
    // otherwise inflate dt and understate the bus's speed.
    const now = busLocation.timestamp ?? Date.now();
    const hist = busHistory.current;

    // Compute speed from last known position
    if (hist.length > 0) {
      const prev = hist[hist.length - 1];
      const dt = (now - prev.time) / 1000; // seconds
      if (dt > 0.5) {
        const dx = haversineDistance(prev.lat, prev.lng, busPosition.latitude, busPosition.longitude);
        const computedSpeed = (dx / dt) * 3600; // km/h

        // Reliability check: Use GPS speed if valid, otherwise fallback to computed
        const gpsSpeed = busLocation.speed != null && busLocation.speed > 0 ? busLocation.speed * 3.6 : 0;
        const bestSpeed = gpsSpeed > 1 && gpsSpeed < 120 ? gpsSpeed : computedSpeed;

        if (bestSpeed < 150) { // Filter out impossible jumps
          speedBuffer.current.push(bestSpeed);
          if (speedBuffer.current.length > SPEED_BUFFER_SIZE) {
            speedBuffer.current.shift();
          }
        }
      }
    }

    hist.push({ lat: busPosition.latitude, lng: busPosition.longitude, time: now });
    if (hist.length > HISTORY_MAX) hist.shift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busLocation]);

  // Calculates a rolling average of speed to provide a smooth UI experience
  const smoothedSpeed = useMemo(() => {
    const buf = speedBuffer.current;
    if (buf.length === 0) return 0;

    // Weighted average: recent readings count more than older ones
    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < buf.length; i++) {
      const weight = i + 1; // older=1, newest=N
      weightedSum += buf[i] * weight;
      weightTotal += weight;
    }
    return weightedSum / weightTotal;
  }, [busLocation]);

  // Simple direct distance between bus and passenger. Uses the snapped
  // position so the number matches the marker the passenger is looking at.
  const distanceToUser = useMemo(() => {
    if (!busPosition || !userLocation) return null;
    return distanceKm(busPosition, userLocation);
  }, [busPosition, userLocation]);

  // Distance measured along the route rather than as the crow flies, so a
  // winding road between the bus and the stop is not understated.
  const distanceToDest = useMemo(() => {
    if (!busPosition) return null;
    return distanceAlongRoute(routeCoords, busPosition, passengerDestIndex);
  }, [busPosition, routeCoords, passengerDestIndex]);

  // Context-aware distance: Distance to "me" if waiting, distance to "destination" if on board
  const activeDistance = useMemo(() => {
    return isBoarded ? distanceToDest : distanceToUser;
  }, [isBoarded, distanceToDest, distanceToUser]);

  const etaText = useMemo(() => {
    if (activeDistance == null) return "Calculating...";
    if (activeDistance <= 0) return isBoarded ? "Arriving!" : "Arrived";
    if (smoothedSpeed < 1) return "Bus is stopped";
    return formatETA(activeDistance, smoothedSpeed);
  }, [activeDistance, smoothedSpeed, isBoarded]);

  const distanceText = useMemo(() => {
    if (activeDistance == null) return "—";
    return formatDistance(activeDistance);
  }, [activeDistance]);

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
          // The passenger's own dot anchors every distance and ETA on this
          // screen, so it is worth the extra battery to fix it precisely.
          accuracy: Location.Accuracy.BestForNavigation,
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

  /* Slide the marker from where it is drawn to the newest fix.
     Fixes arrive every few seconds; without this the marker would sit still
     and then jump, which reads as a glitch rather than as a moving bus. */
  useEffect(() => {
    if (!busPosition) return;

    const from = displayPosition;
    if (!from) {
      /* First fix of the session: place the marker, do not fly it in from
         wherever the map happened to be centred. */
      setDisplayPosition(busPosition);
      return;
    }

    const startedAt = Date.now();
    let frame: ReturnType<typeof requestAnimationFrame>;
    let lastPaintedAt = 0;

    /* Repaint about 25 times a second rather than on every frame. Each update
       re-renders the map with its polylines and stop markers, and at 60 fps
       that is enough work to stutter on a low-end phone - while 25 fps is
       already past the point where the slide looks continuous. */
    const MIN_FRAME_GAP_MS = 40;

    const step = () => {
      const elapsed = Date.now() - startedAt;
      const finished = elapsed >= MARKER_TRANSITION_MS;

      if (finished || elapsed - lastPaintedAt >= MIN_FRAME_GAP_MS) {
        lastPaintedAt = elapsed;
        setDisplayPosition(
          interpolatePosition(from, busPosition, elapsed, MARKER_TRANSITION_MS),
        );
      }
      if (!finished) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frame);
    // displayPosition is deliberately excluded: it is written by this effect,
    // and including it would restart the animation on every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busPosition]);

  /* Keep the age caption and confidence badge counting while the stream is
     quiet, so a frozen tracker is visible instead of looking healthy. */
  useEffect(() => {
    const id = setInterval(() => setClockTick((tick) => tick + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Fit map to show both user and bus
  // Adjusts the map viewport to ensure all critical markers are visible.
  const fitMapToMarkers = useCallback(() => {
    const coords: { latitude: number; longitude: number }[] = [];
    if (userLocation) coords.push(userLocation);
    if (busPosition) coords.push(busPosition);
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
  }, [userLocation, busPosition, routeCoords]);

  // Initial map fit when we get data
  const initialFitDone = useRef(false);
  useEffect(() => {
    if (!initialFitDone.current && (userLocation || busLocation)) {
      initialFitDone.current = true;
      setTimeout(fitMapToMarkers, 500);
    }
  }, [userLocation, busLocation, fitMapToMarkers]);

  // WebSocket for live bus location
  // Live WebSocket tracking: Connects to the tracking server to receive 
  // real-time location packets for the specific bus.
  useEffect(() => {
    const socket = new BusTrackingSocket();
    socket.connect();
    setWsConnected(true);

    // Both sources below can deliver an older fix than the one already on
    // screen - a redelivered push, or a REST response that lost the race with
    // a push. shouldApplyFix drops those, so the marker never runs backwards.
    const applyFix = (loc: LiveBusLocation | null) =>
      setBusLocation((current) => (shouldApplyFix(current, loc) ? loc : current));

    socket.subscribe(busNumber, applyFix);

    // Also fetch last known location immediately
    getLatestBusLocation(busNumber).then(applyFix).catch(() => { });

    return () => {
      setWsConnected(false);
      socket.disconnect();
    };
  }, [busNumber]);

  // Load route geometry
  // Fetches the static route path (geometry) from the API.
  useEffect(() => {
    getRouteGeometry(startLoc, busEndLoc)
      .then((geo) => {
        if (geo?.stops) setRouteStops(geo.stops);
      })
      .catch(() => { });
  }, [startLoc, busEndLoc]);

  // When user is boarded, follow bus location on map
  // Auto-follow logic: If the passenger is on board, the map automatically
  // centers on the bus as it moves.
  useEffect(() => {
    if (isBoarded && busPosition && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          ...busPosition,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        800,
      );
    }
  }, [isBoarded, busPosition]);

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

  /* ── Map Overlays ───────────────────────────────────────── */
  /* Bus marker with bus icon */
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
          index === sortedStops.length - 1 && styles.stopDotEnd,
          index === passengerDestIndex && styles.stopDotPassengerDest,
        ]}
      />
    </View>
  );

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <View style={styles.container}>
      {/* Main Map View */}
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
        mapPadding={{ top: 0, right: 0, bottom: 240, left: 0 }}
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
              name={sortedStops[idx]?.name ?? ""}
              index={idx}
            />
          </Marker>
        ))}

        {/* Accuracy circle: the area the bus is actually somewhere within.
            Drawing it is more honest than a bare pin, which implies a
            precision GPS does not have, and it makes a degraded signal
            visible as a widening circle rather than a marker that drifts. */}
        {displayPosition && busLocation?.accuracy != null && !isStale && (
          <Circle
            center={displayPosition}
            radius={busLocation.accuracy}
            strokeColor="rgba(47,107,255,0.35)"
            fillColor="rgba(47,107,255,0.10)"
            strokeWidth={1}
          />
        )}

        {/* Bus marker */}
        {displayPosition && (
          <Marker
            coordinate={displayPosition}
            anchor={{ x: 0.5, y: 0.9 }}
            tracksViewChanges={true}
            opacity={isStale ? 0.5 : 1}
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
        {/* Tracking quality, not just socket health: a connected socket
            carrying a 40-second-old fix is not "LIVE" to a waiting rider. */}
        <View style={styles.connectionDot}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: wsConnected
                  ? trackingStatus.colour
                  : "#EF4444",
              },
            ]}
          />
          <Text style={styles.statusText}>
            {wsConnected ? trackingStatus.label : "OFFLINE"}
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
        {busPosition && (
          <Pressable
            style={styles.fabButton}
            onPress={() => {
              mapRef.current?.animateToRegion(
                {
                  ...busPosition,
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

      {/* Bottom Sheet: Interactive details and metrics */}
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
          {userLocation && (
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
              {busLocation
                ? `${Math.round(smoothedSpeed)} km/h`
                : "—"}
            </Text>
          </View>
        </View>

        {/* Tracking quality strip: tells the rider how much to trust the dot,
            and why, instead of leaving them to guess whether a motionless
            marker means a parked bus or a dead signal. */}
        {busLocation && (
          <View style={styles.accuracyRow}>
            <MaterialCommunityIcons
              name={
                freshness === "lost"
                  ? "satellite-variant"
                  : "crosshairs-gps"
              }
              size={14}
              color={trackingStatus.colour}
            />
            <Text style={styles.accuracyText}>{trackingStatus.detail}</Text>
            {snapped?.snapped && (
              <Text style={styles.accuracyBadge}>ON ROUTE</Text>
            )}
            {/* The route line is drawn as straight chords between the stops we
                hold coordinates for, not the road the bus actually drives. On
                a long route with few stops the bus is legitimately kilometres
                from that line, so only flag a deviation big enough to mean a
                real diversion. */}
            {snapped &&
              !snapped.snapped &&
              snapped.offRouteMeters > OFF_ROUTE_ALERT_METERS && (
                <Text style={[styles.accuracyBadge, styles.accuracyBadgeWarn]}>
                  OFF ROUTE
                </Text>
              )}
          </View>
        )}

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
        ) : isStale ? (
          /* Distance and ETA computed from a fix this old would be fiction.
             Show the last known position instead of a confident wrong number. */
          <View style={styles.waitingBanner}>
            <MaterialCommunityIcons
              name="signal-off"
              size={16}
              color="#94A3B8"
            />
            <Text style={styles.waitingText}>
              Lost contact with the bus • last seen{" "}
              {formatFixAge(fixAgeMs ?? 0)}
            </Text>
          </View>
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
          {!isBoarded && (
            <Pressable
              style={[
                styles.boardBtn,
                !boarding.allowed && styles.boardBtnDisabled,
              ]}
              disabled={!boarding.allowed}
              onPress={() => setShowBoardingModal(true)}
            >
              <Ionicons
                name={boarding.allowed ? "enter-outline" : "lock-closed-outline"}
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.boardBtnText} numberOfLines={1}>
                {boarding.allowed ? "I'm on the Bus" : boarding.reason}
              </Text>
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
  );
}

/* ── Styles ──────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    top: 90,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
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
    flexShrink: 1,
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
    bottom: 260,
    gap: 8,
    zIndex: 10,
  },
  fabButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 10,
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
    marginBottom: 2,
  },

  /* Sheet Header */
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetBusIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#2F6BFF",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHeaderInfo: {
    flex: 1,
  },
  sheetBusNumber: {
    fontSize: 15,
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
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
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
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "500",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
  },

  /* Status banners */
  boardedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#22C55E",
    paddingVertical: 8,
    borderRadius: 10,
  },
  boardedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  accuracyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 8,
  },
  accuracyText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  accuracyBadge: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#15803D",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  accuracyBadgeWarn: {
    color: "#B45309",
    backgroundColor: "#FEF3C7",
  },
  approachingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    paddingVertical: 8,
    borderRadius: 10,
  },
  approachingText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2F6BFF",
  },
  waitingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F8FAFC",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },
  waitingText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#94A3B8",
  },

  /* Action buttons */
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  boardBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#2F6BFF",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  boardBtnDisabled: {
    backgroundColor: "#94A3B8",
  },
  boardBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  alightBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F97316",
    paddingVertical: 12,
    borderRadius: 12,
  },
  alightBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  msgBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1.5,
    borderColor: "#2F6BFF",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  msgBtnText: {
    fontSize: 13,
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
  stopDotPassengerDest: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
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
