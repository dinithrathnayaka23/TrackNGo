import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { useTheme } from '@/context/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  const { darkMode } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0066FF',
        tabBarInactiveTintColor: darkMode ? '#888' : '#999',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: darkMode ? '#1E1E1E' : '#fff',
          borderTopColor: darkMode ? '#333' : '#f0f0f0',
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Ionicons size={22} name="home" color={color} />,
        }}
      />

      <Tabs.Screen
        name="allocations"
        options={{
          title: 'Allocations',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons size={24} name="seat" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="earnings"
        options={{
          title: 'Earnings',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons size={24} name="cash-multiple" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => (
            <Ionicons size={22} name="chatbubble-ellipses" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Ionicons size={22} name="settings" color={color} />,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}