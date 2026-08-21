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
  AppState,
  Animated,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LocalizedText as Text } from "../../utils/i18n";
import {
  getGreetingForTime,
  millisUntilNextGreetingBoundary,
} from "../../utils/greeting";

// API Services and Session management imports
import {
  getRecentUpcomingBookings,
  type RecentBookingDto,
} from "../../services/bookingsApi";
import { getPassengerUnreadCount } from "../../services/notificationsApi";
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
  /* Raw journey date/time, kept alongside the display labels because the
     live map gates boarding on when the trip actually departs. */
  journeyDate: string;
  journeyTime: string;
  paymentStatus?: string | null;
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
 * Transforms API DTO into a format suitable for the dashboard UI
 */
/**
 * Identity of the rendered booking list. Background polls compare against this
 * so an unchanged response does not replace state, which would re-render the
 * dashboard and restart the journey-expiry timer every few seconds.
 */
function recentBookingsSignature(bookings: DashboardRecentBooking[]) {
  return bookings
    .map((booking) =>
      [
        booking.id,
        booking.busNumber,
        booking.busType,
        booking.badge,
        booking.from,
        booking.to,
        booking.dateLabel,
        booking.timeLabel,
        booking.base,
        booking.journeyAt.getTime(),
        booking.journeyDate,
        booking.journeyTime,
        booking.paymentStatus ?? "",
      ].join("|"),
    )
    .join("~");
}

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
    journeyDate: dto.journeyDate,
    journeyTime: dto.journeyTime,
    paymentStatus: dto.paymentStatus,
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
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
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
      style={style}
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
  // Distinguishes the first load from the 5s background polls.
  const hasLoadedRecentRef = useRef(false);
  const [now, setNow] = useState(() => new Date());
  const [displayName, setDisplayName] = useState("User");
  const [unreadNotifications, setUnreadNotifications] = useState(0);

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
      hasLoadedRecentRef.current = false;
      return;
    }

    // Only the very first load shows a placeholder. The 5s background poll
    // refreshes in place, so the section no longer collapses to a loading
    // line and pushes the cards around twice every cycle.
    const isFirstLoad = !hasLoadedRecentRef.current;
    if (isFirstLoad) {
      setLoadingRecent(true);
    }

    try {
      const data = await getRecentUpcomingBookings(currentUser.userId);
      const next = data.map(toDashboardRecentBooking);
      setNow(new Date());
      setRecentBookings((previous) =>
        recentBookingsSignature(previous) === recentBookingsSignature(next)
          ? previous
          : next,
      );
      hasLoadedRecentRef.current = true;
    } catch (error) {
      console.error("[HomeScreen] Failed to load recent bookings", error);
      // A dropped poll is not an empty booking list. Keep whatever is already
      // on screen rather than flashing "No upcoming bookings found".
      if (isFirstLoad) {
        setRecentBookings([]);
      }
    } finally {
      if (isFirstLoad) {
        setLoadingRecent(false);
      }
    }
  }, [currentUser]);

  const loadUnreadNotifications = useCallback(async () => {
    if (!currentUser) {
      setUnreadNotifications(0);
      return;
    }

    setUnreadNotifications(await getPassengerUnreadCount(currentUser.userId));
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
      setUnreadNotifications(0);
      return;
    }

    const intervalId = setInterval(() => {
      if (AppState.currentState === "active") {
        void loadUnreadNotifications();
        void loadRecentBookings();
      }
    }, 5_000);

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void loadUnreadNotifications();
        void loadRecentBookings();
      }
    });

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, [currentUser, loadRecentBookings, loadUnreadNotifications]);

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
    const timeoutId = setTimeout(() => {
      setNow(new Date());
    }, millisUntilNextGreetingBoundary());

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
                {unreadNotifications > 0 ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {unreadNotifications > 9 ? "9+" : String(unreadNotifications)}
                    </Text>
                  </View>
                ) : null}
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
                <View style={styles.tripEndpoint}>
                  <Text style={styles.tripLabel}>From</Text>
                  <Text style={styles.tripValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{booking.from}</Text>
                </View>
                <View style={styles.tripLineWrap}>
                  <View style={styles.tripLine} />
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </View>
                <View style={styles.tripEndpoint}>
                  <Text style={[styles.tripLabel, styles.tripTextEnd]}>To</Text>
                  <Text style={[styles.tripValue, styles.tripTextEnd]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{booking.to}</Text>
                </View>
              </View>

              <View style={styles.cardBottomRow}>
                <Text style={styles.timeText}>
                  {booking.dateLabel} | {booking.timeLabel}
                </Text>
                <View style={styles.cardActions}>
                  {booking.busType === "trip_booking" &&
                  !["success", "paid"].includes(String(booking.paymentStatus ?? "").toLowerCase()) ? (
                    <PressScale
                      style={styles.actionButton}
                      onPress={() => {
                        const tripId = booking.id.replace("BK-", "");
                        router.push({
                          pathname: "/trips/NegotiationScreen",
                          params: {
                            tripDetails: JSON.stringify({
                              bookingId: tripId,
                              pickup: booking.from,
                              drop: booking.to,
                              depart: booking.dateLabel,
                              busBrand: "Standard",
                              busNumber: "Pending Assignment",
                              totalPayment: 0,
                              advancePayment: 0,
                              dueAmount: 0
                            })
                          }
                        });
                      }}
                    >
                      <View style={styles.smallButton}>
                        <Ionicons
                          name="chatbubbles-outline"
                          size={13}
                          color={booking.base}
                        />
                        <Text
                          style={[
                            styles.smallButtonText,
                            { color: booking.base },
                          ]}
                        >
                          {booking.busNumber === "PENDING" ? "Review Booking" : "Open Booking Review"}
                        </Text>
                      </View>
                    </PressScale>
                  ) : (
                    <>
                      <PressScale
                        style={styles.actionButton}
                        onPress={() =>
                          router.push({
                            pathname: "/map/live-map",
                            params: {
                              busNumber: booking.busNumber,
                              startLocation: booking.from,
                              endLocation: booking.to,
                              // Boarding is limited to the trip the seat is
                              // booked on, so the map needs its departure time.
                              journeyDate: booking.journeyDate,
                              journeyTime: booking.journeyTime,
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
                        style={styles.actionButton}
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
                          <Ionicons
                            name="arrow-forward"
                            size={13}
                            color={booking.base}
                          />
                        </View>
                      </PressScale>
                    </>
                  )}
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
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#FF4D5A",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#FFFFFF",
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
    fontSize: 11,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
  },
  recentBlock: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 16,
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    flexShrink: 1,
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
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  refText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  tripEndpoint: {
    flex: 1,
    minWidth: 0,
  },
  // The destination reads against the right edge so the row runs
  // origin -> arrow -> destination across the full card width. This aligns the
  // glyphs rather than the box, so adjustsFontSizeToFit keeps a width to
  // shrink long city names into.
  tripTextEnd: {
    textAlign: "right",
  },
  tripLabel: {
    fontSize: 11, fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
  },
  tripValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    minWidth: 0,
    flexShrink: 1,
  },
  tripLineWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 64,
    flexShrink: 0,
  },
  tripLine: {
    flex: 1,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    borderStyle: "dashed",
  },
  cardBottomRow: {
    flexDirection: "column",
    alignItems: "stretch",
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
    alignItems: "center",
  },
  // Each action takes an equal share of the row, so two buttons split it in
  // half and a single button spans the card rather than sitting off to one side.
  actionButton: {
    flex: 1,
  },
  smallButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    height: 28,
  },
  smallButtonText: {
    fontSize: 13,
    fontWeight: "600",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});
