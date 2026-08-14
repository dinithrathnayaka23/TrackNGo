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
  sectionForDate,
  timeAgo,
  type DriverNotificationItem,
} from "@/utils/driverNotifications";

function mapNotification(dto: DriverNotificationDto): DriverNotificationItem {
  return {
    id: dto.id,
    title: dto.title || "Driver update",
    message: dto.message,
    read: dto.read,
    createdAt: dto.createdAt,
    notificationType: dto.notificationType,
  };
}

export default function DriverNotificationsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { bottom } = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<DriverNotificationItem[]>(
    [],
  );
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

  const sectionedNotifications = useMemo(() => {
    const sections: { title: string; data: DriverNotificationItem[] }[] = [];
    notifications.forEach((item) => {
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
  }, [notifications]);

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
            <Text style={styles.stateText}>No notifications to show.</Text>
          </View>
        ) : (
          sectionedNotifications.map((section) => (
            <View key={section.title} style={styles.sectionGroup}>
              <Text style={styles.sectionLabel}>{section.title}</Text>
              {section.data.map((item) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.noticeCard,
                    item.read && styles.noticeCardRead,
                  ]}
                  onPress={() => handleMarkRead(item)}
                >
                  <View style={styles.noticeIcon}>
                    <MaterialCommunityIcons
                      name="bus"
                      size={18}
                      color="#1A73E8"
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
              ))}
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
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
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
    backgroundColor: "#EAF1FF",
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
