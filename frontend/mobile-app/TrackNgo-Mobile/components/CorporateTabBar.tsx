import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

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
            <Ionicons
              name={isActive ? tab.activeIcon : tab.icon}
              size={22}
              color={isActive ? "#067BF9" : "#64748B"}
            />
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
  tabLabel: { fontSize: 11, fontWeight: "600", color: "#64748B", marginTop: 2 },
  tabLabelActive: { color: "#067BF9" },
});
