// Essential React and React Native imports for UI structure and state management
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// API Services and Session management imports
import {
  getRecentUpcomingBookings,
  type RecentBookingDto,
} from "../../services/bookingsApi";
import { getPassengerNotifications } from "../../services/notificationsApi";
import { getUserProfile } from "../../services/userProfileApi";
import { useSession } from "../../store/sessionStore";

// Configuration for dashboard quick access buttons
const quickActions = [
  {
    key: "highway",
    label: "Highway Bus",
    icon: (color: string) => (
      <MaterialCommunityIcons name="road-variant" size={20} color={color} />
    ),
  },
  {
    key: "long-distance",
    label: "Long Distance",
    icon: (color: string) => (
      <Ionicons name="bus-outline" size={20} color={color} />
    ),
  },
  {
    key: "trip-booking",
    label: "Trip Booking",
    icon: (color: string) => (
      <Ionicons name="ticket-outline" size={20} color={color} />
    ),
  },
  {
    key: "my-bookings",
    label: "My Bookings",
    icon: (color: string) => (
      <Ionicons name="calendar-outline" size={20} color={color} />
    ),
  },
];

/**
 * Data interface for transformed booking objects used in the UI
 */
interface DashboardRecentBooking {
  busNumber: string;
  busType: string;
  id: string;
  badge: string;
  from: string;
  to: string;
  dateLabel: string;
  timeLabel: string;
  base: string;
  journeyAt: Date;
}

/**
 * Formats raw bus type strings into human-readable labels
 */
function normalizeBusType(busType: string): string {
  const raw = (busType ?? "").toLowerCase();
  if (raw === "trip_booking") {
    return "Trip";
  }
  if (!raw) {
    return "Booking";
  }
  return raw
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Assigns a specific theme color based on the booking type
 */
function getCardBaseColor(busType: string): string {
  return (busType ?? "").toLowerCase() === "trip_booking"
    ? "#8A2BE2" //Purple for trip booking
    : "#2F6BFF"; //Blue for long distance or highway booking
}

/**
 * Combines date and time strings from API into a single Date object
 */
function parseJourneyDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Returns a time-appropriate greeting (Morning, Afternoon, etc.)
 */
function getGreetingForTime(date: Date): string {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) {
    return "Good Morning";
  }
  if (hour >= 12 && hour < 17) {
    return "Good Afternoon";
  }
  if (hour >= 17 && hour < 21) {
    return "Good Evening";
  }
  return "Good Night";
}

/**
 * Transforms API DTO into a format suitable for the dashboard UI
 */
function toDashboardRecentBooking(
  dto: RecentBookingDto,
): DashboardRecentBooking {
  const journeyAt = parseJourneyDateTime(dto.journeyDate, dto.journeyTime);
  const dateLabel = dto.journeyDate;
  const timeLabel = journeyAt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return {
    busNumber: dto.busNumber,
    busType: dto.busType,
    id: dto.bookingReference,
    badge: normalizeBusType(dto.busType),
    from: dto.startLocation,
    to: dto.endLocation,
    dateLabel,
    timeLabel,
    base: getCardBaseColor(dto.busType),
    journeyAt,
  };
}

// Constants for dynamic layout calculations
const CARD_GAP = 12;
const H_PADDING = 20;
const screenWidth = Dimensions.get("window").width;
const cardWidth = (screenWidth - H_PADDING * 2 - CARD_GAP) / 2;

/**
 * Custom hook for smooth entrance animations on component load
 * @param delay - millisecond delay before animation starts
 */
function useEntranceAnimation(delay: number) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);

  return { opacity, translateY };
}

/**
 * Reusable component for adding a "press-in" scaling effect to touchable elements
 */
function PressScale({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 18,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  // Session and Navigation hooks
  const { currentUser } = useSession();
  const router = useRouter();

  // Entrance animations for different dashboard sections
  const headerAnim = useEntranceAnimation(0);
  const greetingAnim = useEntranceAnimation(80);
  const gridAnim = useEntranceAnimation(160);
  const recentAnim = useEntranceAnimation(240);

  // Component local state
  const [recentBookings, setRecentBookings] = useState<
    DashboardRecentBooking[]
  >([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [displayName, setDisplayName] = useState("User");
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  /**
   * Fetches user profile to display proper name on dashboard
   */
  const loadDisplayName = useCallback(async () => {
    if (!currentUser) {
      setDisplayName("User");
      return;
    }

    try {
      const profile = await getUserProfile(currentUser.userId);
      const resolvedName =
        profile.fullName?.trim() ||
        profile.contactPersonName?.trim() ||
        profile.companyName?.trim() ||
        `User ${currentUser.userId}`;
      setDisplayName(resolvedName);
    } catch (error) {
      console.error("[HomeScreen] Failed to load user profile", error);
      setDisplayName(`User ${currentUser.userId}`);
    }
  }, [currentUser]);

  /**
   * Fetches upcoming bookings for the current user
   */
  const loadRecentBookings = useCallback(async () => {
    if (!currentUser) {
      setRecentBookings([]);
      setLoadingRecent(false);
      setNow(new Date());
      return;
    }

    try {
      setLoadingRecent(true);
      const data = await getRecentUpcomingBookings(currentUser.userId);
      setNow(new Date());
      setRecentBookings(data.map(toDashboardRecentBooking));
    } catch (error) {
      console.error("[HomeScreen] Failed to load recent bookings", error);
      setRecentBookings([]);
    } finally {
      setLoadingRecent(false);
    }
  }, [currentUser]);

  const loadUnreadNotifications = useCallback(async () => {
    if (!currentUser) {
      setHasUnreadNotifications(false);
      return;
    }

    try {
      const notifications = await getPassengerNotifications(currentUser.userId);
      setHasUnreadNotifications(
        notifications.some((notification) => !notification.read),
      );
    } catch (error) {
      console.error("[HomeScreen] Failed to load notifications", error);
    }
  }, [currentUser]);

  // Refresh data whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      void loadRecentBookings();
      void loadDisplayName();
      void loadUnreadNotifications();
    }, [loadRecentBookings, loadDisplayName, loadUnreadNotifications]),
  );

  useEffect(() => {
    if (!currentUser) {
      setHasUnreadNotifications(false);
      return;
    }

    const intervalId = setInterval(() => {
      void loadUnreadNotifications();
    }, 30_000);

    return () => clearInterval(intervalId);
  }, [currentUser, loadUnreadNotifications]);

  /**
   * Automatically refreshes bookings list when a booking's journey time passes
   */
  useEffect(() => {
    const nowMillis = Date.now();
    const nextExpiryMillis = recentBookings
      .map((booking) => booking.journeyAt.getTime())
      .filter((millis) => millis >= nowMillis)
      .sort((a, b) => a - b)[0];

    if (!nextExpiryMillis) {
      return;
    }

    const delayMillis = Math.max(nextExpiryMillis - nowMillis + 1_000, 500);
    const timeoutId = setTimeout(() => {
      setNow(new Date());
      void loadRecentBookings();
    }, delayMillis);

    return () => clearTimeout(timeoutId);
  }, [recentBookings, loadRecentBookings]);

  /**
   * Refreshes the "now" state at day/time boundaries to update greetings
   */
  useEffect(() => {
    const nowDate = new Date();
    const boundaryHours = [5, 12, 17, 21, 24];
    const currentHour = nowDate.getHours();
    const nextHour = boundaryHours.find((hour) => hour > currentHour) ?? 24;
    const nextBoundary = new Date(nowDate);
    nextBoundary.setHours(nextHour, 0, 0, 0);
    const delayMillis = Math.max(nextBoundary.getTime() - Date.now(), 500);

    const timeoutId = setTimeout(() => {
      setNow(new Date());
    }, delayMillis);

    return () => clearTimeout(timeoutId);
  }, [now]);

  // Memoized values for performance
  const actionColor = useMemo(() => "#2F6BFF", []);

  const todayLabel = useMemo(() => {
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      day: "2-digit",
      month: "short",
    });
  }, [now]);

  const greetingLabel = useMemo(() => getGreetingForTime(now), [now]);

  // Filters out bookings that have already passed their journey date
  const visibleRecentBookings = useMemo(
    () =>
      recentBookings.filter((booking) => {
        const journeyDate = new Date(
          booking.journeyAt.getFullYear(),
          booking.journeyAt.getMonth(),
          booking.journeyAt.getDate(),
        );
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        return journeyDate.getTime() >= today.getTime();
      }),
    [recentBookings, now],
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* --- Top Branding and Notification Header --- */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: headerAnim.opacity,
              transform: [{ translateY: headerAnim.translateY }],
            },
          ]}
        >
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Ionicons name="bus" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.brandText}>TrackNGo</Text>
          </View>
          <View style={styles.headerActions}>
            <PressScale
              onPress={() => router.push("/notifications/notifications")}
            >
              <View style={styles.iconButton}>
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color="#1F2937"
                />
                {hasUnreadNotifications ? (
                  <View style={styles.notificationDot} />
                ) : null}
              </View>
            </PressScale>
            <PressScale
              onPress={() => Alert.alert("Menu", "Menu button tapped.")}
            >
              <View style={styles.iconButton}>
                <Ionicons name="menu" size={22} color="#1F2937" />
              </View>
            </PressScale>
          </View>
        </Animated.View>

        <View style={styles.divider} />

        {/* --- Greeting Section --- */}
        <Animated.View
          style={[
            styles.greetingBlock,
            {
              opacity: greetingAnim.opacity,
              transform: [{ translateY: greetingAnim.translateY }],
            },
          ]}
        >
          <Text style={styles.dateText}>{todayLabel}</Text>
          <Text style={styles.greetingText}>
            {greetingLabel}, {displayName}
          </Text>
        </Animated.View>

        {/* --- Quick Action Grid --- */}
        <Animated.View
          style={[
            styles.grid,
            {
              opacity: gridAnim.opacity,
              transform: [{ translateY: gridAnim.translateY }],
            },
          ]}
        >
          {quickActions.map((action) => (
            <PressScale
              key={action.key}
              onPress={() => {
                if (
                  action.key === "highway" ||
                  action.key === "long-distance"
                ) {
                  const busCategory = action.key === "highway" ? "highway" : "long_distance";
                  router.push({
                    pathname: "/booking/search-buses",
                    params: { busCategory },
                  });
                  return;
                }
                if (action.key === "trip-booking") {
                  router.push("/trips/BookATrip");
                  return;
                }
                if (action.key === "my-bookings") {
                  router.push("/booking/booking-history");
                  return;
                }
                Alert.alert(action.label, `Opening ${action.label}...`);
              }}
            >
              <View style={styles.actionCard}>
                <View style={styles.actionIconWrap}>
                  {action.icon(actionColor)}
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </View>
            </PressScale>
          ))}
        </Animated.View>

        {/* --- Recent Bookings Display --- */}
        <Animated.View
          style={[
            styles.recentBlock,
            {
              opacity: recentAnim.opacity,
              transform: [{ translateY: recentAnim.translateY }],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>Recent Bookings</Text>

          {loadingRecent ? (
            <Text style={styles.recentInfoText}>
              Loading upcoming bookings...
            </Text>
          ) : null}

          {!loadingRecent && visibleRecentBookings.length === 0 ? (
            <Text style={styles.recentInfoText}>
              No upcoming bookings found.
            </Text>
          ) : null}

          {visibleRecentBookings.map((booking) => (
            <View
              key={booking.id}
              style={[styles.bookingCard, { backgroundColor: booking.base }]}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Upcoming</Text>
                  </View>
                  <View style={[styles.badge, styles.badgeSoft]}>
                    <Text style={styles.badgeText}>{booking.badge}</Text>
                  </View>
                </View>
                <Text style={styles.refText}>Ref: {booking.id}</Text>
              </View>

              <View style={styles.tripRow}>
                <View>
                  <Text style={styles.tripLabel}>From</Text>
                  <Text style={styles.tripValue}>{booking.from}</Text>
                </View>
                <View style={styles.tripLineWrap}>
                  <View style={styles.tripLine} />
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.tripLabel}>To</Text>
                  <Text style={styles.tripValue}>{booking.to}</Text>
                </View>
              </View>

              <View style={styles.cardBottomRow}>
                <Text style={styles.timeText}>
                  {booking.dateLabel} | {booking.timeLabel}
                </Text>
                <View style={styles.cardActions}>
                  <PressScale
                    onPress={() =>
                      router.push({
                        pathname: "/map/live-map",
                        params: {
                          busNumber: booking.busNumber,
                          startLocation: booking.from,
                          endLocation: booking.to,
                        },
                      })
                    }
                  >
                    <View style={styles.smallButton}>
                      <Ionicons
                        name="location"
                        size={13}
                        color={booking.base}
                      />
                      <Text
                        style={[
                          styles.smallButtonText,
                          { color: booking.base },
                        ]}
                      >
                        Track Live
                      </Text>
                    </View>
                  </PressScale>
                  <PressScale
                    onPress={() =>
                      router.push({
                        pathname: "/booking/view-ticket",
                        params: {
                          bookingRef: booking.id,
                          from: booking.from,
                          to: booking.to,
                          busNumber: booking.busNumber,
                          date: booking.dateLabel,
                          depart: booking.timeLabel,
                          busType: booking.busType,
                          passengerName: displayName,
                        },
                      })
                    }
                  >
                    <View style={styles.smallButton}>
                      <Text
                        style={[
                          styles.smallButtonText,
                          { color: booking.base },
                        ]}
                      >
                        View Ticket
                      </Text>
                    </View>
                  </PressScale>
                </View>
              </View>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// UI Styles for the Dashboard
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },
  container: {
    paddingHorizontal: H_PADDING,
    paddingBottom: 32,
    backgroundColor: "#F6F7F9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E9EDF3",
    marginBottom: 18,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#2F6BFF",
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconButton: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF4D5A",
  },
  greetingBlock: {
    marginBottom: 18,
  },
  dateText: {
    color: "#9AA4B2",
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "500",
  },
  greetingText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  actionCard: {
    width: cardWidth,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: CARD_GAP,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EAF1FF",
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
  },
  recentBlock: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },
  recentInfoText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: -4,
  },
  bookingCard: {
    borderRadius: 14,
    padding: 16,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeSoft: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  badgeText: {
    fontSize: 10.5,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  refText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  tripLabel: {
    fontSize: 10.5,
    color: "rgba(255,255,255,0.75)",
  },
  tripValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tripLineWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tripLine: {
    width: 72,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    borderStyle: "dashed",
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  timeText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    flex: 1,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  smallButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    height: 28,
  },
  smallButtonText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
