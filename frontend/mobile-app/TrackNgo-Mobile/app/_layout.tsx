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
        <>
          <Stack.Screen name="auth/welcome" />
          <Stack.Screen name="auth/login" />
          <Stack.Screen name="auth/registration" />
          <Stack.Screen name="auth/otp-verification" />
        </>
      ) : (
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