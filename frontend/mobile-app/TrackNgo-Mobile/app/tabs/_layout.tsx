import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../../utils/i18n";
import { formatUnreadBadge, useUnreadChatCount } from "../../hooks/useUnreadChatCount";

// The visible height of the bar itself, before the system navigation inset.
const TAB_BAR_CONTENT_HEIGHT = 62;

export default function TabLayout() {
  const { t } = useLanguage();
  const unreadChatCount = useUnreadChatCount();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: "#2F6BFF",
        tabBarInactiveTintColor: "#9AA4B2",
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        // BottomTabBar applies tabBarStyle last, so a bare height/paddingBottom here
        // silently replaces the inset-aware values it would otherwise use, leaving the
        // bar no room for the Android navigation bar. Adding the inset back keeps the
        // designed 62pt of content and reserves that space. Where the inset is 0 this
        // evaluates to the previous fixed values, so nothing changes visually there.
        tabBarStyle: {
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingTop: 6,
          paddingBottom: 6 + insets.bottom,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E9EDF3",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("Home"),
          tabBarIcon: ({ color }) => <Ionicons size={22} name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t("Chat"),
          tabBarBadge: formatUnreadBadge(unreadChatCount),
          tabBarBadgeStyle: styles.chatBadge,
          tabBarIcon: ({ color }) => (
            <Ionicons size={22} name="chatbubble-ellipses" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: t("AI"),
          tabBarIcon: ({ color }) => (
            <Ionicons size={22} name="sparkles-outline" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("Profile"),
          tabBarIcon: ({ color }) => <Ionicons size={22} name="person" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  chatBadge: {
    backgroundColor: "#2F6BFF",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
});
