import React, { useEffect, useMemo, useRef } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

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
    icon: (color: string) => <Ionicons name="bus-outline" size={20} color={color} />,
  },
  {
    key: "trip-booking",
    label: "Trip Booking",
    icon: (color: string) => <Ionicons name="ticket-outline" size={20} color={color} />,
  },
  {
    key: "my-bookings",
    label: "My Bookings",
    icon: (color: string) => <Ionicons name="calendar-outline" size={20} color={color} />,
  },
];

const recentBookings = [
  {
    id: "HW8892",
    badge: "Highway",
    from: "Colombo",
    to: "Galle",
    time: "Tomorrow, 08:00 AM",
    base: "#2F6BFF",
  },
  {
    id: "TB8892",
    badge: "Trip",
    from: "Colombo",
    to: "Jaffna",
    time: "Dec 05, 08:00 AM",
    base: "#8A2BE2",
  },
];

const CARD_GAP = 12;
const H_PADDING = 20;
const screenWidth = Dimensions.get("window").width;
const cardWidth = (screenWidth - H_PADDING * 2 - CARD_GAP) / 2;

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

function PressScale({
  children,
  onPress,
}: {
  children: React.ReactNode;
  onPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 20 }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18 }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const headerAnim = useEntranceAnimation(0);
  const greetingAnim = useEntranceAnimation(80);
  const gridAnim = useEntranceAnimation(160);
  const recentAnim = useEntranceAnimation(240);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const actionColor = useMemo(() => "#2F6BFF", []);
  const todayLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      day: "2-digit",
      month: "short",
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.header,
            { opacity: headerAnim.opacity, transform: [{ translateY: headerAnim.translateY }] },
          ]}
        >
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Ionicons name="bus" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.brandText}>TrackNGo</Text>
          </View>
          <View style={styles.headerActions}>
            <PressScale onPress={() => router.push("/notifications/notifications")}>
              <View style={styles.iconButton}>
                <Ionicons name="notifications-outline" size={20} color="#1F2937" />
                <View style={styles.notificationDot} />
              </View>
            </PressScale>
            <PressScale onPress={() => Alert.alert("Menu", "Menu button tapped.")}>
              <View style={styles.iconButton}>
                <Ionicons name="menu" size={22} color="#1F2937" />
              </View>
            </PressScale>
          </View>
        </Animated.View>

        <View style={styles.divider} />

        <Animated.View
          style={[
            styles.greetingBlock,
            { opacity: greetingAnim.opacity, transform: [{ translateY: greetingAnim.translateY }] },
          ]}
        >
          <Text style={styles.dateText}>{todayLabel}</Text>
          <Text style={styles.greetingText}>Good Morning, Chamara</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.grid,
            { opacity: gridAnim.opacity, transform: [{ translateY: gridAnim.translateY }] },
          ]}
        >
          {quickActions.map((action) => (
            <PressScale
              key={action.key}
              onPress={() => {
                if (action.key === "highway" || action.key === "long-distance") {
                  router.push("/booking/search-buses");
                  return;
                }
                Alert.alert(action.label, `Opening ${action.label}...`);
              }}
            >
              <View style={styles.actionCard}>
                <View style={styles.actionIconWrap}>{action.icon(actionColor)}</View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </View>
            </PressScale>
          ))}
        </Animated.View>

        <Animated.View
          style={[
            styles.recentBlock,
            { opacity: recentAnim.opacity, transform: [{ translateY: recentAnim.translateY }] },
          ]}
        >
          <Text style={styles.sectionTitle}>Recent Bookings</Text>

          {recentBookings.map((booking) => (
            <View key={booking.id} style={[styles.bookingCard, { backgroundColor: booking.base }]}>
              <View style={styles.cardTopRow}>
                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Upcoming</Text>
                  </View>
                  <View style={[styles.badge, styles.badgeSoft]}>
                    <Text style={styles.badgeText}>{booking.badge}</Text>
                  </View>
                </View>
                <Text style={styles.refText}>Ref: #{booking.id}</Text>
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
                <Text style={styles.timeText}>{booking.time}</Text>
                <View style={styles.cardActions}>
                  <PressScale onPress={() => router.push("/map/live-map")}>
                    <View style={styles.smallButton}>
                      <Ionicons name="location" size={13} color={booking.base} />
                      <Text style={[styles.smallButtonText, { color: booking.base }]}>
                        Track Live
                      </Text>
                    </View>
                  </PressScale>
                  <PressScale onPress={() => Alert.alert("Ticket", `Viewing ticket #${booking.id}.`)}>
                    <View style={styles.smallButton}>
                      <Text style={[styles.smallButtonText, { color: booking.base }]}>
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
