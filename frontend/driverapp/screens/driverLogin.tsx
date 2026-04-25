import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons,MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

export default function DriverLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('driver2@mail.com');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
  setIsLoading(true);

  setTimeout(() => {
    setIsLoading(false);
    router.replace('/(tabs)');
  }, 1000);};

  const handleGoogleLogin = () => {
    console.log('Google login pressed');
    // Implement Google login logic
  };

  const handleFacebookLogin = () => {
    console.log('Facebook login pressed');
    // Implement Facebook login logic
  };

  const handleForgotPassword = () => {
    console.log('Forgot password link pressed');
    // Navigate to forgot password screen
    // router.push('/forgot-password');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TrackNGo Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconBox}>
            <Ionicons name="bus" size={80} color="#ffffff" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.welcomeTitle}>Driver Login</Text>
        <Text style={styles.appName}>TrackNGo</Text>

        {/* Email/Phone Input */}
        <View style={styles.formContainer}>
          <Text style={styles.label}>Email or Phone Number</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter email or phone"
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#999"
              keyboardType="email-address"
              editable={!isLoading}
            />
          </View>

          {/* Password Input */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#999"
              secureTextEntry={!showPassword}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off' : 'eye'}
                size={24}
                color="#333"
              />
            </TouchableOpacity>
          </View>

          {/* Remember Me & Forgot Password */}
          <View style={styles.bottomOptionsContainer}>
            <TouchableOpacity
              style={styles.rememberContainer}
              onPress={() => setRememberMe(!rememberMe)}
              disabled={isLoading}
            >
              <View style={[styles.checkBox, rememberMe && styles.checkBoxChecked]}>
                {rememberMe && (
                  <MaterialCommunityIcons name="check" size={16} color="#0066FF" />
                )}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleForgotPassword}
              disabled={isLoading}
            >
              <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={isLoading ? 1 : 0.7}
          >
            <Text style={styles.loginButtonText}>
              {isLoading ? 'Logging in...' : 'Log In'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or login with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Login Buttons */}
          <View style={styles.socialButtonsContainer}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleGoogleLogin}
              disabled={isLoading}
            >
              <FontAwesome name="google" size={20} color="#EA4335" />
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleFacebookLogin}
              disabled={isLoading}
            >
              <FontAwesome name="facebook" size={20} color="#1877F2" />
              <Text style={styles.socialButtonText}>Facebook</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
    justifyContent: 'flex-start',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: height > 600 ? 40 : 20,
  },
  iconBox: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: '#0066FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 5,
  },
  appName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#999',
    textAlign: 'center',
    marginBottom: 40,
  },
  formContainer: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
    marginTop: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 20,
    paddingRight: 10,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#000',
  },
  eyeIcon: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  bottomOptionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#0066FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkBoxChecked: {
    backgroundColor: '#0066FF',
  },
  rememberText: {
    fontSize: 14,
    color: '#000',
  },
  forgotPasswordLink: {
    fontSize: 14,
    color: '#0066FF',
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#0066FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
});
