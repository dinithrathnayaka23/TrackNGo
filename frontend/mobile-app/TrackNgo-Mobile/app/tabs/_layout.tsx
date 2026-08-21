import { Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../utils/i18n";
import { formatUnreadBadge, useUnreadChatCount } from "../../hooks/useUnreadChatCount";

export default function TabLayout() {
  const { t } = useLanguage();
  const unreadChatCount = useUnreadChatCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: "#2F6BFF",
        tabBarInactiveTintColor: "#9AA4B2",
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarStyle: {
          height: 62,
          paddingTop: 6,
          paddingBottom: 6,
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
