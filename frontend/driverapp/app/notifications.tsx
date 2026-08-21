import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import {
  getDriverNotifications,
  markAllDriverNotificationsRead,
  markDriverNotificationRead,
  type DriverNotificationDto,
} from "@/services/driverNotificationsApi";
import {
  driverNotificationTabs,
  sectionForDate,
  sectionForType,
  timeAgo,
  type DriverNoticeCategory,
  type DriverNotificationItem,
} from "@/utils/driverNotifications";

type NoticeIcon = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  background: string;
};

const iconByType: Record<string, NoticeIcon> = {
  booking: { icon: "ticket-confirmation", color: "#1A73E8", background: "#EAF1FF" },
  cancellation: { icon: "close-circle", color: "#EF4444", background: "#FEE2E2" },
  journey: { icon: "bus-clock", color: "#F59E0B", background: "#FEF3C7" },
  rating: { icon: "star", color: "#EAB308", background: "#FEF9C3" },
  complaint: { icon: "headset", color: "#0EA5E9", background: "#E0F2FE" },
  sos: { icon: "alert-circle", color: "#DC2626", background: "#FEE2E2" },
  payment: { icon: "cash-check", color: "#16A34A", background: "#DCFCE7" },
  promotion: { icon: "tag", color: "#8B5CF6", background: "#F3E8FF" },
  system_alert: { icon: "information", color: "#475569", background: "#E2E8F0" },
};

const fallbackIcon: NoticeIcon = {
  icon: "bell",
  color: "#64748B",
  background: "#E2E8F0",
};

function iconFor(notificationType: string): NoticeIcon {
  return iconByType[(notificationType ?? "").toLowerCase()] ?? fallbackIcon;
}

function mapNotification(dto: DriverNotificationDto): DriverNotificationItem {
  return {
    id: dto.id,
    title: dto.title || "Driver update",
    message: dto.message,
    read: dto.read,
    createdAt: dto.createdAt,
    notificationType: dto.notificationType,
    category: sectionForType(dto.notificationType),
  };
}

export default function DriverNotificationsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { bottom } = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<DriverNotificationItem[]>(
    [],
  );
  const [activeTab, setActiveTab] = useState<DriverNoticeCategory>("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(
    async (showLoader = true) => {
      if (!user?.userId) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      if (showLoader) setLoading(true);
      setError(null);

      try {
        const data = await getDriverNotifications(user.userId);
        setNotifications(data.map(mapNotification));
      } catch (err) {
        console.error("Failed to load driver notifications", err);
        setError("Could not load notifications. Pull down to try again.");
      } finally {
        setLoading(false);
      }
    },
    [user?.userId],
  );

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  // The driver feed is small enough to fetch whole and filter here, which keeps
  // switching tabs instant instead of firing a request per tab.
  const visibleNotifications = useMemo(() => {
    if (activeTab === "All") return notifications;
    return notifications.filter((item) => item.category === activeTab);
  }, [activeTab, notifications]);

  const sectionedNotifications = useMemo(() => {
    const sections: { title: string; data: DriverNotificationItem[] }[] = [];
    visibleNotifications.forEach((item) => {
      const section = sections.find(
        (entry) => entry.title === sectionForDate(item.createdAt),
      );
      if (section) {
        section.data.push(item);
      } else {
        sections.push({ title: sectionForDate(item.createdAt), data: [item] });
      }
    });
    return sections;
  }, [visibleNotifications]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNotifications(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    if (!user?.userId || notifications.length === 0) return;

    try {
      await markAllDriverNotificationsRead(user.userId);
      setNotifications((items) =>
        items.map((item) => ({ ...item, read: true })),
      );
    } catch (err) {
      console.error("Failed to mark notifications read", err);
      Alert.alert("Notifications", "Could not mark notifications as read.");
    }
  }, [notifications.length, user?.userId]);

  const handleMarkRead = useCallback(async (item: DriverNotificationItem) => {
    if (item.read) return;

    setNotifications((items) =>
      items.map((entry) =>
        entry.id === item.id ? { ...entry, read: true } : entry,
      ),
    );

    try {
      await markDriverNotificationRead(item.id);
    } catch (err) {
      console.error("Failed to mark driver notification read", err);
      setNotifications((items) =>
        items.map((entry) =>
          entry.id === item.id ? { ...entry, read: false } : entry,
        ),
      );
    }
  }, []);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 34 }} />
      </View>

      <View style={styles.tabsRow}>
        {driverNotificationTabs.map((tab) => {
          const active = tab === activeTab;
          return (
            <Pressable
              key={tab}
              style={[styles.tabChip, active && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                numberOfLines={1}
                style={active ? styles.tabActiveText : styles.tabText}
              >
                {tab}
              </Text>
            </Pressable>
          );
        })}
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
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Recent</Text>
          <Pressable onPress={handleMarkAllRead}>
            <Text style={styles.markRead}>Mark all read</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#1A73E8" />
            <Text style={styles.stateText}>Loading notifications...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons
              name="wifi-alert"
              size={22}
              color="#EF4444"
            />
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : sectionedNotifications.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons
              name="bell-off-outline"
              size={24}
              color="#94A3B8"
            />
            <Text style={styles.stateText}>
              {activeTab === "All"
                ? "No notifications to show."
                : `No ${activeTab.toLowerCase()} notifications to show.`}
            </Text>
          </View>
        ) : (
          sectionedNotifications.map((section) => (
            <View key={section.title} style={styles.sectionGroup}>
              <Text style={styles.sectionLabel}>{section.title}</Text>
              {section.data.map((item) => {
                const notice = iconFor(item.notificationType);
                return (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.noticeCard,
                      item.read && styles.noticeCardRead,
                    ]}
                    onPress={() => handleMarkRead(item)}
                  >
                    <View
                      style={[
                        styles.noticeIcon,
                        { backgroundColor: notice.background },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={notice.icon}
                        size={18}
                        color={notice.color}
                      />
                    </View>
                    <View style={styles.noticeBody}>
                      <View style={styles.noticeTitleRow}>
                        {!item.read ? <View style={styles.unreadDot} /> : null}
                        <Text style={styles.noticeTitle}>{item.title}</Text>
                      </View>
                      <Text style={styles.noticeText}>{item.message}</Text>
                    </View>
                    <Text style={styles.noticeTime}>
                      {timeAgo(item.createdAt)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9FC",
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
    color: "#111827",
    textAlign: "center",
  },
  // All five tabs share one row. flexGrow with an auto basis sizes each chip to
  // its own label first and only shares the leftover width, so a long label
  // like "Journeys" is never clipped by an equal split.
  tabsRow: {
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 5,
    marginBottom: 8,
  },
  tabChip: {
    flexGrow: 1,
    flexBasis: "auto",
    paddingHorizontal: 5,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#EEF2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: {
    backgroundColor: "#1A73E8",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7B8794",
    textAlign: "center",
  },
  tabActiveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  sectionGroup: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94A3B8",
  },
  markRead: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1A73E8",
  },
  noticeCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E6ECF3",
    padding: 12,
    gap: 10,
  },
  noticeCardRead: {
    backgroundColor: "#FBFCFE",
  },
  // The background colour now comes from the notification type, so it is not
  // fixed here.
  noticeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeBody: {
    flex: 1,
  },
  noticeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#1A73E8",
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1F2937",
    flex: 1,
  },
  noticeText: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: "#7B8794",
  },
  noticeTime: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94A3B8",
  },
  stateCard: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6ECF3",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
  },
  stateText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7B8794",
    textAlign: "center",
  },
});
