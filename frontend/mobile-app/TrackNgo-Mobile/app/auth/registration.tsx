import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LocalizedText as Text, LocalizedTextInput as TextInput } from "../../utils/i18n";
import { sendRegistrationOtp } from "../../services/registrationOtpApi";
import { isRealProfileText, isValidProfileEmail, isValidSriLankanPhone } from "../../services/corporateApi";
import { SRI_LANKAN_INDUSTRIES } from "../../utils/industries";

type UserType = "Passenger" | "Corporate";

export default function RegistrationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [userType, setUserType] = useState<UserType>("Passenger");

  // Passenger fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Corporate — Company Information
  const [companyName, setCompanyName] = useState("");
  const [brn, setBrn] = useState("");
  const [industry, setIndustry] = useState("Private Transport");
  const [address, setAddress] = useState("");
  const [showIndustryModal, setShowIndustryModal] = useState(false);

  // Corporate — Contact Person
  const [contactName, setContactName] = useState("");
  const [designation, setDesignation] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Shared — account credentials
  const [email, setEmail] = useState("");
  const [countryCode] = useState("+94");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const isCorporate = userType === "Corporate";

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (isCorporate) {
      if (!isRealProfileText(companyName, 2)) next.companyName = "Enter your real company name";
      if (!isRealProfileText(brn, 3)) next.brn = "Enter a real business registration number";
      if (!SRI_LANKAN_INDUSTRIES.includes(industry)) next.industry = "Select an industry from the list";
      if (!isRealProfileText(address, 5)) next.address = "Enter your real company address";
      if (!isRealProfileText(contactName, 2)) next.contactName = "Enter the contact person's real name";
      if (!isRealProfileText(designation, 2)) next.designation = "Enter a real designation";
      if (!contactPhone.trim()) next.contactPhone = "Phone number is required";
      else if (!isValidSriLankanPhone(contactPhone)) next.contactPhone = "Enter a valid Sri Lankan phone number";
    } else {
      if (!isRealProfileText(firstName, 2)) next.firstName = "Enter your real first name";
      if (!isRealProfileText(lastName, 2)) next.lastName = "Enter your real last name";
      if (!phone.trim()) next.phone = "Phone number is required";
      else if (!isValidSriLankanPhone(phone)) next.phone = "Enter a valid Sri Lankan phone number";
    }

    if (!email.trim()) next.email = "Email is required";
    else if (!isValidProfileEmail(email)) next.email = "Enter a valid email";

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
        params: isCorporate
          ? {
              email: trimmedEmail,
              userType,
              password,
              companyName: companyName.trim(),
              businessRegistrationNumber: brn.trim(),
              industry,
              address: address.trim(),
              contactPersonName: contactName.trim(),
              contactPersonDesignation: designation.trim(),
              contactPhone: contactPhone.trim(),
            }
          : {
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
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 4 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          {/* Back button and title share one row: on its own line the button left a
              48px band of empty space above a centred title. */}
          <View style={styles.headerRow}>
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

            {/* Balances the back button so the title stays optically centred. */}
            <View style={styles.headerSpacer} />
          </View>

          {/* Step indicator */}
          <View style={styles.stepRow}>
            <Text style={styles.stepLabel}>Step 1 of 3</Text>
            <Text style={styles.stepName}>{isCorporate ? "Company Details" : "Personal Info"}</Text>
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

        {isCorporate ? (
          <>
            {/* Company Information */}
            <Text style={styles.sectionTitle}>Company Information</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Company Name</Text>
              <View style={[styles.inputRow, errors.companyName ? styles.inputRowError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Ceylon Cargo Solutions (Pvt) Ltd"
                  placeholderTextColor="#B0BAC9"
                  value={companyName}
                  onChangeText={(t) => { setCompanyName(t); clearError("companyName"); }}
                />
              </View>
              {errors.companyName ? <Text style={styles.errorText}>{errors.companyName}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Business Registration No.</Text>
              <View style={[styles.inputRow, errors.brn ? styles.inputRowError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. PV 00123456"
                  placeholderTextColor="#B0BAC9"
                  value={brn}
                  onChangeText={(t) => { setBrn(t); clearError("brn"); }}
                  autoCapitalize="characters"
                />
              </View>
              {errors.brn ? <Text style={styles.errorText}>{errors.brn}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Industry</Text>
              <Pressable
                style={[styles.inputRow, errors.industry ? styles.inputRowError : null]}
                onPress={() => setShowIndustryModal(true)}
              >
                <Text style={styles.dropdownText}>{industry}</Text>
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              </Pressable>
              {errors.industry ? <Text style={styles.errorText}>{errors.industry}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Address</Text>
              <View style={[styles.inputRow, errors.address ? styles.inputRowError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. No. 45, Galle Road, Colombo 03"
                  placeholderTextColor="#B0BAC9"
                  value={address}
                  onChangeText={(t) => { setAddress(t); clearError("address"); }}
                />
              </View>
              {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}
            </View>

            {/* Contact Person */}
            <Text style={styles.sectionTitle}>Contact Person</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputRow, errors.contactName ? styles.inputRowError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Kasun Perera"
                  placeholderTextColor="#B0BAC9"
                  value={contactName}
                  onChangeText={(t) => { setContactName(t); clearError("contactName"); }}
                  autoCapitalize="words"
                />
              </View>
              {errors.contactName ? <Text style={styles.errorText}>{errors.contactName}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Designation</Text>
              <View style={[styles.inputRow, errors.designation ? styles.inputRowError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. HR Manager"
                  placeholderTextColor="#B0BAC9"
                  value={designation}
                  onChangeText={(t) => { setDesignation(t); clearError("designation"); }}
                />
              </View>
              {errors.designation ? <Text style={styles.errorText}>{errors.designation}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={[styles.inputRow, errors.email ? styles.inputRowError : null]}>
                <Ionicons name="mail" size={18} color="#9AA4B2" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. hr@company.lk"
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

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[styles.inputRow, errors.contactPhone ? styles.inputRowError : null]}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. +94 77 123 4567"
                  placeholderTextColor="#B0BAC9"
                  value={contactPhone}
                  onChangeText={(t) => { setContactPhone(t); clearError("contactPhone"); }}
                  keyboardType="phone-pad"
                />
              </View>
              {errors.contactPhone ? <Text style={styles.errorText}>{errors.contactPhone}</Text> : null}
            </View>
          </>
        ) : (
          <>
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
          </>
        )}

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
          style={[styles.nextBtn, !agreeTerms && styles.nextBtnLocked, submitting && { opacity: 0.7 }]}
          onPress={() => void handleNext()}
          activeOpacity={0.85}
          disabled={submitting || !agreeTerms}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={[styles.nextBtnText, !agreeTerms && styles.nextBtnTextLocked]}>Next</Text>
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

      {/* Industry Dropdown Modal */}
      <Modal visible={showIndustryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Industry</Text>
              <TouchableOpacity onPress={() => setShowIndustryModal(false)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={SRI_LANKAN_INDUSTRIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setIndustry(item);
                    clearError("industry");
                    setShowIndustryModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, industry === item && styles.modalItemTextActive]}>
                    {item}
                  </Text>
                  {industry === item && <Ionicons name="checkmark" size={20} color="#2F6BFF" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
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
    // Top padding comes from the safe-area inset at render time; the old fixed 56
    // cleared the status bar on one device and left a gap on every other.
    paddingBottom: 40,
  },
  header: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  backBtn: {
    // Pulled left so the icon's optical edge lines up with the form fields below
    // rather than the touch target's edge.
    marginLeft: -8,
    width: 36,
    height: 36,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2937",
    textAlign: "center",
  },
  // Matches the back button's visible width (36 less its -8 offset).
  headerSpacer: {
    width: 28,
  },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
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
    marginBottom: 14,
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
    fontSize: 19,
    fontWeight: "800",
    color: "#1F2937",
    lineHeight: 25,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1F2937",
    marginTop: 12,
    marginBottom: 4,
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
  dropdownText: {
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
  /* Until the terms are accepted the button reads as unavailable rather than
     inviting a tap it would only reject. The lift and glow return with the colour. */
  nextBtnLocked: {
    backgroundColor: "#E2E8F0",
    shadowOpacity: 0,
    elevation: 0,
  },
  nextBtnTextLocked: {
    color: "#94A3B8",
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
  // Industry dropdown modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  modalItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalItemText: {
    fontSize: 16,
    color: "#374151",
  },
  modalItemTextActive: {
    color: "#2F6BFF",
    fontWeight: "600",
  },
});
