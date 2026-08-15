import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { httpPost } from "../../services/http";
import { useSession } from "../../store/sessionStore";
import type { UserType } from "../../types/chat";

const TOKEN_KEY = "trackngo.auth.token";

interface LoginApiData {
  token: string;
  userId: number;
  userType: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
}

const USER_TYPE_MAP: Record<string, UserType> = {
  passenger: "PASSENGER",
  driver: "DRIVER",
  admin: "ADMIN",
  corporate: "CORPORATE_USER",
};

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userType?: string }>();
  const { setCurrentUser } = useSession();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});

  function validate(): boolean {
    const next: { identifier?: string; password?: string } = {};
    if (!identifier.trim()) {
      next.identifier = "Email or phone number is required";
    }
    if (!password) {
      next.password = "Password is required";
    } else if (password.length < 6) {
      next.password = "Password must be at least 6 characters";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await httpPost<ApiResponse<LoginApiData>>(
        "/api/auth/login",
        undefined,
        { identifier: identifier.trim(), password }
      );
      const data = response.data;
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      const userType: UserType =
        USER_TYPE_MAP[data.userType?.toLowerCase()] ?? "PASSENGER";
      await setCurrentUser({ userId: data.userId, userType });
      if (userType === "CORPORATE_USER") {
        router.replace("/corporate/co-op-dashboard");
      } else if (userType === "DRIVER") {
        router.replace("/driver/driver-dashboard");
      } else {
        router.replace("/tabs");
      }
    } catch (error: unknown) {
      let message = "Login failed. Please check your credentials and try again.";
      if (error instanceof Error) {
        const raw = error.message;
        try {
          const parsed = JSON.parse(raw.substring(raw.indexOf("{")));
          if (parsed?.message) message = parsed.message;
        } catch {
          if (raw.toLowerCase().includes("invalid credentials")) {
            message = "Invalid email or password.";
          }
        }
      }
      Alert.alert("Login Failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.busIconBox}>
            <Ionicons name="bus" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Log in to manage your fleet and track buses in real-time
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Identifier */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email or Phone Number</Text>
            <View
              style={[
                styles.inputRow,
                errors.identifier ? styles.inputRowError : null,
              ]}
            >
              <Ionicons
                name="person-outline"
                size={18}
                color="#9AA4B2"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter email or phone"
                placeholderTextColor="#B0BAC9"
                value={identifier}
                onChangeText={(t) => {
                  setIdentifier(t);
                  if (errors.identifier) {
                    setErrors((e) => ({ ...e, identifier: undefined }));
                  }
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>
            {errors.identifier ? (
              <Text style={styles.errorText}>{errors.identifier}</Text>
            ) : null}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.inputRow,
                errors.password ? styles.inputRowError : null,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color="#9AA4B2"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor="#B0BAC9"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (errors.password) {
                    setErrors((e) => ({ ...e, password: undefined }));
                  }
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeBtn}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={18}
                  color="#9AA4B2"
                />
              </Pressable>
            </View>
            {errors.password ? (
              <Text style={styles.errorText}>{errors.password}</Text>
            ) : null}
          </View>

          {/* Remember me + Forgot password */}
          <View style={styles.row}>
            <Pressable
              style={styles.rememberRow}
              onPress={() => setRememberMe((v) => !v)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe ? (
                  <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                ) : null}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/auth/otp-verification")}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </Pressable>
          </View>

          {/* Log In button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Log In</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* OAuth buttons */}
          <View style={styles.oauthRow}>
            <Pressable
              style={styles.oauthBtn}
              onPress={() =>
                Alert.alert("Google", "Google login coming soon.")
              }
            >
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={styles.oauthBtnText}>Google</Text>
            </Pressable>
            <Pressable
              style={styles.oauthBtn}
              onPress={() =>
                Alert.alert("Facebook", "Facebook login coming soon.")
              }
            >
              <Ionicons name="logo-facebook" size={20} color="#1877F2" />
              <Text style={styles.oauthBtnText}>Facebook</Text>
            </Pressable>
          </View>

          {/* Sign up */}
          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Don&apos;t have an account? </Text>
            <Pressable onPress={() => router.push("/auth/registration")}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  header: {
    alignItems: "center",
    paddingTop: 64,
    paddingBottom: 32,
  },
  busIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#2F6BFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: "#2F6BFF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  form: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
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
    fontSize: 15,
    color: "#1F2937",
  },
  eyeBtn: {
    padding: 4,
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  checkboxChecked: {
    backgroundColor: "#2F6BFF",
    borderColor: "#2F6BFF",
  },
  rememberText: {
    fontSize: 14,
    color: "#374151",
  },
  forgotText: {
    fontSize: 14,
    color: "#2F6BFF",
    fontWeight: "600",
  },
  loginBtn: {
    backgroundColor: "#2F6BFF",
    borderRadius: 12,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: "#2F6BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerLabel: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  oauthRow: {
    flexDirection: "row",
    gap: 12,
  },
  oauthBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    height: 48,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  oauthBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  signupText: {
    fontSize: 14,
    color: "#6B7280",
  },
  signupLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2F6BFF",
  },
});

