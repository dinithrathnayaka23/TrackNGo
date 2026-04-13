import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Dashboard">;

export function DashboardScreen({ navigation }: Props) {
  const onOpenChat = () => {
    navigation.navigate("ChatList");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Dashboard</Text>
        <Pressable onPress={onOpenChat}>
          <Text style={styles.link}>Go to Chat</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Notification")}>
          <Text style={styles.link}>Go to Notification</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Sos")}>
          <Text style={styles.link}>Go to SOS</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
  },
  link: {
    fontSize: 18,
    color: "#2563eb",
    textDecorationLine: "underline",
  },
});
