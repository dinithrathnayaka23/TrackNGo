import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Sos">;

const RED = "#EF4444";

const quickActions = [
  { icon: "medical-bag", title: "Ambulance", subtitle: "1990" },
  { icon: "shield", title: "Police", subtitle: "119" },
  { icon: "phone", title: "Help center", subtitle: "0765624985" },
  { icon: "fire-truck", title: "Fire brigade", subtitle: "110" },
  { icon: "microphone", title: "Record", subtitle: "Audio" },
] as const;

export function SosScreen({ navigation }: Props) {
  const { top, bottom } = useSafeAreaInsets();

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={[styles.safeArea, { paddingTop: top }]}
    >
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color="#1F2937"
            />
          </Pressable>
          <Text style={styles.headerTitle}>Emergency Mode</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.subtitle}>Tap in case of emergency</Text>

        <View style={styles.sosRing}>
          <View style={styles.sosCore}>
            <MaterialCommunityIcons name="bell" size={28} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.checkboxRow}>
          <View style={styles.checkbox}>
            <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
          </View>
          <Text style={styles.checkboxText}>Inform my emergency contacts</Text>
        </View>

        <Pressable onPress={() => navigation.navigate("EmergencyContacts")}>
          <Text style={styles.manageText}>Manage emergency contacts</Text>
        </Pressable>

        <View style={styles.grid}>
          {quickActions.map((item) => (
            <View key={item.title} style={styles.gridItem}>
              <View style={styles.gridIcon}>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={18}
                  color={RED}
                />
              </View>
              <Text style={styles.gridTitle}>{item.title}</Text>
              <Text style={styles.gridSubtitle}>{item.subtitle}</Text>
            </View>
          ))}

          <Pressable
            style={styles.gridItem}
            onPress={() => navigation.goBack()}
          >
            <View style={[styles.gridIcon, styles.stopIcon]}>
              <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
            </View>
            <Text style={[styles.gridTitle, styles.stopText]}>Stop SOS</Text>
          </Pressable>
        </View>

        <View style={{ height: bottom + 16 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  headerRow: {
    width: "100%",
    minHeight: 52,
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
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
    color: "#8A94A6",
  },
  sosRing: {
    marginTop: 26,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#F87171",
    alignItems: "center",
    justifyContent: "center",
  },
  sosCore: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  manageText: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
    color: "#1A73E8",
  },
  grid: {
    marginTop: 18,
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  gridItem: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E6ECF3",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  gridIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F2937",
  },
  gridSubtitle: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "600",
    color: "#94A3B8",
  },
  stopIcon: {
    backgroundColor: RED,
  },
  stopText: {
    color: RED,
  },
});
