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
import { UserSelectScreen } from "../screens/auth/UserSelectScreen";
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
        initialRouteName="Dashboard"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="UserSelect" component={UserSelectScreen} />
        <Stack.Screen name="Notification" component={NotificationScreen} />
        <Stack.Screen name="Sos" component={SosScreen} />
        <Stack.Screen
          name="EmergencyContacts"
          component={EmergencyContactsScreen}
        />
        <Stack.Screen name="ChatList" component={ChatListScreen} />
        <Stack.Screen name="ChatRoom" component={ChatRoomScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
