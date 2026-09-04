import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { resendDriverPasswordResetOtp, verifyDriverPasswordResetOtp } from '@/services/passwordResetApi';

const OTP_LENGTH = 6;
// Must match PasswordResetServiceImpl.RESEND_COOLDOWN_SECONDS on the backend.
const RESEND_SECONDS = 30;

export default function DriverResetOtpVerificationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
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
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function handleChange(text: string, index: number) {
    if (text.length > 1) {
      const chars = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH).split('');
      const next = [...otp];
      chars.forEach((c, i) => {
        if (index + i < OTP_LENGTH) next[index + i] = c;
      });
      setOtp(next);
      const focusIdx = Math.min(index + chars.length, OTP_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const digit = text.replace(/[^0-9]/g, '');
    const next = [...otp];
    next[index] = digit;
    setOtp(next);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
    }
  }

  const handleResend = async () => {
    if (!email) return;
    setIsResending(true);
    try {
      await resendDriverPasswordResetOtp(email);
      setTimer(RESEND_SECONDS);
      setCanResend(false);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } catch (error: any) {
      Alert.alert('Could Not Resend', error.message || 'Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < OTP_LENGTH) {
      Alert.alert('Incomplete Code', 'Please enter the full 6-digit code.');
      return;
    }
    if (!email) {
      Alert.alert('Missing Email', 'No email address was provided. Please go back and try again.');
      return;
    }

    setIsLoading(true);
    try {
      const { resetToken } = await verifyDriverPasswordResetOtp(email, code);
      router.replace({
        pathname: '/reset-password',
        params: { resetToken },
      });
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </Pressable>

        <View style={styles.iconCircle}>
          <Ionicons name="mail" size={36} color="#2F6BFF" />
        </View>

        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
        <Text style={styles.destination}>{email}</Text>

        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
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

        <View style={styles.timerRow}>
          {!canResend ? (
            <Text style={styles.timerText}>
              Resend code in <Text style={styles.timerBold}>{formatTime(timer)}</Text>
            </Text>
          ) : null}
          <Pressable onPress={canResend ? handleResend : undefined} disabled={!canResend || isResending}>
            <Text style={[styles.resendText, (!canResend || isResending) && styles.resendDisabled]}>
              {isResending ? 'Sending...' : 'Resend Code'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.verifyButton, isLoading && styles.verifyButtonDisabled]}
          onPress={handleVerify}
          disabled={isLoading}
          activeOpacity={isLoading ? 1 : 0.7}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 10,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2F6BFF',
    marginBottom: 4,
  },
  destination: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 32,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  otpBoxFilled: {
    borderColor: '#2F6BFF',
    backgroundColor: '#F0F5FF',
  },
  otpBoxActive: {
    borderColor: '#2F6BFF',
  },
  timerRow: {
    alignItems: 'center',
    gap: 6,
  },
  timerText: {
    fontSize: 14,
    color: '#2F6BFF',
    fontWeight: '600',
  },
  timerBold: {
    fontWeight: '800',
    color: '#2F6BFF',
  },
  resendText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  resendDisabled: {
    opacity: 0.5,
  },
  spacer: {
    flex: 1,
  },
  verifyButton: {
    backgroundColor: '#2F6BFF',
    borderRadius: 12,
    height: 54,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyButtonDisabled: {
    opacity: 0.7,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
