import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useSession } from "../store/sessionStore";

export default function Index() {
  const { currentUser, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2F6BFF" />
      </View>
    );
  }

  return <Redirect href="/auth/welcome" />;
}
