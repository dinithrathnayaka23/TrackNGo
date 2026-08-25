import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { requestPasswordResetOtp } from "../../services/passwordResetApi";
import { LocalizedText as Text, LocalizedTextInput as TextInput } from "../../utils/i18n";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email");
      return false;
    }
    setError("");
    return true;
  }

  async function handleSend() {
    if (!validate()) return;
    setLoading(true);
    try {
      await requestPasswordResetOtp(email.trim());
      router.push({
        pathname: "/auth/reset-otp-verification",
        params: { email: email.trim() },
      });
    } catch (err) {
      Alert.alert("Could Not Send Code", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.container}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </Pressable>

        <View style={styles.iconCircle}>
          <Ionicons name="key" size={36} color="#2F6BFF" />
        </View>

        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.subtitle}>
          Enter the email address on your account and we&apos;ll send you a verification code to reset your
          password.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
            <Ionicons name="mail-outline" size={18} color="#9AA4B2" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#B0BAC9"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError("");
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.sendBtn, loading && { opacity: 0.7 }]}
          onPress={() => void handleSend()}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.sendBtnText}>Send Code</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EBF1FF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 32,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    height: 50,
  },
  inputRowError: {
    borderColor: "#EF4444",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1F2937",
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#EF4444",
    marginTop: 4,
  },
  spacer: {
    flex: 1,
  },
  sendBtn: {
    backgroundColor: "#2F6BFF",
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2F6BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
