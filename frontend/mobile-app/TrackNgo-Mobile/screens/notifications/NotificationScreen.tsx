import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppState,
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/types";
import { LocalizedText as Text } from "../../utils/i18n";
import {
  getPassengerNotifications,
  markAllPassengerNotificationsRead,
  markNotificationRead,
  type NotificationDto,
} from "../../services/notificationsApi";
import { useSession } from "../../store/sessionStore";

type Props = NativeStackScreenProps<RootStackParamList, "Notification">;
type NoticeCategory = "All" | "Bookings" | "Payments" | "Journeys";
type ApiFilterType = "booking" | "payment" | "journey";

type NoticeItem = {
  id: number;
  title: string;
  text: string;
  time: string;
  section: string;
  category: Exclude<NoticeCategory, "All"> | "Other";
  notificationType: string;
  read: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  iconBackground: string;
};

const tabs: NoticeCategory[] = ["All", "Bookings", "Payments", "Journeys"];

const tabToApiType: Record<Exclude<NoticeCategory, "All">, ApiFilterType> = {
  Bookings: "booking",
  Payments: "payment",
  Journeys: "journey",
};

const categoryByType: Record<string, NoticeItem["category"]> = {
  booking: "Bookings",
  cancellation: "Bookings",
  payment: "Payments",
  journey: "Journeys",
};

const iconByType: Record<
  string,
  Pick<NoticeItem, "icon" | "iconColor" | "iconBackground">
> = {
  booking: {
    icon: "ticket-confirmation",
    iconColor: "#1A73E8",
    iconBackground: "#EAF1FF",
  },
  cancellation: {
    icon: "close-circle",
    iconColor: "#EF4444",
    iconBackground: "#FEE2E2",
  },
  payment: {
    icon: "cash-check",
    iconColor: "#16A34A",
    iconBackground: "#DCFCE7",
  },
  journey: {
    icon: "bus-clock",
    iconColor: "#F59E0B",
    iconBackground: "#FEF3C7",
  },
  rating: {
    icon: "star",
    iconColor: "#EAB308",
    iconBackground: "#FEF9C3",
  },
  complaint: {
    icon: "headset",
    iconColor: "#0EA5E9",
    iconBackground: "#E0F2FE",
  },
  promotion: {
    icon: "tag",
    iconColor: "#8B5CF6",
    iconBackground: "#F3E8FF",
  },
  sos: {
    icon: "alert-circle",
    iconColor: "#DC2626",
    iconBackground: "#FEE2E2",
  },
};

function sameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function sectionForDate(value: string | null) {
  if (!value) return "Earlier";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (sameCalendarDay(date, today)) return "Today";
  if (sameCalendarDay(date, yesterday)) return "Yesterday";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: today.getFullYear() === date.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function timeAgo(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return "now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function mapNotification(dto: NotificationDto): NoticeItem {
  const notificationType = (dto.notificationType ?? "").toLowerCase();
  const iconStyle = iconByType[notificationType] ?? {
    icon: "bell",
    iconColor: "#64748B",
    iconBackground: "#E2E8F0",
  };

  return {
    id: dto.id,
    title: dto.title,
    text: dto.message,
    time: timeAgo(dto.createdAt),
    section: sectionForDate(dto.createdAt),
    category: categoryByType[notificationType] ?? "Other",
    notificationType,
    read: Boolean(dto.read),
    ...iconStyle,
  };
}

export function NotificationScreen({ navigation }: Props) {
  const { bottom } = useSafeAreaInsets();
  const { currentUser } = useSession();
  const [activeTab, setActiveTab] = useState<NoticeCategory>("All");
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(
    async (showLoader = true) => {
      if (!currentUser) {
        setNotices([]);
        setLoading(false);
        return;
      }

      if (showLoader) setLoading(true);
      setError(null);

      try {
        const type = activeTab === "All" ? undefined : tabToApiType[activeTab];
        const data = await getPassengerNotifications(currentUser.userId, type);
        setNotices(data.map(mapNotification));
      } catch (err) {
        console.error("Failed to load notifications", err);
        setError("Could not load notifications. Pull down to try again.");
      } finally {
        setLoading(false);
      }
    },
    [activeTab, currentUser],
  );

  // This screen is mounted through an Expo Router adapter, so it must not
  // depend on React Navigation's useFocusEffect context. Load on mount and
  // refresh whenever the app returns to the foreground instead.
  useEffect(() => {
    void loadNotifications();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void loadNotifications(false);
      }
    });

    const intervalId = setInterval(() => {
      if (AppState.currentState === "active") {
        void loadNotifications(false);
      }
    }, 5_000);

    return () => {
      subscription.remove();
      clearInterval(intervalId);
    };
  }, [loadNotifications]);

  const filteredNotices = useMemo(() => {
    if (activeTab === "All") {
      return notices;
    }
    return notices.filter((notice) => notice.category === activeTab);
  }, [activeTab, notices]);

  const sectionedNotices = useMemo(() => {
    const sections: { title: string; data: NoticeItem[] }[] = [];
    filteredNotices.forEach((notice) => {
      const section = sections.find((item) => item.title === notice.section);
      if (section) {
        section.data.push(notice);
      } else {
        sections.push({ title: notice.section, data: [notice] });
      }
    });
    return sections;
  }, [filteredNotices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNotifications(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    if (!currentUser || notices.length === 0) return;

    try {
      await markAllPassengerNotificationsRead(currentUser.userId);
      setNotices((items) => items.map((item) => ({ ...item, read: true })));
    } catch (err) {
      console.error("Failed to mark notifications read", err);
      Alert.alert("Notifications", "Could not mark notifications as read.");
    }
  }, [currentUser, notices.length]);

  const handleMarkRead = useCallback(async (notice: NoticeItem) => {
    if (notice.read) return;

    setNotices((items) =>
      items.map((item) =>
        item.id === notice.id ? { ...item, read: true } : item,
      ),
    );

    try {
      await markNotificationRead(notice.id);
    } catch (err) {
      console.error("Failed to mark notification read", err);
      setNotices((items) =>
        items.map((item) =>
          item.id === notice.id ? { ...item, read: false } : item,
        ),
      );
    }
  }, []);

  const renderNotice = (notice: NoticeItem) => (
    <Pressable
      key={notice.id}
      style={[styles.noticeCard, notice.read && styles.noticeCardRead]}
      onPress={() => handleMarkRead(notice)}
    >
      <View
        style={[
          styles.noticeIcon,
          { backgroundColor: notice.iconBackground },
        ]}
      >
        <MaterialCommunityIcons
          name={notice.icon}
          size={18}
          color={notice.iconColor}
        />
      </View>
      <View style={styles.noticeBody}>
        <View style={styles.noticeTitleRow}>
          {!notice.read ? <View style={styles.unreadDot} /> : null}
          <Text style={styles.noticeTitle}>{notice.title}</Text>
        </View>
        <Text style={styles.noticeText}>{notice.text}</Text>
      </View>
      <Text style={styles.noticeTime}>{notice.time}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={styles.safeArea}
    >
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1F2937" />
        </Pressable>
        <View style={styles.headerTitleWrap} pointerEvents="none">
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>
      </View>

      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const active = tab === activeTab;
          return (
            <Pressable
              key={tab}
              style={[styles.tabChip, active && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={active ? styles.tabActiveText : styles.tabText}>
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
            <MaterialCommunityIcons name="wifi-alert" size={22} color="#EF4444" />
            <Text style={styles.stateText}>{error}</Text>
          </View>
        ) : sectionedNotices.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="bell-off-outline" size={24} color="#94A3B8" />
            <Text style={styles.stateText}>No notifications to show.</Text>
          </View>
        ) : (
          sectionedNotices.map((section) => (
            <View key={section.title} style={styles.sectionGroup}>
              <Text style={styles.sectionLabel}>{section.title}</Text>
              {section.data.map(renderNotice)}
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
    position: "relative",
  },
  headerTitleWrap: {
    position: "absolute",
    left: 60,
    right: 60,
    alignItems: "center",
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
    textAlign: "center",
  },
  tabsRow: {
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#EEF2F7",
  },
  tabActive: {
    backgroundColor: "#1A73E8",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7B8794",
  },
  tabActiveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
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
    fontSize: 11,
    fontWeight: "700",
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

