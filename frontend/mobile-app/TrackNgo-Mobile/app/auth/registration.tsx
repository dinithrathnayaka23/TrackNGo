import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LocalizedText as Text, LocalizedTextInput as TextInput } from "../../utils/i18n";
import { sendRegistrationOtp } from "../../services/registrationOtpApi";

type UserType = "Passenger" | "Corporate";

export default function RegistrationScreen() {
  const router = useRouter();

  const [userType, setUserType] = useState<UserType>("Passenger");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode] = useState("+94");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = "First name is required";
    if (!lastName.trim()) next.lastName = "Last name is required";
    if (!email.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Enter a valid email";
    if (!phone.trim()) next.phone = "Phone number is required";
    if (!password) next.password = "Password is required";
    else if (password.length < 6)
      next.password = "Password must be at least 6 characters";
    if (!confirmPassword) next.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword)
      next.confirmPassword = "Passwords do not match";
    if (!agreeTerms) next.terms = "You must agree to the terms";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleNext() {
    if (!validate()) return;
    const trimmedEmail = email.trim();
    setSubmitting(true);
    try {
      await sendRegistrationOtp(trimmedEmail);
      router.push({
        pathname: "/auth/otp-verification",
        params: {
          phone: `${countryCode} ${phone}`,
          email: trimmedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          userType,
          password,
        },
      });
    } catch (error) {
      showSendOtpError(error, trimmedEmail);
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Explains why the verification code could not be sent.
   *
   * An address that is already registered is the common case and is not really a
   * failure, so it is marked on the email field the way validation errors are and
   * offered a way straight to the login screen rather than a dead-end alert.
   *
   * The backend reports this as a plain message with no error code, so the wording
   * has to be matched. If that wording ever changes this falls through to showing
   * the server's own message, which is still accurate - it just loses the shortcut.
   */
  function showSendOtpError(error: unknown, attemptedEmail: string) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Something went wrong. Please check your connection and try again.";

    if (/already (exists|registered)/i.test(message)) {
      setErrors((prev) => ({ ...prev, email: "This email is already registered" }));
      Alert.alert(
        "Email already registered",
        `${attemptedEmail} already has a TrackNGo account. You can log in with it, or sign up using a different email address.`,
        [
          { text: "Use another email", style: "cancel" },
          { text: "Log In", onPress: () => router.replace("/auth/login") },
        ],
      );
      return;
    }

    Alert.alert("Could not send code", message);
  }

  function clearError(field: string) {
    if (errors[field]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
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
          <Pressable
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/auth/welcome")
            }
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color="#374151" />
          </Pressable>

          <Text style={styles.title}>Create Account</Text>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            <Text style={styles.stepLabel}>Step 1 of 3</Text>
            <Text style={styles.stepName}>Personal Info</Text>
          </View>
          <View style={styles.stepBarRow}>
            <View style={[styles.stepBar, styles.stepBarActive]} />
            <View style={styles.stepBar} />
            <View style={styles.stepBar} />
          </View>

          <Text style={styles.heading}>
            Sign up to start{"\n"}tracking and booking.
          </Text>
        </View>

        {/* User type selector */}
        <Text style={styles.label}>I am a</Text>
        <View style={styles.typeRow}>
          {(["Passenger", "Corporate"] as UserType[]).map((type) => {
            const active = userType === type;
            return (
              <Pressable
                key={type}
                style={[styles.typeCard, active && styles.typeCardActive]}
                onPress={() => setUserType(type)}
              >
                {active && (
                  <View style={styles.typeCheck}>
                    <Ionicons name="checkmark-circle" size={20} color="#2F6BFF" />
                  </View>
                )}
                <Ionicons
                  name={type === "Passenger" ? "person" : "business"}
                  size={28}
                  color={active ? "#2F6BFF" : "#6B7280"}
                />
                <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Name row */}
        <View style={styles.nameRow}>
          <View style={styles.nameCol}>
            <Text style={styles.label}>First Name</Text>
            <View style={[styles.inputRow, errors.firstName ? styles.inputRowError : null]}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Kasun"
                placeholderTextColor="#B0BAC9"
                value={firstName}
                onChangeText={(t) => { setFirstName(t); clearError("firstName"); }}
                autoCapitalize="words"
              />
            </View>
            {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
          </View>
          <View style={styles.nameCol}>
            <Text style={styles.label}>Last Name</Text>
            <View style={[styles.inputRow, errors.lastName ? styles.inputRowError : null]}>
              <TextInput
                style={styles.input}
                placeholder="e.g. Perera"
                placeholderTextColor="#B0BAC9"
                value={lastName}
                onChangeText={(t) => { setLastName(t); clearError("lastName"); }}
                autoCapitalize="words"
              />
            </View>
            {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}
          </View>
        </View>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputRow, errors.email ? styles.inputRowError : null]}>
            <Ionicons name="mail" size={18} color="#9AA4B2" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor="#B0BAC9"
              value={email}
              onChangeText={(t) => { setEmail(t); clearError("email"); }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
        </View>

        {/* Mobile Number */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Mobile Number</Text>
          <View style={[styles.inputRow, errors.phone ? styles.inputRowError : null]}>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{countryCode}</Text>
            </View>
            <View style={styles.codeDivider} />
            <TextInput
              style={styles.input}
              placeholder="77 123 4567"
              placeholderTextColor="#B0BAC9"
              value={phone}
              onChangeText={(t) => { setPhone(t); clearError("phone"); }}
              keyboardType="phone-pad"
            />
          </View>
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={[styles.inputRow, errors.password ? styles.inputRowError : null]}>
            <Ionicons name="lock-closed" size={18} color="#9AA4B2" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor="#B0BAC9"
              value={password}
              onChangeText={(t) => { setPassword(t); clearError("password"); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={18}
                color="#9AA4B2"
              />
            </Pressable>
          </View>
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
        </View>

        {/* Confirm Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={[styles.inputRow, errors.confirmPassword ? styles.inputRowError : null]}>
            <Ionicons name="lock-closed" size={18} color="#9AA4B2" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              placeholderTextColor="#B0BAC9"
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); clearError("confirmPassword"); }}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
            />
            <Pressable onPress={() => setShowConfirmPassword((v) => !v)} style={styles.eyeBtn} hitSlop={8}>
              <Ionicons
                name={showConfirmPassword ? "eye-outline" : "eye-off-outline"}
                size={18}
                color="#9AA4B2"
              />
            </Pressable>
          </View>
          {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
        </View>

        {/* Terms checkbox */}
        <Pressable
          style={styles.termsRow}
          onPress={() => { setAgreeTerms((v) => !v); clearError("terms"); }}
        >
          <View style={[styles.checkbox, agreeTerms && styles.checkboxChecked]}>
            {agreeTerms && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
          </View>
          <Text style={styles.termsText}>
            I agree to the{" "}
            <Text style={styles.termsLink}>Terms & Conditions</Text> and{" "}
            <Text style={styles.termsLink}>Privacy Policy</Text>.
          </Text>
        </Pressable>
        {errors.terms ? <Text style={[styles.errorText, { marginTop: -8 }]}>{errors.terms}</Text> : null}

        {/* Next button */}
        <TouchableOpacity
          style={[styles.nextBtn, submitting && { opacity: 0.7 }]}
          onPress={() => void handleNext()}
          activeOpacity={0.85}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.nextBtnText}>Next</Text>
          )}
        </TouchableOpacity>

        {/* Login link */}
        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <Pressable onPress={() => router.push("/auth/login")}>
            <Text style={styles.loginLink}>Login</Text>
          </Pressable>
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
    paddingTop: 56,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  backBtn: {
    // Pulled left so the icon's optical edge lines up with the title below it
    // rather than the touch target's edge.
    marginLeft: -8,
    marginBottom: 8,
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#2F6BFF",
  },
  stepName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  stepBarRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 24,
  },
  stepBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
  },
  stepBarActive: {
    backgroundColor: "#2F6BFF",
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
    lineHeight: 36,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 4,
  },
  typeRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  typeCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  typeCardActive: {
    borderColor: "#2F6BFF",
    backgroundColor: "#F0F5FF",
  },
  typeCheck: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 8,
  },
  typeLabelActive: {
    color: "#2F6BFF",
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  nameCol: {
    flex: 1,
  },
  fieldGroup: {
    marginBottom: 4,
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
    marginBottom: 4,
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
  codeBox: {
    paddingRight: 10,
  },
  codeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  codeDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E5E7EB",
    marginRight: 10,
  },
  errorText: {
    fontSize: 12, fontWeight: "600",
    color: "#EF4444",
    marginBottom: 4,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: "#2F6BFF",
    borderColor: "#2F6BFF",
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },
  termsLink: {
    color: "#2F6BFF",
    fontWeight: "600",
  },
  nextBtn: {
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
  nextBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  loginText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2F6BFF",
  },
});
