import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useUser } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  getActiveEmergencyNumbers,
  triggerSosAlert,
  type EmergencyNumberDto,
} from "@/services/sosApi";

const RED = "#DC2626";
const GREEN = "#22C55E";

type QuickAction = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  labelKey: "sos.ambulance" | "sos.police" | "sos.helpCenter" | "sos.fireBrigade";
  number: string;
};

/* Builds the quick-call tiles from the active emergency number record. Kept
   separate from the component so the mapping can be unit tested. */
export function buildQuickActions(
  data: EmergencyNumberDto | null,
): QuickAction[] {
  if (!data) return [];
  return [
    { icon: "medical-bag", labelKey: "sos.ambulance", number: data.ambulance },
    { icon: "shield", labelKey: "sos.police", number: data.police },
    { icon: "phone", labelKey: "sos.helpCenter", number: data.helpCenter },
    { icon: "fire-truck", labelKey: "sos.fireBrigade", number: data.fireBrigade },
  ];
}

export default function DriverSosScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { t } = useLanguage();
  const { bottom } = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    busNumber?: string;
    startLocation?: string;
    endLocation?: string;
  }>();

  const [emergencyData, setEmergencyData] = useState<EmergencyNumberDto | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [notifyContacts, setNotifyContacts] = useState(true);

  const busNumber = Array.isArray(params.busNumber)
    ? params.busNumber[0]
    : params.busNumber;
  const startLocation = Array.isArray(params.startLocation)
    ? params.startLocation[0]
    : params.startLocation;
  const endLocation = Array.isArray(params.endLocation)
    ? params.endLocation[0]
    : params.endLocation;

  useEffect(() => {
    let active = true;
    getActiveEmergencyNumbers()
      .then((data) => {
        if (active) setEmergencyData(data);
      })
      .catch((err) => {
        console.warn("[SOS] Failed to load emergency numbers:", err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /* The alert is only useful if the control room can see where the driver is,
     so the fix is taken at press time rather than trusting a cached one. */
  const getCurrentLocation = async () => {
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

  const sendSos = useCallback(async () => {
    if (!user?.userId) {
      Alert.alert(
        t("sos.loginRequiredTitle"),
        t("sos.loginRequiredMessage"),
      );
      return;
    }

    setTriggering(true);
    try {
      const location = await getCurrentLocation();
      if (!location) {
        Alert.alert(
          t("sos.locationRequiredTitle"),
          t("sos.locationRequiredMessage"),
        );
        return;
      }

      const sharedLocation = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)} - Driver location`;

      await triggerSosAlert({
        driverId: user.userId,
        sharedLocation,
        busNumber,
        startLocation,
        endLocation,
        notifyEmergencyContacts: notifyContacts,
      });

      setSosSent(true);
      Alert.alert(t("sos.sentTitle"), t("sos.sentMessage"));
    } catch (err) {
      console.error("[SOS] Failed to trigger alert:", err);
      Alert.alert(t("sos.failedTitle"), t("sos.failedMessage"));
    } finally {
      setTriggering(false);
    }
  }, [
    user?.userId,
    busNumber,
    startLocation,
    endLocation,
    notifyContacts,
    t,
  ]);

  const callNumber = async (number: string) => {
    try {
      await Linking.openURL(`tel:${number}`);
    } catch {
      Alert.alert(t("sos.callFailedTitle"), t("sos.callFailedMessage"));
    }
  };

  const quickActions = buildQuickActions(emergencyData);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>{t("sos.title")}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottom + 24 },
        ]}
      >
        <Text style={styles.subtitle}>
          {sosSent
            ? t("sos.sentMessage")
            : triggering
              ? t("sos.sending")
              : "Tap in case of emergency"}
        </Text>

        {busNumber ? (
          <View style={styles.busChip}>
            <MaterialCommunityIcons name="bus" size={16} color="#2563EB" />
            <Text style={styles.busChipText}>
              {t("sos.currentBus", { busNumber })}
            </Text>
          </View>
        ) : null}

        <Pressable
          testID="trigger-sos-button"
          style={[
            styles.sosRing,
            sosSent ? styles.sosRingSuccess : undefined,
            triggering ? styles.sosRingDisabled : undefined,
          ]}
          disabled={triggering || sosSent}
          onPress={() => void sendSos()}
        >
          <View style={[styles.sosCore, sosSent ? styles.sosCoreSuccess : undefined]}>
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

        {sosSent ? <Text style={styles.calmText}>{t("sos.sentMessage")}</Text> : null}

        <Pressable
          testID="inform-emergency-contacts-toggle"
          style={styles.checkboxRow}
          onPress={() => setNotifyContacts((prev) => !prev)}
          disabled={triggering || sosSent}
        >
          <View style={[styles.checkbox, !notifyContacts && styles.checkboxUnchecked]}>
            {notifyContacts ? (
              <MaterialCommunityIcons name="check" size={12} color="#FFFFFF" />
            ) : null}
          </View>
          <Text style={styles.checkboxText}>{t("sos.notifyContacts")}</Text>
        </Pressable>

        <Pressable onPress={() => router.push("/emergency-contacts")}>
          <Text style={styles.manageText}>Manage emergency contacts</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>{t("sos.quickCall")}</Text>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={RED} />
        ) : (
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <Pressable
                key={action.labelKey}
                style={styles.actionTile}
                onPress={() => void callNumber(action.number)}
              >
                <View style={styles.actionIconWrap}>
                  <MaterialCommunityIcons
                    name={action.icon}
                    size={22}
                    color={RED}
                  />
                </View>
                <Text style={styles.actionTitle}>{t(action.labelKey)}</Text>
                <Text style={styles.actionNumber}>{action.number}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  subtitle: {
    fontSize: 14,
    color: "#4B5563",
    textAlign: "center",
  },
  busChip: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  busChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  sosRing: {
    marginTop: 10,
    alignSelf: "center",
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
    marginTop: -8,
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
    textAlign: "center",
  },
  checkboxRow: {
    alignSelf: "center",
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
    alignSelf: "center",
    marginTop: -8,
    fontSize: 11,
    fontWeight: "700",
    color: "#1A73E8",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  loader: {
    marginVertical: 20,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionTile: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  actionNumber: {
    fontSize: 13,
    color: "#6B7280",
  },
});
