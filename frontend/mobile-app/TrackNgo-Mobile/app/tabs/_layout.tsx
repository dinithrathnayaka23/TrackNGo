import { Tabs } from "expo-router";
import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "../../utils/i18n";

export default function TabLayout() {
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: "#2F6BFF",
        tabBarInactiveTintColor: "#9AA4B2",
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
        tabBarStyle: {
          height: 62,
          paddingTop: 6,
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
