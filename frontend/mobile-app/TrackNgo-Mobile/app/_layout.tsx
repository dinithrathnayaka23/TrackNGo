import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { chatSocket } from "../services/chatSocket";
import { SessionProvider, useSession } from "../store/sessionStore";
import { LanguageProvider } from "../utils/i18n";

function GlobalPresenceConnection() {
  const { currentUser } = useSession();

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }

    chatSocket.connect(currentUser.userId);
    return () => {
      chatSocket.disconnect();
    };
  }, [currentUser]);

  return null;
}

function RootLayoutNav() {
  const { currentUser, loading } = useSession();

  if (loading) {
    return null; // or a loading spinner
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth/welcome" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/registration" />
      <Stack.Screen name="auth/otp-verification" />
      <Stack.Screen name="tabs" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <LanguageProvider>
          <GlobalPresenceConnection />
          <RootLayoutNav />
          <StatusBar style="dark" />
        </LanguageProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
