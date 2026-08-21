import { Tabs } from 'expo-router'; // Tabs for navigation
import React, { useCallback, useEffect, useState } from 'react'; //for React library

import { HapticTab } from '@/components/haptic-tab'; // HapticTab for haptic feedback
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import { getUserConversations, type ConversationDto } from '@/services/chatApi';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  const { darkMode } = useTheme();
  const { user } = useUser();
  const { t } = useLanguage();
  const [unreadTotal, setUnreadTotal] = useState(0);

  const refreshUnreadTotal = useCallback(async () => {
    if (!user?.userId || !user?.token) {
      setUnreadTotal(0);
      return;
    }

    try {
      const result = await getUserConversations({
        token: user.token,
        userId: user.userId,
        page: 0,
        size: 50,
      });
      const conversations = Array.isArray(result.content) ? result.content : [];
      const total = conversations.reduce(
        (sum, item) => sum + getConversationUnreadCount(item, user.userId),
        0
      );
      setUnreadTotal(total);
    } catch {
      // A dropped poll says nothing about the inbox, so the previous count
      // stays put rather than blinking the badge off on a flaky connection.
    }
  }, [user?.token, user?.userId]);

  useEffect(() => {
    void refreshUnreadTotal();
    const timer = setInterval(() => {
      void refreshUnreadTotal();
    }, 5000);

    return () => clearInterval(timer);
  }, [refreshUnreadTotal]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: '#2F6BFF',
        tabBarInactiveTintColor: darkMode ? '#888' : '#9AA4B2',
        tabBarButton: HapticTab,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          height: 62,
          paddingTop: 6,
          paddingBottom: 6,
          backgroundColor: darkMode ? '#1E1E1E' : '#FFFFFF',
          borderTopColor: darkMode ? '#333' : '#E9EDF3',
          borderTopWidth: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color }) => <Ionicons size={22} name="home" color={color} />,
        }}
      />

      <Tabs.Screen
        name="allocations"
        options={{
          title: t("tabs.allocations"),
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons size={24} name="seat" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="earnings"
        options={{
          title: t("tabs.earnings"),
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons size={24} name="cash-multiple" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: t("tabs.chat"),
          tabBarBadge: unreadTotal > 0 ? (unreadTotal > 99 ? '99+' : unreadTotal) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#2F6BFF',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: "800",
          },
          tabBarIcon: ({ color }) => (
            <Ionicons size={22} name="chatbubble-ellipses" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color }) => <Ionicons size={22} name="settings" color={color} />,
        }}
      />

      <Tabs.Screen //this screen is hidden from the user because it is only for internal use
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

function getConversationUnreadCount(item: ConversationDto, currentUserId: number) {
  if (item.participant1Id === currentUserId) {
    return item.participant1Unread ?? item.unreadCount ?? 0;
  }

  if (item.participant2Id === currentUserId) {
    return item.participant2Unread ?? item.unreadCount ?? 0;
  }

  return item.unreadCount ?? 0;
}
