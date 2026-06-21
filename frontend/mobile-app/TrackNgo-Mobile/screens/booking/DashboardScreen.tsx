import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

/**
 * DashboardScreen - Main dashboard for the TrackNGo mobile app
 * 
 * This screen serves as the central hub for passengers after login.
 * It provides quick navigation to key features of the app including
 * chat, notifications, and emergency SOS functionality.
 * 
 * The screen displays a simple interface with navigation buttons
 * that allow users to access different sections of the app.
 */
export function DashboardScreen({ navigation }: Props) {
  /**
   * Navigates to the chat list screen
   * 
   * This function handles the press event for the chat button,
   * navigating the user to the ChatList screen where they can
   * view and start conversations.
   */
  const onOpenChat = () => {
    navigation.navigate("ChatList");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Main title for the dashboard */}
        <Text style={styles.title}>Dashboard</Text>
        
        {/* Navigation button to chat functionality */}
        <Pressable onPress={onOpenChat}>
          <Text style={styles.link}>Go to Chat</Text>
        </Pressable>
        
        {/* Navigation button to notifications */}
        <Pressable onPress={() => navigation.navigate("Notification")}>
          <Text style={styles.link}>Go to Notification</Text>
        </Pressable>
        
        {/* Navigation button to emergency SOS feature */}
        <Pressable onPress={() => navigation.navigate("Sos")}>
          <Text style={styles.link}>Go to SOS</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Main container with full screen background
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  // Content area centered with padding and spacing
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 20,
  },
  // Title text styling
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  // Link/button text styling with blue color and underline
  link: {
    fontSize: 18,
    color: "#2563eb",
    textDecorationLine: "underline",
  },
});
