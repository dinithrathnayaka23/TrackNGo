import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../store/sessionStore";

function RootLayoutNav() {
  const { currentUser, loading } = useSession();

  if (loading) {
    return null; // or a loading spinner
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {currentUser == null ? (
        // Show login screen if not authenticated
        <Stack.Screen name="auth/login" />
      ) : (
        // Show app navigation if authenticated
        <Stack.Screen name="navigation/AppNavigation" />
      )}
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <RootLayoutNav />
        <StatusBar style="dark" />
      </SessionProvider>
    </SafeAreaProvider>
  );
}