import React, { useState } from 'react'; // change usestate dynamically
import {
  View,
  Text,
  TextInput, // To create input fields
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions, // To get screen dimensions for responsive design
  Platform, // To adjust keyboard behavior based on platform
  KeyboardAvoidingView, // To avoid keyboard overlap
  Alert,
} from 'react-native'; // To build UI
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons,MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; // Navigate between screens in the app
import { driverLogin } from "../services/auth"; //driverLogin function from the auth service 
import AsyncStorage from "@react-native-async-storage/async-storage"; // For storing user data and token permanently on the device.
import { useUser } from '@/context/UserContext'; //update user state across the app
import { requestLocationOnSignIn } from '@/utils/locationSharing';

const { width, height } = Dimensions.get('window'); // Get screen dimensions

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function DriverLoginScreen() {   //default finction because we are using expo router
  const router = useRouter();  //expo router, file based nav
  const { setUser } = useUser(); // Get the setUser function from the user context(store user data and token)
  const [email, setEmail] = useState<string>('');  //must be a string
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const clearError = (field: 'email' | 'password') => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validate = (): boolean => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Email is required';
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
  if (!validate()) return;
  setIsLoading(true); //when login process starts

  try {
    const res = await driverLogin(email, password); // from auth service

    console.log("Final Response:", res); // Log the full response 

    const authData = res.data || res; // Adjust based on actual response structure, if the response is just the data object, use res directly, otherwise use res.data

    if (authData.userType === "driver") {
      if (authData.twoFactorRequired) {
        // Password matched, but this driver has email two-factor authentication
        // turned on, so a code was just emailed to them. They must verify it
        // before we issue the real session token.
        router.push({
          pathname: "/two-factor-verification",
          params: { challengeToken: authData.twoFactorToken, email: authData.email },
        });
        return;
      }

      const userData = { // Adjust these fields based the actual response structure
        userId: authData.userId,
        firstName: authData.firstName,
        lastName: authData.lastName,
        email: authData.email,
        token: authData.token,
      };


      setUser(userData); // Update the user context

      // Store in AsyncStorage for persistence
      await AsyncStorage.setItem("user", JSON.stringify(userData)); //userData object into a string format to store
      await AsyncStorage.setItem("token", authData.token); // Store the token in AsyncStorage

      router.replace("/(tabs)"); // Navigate to dashboard
      // Raised after the transition rather than before it, so the dashboard is
      // already behind the device's dialog when the choice is made.
      void requestLocationOnSignIn();
    }
    else {
      Alert.alert("Login Failed", "Not a driver account");
    }

  } catch (error: any) {
    console.log("LOGIN ERROR:", error.message);
    Alert.alert("Login Failed", error.message || "Login failed");
  } finally {
    setIsLoading(false); // Reset loading state 
  }
};

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} // Adjust behavior based on platform 
      style={styles.container}
    >
      <ScrollView  //allow content to be scrollable 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* TrackNGo Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconBox}>
            <Ionicons name="bus" size={40} color="#ffffff" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.welcomeTitle}>Driver Login</Text>
        <Text style={styles.appName}>TrackNGo</Text>

        {/* Email/Phone Input */}
        <View style={styles.formContainer}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputContainer, errors.email && styles.inputContainerError]}>
            <MaterialCommunityIcons
              name="email-outline"
              size={21}
              color="#64748B"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={(text) => { setEmail(text); clearError('email'); }}
              placeholderTextColor="#999"
              keyboardType="email-address" // Show email keyboard
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}  // Disable input when loading
            />
          </View>
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

          {/* Password Input */}
          <Text style={styles.label}>Password</Text>
          <View style={[styles.inputContainer, errors.password && styles.inputContainerError]}>
            <MaterialCommunityIcons
              name="lock-outline"
              size={21}
              color="#64748B"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              value={password}
              onChangeText={(text) => { setPassword(text); clearError('password'); }}
              placeholderTextColor="#999"
              secureTextEntry={!showPassword} // Hide password when showPassword is false
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)} // Toggle password visibility
              disabled={isLoading}
            >
              <MaterialCommunityIcons
                name={showPassword ? 'eye-off' : 'eye'}
                size={24}
                color="#333"
              />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

          {/* Remember Me & Forgot Password */}
          <View style={styles.bottomOptionsContainer}>
            <TouchableOpacity
              style={styles.rememberContainer}
              onPress={() => setRememberMe(!rememberMe)} // when pressed,toggle
              disabled={isLoading} 
            >
              <View style={[styles.checkBox, rememberMe && styles.checkBoxChecked]}>
                {rememberMe && (  
                  <MaterialCommunityIcons name="check" size={16} color="#E2E8F0" />
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
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} // Disable button and change style when loading
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={isLoading ? 1 : 0.7} // Prevent button from dimming when loading
          >
            <Text style={styles.loginButtonText}>
              {isLoading ? 'Logging in...' : 'Log In'} 
            </Text> 
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
    justifyContent: 'flex-start',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: height > 600 ? 40 : 20,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#2F6BFF',
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
    fontWeight: "700",
    color: '#000',
    textAlign: 'center',
    marginBottom: 5,
  },
  appName: {
    fontSize: 18,
    fontWeight: "500",
    color: '#999',
    textAlign: 'center',
    marginBottom: 40,
  },
  formContainer: {
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
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
    borderColor: '#E2E8F0',
    marginBottom: 20,
    paddingLeft: 14,
    paddingRight: 10,
    overflow: 'hidden',
  },
  inputContainerError: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: -14,
    marginBottom: 14,
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
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkBoxChecked: {
    backgroundColor: '#2F6BFF',
  },
  rememberText: {
    fontSize: 14,
    color: '#000',
  },
  forgotPasswordLink: {
    fontSize: 14,
    color: '#2F6BFF',
    fontWeight: "500",
  },
  loginButton: {
    backgroundColor: '#2F6BFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#2F6BFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 14,
    fontWeight: "700",
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
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#999',
    fontWeight: "500",
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
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: '#000',
  },
});
