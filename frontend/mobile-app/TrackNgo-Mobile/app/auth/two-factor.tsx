import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { httpPost, setAuthToken } from "../../services/http";
import { saveTrustedDeviceToken } from "../../services/trustedDeviceStorage";
import { useSession } from "../../store/sessionStore";
import { LocalizedText as Text, useLanguage } from "../../utils/i18n";
import { requestLocationOnSignIn } from "../../utils/locationSharing";

interface LoginApiData {
  token: string;
  userId: number;
  userType: string;
  trustedDeviceToken?: string | null;
}

interface ApiResponse<T> {
  data: T;
}

const userTypeMap: Record<string, "PASSENGER" | "DRIVER" | "ADMIN" | "CORPORATE_USER"> = {
  passenger: "PASSENGER",
  driver: "DRIVER",
  admin: "ADMIN",
  corporate: "CORPORATE_USER",
};

export default function TwoFactorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ challengeToken?: string; email?: string }>();
  const { setCurrentUser } = useSession();
  const { language } = useLanguage();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const isSinhala = language === "si";

  const verify = async () => {
    const normalized = code.replace(/\D/g, "");
    if (normalized.length !== 6) {
      Alert.alert(
        isSinhala ? "කේතය සම්පූර්ණ නොවේ" : "Incomplete code",
        isSinhala ? "අංක 6ක සත්‍යාපන කේතය ඇතුළත් කරන්න." : "Enter the 6-digit authenticator code.",
      );
      return;
    }
    if (!params.challengeToken) {
      Alert.alert(isSinhala ? "සැසිය කල් ඉකුත් වී ඇත" : "Session expired", isSinhala ? "කරුණාකර නැවත ඇතුළු වන්න." : "Please log in again.");
      router.replace("/auth/login");
      return;
    }

    setLoading(true);
    try {
      const response = await httpPost<ApiResponse<LoginApiData>>(
        "/api/auth/2fa/verify",
        undefined,
        { challengeToken: params.challengeToken, code: normalized },
      );
      const data = response.data;
      if (data.trustedDeviceToken) {
        await saveTrustedDeviceToken(data.trustedDeviceToken);
      }
      await setAuthToken(data.token);
      await setCurrentUser({
        userId: data.userId,
        userType: userTypeMap[data.userType?.toLowerCase()] ?? "PASSENGER",
      });
      router.replace("/tabs");
      void requestLocationOnSignIn();
    } catch (error) {
      Alert.alert(
        isSinhala ? "සත්‍යාපනය අසාර්ථකයි" : "Verification failed",
        error instanceof Error ? error.message : (isSinhala ? "කේතය පරීක්ෂා කළ නොහැක." : "The authenticator code could not be verified."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <View style={styles.iconCircle}><Ionicons name="shield-checkmark-outline" size={30} color="#2378E8" /></View>
        <Text style={styles.title}>{isSinhala ? "ද්වි-සාධක සත්‍යාපනය" : "Two-factor authentication"}</Text>
        <Text style={styles.subtitle}>
          {isSinhala
            ? `${params.email ?? "ඔබගේ ගිණුම"} සඳහා Authenticator යෙදුමේ පෙන්වන අංක 6ක කේතය ඇතුළත් කරන්න.`
            : `Enter the 6-digit code from your authenticator app for ${params.email ?? "your account"}.`}
        </Text>
        <TextInput
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          placeholder="000000"
          placeholderTextColor="#A4ADBA"
          style={styles.codeInput}
        />
        <Pressable style={styles.primaryButton} onPress={() => void verify()} disabled={loading}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{isSinhala ? "තහවුරු කරන්න" : "Verify code"}</Text>}
        </Pressable>
        <Pressable onPress={() => router.replace("/auth/login")} disabled={loading}>
          <Text style={styles.backText}>{isSinhala ? "ආපසු ඇතුළු වීම වෙත" : "Back to login"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "#F6F8FC" },
  card: { padding: 24, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", shadowColor: "#1F2937", shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF2FF", marginBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#172033", textAlign: "center" },
  subtitle: { marginTop: 10, fontSize: 13, fontWeight: "500", lineHeight: 21, color: "#687386", textAlign: "center" },
  codeInput: { width: "100%", marginTop: 24, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 24, letterSpacing: 8, textAlign: "center", color: "#172033" },
  primaryButton: { width: "100%", minHeight: 50, marginTop: 16, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#2378E8" },
  primaryText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  backText: { marginTop: 18, color: "#2378E8", fontWeight: "700" },
});
