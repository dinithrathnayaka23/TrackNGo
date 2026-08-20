import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  formatUnreadBadge,
  useUnreadChatCount,
} from "../hooks/useUnreadChatCount";

/**
 * Bottom navigation shared by every corporate screen. It used to be copy-pasted
 * into each screen, which meant a new destination had to be added in five
 * places (and the active colour had already drifted between them).
 */
export type CorporateTab =
  | "dashboard"
  | "contracts"
  | "chat"
  | "billing"
  | "profile";

type TabDefinition = {
  key: CorporateTab;
  label: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabDefinition[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/corporate/co-op-dashboard",
    icon: "grid-outline",
    activeIcon: "grid",
  },
  {
    key: "contracts",
    label: "Contracts",
    href: "/corporate/corporate-contract",
    icon: "document-text-outline",
    activeIcon: "document-text",
  },
  {
    key: "chat",
    label: "Chat",
    href: "/corporate/corporate-chat",
    icon: "chatbubble-ellipses-outline",
    activeIcon: "chatbubble-ellipses",
  },
  {
    key: "billing",
    label: "Billing",
    href: "/corporate/corporate-billing",
    icon: "receipt-outline",
    activeIcon: "receipt",
  },
  {
    key: "profile",
    label: "Profile",
    href: "/corporate/corporate-profile",
    icon: "person-outline",
    activeIcon: "person",
  },
];

export function CorporateTabBar({ active }: { active: CorporateTab }) {
  const router = useRouter();
  // Corporate users share the passenger inbox, so the badge is driven by the
  // same hook the passenger tab bar uses.
  const unreadChatCount = useUnreadChatCount();
  const chatBadge = formatUnreadBadge(unreadChatCount);

  return (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            activeOpacity={0.8}
            onPress={() => {
              if (!isActive) router.push(tab.href as never);
            }}
          >
            <View>
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={22}
                color={isActive ? "#067BF9" : "#64748B"}
              />
              {tab.key === "chat" && chatBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{chatBadge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    height: 64,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingBottom: 4,
  },
  tabItem: { flex: 1, justifyContent: "center", alignItems: "center", gap: 3 },
  // Sits over the icon the way the native tab-bar badge does on the other tabs.
  badge: {
    position: "absolute",
    top: -5,
    left: 12,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: "#2F6BFF",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },
  tabLabel: { fontSize: 11, fontWeight: "600", color: "#64748B", marginTop: 2 },
  tabLabelActive: { color: "#067BF9" },
});
