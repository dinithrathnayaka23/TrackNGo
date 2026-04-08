import { useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { UserType } from "../types/chat";
import { useSession } from "../store/sessionStore";

const userTypes: UserType[] = [
  "PASSENGER",
  "DRIVER",
  "ADMIN",
  "CORPORATE_USER",
];

type Props = NativeStackScreenProps<RootStackParamList, "UserSelect">;

export function UserSelectScreen({ navigation }: Props) {
  const { setCurrentUser } = useSession();
  const [selectedType, setSelectedType] = useState<UserType>("PASSENGER");
  const [userId, setUserId] = useState("1");
  const [loading, setLoading] = useState(false);

  const onContinue = async () => {
    const parsed = Number(userId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      Alert.alert("Invalid User ID", "Enter a positive numeric User ID.");
      return;
    }
    setLoading(true);
    try {
      await setCurrentUser({ userId: parsed, userType: selectedType });
      navigation.replace("ChatList");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Select Test User</Text>
        <Text style={styles.subtitle}>
          Temporary mock login to test chat roles until JWT auth is integrated.
        </Text>

        <Text style={styles.label}>User ID</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={userId}
          onChangeText={setUserId}
          placeholder="Enter user id"
        />

        <Text style={styles.label}>User Type</Text>
        <View style={styles.typeWrap}>
          {userTypes.map((type) => (
            <Pressable
              key={type}
              style={[
                styles.typeChip,
                selectedType === type && styles.typeChipSelected,
              ]}
              onPress={() => setSelectedType(type)}
            >
              <Text
                style={[
                  styles.typeText,
                  selectedType === type && styles.typeTextSelected,
                ]}
              >
                {type}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={styles.button}
          onPress={onContinue}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Saving..." : "Continue"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#edf2f6",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1d2a37",
  },
  subtitle: {
    marginTop: 6,
    color: "#5c6d7e",
    lineHeight: 20,
  },
  label: {
    marginTop: 14,
    marginBottom: 6,
    color: "#42566a",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccd7e2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#1a2631",
  },
  typeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    borderWidth: 1,
    borderColor: "#c8d4e0",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  typeChipSelected: {
    backgroundColor: "#1f8fff",
    borderColor: "#1f8fff",
  },
  typeText: {
    color: "#4c6074",
    fontSize: 12,
    fontWeight: "600",
  },
  typeTextSelected: {
    color: "#fff",
  },
  button: {
    marginTop: 18,
    backgroundColor: "#1f8fff",
    borderRadius: 11,
    alignItems: "center",
    paddingVertical: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
