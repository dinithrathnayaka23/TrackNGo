import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "EmergencyContacts">;

const contacts = [
  { id: 1, name: "Anjana", number: "0772345627" },
  { id: 2, name: "Dinith", number: "0752345672" },
];

export function EmergencyContactsScreen({ navigation }: Props) {
  const { top } = useSafeAreaInsets();

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={[styles.safeArea, { paddingTop: top }]}
    >
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Emergency contacts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.list}>
        {contacts.map((contact) => (
          <View key={contact.id} style={styles.contactRow}>
            <View>
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactNumber}>{contact.number}</Text>
            </View>
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={18}
              color="#94A3B8"
            />
          </View>
        ))}

        <View style={styles.addRow}>
          <View style={styles.addLeft}>
            <View style={styles.addIcon}>
              <MaterialCommunityIcons
                name="account"
                size={16}
                color="#F97316"
              />
            </View>
            <Text style={styles.addText}>Add contact</Text>
          </View>
          <MaterialCommunityIcons name="plus" size={18} color="#1A73E8" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  headerRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F2937",
  },
  headerSpacer: {
    width: 34,
  },
  list: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
  },
  contactRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contactName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
  },
  contactNumber: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: "#9AA4B2",
  },
  addRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  addLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FDEBD2",
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A73E8",
  },
});
