import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ChatListScreen } from "../../screens/chat/ChatListScreen";
import { useNavigationAdapter } from "../../navigation/navigationAdapter";
import { CorporateTabBar } from "../../components/CorporateTabBar";

/**
 * Corporate chat renders the exact same ChatListScreen as the passenger tab, so
 * the two stay identical in design and behaviour. Only two things differ: the
 * corporate bottom navigation stays in reach, and the screen's "back to
 * dashboard" action goes to the corporate dashboard instead of the passenger
 * tabs.
 */
export default function CorporateChatScreen() {
  const navigation = useNavigationAdapter();
  const router = useRouter();

  const corporateNavigation = useMemo(
    () => ({
      ...navigation,
      replace: (name: string, params?: Record<string, string>) => {
        if (name === "Dashboard") {
          router.replace("/corporate/co-op-dashboard");
          return;
        }
        navigation.replace(name, params);
      },
    }),
    [navigation, router],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <ChatListScreen
          navigation={corporateNavigation as any}
          route={{ name: "ChatList", params: undefined } as any}
        />
      </View>
      <CorporateTabBar active="chat" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flex: 1 },
});
