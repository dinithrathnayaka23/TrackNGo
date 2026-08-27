import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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

  /* An accidental SOS pulls the control room away from a real emergency, so the
     button asks once before firing. */
  const confirmSos = () => {
    Alert.alert(t("sos.confirmTitle"), t("sos.confirmMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("sos.confirmSend"),
        style: "destructive",
        onPress: () => void sendSos(),
      },
    ]);
  };

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
        <Text style={styles.subtitle}>{t("sos.subtitle")}</Text>

        {busNumber ? (
          <View style={styles.busChip}>
            <MaterialCommunityIcons name="bus" size={16} color="#2563EB" />
            <Text style={styles.busChipText}>
              {t("sos.currentBus", { busNumber })}
            </Text>
          </View>
        ) : null}

        <Pressable
          style={[
            styles.sosButton,
            (triggering || sosSent) && styles.sosButtonDisabled,
          ]}
          disabled={triggering || sosSent}
          onPress={confirmSos}
        >
          {triggering ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <MaterialCommunityIcons
              name={sosSent ? "check-circle-outline" : "alert-octagon"}
              size={44}
              color="#FFFFFF"
            />
          )}
          <Text style={styles.sosButtonText}>
            {triggering
              ? t("sos.sending")
              : sosSent
                ? t("sos.sentTitle")
                : t("sos.emergencyButton")}
          </Text>
        </Pressable>

        <View style={styles.notifyRow}>
          <View style={styles.notifyTextWrap}>
            <Text style={styles.notifyLabel}>{t("sos.notifyContacts")}</Text>
            <Text style={styles.notifyHint}>{t("sos.notifyContactsHint")}</Text>
          </View>
          <Switch
            value={notifyContacts}
            onValueChange={setNotifyContacts}
            disabled={triggering}
          />
        </View>

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
  sosButton: {
    alignSelf: "center",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: RED,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sosButtonDisabled: {
    opacity: 0.6,
  },
  sosButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  notifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
  },
  notifyTextWrap: {
    flex: 1,
  },
  notifyLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  notifyHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
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
