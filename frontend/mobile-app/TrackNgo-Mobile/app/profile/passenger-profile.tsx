import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { useSession } from "../../store/sessionStore";
import { useLanguage } from "../../utils/i18n";
import { HttpError, setAuthToken } from "../../services/http";
import {
  deleteProfilePicture,
  getUserProfile,
  resolveProfilePhoto,
  updateUserProfile,
  uploadProfilePicture,
} from "../../services/userProfileApi";
import {
  changePassword,
  getUserSettings,
  type ProfileLanguage,
  type UserSettings,
  updateUserSettings,
} from "../../services/profileSettingsApi";
import type { UserProfile } from "../../types/chat";
import { ProfileAvatarPlaceholder } from "../../components/ProfileAvatarPlaceholder";
import {
  beginTwoFactorSetup,
  disableTwoFactor,
  enableTwoFactor,
  type TwoFactorSetup,
} from "../../services/twoFactorApi";
import { clearTrustedDeviceToken, saveTrustedDeviceToken } from "../../services/trustedDeviceStorage";

const BLUE = "#2378E8";
const AVATAR_SIZE = 112;

const profileCopy = {
  en: {
    header: "Profile & Settings",
    completion: "Profile Completion",
    bankHint: "Complete your profile details to reach 100%",
    professional: "Professional Details",
    fullName: "Full Name",
    email: "E - mail Address",
    changePassword: "Change Password",
    mobile: "Mobile Number",
    notProvided: "Not provided",
    settings: "Settings",
    language: "Language",
    english: "English",
    sinhala: "Sinhala",
    tamil: "Tamil",
    userId: "ID",
    privacy: "Privacy",
    twoFactor: "Two-Factor Authentication",
    twoFactorSetupTitle: "Set up two-factor authentication",
    twoFactorSetupInstructions: "Scan this QR code with Google Authenticator, Aegis, or Microsoft Authenticator, then enter the 6-digit code.",
    twoFactorSecret: "Manual setup key",
    twoFactorAuthenticatorHint: "Keep this key private. It can be used if you cannot scan the QR code.",
    twoFactorCodePlaceholder: "6-digit authenticator code",
    twoFactorEnable: "Enable",
    twoFactorDisableTitle: "Disable two-factor authentication",
    twoFactorDisableInstructions: "Enter the current code from your authenticator app to disable two-factor authentication.",
    twoFactorDisable: "Disable",
    twoFactorVerify: "Verify code",
    twoFactorEnabled: "Two-factor authentication enabled",
    twoFactorEnabledMessage: "New devices will require an authenticator code. This device will be remembered for 180 days.",
    twoFactorDisabled: "Two-factor authentication disabled",
    twoFactorDisabledMessage: "Authenticator verification has been removed from login.",
    twoFactorError: "Could not update two-factor authentication",
    supportLegal: "Support & Legal",
    terms: "Terms & Conditions",
    termsHint: "View our terms and conditions",
    logout: "Log Out",
    loggingOut: "Logging out...",
    unavailable: "Profile information is unavailable.",
    retry: "Retry",
    editProfile: "Edit Profile",
    namePlaceholder: "Full name",
    emailPlaceholder: "Email address",
    mobilePlaceholder: "Mobile number",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving...",
    selectLanguage: "Select Language",
    passwordTitle: "Change Password",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    update: "Update",
    updating: "Updating...",
    passenger: "Passenger",
    unableLoad: "Unable to load profile",
    missingDetails: "Missing details",
    nameEmailRequired: "Name and email are required.",
    saveProfileError: "Could not save profile",
    permissionRequired: "Permission required",
    photoPermission: "Allow photo access to change your profile picture.",
    updatePhotoError: "Could not update photo",
    photoTitle: "Profile picture",
    photoChoose: "Choose a new photo",
    photoRemove: "Remove photo",
    photoRemoveTitle: "Remove photo?",
    photoRemoveConfirm: "Your profile picture will be deleted.",
    removePhotoError: "Could not remove photo",
    saveSettingError: "Could not save setting",
    saveLanguageError: "Could not save language",
    completePassword: "Complete all password fields.",
    passwordUpdated: "Password updated",
    passwordSuccess: "Your password was changed successfully.",
    changePasswordError: "Could not change password",
    logoutTitle: "Logout",
    logoutConfirm: "Are you sure you want to logout?",
    logoutAccount: "Logout",
    termsTitle: "Terms & Conditions",
    termsMessage: "TrackNGo terms and conditions will be available here.",
    tryAgain: "Please try again.",
  },
  si: {
    header: "පැතිකඩ සහ සැකසුම්",
    completion: "පැතිකඩ සම්පූර්ණත්වය",
    bankHint: "පැතිකඩ 100%ක් සම්පූර්ණ කිරීමට ඔබගේ සියලු විස්තර එක් කරන්න",
    professional: "පෞද්ගලික විස්තර",
    fullName: "සම්පූර්ණ නම",
    email: "විද්‍යුත් තැපැල් ලිපිනය",
    changePassword: "මුරපදය වෙනස් කරන්න",
    mobile: "ජංගම දුරකථන අංකය",
    notProvided: "සපයා නැත",
    settings: "සැකසුම්",
    language: "භාෂාව",
    english: "ඉංග්‍රීසි",
    sinhala: "සිංහල",
    tamil: "දෙමළ",
    userId: "හඳුනාගැනීමේ අංකය",
    privacy: "පෞද්ගලිකත්වය",
    twoFactor: "ද්වි-සාධක සත්‍යාපනය",
    twoFactorSetupTitle: "ද්වි-සාධක සත්‍යාපනය සකසන්න",
    twoFactorSetupInstructions: "මෙම QR කේතය Google Authenticator, Aegis හෝ Microsoft Authenticator යෙදුමකින් ස්කෑන් කර අංක 6ක කේතය ඇතුළත් කරන්න.",
    twoFactorSecret: "අතින් සකස් කිරීමේ යතුර",
    twoFactorAuthenticatorHint: "මෙම යතුර රහසිගතව තබාගන්න. QR කේතය ස්කෑන් කළ නොහැකි නම් එය භාවිත කළ හැකිය.",
    twoFactorCodePlaceholder: "Authenticator අංක 6ක කේතය",
    twoFactorEnable: "සක්‍රිය කරන්න",
    twoFactorDisableTitle: "ද්වි-සාධක සත්‍යාපනය අක්‍රිය කරන්න",
    twoFactorDisableInstructions: "ද්වි-සාධක සත්‍යාපනය අක්‍රිය කිරීමට ඔබගේ Authenticator යෙදුමේ වත්මන් කේතය ඇතුළත් කරන්න.",
    twoFactorDisable: "අක්‍රිය කරන්න",
    twoFactorVerify: "කේතය තහවුරු කරන්න",
    twoFactorEnabled: "ද්වි-සාධක සත්‍යාපනය සක්‍රියයි",
    twoFactorEnabledMessage: "නව උපාංගවලදී Authenticator කේතයක් අවශ්‍ය වේ. මෙම උපාංගය දින 180ක් මතක තබාගනු ඇත.",
    twoFactorDisabled: "ද්වි-සාධක සත්‍යාපනය අක්‍රියයි",
    twoFactorDisabledMessage: "ඇතුළු වීමේදී Authenticator සත්‍යාපනය ඉවත් කරන ලදී.",
    twoFactorError: "ද්වි-සාධක සත්‍යාපනය යාවත්කාලීන කළ නොහැක",
    supportLegal: "සහාය සහ නීතිමය තොරතුරු",
    terms: "නියමයන් සහ කොන්දේසි",
    termsHint: "අපගේ නියමයන් සහ කොන්දේසි බලන්න",
    logout: "ඉවත් වන්න",
    loggingOut: "ඉවත් වෙමින්...",
    unavailable: "පැතිකඩ තොරතුරු ලබාගත නොහැක.",
    retry: "නැවත උත්සාහ කරන්න",
    editProfile: "පැතිකඩ සංස්කරණය",
    namePlaceholder: "සම්පූර්ණ නම",
    emailPlaceholder: "විද්‍යුත් තැපැල් ලිපිනය",
    mobilePlaceholder: "ජංගම දුරකථන අංකය",
    cancel: "අවලංගු කරන්න",
    save: "සුරකින්න",
    saving: "සුරකිමින්...",
    selectLanguage: "භාෂාව තෝරන්න",
    passwordTitle: "මුරපදය වෙනස් කරන්න",
    currentPassword: "වත්මන් මුරපදය",
    newPassword: "නව මුරපදය",
    confirmPassword: "නව මුරපදය තහවුරු කරන්න",
    update: "යාවත්කාලීන කරන්න",
    updating: "යාවත්කාලීන කරමින්...",
    passenger: "මගියා",
    unableLoad: "පැතිකඩ පූරණය කළ නොහැක",
    missingDetails: "අවශ්‍ය තොරතුරු නොමැත",
    nameEmailRequired: "නම සහ විද්‍යුත් තැපැල් ලිපිනය අවශ්‍ය වේ.",
    saveProfileError: "පැතිකඩ සුරැකිය නොහැක",
    permissionRequired: "අවසර අවශ්‍යයි",
    photoPermission: "ඔබගේ පැතිකඩ ඡායාරූපය වෙනස් කිරීමට ඡායාරූප වෙත ප්‍රවේශ වීමට අවසර දෙන්න.",
    updatePhotoError: "ඡායාරූපය යාවත්කාලීන කළ නොහැක",
    photoTitle: "පැතිකඩ ඡායාරූපය",
    photoChoose: "නව ඡායාරූපයක් තෝරන්න",
    photoRemove: "ඡායාරූපය ඉවත් කරන්න",
    photoRemoveTitle: "ඡායාරූපය ඉවත් කරන්නද?",
    photoRemoveConfirm: "ඔබගේ පැතිකඩ ඡායාරූපය මකා දමනු ලැබේ.",
    removePhotoError: "ඡායාරූපය ඉවත් කළ නොහැක",
    saveSettingError: "සැකසුම සුරැකිය නොහැක",
    saveLanguageError: "භාෂාව සුරැකිය නොහැක",
    completePassword: "මුරපද ක්ෂේත්‍ර සියල්ල පුරවන්න.",
    passwordUpdated: "මුරපදය යාවත්කාලීන කරන ලදී",
    passwordSuccess: "ඔබගේ මුරපදය සාර්ථකව වෙනස් කරන ලදී.",
    changePasswordError: "මුරපදය වෙනස් කළ නොහැක",
    logoutTitle: "ඉවත් වීම",
    logoutConfirm: "ඔබට ඉවත් වීමට අවශ්‍ය බව විශ්වාසද?",
    logoutAccount: "ඉවත් වන්න",
    termsTitle: "නියමයන් සහ කොන්දේසි",
    termsMessage: "TrackNGo නියමයන් සහ කොන්දේසි මෙහි ලබා ගත හැක.",
    tryAgain: "කරුණාකර නැවත උත්සාහ කරන්න.",
  },
  ta: {
    header: "சுயவிவரம் & அமைப்புகள்",
    completion: "சுயவிவர நிறைவு",
    bankHint: "100% அடைய உங்கள் சுயவிவர விவரங்களை நிறைவு செய்யவும்",
    professional: "தனிப்பட்ட விவரங்கள்",
    fullName: "முழு பெயர்",
    email: "மின்னஞ்சல் முகவரி",
    changePassword: "கடவுச்சொல்லை மாற்றவும்",
    mobile: "மொபைல் எண்",
    notProvided: "வழங்கப்படவில்லை",
    settings: "அமைப்புகள்",
    language: "மொழி",
    english: "ஆங்கிலம்",
    sinhala: "சிங்களம்",
    tamil: "தமிழ்",
    userId: "ஐடி",
    privacy: "தனியுரிமை",
    twoFactor: "இரு-காரணி அங்கீகாரம்",
    twoFactorSetupTitle: "இரு-காரணி அங்கீகாரத்தை அமைக்கவும்",
    twoFactorSetupInstructions: "Google Authenticator, Aegis அல்லது Microsoft Authenticator மூலம் இந்த QR குறியீட்டை ஸ்கேன் செய்து, 6 இலக்க குறியீட்டை உள்ளிடவும்.",
    twoFactorSecret: "கைமுறை அமைப்பு விசை",
    twoFactorAuthenticatorHint: "இந்த விசையை ரகசியமாக வைத்திருங்கள். QR குறியீட்டை ஸ்கேன் செய்ய முடியாவிட்டால் இதைப் பயன்படுத்தலாம்.",
    twoFactorCodePlaceholder: "6 இலக்க அங்கீகார குறியீடு",
    twoFactorEnable: "இயக்கு",
    twoFactorDisableTitle: "இரு-காரணி அங்கீகாரத்தை முடக்கவும்",
    twoFactorDisableInstructions: "இரு-காரணி அங்கீகாரத்தை முடக்க உங்கள் அங்கீகார பயன்பாட்டிலிருந்து தற்போதைய குறியீட்டை உள்ளிடவும்.",
    twoFactorDisable: "முடக்கு",
    twoFactorVerify: "குறியீட்டை சரிபார்க்கவும்",
    twoFactorEnabled: "இரு-காரணி அங்கீகாரம் இயக்கப்பட்டது",
    twoFactorEnabledMessage: "புதிய சாதனங்களுக்கு அங்கீகார குறியீடு தேவைப்படும். இந்த சாதனம் 180 நாட்களுக்கு நினைவில் வைக்கப்படும்.",
    twoFactorDisabled: "இரு-காரணி அங்கீகாரம் முடக்கப்பட்டது",
    twoFactorDisabledMessage: "உள்நுழைவிலிருந்து அங்கீகார சரிபார்ப்பு அகற்றப்பட்டது.",
    twoFactorError: "இரு-காரணி அங்கீகாரத்தை புதுப்பிக்க முடியவில்லை",
    supportLegal: "ஆதரவு & சட்டம்",
    terms: "விதிமுறைகள் மற்றும் நிபந்தனைகள்",
    termsHint: "எங்கள் விதிமுறைகள் மற்றும் நிபந்தனைகளைக் காண்க",
    logout: "வெளியேறு",
    loggingOut: "வெளியேறுகிறது...",
    unavailable: "சுயவிவரத் தகவல் கிடைக்கவில்லை.",
    retry: "மீண்டும் முயற்சிக்கவும்",
    editProfile: "சுயவிவரத்தைத் திருத்து",
    namePlaceholder: "முழு பெயர்",
    emailPlaceholder: "மின்னஞ்சல் முகவரி",
    mobilePlaceholder: "மொபைல் எண்",
    cancel: "ரத்து செய்",
    save: "சேமி",
    saving: "சேமிக்கிறது...",
    selectLanguage: "மொழியைத் தேர்ந்தெடுக்கவும்",
    passwordTitle: "கடவுச்சொல்லை மாற்றவும்",
    currentPassword: "தற்போதைய கடவுச்சொல்",
    newPassword: "புதிய கடவுச்சொல்",
    confirmPassword: "புதிய கடவுச்சொல்லை உறுதிப்படுத்தவும்",
    update: "புதுப்பிக்கவும்",
    updating: "புதுப்பிக்கிறது...",
    passenger: "பயணி",
    unableLoad: "சுயவிவரத்தை ஏற்ற முடியவில்லை",
    missingDetails: "விவரங்கள் இல்லை",
    nameEmailRequired: "பெயர் மற்றும் மின்னஞ்சல் தேவை.",
    saveProfileError: "சுயவிவரத்தை சேமிக்க முடியவில்லை",
    permissionRequired: "அனுமதி தேவை",
    photoPermission: "உங்கள் சுயவிவரப் படத்தை மாற்ற புகைப்படங்களை அணுக அனுமதிக்கவும்.",
    updatePhotoError: "படத்தை புதுப்பிக்க முடியவில்லை",
    photoTitle: "சுயவிவரப் படம்",
    photoChoose: "புதிய படத்தைத் தேர்ந்தெடுக்கவும்",
    photoRemove: "படத்தை நீக்கவும்",
    photoRemoveTitle: "படத்தை நீக்கவா?",
    photoRemoveConfirm: "உங்கள் சுயவிவரப் படம் நீக்கப்படும்.",
    removePhotoError: "படத்தை நீக்க முடியவில்லை",
    saveSettingError: "அமைப்பை சேமிக்க முடியவில்லை",
    saveLanguageError: "மொழியை சேமிக்க முடியவில்லை",
    completePassword: "அனைத்து கடவுச்சொல் புலங்களையும் நிரப்பவும்.",
    passwordUpdated: "கடவுச்சொல் புதுப்பிக்கப்பட்டது",
    passwordSuccess: "உங்கள் கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது.",
    changePasswordError: "கடவுச்சொல்லை மாற்ற முடியவில்லை",
    logoutTitle: "வெளியேறு",
    logoutConfirm: "நீங்கள் வெளியேற விரும்புகிறீர்களா?",
    logoutAccount: "வெளியேறு",
    termsTitle: "விதிமுறைகள் மற்றும் நிபந்தனைகள்",
    termsMessage: "TrackNGo இன் விதிமுறைகள் மற்றும் நிபந்தனைகள் இங்கே கிடைக்கும்.",
    tryAgain: "மீண்டும் முயற்சிக்கவும்.",
  },
} as const;

function DetailRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.detailRow} onPress={onPress} disabled={!onPress}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={20} color="#55585D" />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color="#8A9099" /> : null}
    </Pressable>
  );
}

function PasswordField({
  placeholder,
  value,
  onChangeText,
  visible,
  onToggleVisible,
}: {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  return (
    <View style={styles.passwordFieldWrap}>
      <TextInput
        style={styles.passwordInput}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
      />
      <Pressable style={styles.passwordToggle} onPress={onToggleVisible} hitSlop={10}>
        <Ionicons name={visible ? "eye-off" : "eye"} size={20} color="#7B828D" />
      </Pressable>
    </View>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {subtitle ? <Text style={styles.toggleSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#D3D7DE", true: "#B8D4FA" }}
        thumbColor={value ? BLUE : "#FFFFFF"}
        ios_backgroundColor="#D3D7DE"
      />
    </View>
  );
}

export default function PassengerProfileScreen() {
  const router = useRouter();
  const { currentUser, clearCurrentUser } = useSession();
  const { setLanguage: setAppLanguage } = useLanguage();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Remembers the photo URL that failed to load rather than a plain boolean,
  // so uploading a replacement clears the failure by itself.
  const [failedPhotoUri, setFailedPhotoUri] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [twoFactorVisible, setTwoFactorVisible] = useState(false);
  const [twoFactorMode, setTwoFactorMode] = useState<"enable" | "disable">("enable");
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorBusy, setTwoFactorBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const userId = currentUser?.userId;
  const copy = profileCopy[settings?.language === "si" || settings?.language === "ta" ? settings.language : "en"];

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [loadedProfile, loadedSettings] = await Promise.all([
        getUserProfile(userId),
        getUserSettings(userId),
      ]);
      setProfile(loadedProfile);
      setSettings(loadedSettings);
    } catch (error) {
      if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
        // clearCurrentUser also drops the token.
        await clearCurrentUser();
        Alert.alert(
          "Session expired",
          "Please log in again to continue.",
        );
        router.replace("/auth/login");
        return;
      }
      Alert.alert(profileCopy.en.unableLoad, error instanceof Error ? error.message : profileCopy.en.tryAgain);
    } finally {
      setLoading(false);
    }
  }, [userId, clearCurrentUser, router]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const completion = useMemo(() => {
    if (!profile) return 0;
    const completed = [profile.fullName, profile.email, profile.phoneNumber].filter(Boolean).length;
    return [0, 30, 55, 85][completed];
  }, [profile]);

  const openEdit = () => {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setEmail(profile.email ?? "");
    setPhoneNumber(profile.phoneNumber ?? "");
    setEditVisible(true);
  };

  const saveProfile = async () => {
    if (!userId || !fullName.trim() || !email.trim()) {
      Alert.alert(copy.missingDetails, copy.nameEmailRequired);
      return;
    }
    try {
      setSaving(true);
      const updated = await updateUserProfile({
        userId,
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || null,
      });
      // Changing the email invalidates the current JWT (it's keyed to the old
      // email), so the server hands back a fresh one to keep the session alive.
      if (updated.token) {
        await setAuthToken(updated.token);
      }
      setProfile(updated);
      setEditVisible(false);
    } catch (error) {
      Alert.alert(copy.saveProfileError, error instanceof Error ? error.message : copy.tryAgain);
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async () => {
    if (!userId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(copy.permissionRequired, copy.photoPermission);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    try {
      setSaving(true);
      await uploadProfilePicture(result.assets[0].uri);
      setProfile(await getUserProfile(userId));
    } catch (error) {
      Alert.alert(copy.updatePhotoError, error instanceof Error ? error.message : copy.tryAgain);
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async () => {
    if (!userId) return;
    try {
      setSaving(true);
      await deleteProfilePicture();
      // A previously broken photo is gone for good, so the failure it recorded goes too.
      setFailedPhotoUri(null);
      setProfile(await getUserProfile(userId));
    } catch (error) {
      Alert.alert(copy.removePhotoError, error instanceof Error ? error.message : copy.tryAgain);
    } finally {
      setSaving(false);
    }
  };

  const confirmRemovePhoto = () => {
    Alert.alert(copy.photoRemoveTitle, copy.photoRemoveConfirm, [
      { text: copy.cancel, style: "cancel" },
      { text: copy.photoRemove, style: "destructive", onPress: () => void removePhoto() },
    ]);
  };

  // With a picture already stored the button offers both actions; with none there is
  // nothing to remove, so it opens the picker directly the way it always did.
  const openPhotoOptions = () => {
    if (!profile?.profilePhoto) {
      void pickPhoto();
      return;
    }
    Alert.alert(copy.photoTitle, undefined, [
      { text: copy.photoChoose, onPress: () => void pickPhoto() },
      { text: copy.photoRemove, style: "destructive", onPress: confirmRemovePhoto },
      { text: copy.cancel, style: "cancel" },
    ]);
  };

  const setSetting = async (key: keyof Omit<UserSettings, "userId" | "language">, value: boolean) => {
    if (!userId || !settings) return;
    const previous = settings;
    setSettings({ ...settings, [key]: value });
    try {
      const updated = await updateUserSettings(userId, { [key]: value });
      setSettings(updated);
    } catch (error) {
      setSettings(previous);
      Alert.alert(copy.saveSettingError, error instanceof Error ? error.message : copy.tryAgain);
    }
  };

  const handleTwoFactorToggle = async (enabled: boolean) => {
    if (!userId) return;
    setTwoFactorMode(enabled ? "enable" : "disable");
    setTwoFactorCode("");
    setTwoFactorSetup(null);
    if (!enabled) {
      setTwoFactorVisible(true);
      return;
    }

    try {
      setTwoFactorBusy(true);
      setTwoFactorSetup(await beginTwoFactorSetup(userId));
      setTwoFactorVisible(true);
    } catch (error) {
      Alert.alert(copy.twoFactorError, error instanceof Error ? error.message : copy.tryAgain);
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const confirmTwoFactor = async () => {
    if (!userId || twoFactorCode.replace(/\D/g, "").length !== 6) {
      Alert.alert(copy.missingDetails, copy.twoFactorCodePlaceholder);
      return;
    }
    try {
      setTwoFactorBusy(true);
      if (twoFactorMode === "enable") {
        const trustedDeviceToken = await enableTwoFactor(userId, twoFactorCode);
        if (!trustedDeviceToken) {
          throw new Error("The trusted-device credential was not created. Please restart the app and try again.");
        }
        await saveTrustedDeviceToken(trustedDeviceToken);
        setSettings((current) => current ? { ...current, twoFactorAuthentication: true } : current);
        setTwoFactorVisible(false);
        Alert.alert(copy.twoFactorEnabled, copy.twoFactorEnabledMessage);
      } else {
        await disableTwoFactor(userId, twoFactorCode);
        await clearTrustedDeviceToken();
        setSettings((current) => current ? { ...current, twoFactorAuthentication: false } : current);
        setTwoFactorVisible(false);
        Alert.alert(copy.twoFactorDisabled, copy.twoFactorDisabledMessage);
      }
      setTwoFactorCode("");
    } catch (error) {
      Alert.alert(copy.twoFactorError, error instanceof Error ? error.message : copy.tryAgain);
    } finally {
      setTwoFactorBusy(false);
    }
  };

  const selectLanguage = async (language: ProfileLanguage) => {
    if (!userId || !settings) return;
    const previousSettings = settings;
    const selectedSettings: UserSettings = { ...settings, language };
    setSettings(selectedSettings);
    setLanguageVisible(false);
    await setAppLanguage(language);
    try {
      const updated = await updateUserSettings(userId, { language });
      setSettings({ ...selectedSettings, ...updated, language });
    } catch (error) {
      setSettings(previousSettings);
      await setAppLanguage(previousSettings.language);
      setLanguageVisible(true);
      Alert.alert(copy.saveLanguageError, error instanceof Error ? error.message : copy.tryAgain);
    }
  };

  const savePassword = async () => {
    if (!userId || !currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(copy.missingDetails, copy.completePassword);
      return;
    }
    try {
      setSaving(true);
      await changePassword(userId, currentPassword, newPassword, confirmPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setPasswordVisible(false);
      Alert.alert(copy.passwordUpdated, copy.passwordSuccess);
    } catch (error) {
      Alert.alert(copy.changePasswordError, error instanceof Error ? error.message : copy.tryAgain);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(copy.logoutTitle, copy.logoutConfirm, [
      { text: copy.cancel, style: "cancel" },
      {
        text: copy.logoutAccount,
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            await clearCurrentUser();
            router.replace("/auth/login");
          } finally {
            setLoggingOut(false);
          }
      },
      },
    ]);
  };

  if (loading) {
    return <SafeAreaView style={styles.loadingScreen}><ActivityIndicator color={BLUE} size="large" /></SafeAreaView>;
  }

  if (!profile || !settings) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.emptyText}>{copy.unavailable}</Text>
        <Pressable style={styles.retryButton} onPress={() => void loadData()}><Text style={styles.retryText}>{copy.retry}</Text></Pressable>
      </SafeAreaView>
    );
  }

  const photoUri = resolveProfilePhoto(profile.profilePhoto);
  // A stored photo that will not load is treated the same as no photo at all,
  // matching how the admin web profile falls back to its placeholder.
  const showAvatarPlaceholder = !photoUri || photoUri === failedPhotoUri;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}><Ionicons name="arrow-back" size={25} color="#111827" /></Pressable>
          <Text style={styles.headerTitle}>{copy.header}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.identity}>
          <View style={styles.avatarWrap}>
            {showAvatarPlaceholder ? (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <ProfileAvatarPlaceholder size={AVATAR_SIZE} />
              </View>
            ) : (
              <Image
                source={{ uri: photoUri! }}
                style={styles.avatar}
                onError={() => setFailedPhotoUri(photoUri)}
              />
            )}
            <Pressable style={styles.photoButton} onPress={openPhotoOptions} disabled={saving}><Ionicons name="pencil" size={17} color="#FFFFFF" /></Pressable>
          </View>
          <Text style={styles.name}>{profile.fullName || copy.passenger}</Text>
          <Text style={styles.userId}>{copy.userId}: PSG-{String(profile.userId).padStart(3, "0")}</Text>
        </View>
        <View style={styles.completionCard}>
          <View style={styles.completionTop}><Text style={styles.cardTitle}>{copy.completion}</Text><Text style={styles.completionValue}>{completion}%</Text></View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${completion}%` }]} /></View>
          <Text style={styles.helperText}>{copy.bankHint}</Text>
        </View>

        <Text style={styles.sectionTitle}>{copy.professional}</Text>
        <View style={styles.card}>
          <DetailRow icon="create" label={copy.fullName} value={profile.fullName || copy.notProvided} onPress={openEdit} />
          <DetailRow icon="mail" label={copy.email} value={profile.email || copy.notProvided} onPress={openEdit} />
          <DetailRow icon="lock-closed" label={copy.changePassword} value="************" onPress={() => setPasswordVisible(true)} />
          <DetailRow icon="phone-portrait" label={copy.mobile} value={profile.phoneNumber || copy.notProvided} onPress={openEdit} />
        </View>

        <Text style={styles.sectionTitle}>{copy.settings}</Text>
        <View style={styles.card}><DetailRow icon="language" label={copy.language} value={settings.language === "si" ? copy.sinhala : settings.language === "ta" ? copy.tamil : copy.english} onPress={() => setLanguageVisible(true)} /></View>

        <Text style={styles.sectionTitle}>{copy.privacy}</Text>
        <View style={styles.card}>
          <ToggleRow title={copy.twoFactor} value={settings.twoFactorAuthentication} onValueChange={(value) => void handleTwoFactorToggle(value)} />
        </View>

        <Text style={styles.sectionTitle}>{copy.supportLegal}</Text>
        <View style={styles.card}>
          <DetailRow
            icon="document-text-outline"
            label={copy.terms}
            value={copy.termsHint}
            onPress={() => Alert.alert(copy.termsTitle, copy.termsMessage)}
          />
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout} disabled={loggingOut}>
          <Ionicons name="log-out-outline" size={19} color="#FFFFFF" />
          <Text style={styles.logoutButtonText}>{loggingOut ? copy.loggingOut : copy.logout}</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalCard}><Text style={styles.modalTitle}>{copy.editProfile}</Text>
            <TextInput style={styles.input} placeholder={copy.namePlaceholder} value={fullName} onChangeText={setFullName} />
            <TextInput style={styles.input} placeholder={copy.emailPlaceholder} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder={copy.mobilePlaceholder} value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
            <View style={styles.modalActions}><Pressable style={styles.cancelButton} onPress={() => setEditVisible(false)}><Text style={styles.cancelText}>{copy.cancel}</Text></Pressable><Pressable style={styles.primaryButton} onPress={() => void saveProfile()} disabled={saving}><Text style={styles.primaryText}>{saving ? copy.saving : copy.save}</Text></Pressable></View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={languageVisible} transparent animationType="fade" onRequestClose={() => setLanguageVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setLanguageVisible(false)}>
          <View style={styles.modalCard}><Text style={styles.modalTitle}>{copy.selectLanguage}</Text>
            <Pressable style={styles.languageOption} onPress={() => void selectLanguage("en")}><Text style={styles.languageText}>{copy.english}</Text>{settings.language === "en" ? <Ionicons name="checkmark" size={21} color={BLUE} /> : null}</Pressable>
            <Pressable style={styles.languageOption} onPress={() => void selectLanguage("si")}><Text style={styles.languageText}>{copy.sinhala}</Text>{settings.language === "si" ? <Ionicons name="checkmark" size={21} color={BLUE} /> : null}</Pressable>
            <Pressable style={styles.languageOption} onPress={() => void selectLanguage("ta")}><Text style={styles.languageText}>{copy.tamil}</Text>{settings.language === "ta" ? <Ionicons name="checkmark" size={21} color={BLUE} /> : null}</Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={passwordVisible} transparent animationType="slide" onRequestClose={() => setPasswordVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalCard}><Text style={styles.modalTitle}>{copy.passwordTitle}</Text>
            <PasswordField placeholder={copy.currentPassword} value={currentPassword} onChangeText={setCurrentPassword} visible={showCurrentPassword} onToggleVisible={() => setShowCurrentPassword((value) => !value)} />
            <PasswordField placeholder={copy.newPassword} value={newPassword} onChangeText={setNewPassword} visible={showNewPassword} onToggleVisible={() => setShowNewPassword((value) => !value)} />
            <PasswordField placeholder={copy.confirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} visible={showConfirmPassword} onToggleVisible={() => setShowConfirmPassword((value) => !value)} />
            <View style={styles.modalActions}><Pressable style={styles.cancelButton} onPress={() => setPasswordVisible(false)}><Text style={styles.cancelText}>{copy.cancel}</Text></Pressable><Pressable style={styles.primaryButton} onPress={() => void savePassword()} disabled={saving}><Text style={styles.primaryText}>{saving ? copy.updating : copy.update}</Text></Pressable></View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={twoFactorVisible} transparent animationType="slide" onRequestClose={() => setTwoFactorVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.twoFactorModalCard}>
            <Text style={styles.modalTitle}>{twoFactorMode === "enable" ? copy.twoFactorSetupTitle : copy.twoFactorDisableTitle}</Text>
            {twoFactorMode === "enable" && twoFactorSetup ? (
              <>
                <Text style={styles.twoFactorInstructions}>{copy.twoFactorSetupInstructions}</Text>
                <View style={styles.qrWrap}><QRCode value={twoFactorSetup.provisioningUri} size={190} /></View>
                <Text style={styles.secretLabel}>{copy.twoFactorSecret}</Text>
                <Text selectable style={styles.secretValue}>{twoFactorSetup.secret}</Text>
                <Text style={styles.twoFactorHint}>{copy.twoFactorAuthenticatorHint}</Text>
              </>
            ) : (
              <Text style={styles.twoFactorInstructions}>{copy.twoFactorDisableInstructions}</Text>
            )}
            <TextInput
              style={styles.input}
              placeholder={copy.twoFactorCodePlaceholder}
              value={twoFactorCode}
              onChangeText={(value) => setTwoFactorCode(value.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setTwoFactorVisible(false)} disabled={twoFactorBusy}>
                <Text style={styles.cancelText}>{copy.cancel}</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => void confirmTwoFactor()} disabled={twoFactorBusy}>
                {twoFactorBusy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{twoFactorMode === "enable" ? copy.twoFactorEnable : copy.twoFactorDisable}</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  headerSpacer: { width: 25 },
  identity: { alignItems: "center", paddingTop: 8, paddingBottom: 20 },
  avatarWrap: { position: "relative", marginBottom: 12 },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarFallback: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoButton: { position: "absolute", right: -4, bottom: 7, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: BLUE, borderWidth: 2, borderColor: "#FFFFFF" },
  name: { fontSize: 24, fontWeight: "700", color: "#111827" },
  userId: { marginTop: 2, fontSize: 14, color: "#737B87" },
  completionCard: { padding: 16, borderWidth: 1, borderColor: "#E2E4E8", borderRadius: 12, marginBottom: 28 },
  completionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#1B2433" },
  completionValue: { fontSize: 13, fontWeight: "600", color: BLUE },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "#EEF0F4", marginTop: 14, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: BLUE },
  helperText: { marginTop: 12, fontSize: 11, fontWeight: "500", color: "#737B87" },
  sectionTitle: { marginBottom: 10, marginLeft: 2, fontSize: 16, fontWeight: "700", color: "#717987" },
  card: { borderWidth: 1, borderColor: "#E2E4E8", borderRadius: 12, overflow: "hidden", marginBottom: 26 },
  detailRow: { minHeight: 72, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#EEF0F2" },
  detailIcon: { width: 40, height: 40, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F2F4" },
  detailText: { flex: 1, marginLeft: 16 },
  detailLabel: { fontSize: 11, fontWeight: "600", color: "#7B828D", marginBottom: 3 },
  detailValue: { fontSize: 13, fontWeight: "600", color: "#4B4E54" },
  toggleRow: { minHeight: 70, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#EEF0F2" },
  toggleText: { flex: 1, paddingVertical: 12 },
  toggleTitle: { fontSize: 16, color: "#1B2433", fontWeight: "500" },
  toggleSubtitle: { marginTop: 4, fontSize: 12, color: "#7B828D" },
  emptyText: { fontSize: 14, fontWeight: "600", color: "#697386", marginBottom: 16 },
  retryButton: { borderRadius: 8, backgroundColor: BLUE, paddingHorizontal: 22, paddingVertical: 11 },
  retryText: { color: "#FFFFFF", fontWeight: "700" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  modalCard: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  twoFactorModalCard: { maxHeight: "92%", backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 16 },
  twoFactorInstructions: { fontSize: 14, lineHeight: 21, color: "#5E6673", marginBottom: 14 },
  qrWrap: { alignSelf: "center", padding: 12, marginBottom: 14, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" },
  secretLabel: { fontSize: 11, fontWeight: "600", color: "#7B828D", marginBottom: 4 },
  secretValue: { padding: 10, borderRadius: 8, backgroundColor: "#F1F5F9", color: "#1B2433", fontSize: 13, letterSpacing: 1, fontWeight: "600" },
  twoFactorHint: { marginTop: 8, marginBottom: 12, fontSize: 12, lineHeight: 18, color: "#7B828D" },
  input: { height: 48, borderWidth: 1, borderColor: "#D9DDE4", borderRadius: 9, paddingHorizontal: 13, marginBottom: 12, color: "#111827" },
  passwordFieldWrap: { position: "relative", justifyContent: "center", marginBottom: 12 },
  passwordInput: { height: 48, borderWidth: 1, borderColor: "#D9DDE4", borderRadius: 9, paddingHorizontal: 13, paddingRight: 42, color: "#111827" },
  passwordToggle: { position: "absolute", right: 12, height: 48, justifyContent: "center", alignItems: "center" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  cancelButton: { paddingHorizontal: 18, paddingVertical: 13 },
  cancelText: { color: "#5E6673", fontWeight: "600" },
  primaryButton: { minWidth: 92, alignItems: "center", borderRadius: 9, backgroundColor: BLUE, paddingHorizontal: 18, paddingVertical: 13 },
  primaryText: { color: "#FFFFFF", fontWeight: "700" },
  languageOption: { minHeight: 52, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#EEF0F2" },
  languageText: { fontSize: 16, color: "#1B2433" },
  logoutButton: { minHeight: 52, marginTop: 2, marginBottom: 8, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#E53935" },
  logoutButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
