import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
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
  const segments = useSegments();
  const router = useRouter();

  // When the backend rejects our token the session store clears it, but clearing
  // the session on its own leaves the user sitting on whatever screen they were
  // reading, which then re-requests and re-fails on every render. Navigate them
  // back to the entry screen so an expired token surfaces as "please log in"
  // rather than a screen that quietly stops loading.
  //
  // Screens under auth/ are skipped: they are reachable with no session by
  // design, and redirecting away from them would interrupt a login in progress.
  useEffect(() => {
    if (loading || currentUser || segments[0] === "auth") {
      return;
    }
    router.replace("/auth/welcome");
  }, [currentUser, loading, segments, router]);

  if (loading) {
    return null; // or a loading spinner
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth/welcome" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/registration" />
      <Stack.Screen name="auth/otp-verification" />
      <Stack.Screen name="auth/forgot-password" />
      <Stack.Screen name="auth/reset-otp-verification" />
      <Stack.Screen name="auth/reset-password" />
      <Stack.Screen name="auth/two-factor" />
      <Stack.Screen name="tabs" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    // Without initialMetrics the provider has no insets until its native view
    // reports them, so every consumer renders once with zeros and then again with
    // the real values. That second pass is what makes the layout jump on the first
    // frame and again when Android re-dispatches insets after the app is resumed.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SessionProvider>
        <LanguageProvider>
          <GlobalPresenceConnection />
          <RootLayoutNav />
          {/* White to match the app bar underneath, with dark icons so the
              clock and battery stay readable against it. */}
          <StatusBar style="dark" backgroundColor="#FFFFFF" />
        </LanguageProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
