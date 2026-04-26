import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import type { RootStackParamList } from "../../navigation/types";
import { useSession } from "../../store/sessionStore";
import {
  EmergencyNumberDto,
  getActiveEmergencyNumbers,
  triggerSosAlert,
} from "../../services/sosApi";
import { sendSosSmsDirect } from "../../services/smsService";
import { getUserProfile } from "../../services/userProfileApi";
import * as Location from "expo-location";

type Props = NativeStackScreenProps<RootStackParamList, "Sos">;

const RED = "#EF4444";
const GREEN = "#22C55E";

type QuickAction = {
  icon: "medical-bag" | "shield" | "phone" | "fire-truck";
  title: string;
  subtitle: string;
};

// Builds the quick-call tiles from the active emergency number record.
export function buildQuickActions(data: EmergencyNumberDto | null): QuickAction[] {
  if (!data) return [];
  return [
    { icon: "medical-bag", title: "Ambulance", subtitle: data.ambulance },
    { icon: "shield", title: "Police", subtitle: data.police },
    { icon: "phone", title: "Help center", subtitle: data.helpCenter },
    { icon: "fire-truck", title: "Fire brigade", subtitle: data.fireBrigade },
  ];
}

export function SosScreen({ navigation }: Props) {
  const { currentUser } = useSession();
  const params = useLocalSearchParams<{
    busNumber?: string;
    startLocation?: string;
    endLocation?: string;
    userLatitude?: string;
    userLongitude?: string;
  }>();
  const { bottom } = useSafeAreaInsets();
  const [emergencyData, setEmergencyData] = useState<EmergencyNumberDto | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [informEmergencyContacts, setInformEmergencyContacts] = useState(true);

  // Loads the currently active emergency contact numbers shown on the SOS screen.
  useEffect(() => {
    getActiveEmergencyNumbers()
      .then(setEmergencyData)
      .catch((err) => console.error("Failed to fetch emergency numbers:", err))
      .finally(() => setLoading(false));
  }, []);

  const quickActions = buildQuickActions(emergencyData);

  // Opens the phone dialer with a sanitized emergency number.
  const handleCall = (number: string) => {
    const cleaned = number.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleaned}`);
  };

  // Parses a route parameter into a numeric coordinate when possible.
  const parseCoordinate = (value?: string): number | null => {
    if (!value) {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Resolves the current user location from route params or device GPS permission flow.
  const getLoggedUserLocation = async (): Promise<{
    latitude: number;
    longitude: number;
  } | null> => {
    const latFromParams = parseCoordinate(params.userLatitude);
    const lngFromParams = parseCoordinate(params.userLongitude);

    if (latFromParams !== null && lngFromParams !== null) {
      return {
        latitude: latFromParams,
        longitude: lngFromParams,
      };
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  };

  // Sends the SOS alert to the backend and optionally mirrors the message through direct SMS.
  const handleTriggerSos = async () => {
    if (!currentUser) {
      Alert.alert("Login required", "Please log in before sending SOS alerts.");
      return;
    }

    setTriggering(true);
    try {
      const currentLocation = await getLoggedUserLocation();
      if (!currentLocation) {
        Alert.alert(
          "Location required",
          "Enable location services to send SOS with your live location.",
        );
        return;
      }

      const sharedLocation = `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)} - Logged user location`;

      await triggerSosAlert({
        passengerId:
          currentUser.userType === "PASSENGER" ? currentUser.userId : undefined,
        driverId:
          currentUser.userType === "DRIVER" ? currentUser.userId : undefined,
        sharedLocation,
        busNumber: params.busNumber,
        startLocation: params.startLocation,
        endLocation: params.endLocation,
        notifyEmergencyContacts: informEmergencyContacts,
      });

      setSosSent(true);

      if (informEmergencyContacts) {
        try {
          let userName = "User";
          try {
            const profile = await getUserProfile(currentUser.userId);
            if (profile?.fullName) userName = profile.fullName;
          } catch {}
          await sendSosSmsDirect({
            userName,
            userId: currentUser.userId,
            userType: currentUser.userType as "PASSENGER" | "DRIVER",
            busNumber: params.busNumber,
            startLocation: params.startLocation,
            endLocation: params.endLocation,
            sharedLocation,
          });
        } catch (smsErr) {
          console.warn("Direct SMS sending failed:", smsErr);
        }
      }

      Alert.alert("SOS sent", "Emergency alert has been sent to admin.");
    } catch (error) {
      console.error("Failed to trigger SOS alert", error);
      Alert.alert("Error", "Failed to send SOS alert. Please try again.");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
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

        <Text style={styles.subtitle}>
          {sosSent
            ? "Help is on the way, please be calm."
            : triggering
              ? "Sending emergency alert..."
              : "Tap in case of emergency"}
        </Text>

        <Pressable
          testID="trigger-sos-button"
          style={[
            styles.sosRing,
            sosSent ? styles.sosRingSuccess : undefined,
            triggering ? styles.sosRingDisabled : undefined,
          ]}
          onPress={handleTriggerSos}
          disabled={triggering || sosSent}
        >
          <View
            style={[
              styles.sosCore,
              sosSent ? styles.sosCoreSuccess : undefined,
            ]}
          >
            {triggering ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons
                name={sosSent ? "shield-check" : "bell"}
                size={28}
                color="#FFFFFF"
              />
            )}
          </View>
        </Pressable>

        {sosSent && (
          <Text style={styles.calmText}>
            Help is on the way, please be calm.
          </Text>
        )}

        <Pressable
          testID="inform-emergency-contacts-toggle"
          style={styles.checkboxRow}
          onPress={() => setInformEmergencyContacts((prev) => !prev)}
          disabled={triggering || sosSent}
        >
          <View
            style={[
              styles.checkbox,
              !informEmergencyContacts && styles.checkboxUnchecked,
            ]}
          >
            {informEmergencyContacts ? (
              <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
            ) : null}
          </View>
          <Text style={styles.checkboxText}>Inform my emergency contacts</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate("EmergencyContacts")}>
          <Text style={styles.manageText}>Manage emergency contacts</Text>
        </Pressable>

        <View style={styles.grid}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={RED} />
              <Text style={styles.loadingText}>
                Loading emergency numbers...
              </Text>
            </View>
          ) : (
            quickActions.map((item) => (
              <Pressable
                key={item.title}
                testID={`quick-action-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                style={styles.gridItem}
                onPress={() => handleCall(item.subtitle)}
              >
                <View style={styles.gridIcon}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={18}
                    color={RED}
                  />
                </View>
                <Text style={styles.gridTitle}>{item.title}</Text>
                <Text style={styles.gridSubtitle}>{item.subtitle}</Text>
              </Pressable>
            ))
          )}
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
  sosRingDisabled: {
    opacity: 0.7,
  },
  sosRingSuccess: {
    backgroundColor: "#86EFAC",
  },
  sosCore: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
  sosCoreSuccess: {
    backgroundColor: GREEN,
  },
  calmText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
    textAlign: "center",
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
  checkboxUnchecked: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
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
    marginTop: 70,
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
  loadingContainer: {
    width: "100%",
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#8A94A6",
  },
});
