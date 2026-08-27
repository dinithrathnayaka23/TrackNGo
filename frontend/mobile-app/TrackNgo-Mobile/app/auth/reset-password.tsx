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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { resetPassword } from "../../services/passwordResetApi";
import { LocalizedText as Text, LocalizedTextInput as TextInput } from "../../utils/i18n";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ resetToken?: string }>();
  const resetToken = params.resetToken ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const next: { newPassword?: string; confirmPassword?: string } = {};
    if (!newPassword) next.newPassword = "New password is required";
    else if (newPassword.length < 8) next.newPassword = "Password must be at least 8 characters";
    if (!confirmPassword) next.confirmPassword = "Please confirm your password";
    else if (newPassword !== confirmPassword) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleReset() {
    if (!validate()) return;
    if (!resetToken) {
      Alert.alert("Session Expired", "Please request a new verification code and try again.");
      router.replace("/auth/forgot-password");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(resetToken, newPassword);
      Alert.alert("Password Reset", "Your password has been reset successfully. Please log in with your new password.", [
        { text: "OK", onPress: () => router.replace("/auth/login") },
      ]);
    } catch (err) {
      Alert.alert("Could Not Reset Password", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Android already resizes the window for the keyboard (app.json
  // softwareKeyboardLayoutMode: "resize"), so a "height" behavior here would
  // compensate a second time and make the bottom-anchored button jitter.
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </Pressable>

        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={36} color="#2F6BFF" />
        </View>

        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter a new password for your account.</Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>New Password</Text>
          <View style={[styles.inputRow, errors.newPassword ? styles.inputRowError : null]}>
            <Ionicons name="lock-closed-outline" size={18} color="#9AA4B2" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter new password"
              placeholderTextColor="#B0BAC9"
              value={newPassword}
              onChangeText={(t) => {
                setNewPassword(t);
                if (errors.newPassword) setErrors((e) => ({ ...e, newPassword: undefined }));
              }}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowNewPassword((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
              <Ionicons name={showNewPassword ? "eye-outline" : "eye-off-outline"} size={18} color="#9AA4B2" />
            </Pressable>
          </View>
          {errors.newPassword ? <Text style={styles.errorText}>{errors.newPassword}</Text> : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={[styles.inputRow, errors.confirmPassword ? styles.inputRowError : null]}>
            <Ionicons name="lock-closed-outline" size={18} color="#9AA4B2" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Re-enter new password"
              placeholderTextColor="#B0BAC9"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                if (errors.confirmPassword) setErrors((e) => ({ ...e, confirmPassword: undefined }));
              }}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowConfirmPassword((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
              <Ionicons name={showConfirmPassword ? "eye-outline" : "eye-off-outline"} size={18} color="#9AA4B2" />
            </Pressable>
          </View>
          {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.resetBtn, loading && { opacity: 0.7 }]}
          onPress={() => void handleReset()}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.resetBtnText}>Reset Password</Text>}
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
    marginBottom: 32,
  },
  fieldGroup: {
    gap: 6,
    marginBottom: 16,
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
  eyeBtn: {
    padding: 4,
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
  resetBtn: {
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
  resetBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
