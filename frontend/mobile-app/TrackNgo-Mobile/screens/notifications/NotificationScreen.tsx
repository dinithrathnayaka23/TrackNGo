import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Notification">;
type NoticeCategory = "All" | "Bookings" | "Messages" | "Updates";

type NoticeItem = {
  id: number;
  title: string;
  text: string;
  time: string;
  section: "Today" | "Yesterday";
  category: Exclude<NoticeCategory, "All">;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor: string;
  iconBackground: string;
};

const noticesSeed: NoticeItem[] = [
  {
    id: 1,
    title: "Booking Confirmed",
    text: "Your seat #45 for the Kandy to Colombo express has been confirmed for tomorrow at 8:00 AM.",
    time: "2m ago",
    section: "Today",
    category: "Bookings",
    icon: "ticket",
    iconColor: "#1A73E8",
    iconBackground: "#EAF1FF",
  },
  {
    id: 2,
    title: "Bus Delayed",
    text: "Bus NP-4555 is delayed by 15 mins due to heavy traffic near Kadawatha interchange.",
    time: "15m ago",
    section: "Today",
    category: "Updates",
    icon: "alert",
    iconColor: "#F59E0B",
    iconBackground: "#FEF3C7",
  },
  {
    id: 3,
    title: "Operator Support",
    text: "Please ensure you have your digital ID ready for verification before boarding the semi-luxury service.",
    time: "1d ago",
    section: "Yesterday",
    category: "Messages",
    icon: "headset",
    iconColor: "#0EA5E9",
    iconBackground: "#E0F2FE",
  },
  {
    id: 4,
    title: "Weekend Promo",
    text: "Get 10% off on your next trip to Galle. Valid until Sunday midnight.",
    time: "1d ago",
    section: "Yesterday",
    category: "Updates",
    icon: "tag",
    iconColor: "#8B5CF6",
    iconBackground: "#F3E8FF",
  },
];

const tabs: NoticeCategory[] = ["All", "Bookings", "Messages", "Updates"];

export function NotificationScreen({ navigation }: Props) {
  const { top, bottom } = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<NoticeCategory>("All");
  const [notices, setNotices] = useState<NoticeItem[]>(noticesSeed);

  const filteredNotices = useMemo(() => {
    if (activeTab === "All") {
      return notices;
    }
    return notices.filter((notice) => notice.category === activeTab);
  }, [activeTab, notices]);

  const todayItems = filteredNotices.filter(
    (notice) => notice.section === "Today",
  );
  const yesterdayItems = filteredNotices.filter(
    (notice) => notice.section === "Yesterday",
  );

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={[styles.safeArea, { paddingTop: top }]}
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
        <Pressable style={styles.clearButton} onPress={() => setNotices([])}>
          <Text style={styles.clearText}>Clear All</Text>
        </Pressable>
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 24 + bottom },
        ]}
      >
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Today</Text>
          <Text style={styles.markRead}>Mark all read</Text>
        </View>

        {todayItems.map((notice) => (
          <View key={notice.id} style={styles.noticeCard}>
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
              <Text style={styles.noticeTitle}>{notice.title}</Text>
              <Text style={styles.noticeText}>{notice.text}</Text>
            </View>
            <Text style={styles.noticeTime}>{notice.time}</Text>
          </View>
        ))}

        <Text style={styles.sectionLabel}>Yesterday</Text>

        {yesterdayItems.map((notice) => (
          <View key={notice.id} style={styles.noticeCard}>
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
              <Text style={styles.noticeTitle}>{notice.title}</Text>
              <Text style={styles.noticeText}>{notice.text}</Text>
            </View>
            <Text style={styles.noticeTime}>{notice.time}</Text>
          </View>
        ))}
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
  clearButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  clearText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A73E8",
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
  noticeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1F2937",
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
});
