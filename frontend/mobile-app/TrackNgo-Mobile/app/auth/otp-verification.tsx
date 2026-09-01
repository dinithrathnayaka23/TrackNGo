import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { extractApiMessage, httpPost, setAuthToken } from "../../services/http";
import { resendRegistrationOtp, verifyRegistrationOtp } from "../../services/registrationOtpApi";
import { useSession } from "../../store/sessionStore";
import { LocalizedText as Text } from "../../utils/i18n";
import { requestLocationOnSignIn } from "../../utils/locationSharing";

const OTP_LENGTH = 6;
// Must match RegistrationOtpServiceImpl.RESEND_COOLDOWN_SECONDS on the backend.
const RESEND_SECONDS = 30;

export default function OtpVerificationScreen() {
  const router = useRouter();
  const { setCurrentUser } = useSession();
  const params = useLocalSearchParams<{
    phone?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    userType?: string;
    password?: string;
    companyName?: string;
    businessRegistrationNumber?: string;
    industry?: string;
    address?: string;
    contactPersonName?: string;
    contactPersonDesignation?: string;
    contactPhone?: string;
  }>();
  const email = params.email ?? "";
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return;
    }
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function handleChange(text: string, index: number) {
    if (text.length > 1) {
      // Handle paste
      const chars = text.replace(/[^0-9]/g, "").slice(0, OTP_LENGTH).split("");
      const next = [...otp];
      chars.forEach((c, i) => {
        if (index + i < OTP_LENGTH) next[index + i] = c;
      });
      setOtp(next);
      const focusIdx = Math.min(index + chars.length, OTP_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const digit = text.replace(/[^0-9]/g, "");
    const next = [...otp];
    next[index] = digit;
    setOtp(next);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const next = [...otp];
      next[index - 1] = "";
      setOtp(next);
    }
  }

  async function handleResend() {
    if (!email) return;
    setResending(true);
    try {
      await resendRegistrationOtp(email);
      setTimer(RESEND_SECONDS);
      setCanResend(false);
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
      Alert.alert("Code Sent", "A new verification code has been sent to your email.");
    } catch (error) {
      Alert.alert("Could Not Resend", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setResending(false);
    }
  }

  async function handleVerify() {
    const code = otp.join("");
    if (code.length < OTP_LENGTH) {
      Alert.alert("Incomplete Code", "Please enter the full 6-digit code.");
      return;
    }
    if (!email) {
      Alert.alert("Missing Email", "No email address was provided. Please go back and try again.");
      return;
    }

    setLoading(true);
    try {
      const { verificationToken } = await verifyRegistrationOtp(email, code);

      const isCorporate = params.userType === "Corporate";
      const userTypeParam = isCorporate ? "corporate" : "passenger";

      // The account holder for a corporate sign-up is the contact person —
      // the `user` row still wants a first/last name, so it's split from the
      // single "Full Name" field the corporate form collects.
      const [corporateFirstName, ...corporateLastNameParts] = (params.contactPersonName ?? "").trim().split(/\s+/);
      const payload = {
        email,
        password: params.password,
        userType: userTypeParam,
        firstName: isCorporate ? corporateFirstName : params.firstName,
        lastName: isCorporate ? corporateLastNameParts.join(" ") || null : params.lastName,
        phoneNumber: isCorporate ? params.contactPhone : params.phone,
        emailVerificationToken: verificationToken,
      };

      const response = await httpPost<any>("/api/users", undefined, payload);
      const savedUser = response.data || response;

      // Creating the account does not return a JWT, so log in straight away to
      // obtain one. Without this the new user lands in the app with a session but
      // no credentials, and every authenticated request comes back as a bare 403.
      const loginResponse = await httpPost<any>("/api/auth/login", undefined, {
        // The same normalised address the OTP was verified against and the account
        // was created with, so the sign-in cannot miss on a whitespace difference.
        identifier: email,
        password: params.password,
      });
      const loginData = loginResponse.data || loginResponse;
      if (!loginData?.token) {
        throw new Error("Account created but sign-in failed. Please log in manually.");
      }
      await setAuthToken(loginData.token);

      const userId = loginData.userId ?? savedUser.id;
      const mappedUserType = userTypeParam === "corporate" ? "CORPORATE_USER" : "PASSENGER";
      await setCurrentUser({
        userId,
        userType: mappedUserType,
      });

      // The company/contact fields were collected on the same Create Account
      // screen, so the corporate profile is saved right here rather than in a
      // separate follow-up step. If this call fails the account still exists
      // and is signed in, so the user lands on their profile screen with a
      // heads-up instead of being stuck.
      let corporateProfileError: string | null = null;
      if (isCorporate) {
        try {
          await httpPost<any>(`/api/users/${userId}/corporate`, undefined, {
            companyName: params.companyName,
            businessRegistrationNumber: params.businessRegistrationNumber,
            industry: params.industry,
            address: params.address,
            contactPersonName: params.contactPersonName,
            contactPersonDesignation: params.contactPersonDesignation,
            contactPhone: params.contactPhone,
            contactEmail: email,
          });
        } catch (profileErr) {
          corporateProfileError = extractApiMessage(
            profileErr,
            "Your account was created, but we couldn't save your company details. Please complete your profile.",
          );
        }
      }

      Alert.alert(
        "Verified",
        corporateProfileError ?? "Your account has been verified successfully!",
        [
          {
            text: "OK",
            onPress: () => {
              if (isCorporate) {
                router.replace("/corporate/co-op-dashboard");
              } else {
                router.replace("/tabs");
              }
              // Verifying signs the new account straight in, so it is the same moment
              // to ask about location as an ordinary log-in.
              void requestLocationOnSignIn();
            },
          },
        ],
      );
    } catch (err) {
      // Falls back to a readable sentence rather than the raw
      // "POST /api/users failed: 400 - {...}" string the request throws.
      Alert.alert(
        "Registration Failed",
        extractApiMessage(err, "Failed to create account. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.container}>
        {/* Back button */}
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </Pressable>

        {/* Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="mail" size={36} color="#2F6BFF" />
          <View style={styles.iconDot}>
            <View style={styles.iconDotInner} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
        <Text style={styles.destination}>{email}</Text>

        {/* OTP inputs */}
        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[
                styles.otpBox,
                digit ? styles.otpBoxFilled : null,
                index === otp.findIndex((d) => !d) ? styles.otpBoxActive : null,
              ]}
              value={digit}
              onChangeText={(t) => handleChange(t, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={index === 0 ? OTP_LENGTH : 1}
              selectTextOnFocus
              textContentType="oneTimeCode"
            />
          ))}
        </View>

        {/* Timer & Resend */}
        <View style={styles.timerRow}>
          {!canResend ? (
            <Text style={styles.timerText}>
              Resend code in <Text style={styles.timerBold}>{formatTime(timer)}</Text>
            </Text>
          ) : null}
          <Pressable onPress={canResend ? () => void handleResend() : undefined} disabled={!canResend || resending}>
            <Text style={[styles.resendText, (!canResend || resending) && styles.resendDisabled]}>
              {resending ? "Sending..." : "Resend Code"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.spacer} />

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.verifyBtn, loading && { opacity: 0.7 }]}
          onPress={() => void handleVerify()}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.verifyBtnText}>Verify</Text>
          )}
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
    alignItems: "center",
  },
  backBtn: {
    position: "absolute",
    top: 56,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    zIndex: 10,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EBF1FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    marginBottom: 24,
  },
  iconDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2F6BFF",
    alignItems: "center",
    justifyContent: "center",
  },
  iconDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13, fontWeight: "500",
    color: "#2F6BFF",
    marginBottom: 4,
  },
  destination: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 32,
  },
  otpRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  otpBoxFilled: {
    borderColor: "#2F6BFF",
    backgroundColor: "#F0F5FF",
  },
  otpBoxActive: {
    borderColor: "#2F6BFF",
  },
  timerRow: {
    alignItems: "center",
    gap: 6,
  },
  timerText: {
    fontSize: 14,
    color: "#2F6BFF",
    fontWeight: "600",
  },
  timerBold: {
    fontWeight: "800",
    color: "#2F6BFF",
  },
  resendText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "600",
  },
  resendDisabled: {
    opacity: 0.5,
  },
  spacer: {
    flex: 1,
  },
  verifyBtn: {
    backgroundColor: "#2F6BFF",
    borderRadius: 14,
    height: 54,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2F6BFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
