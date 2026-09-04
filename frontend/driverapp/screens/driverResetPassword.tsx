import React, { useState } from 'react';
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { resetDriverPassword } from '@/services/passwordResetApi';

export default function DriverResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ resetToken?: string }>();
  const resetToken = params.resetToken ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  function validate(): boolean {
    const next: { newPassword?: string; confirmPassword?: string } = {};
    if (!newPassword) next.newPassword = 'New password is required';
    else if (newPassword.length < 8) next.newPassword = 'Password must be at least 8 characters';
    if (!confirmPassword) next.confirmPassword = 'Please confirm your password';
    else if (newPassword !== confirmPassword) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const handleReset = async () => {
    if (!validate()) return;
    if (!resetToken) {
      Alert.alert('Session Expired', 'Please request a new verification code and try again.');
      router.replace('/forgot-password');
      return;
    }

    setIsLoading(true);
    try {
      await resetDriverPassword(resetToken, newPassword);
      Alert.alert(
        'Password Reset',
        'Your password has been reset successfully. Please log in with your new password.',
        [{ text: 'OK', onPress: () => router.replace('/login') }]
      );
    } catch (error: any) {
      Alert.alert('Could Not Reset Password', error.message || 'Please try again.');
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
          <Ionicons name="lock-closed" size={36} color="#2F6BFF" />
        </View>

        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter a new password for your driver account.</Text>

        <Text style={styles.label}>New Password</Text>
        <View style={[styles.inputContainer, errors.newPassword ? styles.inputError : null]}>
          <MaterialCommunityIcons name="lock-outline" size={21} color="#64748B" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter new password"
            placeholderTextColor="#999"
            value={newPassword}
            onChangeText={(t) => {
              setNewPassword(t);
              if (errors.newPassword) setErrors((e) => ({ ...e, newPassword: undefined }));
            }}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            editable={!isLoading}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowNewPassword((v) => !v)}
            disabled={isLoading}
          >
            <MaterialCommunityIcons name={showNewPassword ? 'eye-off' : 'eye'} size={22} color="#333" />
          </TouchableOpacity>
        </View>
        {errors.newPassword ? <Text style={styles.errorText}>{errors.newPassword}</Text> : null}

        <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
        <View style={[styles.inputContainer, errors.confirmPassword ? styles.inputError : null]}>
          <MaterialCommunityIcons name="lock-outline" size={21} color="#64748B" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Re-enter new password"
            placeholderTextColor="#999"
            value={confirmPassword}
            onChangeText={(t) => {
              setConfirmPassword(t);
              if (errors.confirmPassword) setErrors((e) => ({ ...e, confirmPassword: undefined }));
            }}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            editable={!isLoading}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowConfirmPassword((v) => !v)}
            disabled={isLoading}
          >
            <MaterialCommunityIcons name={showConfirmPassword ? 'eye-off' : 'eye'} size={22} color="#333" />
          </TouchableOpacity>
        </View>
        {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.resetButton, isLoading && styles.resetButtonDisabled]}
          onPress={handleReset}
          disabled={isLoading}
          activeOpacity={isLoading ? 1 : 0.7}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.resetButtonText}>Reset Password</Text>
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
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EBF1FF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingLeft: 14,
    paddingRight: 10,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 14,
    color: '#000',
  },
  eyeIcon: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 6,
  },
  spacer: {
    flex: 1,
  },
  resetButton: {
    backgroundColor: '#2F6BFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  resetButtonDisabled: {
    opacity: 0.7,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
});
