import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useUser } from "@/context/UserContext";
import { useTheme } from "@/context/ThemeContext";
import { formatDate } from "@/utils/dateFormatter";
import {
  getDriverComplaints,
  getDriverRatings,
  type DriverComplaintDto,
  type DriverTripRatingDto,
} from "@/services/reviewsRatingsApi";

type Tab = "ratings" | "complaints";

const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  driver_behavior: "Driver Behavior",
  bus_condition: "Bus Condition",
  route_issue: "Route Issue",
  late_arrival: "Late Arrival",
  payment_issue: "Payment Issue",
  booking_issue: "Booking Issue",
  safety_concern: "Safety Concern",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  under_review: "Under Review",
  resolved: "Resolved",
  rejected: "Rejected",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "#16A34A",
  medium: "#D97706",
  high: "#DC2626",
};

export default function ReviewsAndRatingsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { darkMode } = useTheme();
  const { bottom } = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<Tab>("ratings");
  const [ratings, setRatings] = useState<DriverTripRatingDto[]>([]);
  const [complaints, setComplaints] = useState<DriverComplaintDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const [complaintsError, setComplaintsError] = useState<string | null>(null);

  const theme = {
    background: darkMode ? "#111" : "#F5F5F5",
    card: darkMode ? "#1E1E1E" : "#FFF",
    text: darkMode ? "#FFF" : "#000",
    secondaryText: darkMode ? "#AAA" : "#666",
    border: darkMode ? "#333" : "#E0E0E0",
  };

  const loadData = useCallback(
    async (showLoader = true) => {
      if (!user?.userId || !user.token) {
        setRatings([]);
        setComplaints([]);
        setLoading(false);
        return;
      }

      if (showLoader) setLoading(true);
      setRatingsError(null);
      setComplaintsError(null);

      const [ratingsResult, complaintsResult] = await Promise.allSettled([
        getDriverRatings(user.userId, user.token),
        getDriverComplaints(user.userId, user.token),
      ]);

      if (ratingsResult.status === "fulfilled") {
        setRatings(ratingsResult.value);
      } else {
        console.error("Failed to load driver ratings", ratingsResult.reason);
        setRatingsError("Could not load ratings. Pull down to try again.");
      }

      if (complaintsResult.status === "fulfilled") {
        setComplaints(complaintsResult.value);
      } else {
        console.error("Failed to load driver complaints", complaintsResult.reason);
        setComplaintsError("Could not load complaints. Pull down to try again.");
      }

      setLoading(false);
    },
    [user?.token, user?.userId],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const averageDriverRating = useMemo(() => {
    const values = ratings
      .map((item) => item.driverRating)
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [ratings]);

  const styles = useMemo(() => createStyles(theme), [darkMode]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={theme.text}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Reviews and Ratings</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tabButton, activeTab === "ratings" && styles.tabButtonActive]}
          onPress={() => setActiveTab("ratings")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "ratings" && styles.tabButtonTextActive,
            ]}
          >
            Ratings ({ratings.length})
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === "complaints" && styles.tabButtonActive]}
          onPress={() => setActiveTab("complaints")}
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "complaints" && styles.tabButtonTextActive,
            ]}
          >
            Complaints ({complaints.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 24 + bottom },
        ]}
      >
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#0066FF" />
            <Text style={styles.stateText}>Loading...</Text>
          </View>
        ) : activeTab === "ratings" && ratingsError ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons
              name="wifi-alert"
              size={22}
              color="#EF4444"
            />
            <Text style={styles.stateText}>{ratingsError}</Text>
          </View>
        ) : activeTab === "complaints" && complaintsError ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons
              name="wifi-alert"
              size={22}
              color="#EF4444"
            />
            <Text style={styles.stateText}>{complaintsError}</Text>
          </View>
        ) : activeTab === "ratings" ? (
          <>
            {averageDriverRating != null ? (
              <View style={styles.summaryCard}>
                <MaterialCommunityIcons name="star" size={22} color="#FFD700" />
                <Text style={styles.summaryText}>
                  {averageDriverRating.toFixed(1)}/5.0 average from {ratings.length}{" "}
                  {ratings.length === 1 ? "rating" : "ratings"}
                </Text>
              </View>
            ) : null}

            {ratings.length === 0 ? (
              <View style={styles.stateCard}>
                <MaterialCommunityIcons
                  name="star-off-outline"
                  size={24}
                  color="#94A3B8"
                />
                <Text style={styles.stateText}>No ratings yet.</Text>
              </View>
            ) : (
              ratings.map((item) => (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.passengerName}>
                      {item.passengerName}
                    </Text>
                    <Text style={styles.cardDate}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>

                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <MaterialCommunityIcons
                        key={i}
                        name="star"
                        size={16}
                        color={
                          item.driverRating != null && i <= item.driverRating
                            ? "#FFD700"
                            : "#D3D3D3"
                        }
                      />
                    ))}
                  </View>

                  {item.reviewText ? (
                    <Text style={styles.reviewText}>{item.reviewText}</Text>
                  ) : null}

                  <View style={styles.subRatingsRow}>
                    {item.busConditionRating != null ? (
                      <Text style={styles.subRatingText}>
                        Bus condition: {item.busConditionRating}/5
                      </Text>
                    ) : null}
                    {item.journeyRating != null ? (
                      <Text style={styles.subRatingText}>
                        Journey: {item.journeyRating}/5
                      </Text>
                    ) : null}
                  </View>

                  {item.busNumber ? (
                    <Text style={styles.metaText}>Bus {item.busNumber}</Text>
                  ) : null}
                </View>
              ))
            )}
          </>
        ) : complaints.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons
              name="check-decagram-outline"
              size={24}
              color="#94A3B8"
            />
            <Text style={styles.stateText}>No complaints filed.</Text>
          </View>
        ) : (
          complaints.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.complaintType}>
                  {COMPLAINT_TYPE_LABELS[item.complaintType] ?? "Other"}
                </Text>
                <Text style={styles.cardDate}>
                  {formatDate(item.createdAt)}
                </Text>
              </View>

              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.priorityBadge,
                    {
                      backgroundColor:
                        (PRIORITY_COLORS[item.priority] ?? "#64748B") + "22",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityBadgeText,
                      { color: PRIORITY_COLORS[item.priority] ?? "#64748B" },
                    ]}
                  >
                    {item.priority?.toUpperCase() ?? "MEDIUM"}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>
                    {STATUS_LABELS[item.status] ?? "Pending"}
                  </Text>
                </View>
              </View>

              <Text style={styles.reviewText}>{item.description}</Text>

              {item.adminResponse ? (
                <View style={styles.adminResponseBox}>
                  <Text style={styles.adminResponseLabel}>Admin response</Text>
                  <Text style={styles.adminResponseText}>
                    {item.adminResponse}
                  </Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: {
  background: string;
  card: string;
  text: string;
  secondaryText: string;
  border: string;
}) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    headerRow: {
      minHeight: 52,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backButton: {
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
    },
    tabRow: {
      flexDirection: "row",
      marginHorizontal: 16,
      marginTop: 4,
      marginBottom: 8,
      backgroundColor: theme.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 4,
      gap: 4,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: "center",
    },
    tabButtonActive: {
      backgroundColor: "#0066FF",
    },
    tabButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.secondaryText,
    },
    tabButtonTextActive: {
      color: "#FFFFFF",
    },
    scrollContent: {
      paddingHorizontal: 16,
      gap: 12,
    },
    summaryCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
    },
    summaryText: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.text,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      gap: 8,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    passengerName: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.text,
      flexShrink: 1,
    },
    complaintType: {
      fontSize: 13,
      fontWeight: "700",
      color: theme.text,
      flexShrink: 1,
    },
    cardDate: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.secondaryText,
    },
    starsRow: {
      flexDirection: "row",
      gap: 2,
    },
    reviewText: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.secondaryText,
      lineHeight: 18,
    },
    subRatingsRow: {
      flexDirection: "row",
      gap: 14,
    },
    subRatingText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.secondaryText,
    },
    metaText: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.secondaryText,
    },
    badgeRow: {
      flexDirection: "row",
      gap: 8,
    },
    priorityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    priorityBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.border,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.text,
    },
    adminResponseBox: {
      backgroundColor: theme.background,
      borderRadius: 8,
      padding: 10,
      gap: 4,
    },
    adminResponseLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: theme.secondaryText,
      textTransform: "uppercase",
    },
    adminResponseText: {
      fontSize: 12,
      fontWeight: "500",
      color: theme.text,
      lineHeight: 18,
    },
    stateCard: {
      minHeight: 120,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: 16,
    },
    stateText: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.secondaryText,
      textAlign: "center",
    },
  });
}
