import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { httpPost } from "../../services/http";
import { useSession } from "../../store/sessionStore";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 165; // 2:45

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
  }>();
  const phone = params.phone ?? "+94 77 123 4567";
  const email = params.email ?? "";
  const [loading, setLoading] = useState(false);

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

  function handleResend() {
    setTimer(RESEND_SECONDS);
    setCanResend(false);
    setOtp(Array(OTP_LENGTH).fill(""));
    inputRefs.current[0]?.focus();
    Alert.alert("Code Sent", "A new verification code has been sent.");
  }

  async function handleVerify() {
    const code = otp.join("");
    if (code.length < OTP_LENGTH) {
      Alert.alert("Incomplete Code", "Please enter the full 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const userTypeParam = params.userType === "Corporate" ? "corporate" : "passenger";
      const payload = {
        email: params.email?.trim(),
        password: params.password,
        userType: userTypeParam,
      };

      const response = await httpPost<any>("/api/users", undefined, payload);
      const savedUser = response.data || response;

      const mappedUserType = userTypeParam === "corporate" ? "CORPORATE_USER" : "PASSENGER";
      await setCurrentUser({
        userId: savedUser.id,
        userType: mappedUserType,
      });

      Alert.alert("Verified", "Your account has been verified successfully!", [
        {
          text: "OK",
          onPress: () => {
            if (params.userType === "Corporate") {
              router.replace("/corporate/corporate-registration");
            } else {
              router.replace("/tabs");
            }
          },
        },
      ]);
    } catch (err: any) {
      let errorMsg = err.message;
      if (err.message && err.message.includes("{")) {
        try {
          const parsed = JSON.parse(err.message.substring(err.message.indexOf("{")));
          if (parsed.message) errorMsg = parsed.message;
        } catch {}
      }
      Alert.alert("Registration Failed", errorMsg || "Failed to create account. Please try again.");
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
          <Ionicons name="chatbubble" size={36} color="#2F6BFF" />
          <View style={styles.iconDot}>
            <View style={styles.iconDotInner} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Verify Your Number</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
        <Text style={styles.destination}>
          {phone}
          {email ? ` & ${email}` : ""}
        </Text>

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
              autoComplete={index === 0 ? "sms-otp" : "off"}
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
          <Pressable onPress={canResend ? handleResend : undefined} disabled={!canResend}>
            <Text style={[styles.resendText, !canResend && styles.resendDisabled]}>
              Resend Code
            </Text>
          </Pressable>
        </View>

        <View style={styles.spacer} />

        {/* Verify button */}
        <TouchableOpacity
          style={[styles.verifyBtn, loading && { opacity: 0.7 }]}
          onPress={handleVerify}
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
    fontSize: 26,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: "#2F6BFF",
    marginBottom: 4,
  },
  destination: {
    fontSize: 15,
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
    fontSize: 22,
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
    fontSize: 17,
    fontWeight: "700",
  },
});