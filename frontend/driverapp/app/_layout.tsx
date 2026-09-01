import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { UserProvider } from "@/context/UserContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";

export const unstable_settings = {
  anchor: "(tabs)",
};

function ThemedStatusBar() {
  const { darkMode } = useTheme();
  return <StatusBar style={darkMode ? "light" : "dark"} />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <UserProvider>
        <LanguageProvider>
          <ThemeProvider>
            <NavigationThemeProvider
              value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
            >
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="navigation" />
                <Stack.Screen name="notifications" />
                <Stack.Screen name="reviews-and-ratings" />
                <Stack.Screen name="sos" />
                <Stack.Screen name="emergency-contacts" />
                <Stack.Screen
                  name="modal"
                  options={{
                    presentation: "modal",
                    title: "Modal",
                  }}
                />
              </Stack>

              <ThemedStatusBar />
            </NavigationThemeProvider>
          </ThemeProvider>
        </LanguageProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}
