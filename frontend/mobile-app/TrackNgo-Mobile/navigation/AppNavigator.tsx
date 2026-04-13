import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "../store/sessionStore";
import { DashboardScreen } from "../screens/booking/DashboardScreen";
import { ChatListScreen } from "../screens/chat/ChatListScreen";
import { ChatRoomScreen } from "../screens/chat/ChatRoomScreen";
import { EmergencyContactsScreen } from "../screens/sos/EmergencyContactsScreen";
import { NotificationScreen } from "../screens/notifications/NotificationScreen";
import { SosScreen } from "../screens/sos/SosScreen";
import LoginScreen from "../app/auth/login";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { currentUser, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="small" color="#1f8fff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={currentUser ? "Dashboard" : "Login"}
        screenOptions={{ headerShown: false }}
      >
        {/* Auth Screens - Only show if NOT logged in */}
        {!currentUser && (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
          </>
        )}

        {/* App Screens - Only show if logged in */}
        {currentUser && (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Notification" component={NotificationScreen} />
            <Stack.Screen name="Sos" component={SosScreen} />
            <Stack.Screen
              name="EmergencyContacts"
              component={EmergencyContactsScreen}
            />
            <Stack.Screen name="ChatList" component={ChatListScreen} />
            <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
