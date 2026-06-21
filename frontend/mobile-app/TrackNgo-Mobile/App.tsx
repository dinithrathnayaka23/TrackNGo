import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppNavigator } from "./navigation/AppNavigator";
import { chatSocket } from "./services/chatSocket";
import { SessionProvider, useSession } from "./store/sessionStore";

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

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <GlobalPresenceConnection />
        <StatusBar style="dark" />
        <AppNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
