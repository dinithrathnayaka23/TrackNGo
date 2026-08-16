import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { getMyComplaints, type ComplaintDto } from "../../services/complaintsApi";
import { useSession } from "../../store/sessionStore";
import { LocalizedText as Text } from "../../utils/i18n";

type ComplaintItem = {
  id: string;
  type: string;
  description: string;
  status: "Pending" | "Under Review" | "Resolved" | "Rejected";
  adminResponse?: string | null;
  createdLabel: string;
  bookingReference: string;
};

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

export default function ComplaintHistoryScreen() {
  const router = useRouter();
  const { currentUser } = useSession();
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);

  const mapComplaint = useCallback((item: ComplaintDto): ComplaintItem => {
    const normalizedStatus = item.status?.toLowerCase();

    return {
      id: `COMP-${String(item.id).padStart(4, "0")}`,
      type: COMPLAINT_TYPE_LABELS[item.complaintType] ?? item.complaintType,
      description: item.description,
      status:
        normalizedStatus === "resolved"
          ? "Resolved"
          : normalizedStatus === "under_review"
            ? "Under Review"
            : normalizedStatus === "rejected"
              ? "Rejected"
              : "Pending",
      adminResponse: item.adminResponse?.trim() || null,
      createdLabel: formatComplaintDate(item.createdAt),
      bookingReference: item.bookingReference?.trim() || "--",
    };
  }, []);

  const loadComplaints = useCallback(async () => {
    if (!currentUser) {
      setComplaints([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getMyComplaints(currentUser.userId);
      setComplaints(data.map(mapComplaint));
    } catch (error) {
      console.error("[ComplaintHistory] Failed to load complaints", error);
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, mapComplaint]);

  useFocusEffect(
    useCallback(() => {
      void loadComplaints();
    }, [loadComplaints]),
  );

  const totalLabel = useMemo(
    () => `${complaints.length} complaint${complaints.length === 1 ? "" : "s"}`,
    [complaints.length],
  );

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>My Complaints</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.subtitle}>{totalLabel}</Text>

      {loading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator size="small" color="#2F6BFF" />
        </View>
      ) : complaints.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No complaints submitted yet.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          {complaints.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardId}>{item.id}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    item.status === "Pending"
                      ? styles.pendingBadge
                      : item.status === "Under Review"
                        ? styles.reviewBadge
                        : item.status === "Rejected"
                          ? styles.rejectedBadge
                          : styles.resolvedBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      item.status === "Pending"
                        ? styles.pendingText
                        : item.status === "Under Review"
                          ? styles.reviewText
                          : item.status === "Rejected"
                            ? styles.rejectedText
                            : styles.resolvedText,
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>{item.type}</Text>
              <Text style={styles.cardDescription}>{item.description}</Text>
              {item.adminResponse ? (
                <View style={styles.adminResponseBox}>
                  <Text style={styles.adminResponseLabel}>Admin Response</Text>
                  <Text style={styles.adminResponseText}>{item.adminResponse}</Text>
                </View>
              ) : null}

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>Booking: {item.bookingReference}</Text>
                <Text style={styles.metaText}>{item.createdLabel}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export function formatComplaintDate(createdAt?: string | null): string {
  if (!createdAt) {
    return "--";
  }

  const parsed = parseComplaintDateTime(createdAt);
  if (!parsed) {
    return createdAt;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Parses complaint timestamps without shifting timezone-less backend LocalDateTime values.
 * Backend complaint APIs return wall-clock times like 2026-04-25T10:00:00, so we map those
 * into a local Date manually instead of letting Date parsing reinterpret them.
 */
function parseComplaintDateTime(value: string): Date | null {
  const isoLikeMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,9}))?$/
  );

  if (isoLikeMatch) {
    const [, year, month, day, hour, minute, second = "0"] = isoLikeMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1F2937",
  },
  headerSpacer: {
    width: 24,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    paddingHorizontal: 14,
    marginTop: 6,
    marginBottom: 12,
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 24,
    gap: 10,
  },
  centerBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    marginHorizontal: 14,
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E6ECF3",
  },
  emptyText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E6ECF3",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardId: {
    fontSize: 10,
    fontWeight: "700",
    color: "#CBD5E1",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
  },
  reviewBadge: {
    backgroundColor: "#DBEAFE",
  },
  resolvedBadge: {
    backgroundColor: "#DCFCE7",
  },
  rejectedBadge: {
    backgroundColor: "#F3F4F6",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  pendingText: {
    color: "#D97706",
  },
  reviewText: {
    color: "#2563EB",
  },
  resolvedText: {
    color: "#15803D",
  },
  rejectedText: {
    color: "#6B7280",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
  },
  adminResponseBox: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E6ECF3",
    padding: 10,
  },
  adminResponseLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    marginBottom: 5,
    textTransform: "uppercase",
  },
  adminResponseText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#475569",
  },
  metaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  metaText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
  },
});
