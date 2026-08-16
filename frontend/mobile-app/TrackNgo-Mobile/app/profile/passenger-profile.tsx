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
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useSession } from "../../store/sessionStore";
import { useLanguage } from "../../utils/i18n";
import {
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

const TOKEN_KEY = "trackngo.auth.token";
const BLUE = "#2378E8";

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
    userId: "ID",
    privacy: "Privacy",
    shareLocation: "Share Location",
    shareLocationHint: "Required for tracking features",
    twoFactor: "Two-Factor Authentication",
    supportLegal: "Support & Legal",
    terms: "Terms & Conditions",
    termsHint: "View our terms and conditions",
    notifications: "Notifications",
    push: "Push Notifications",
    sms: "SMS Alerts",
    emailUpdates: "Email Updates",
    bookingUpdates: "Booking Updates",
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
    userId: "හඳුනාගැනීමේ අංකය",
    privacy: "පෞද්ගලිකත්වය",
    shareLocation: "ස්ථානය බෙදාගැනීම",
    shareLocationHint: "ගමන් නිරීක්ෂණ පහසුකම් සඳහා අවශ්‍ය වේ",
    twoFactor: "ද්වි-සාධක සත්‍යාපනය",
    supportLegal: "සහාය සහ නීතිමය තොරතුරු",
    terms: "නියමයන් සහ කොන්දේසි",
    termsHint: "අපගේ නියමයන් සහ කොන්දේසි බලන්න",
    notifications: "දැනුම්දීම්",
    push: "යෙදුම් දැනුම්දීම්",
    sms: "SMS දැනුම්දීම්",
    emailUpdates: "විද්‍යුත් තැපැල් යාවත්කාලීන",
    bookingUpdates: "වෙන්කිරීම් යාවත්කාලීන",
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
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [languageVisible, setLanguageVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const userId = currentUser?.userId;
  const copy = profileCopy[settings?.language === "si" ? "si" : "en"];

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
      Alert.alert(profileCopy.en.unableLoad, error instanceof Error ? error.message : profileCopy.en.tryAgain);
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
            await AsyncStorage.removeItem(TOKEN_KEY);
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
  const initials = profile.fullName?.trim().slice(0, 1).toUpperCase() || "P";

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
            {photoUri ? <Image source={{ uri: photoUri }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.initials}>{initials}</Text></View>}
            <Pressable style={styles.photoButton} onPress={() => void pickPhoto()} disabled={saving}><Ionicons name="pencil" size={17} color="#FFFFFF" /></Pressable>
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
        <View style={styles.card}><DetailRow icon="language" label={copy.language} value={settings.language === "si" ? copy.sinhala : copy.english} onPress={() => setLanguageVisible(true)} /></View>

        <Text style={styles.sectionTitle}>{copy.privacy}</Text>
        <View style={styles.card}>
          <ToggleRow title={copy.shareLocation} subtitle={copy.shareLocationHint} value={settings.shareLocation} onValueChange={(value) => void setSetting("shareLocation", value)} />
          <ToggleRow title={copy.twoFactor} value={settings.twoFactorAuthentication} onValueChange={(value) => void setSetting("twoFactorAuthentication", value)} />
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

        <Text style={styles.sectionTitle}>{copy.notifications}</Text>
        <View style={styles.card}>
          <ToggleRow title={copy.push} value={settings.pushNotifications} onValueChange={(value) => void setSetting("pushNotifications", value)} />
          <ToggleRow title={copy.sms} value={settings.smsAlerts} onValueChange={(value) => void setSetting("smsAlerts", value)} />
          <ToggleRow title={copy.emailUpdates} value={settings.emailUpdates} onValueChange={(value) => void setSetting("emailUpdates", value)} />
          <ToggleRow title={copy.bookingUpdates} value={settings.bookingUpdates} onValueChange={(value) => void setSetting("bookingUpdates", value)} />
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
          </View>
        </Pressable>
      </Modal>

      <Modal visible={passwordVisible} transparent animationType="slide" onRequestClose={() => setPasswordVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalCard}><Text style={styles.modalTitle}>{copy.passwordTitle}</Text>
            <TextInput style={styles.input} placeholder={copy.currentPassword} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
            <TextInput style={styles.input} placeholder={copy.newPassword} value={newPassword} onChangeText={setNewPassword} secureTextEntry />
            <TextInput style={styles.input} placeholder={copy.confirmPassword} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
            <View style={styles.modalActions}><Pressable style={styles.cancelButton} onPress={() => setPasswordVisible(false)}><Text style={styles.cancelText}>{copy.cancel}</Text></Pressable><Pressable style={styles.primaryButton} onPress={() => void savePassword()} disabled={saving}><Text style={styles.primaryText}>{saving ? copy.updating : copy.update}</Text></Pressable></View>
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
  headerTitle: { fontSize: 19, fontWeight: "700", color: "#111827" },
  headerSpacer: { width: 25 },
  identity: { alignItems: "center", paddingTop: 8, paddingBottom: 20 },
  avatarWrap: { position: "relative", marginBottom: 12 },
  avatar: { width: 112, height: 112, borderRadius: 56 },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#DBEAFE" },
  initials: { fontSize: 40, fontWeight: "700", color: BLUE },
  photoButton: { position: "absolute", right: -4, bottom: 7, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: BLUE, borderWidth: 2, borderColor: "#FFFFFF" },
  name: { fontSize: 25, fontWeight: "700", color: "#111827" },
  userId: { marginTop: 2, fontSize: 14, color: "#737B87" },
  completionCard: { padding: 16, borderWidth: 1, borderColor: "#E2E4E8", borderRadius: 12, marginBottom: 28 },
  completionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1B2433" },
  completionValue: { fontSize: 15, fontWeight: "700", color: BLUE },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "#EEF0F4", marginTop: 14, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4, backgroundColor: BLUE },
  helperText: { marginTop: 12, fontSize: 13, color: "#737B87" },
  sectionTitle: { marginBottom: 10, marginLeft: 2, fontSize: 15, fontWeight: "700", color: "#717987" },
  card: { borderWidth: 1, borderColor: "#E2E4E8", borderRadius: 12, overflow: "hidden", marginBottom: 26 },
  detailRow: { minHeight: 72, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#EEF0F2" },
  detailIcon: { width: 40, height: 40, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F2F4" },
  detailText: { flex: 1, marginLeft: 16 },
  detailLabel: { fontSize: 13, color: "#7B828D", marginBottom: 3 },
  detailValue: { fontSize: 15, fontWeight: "600", color: "#4B4E54" },
  toggleRow: { minHeight: 70, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#EEF0F2" },
  toggleText: { flex: 1, paddingVertical: 12 },
  toggleTitle: { fontSize: 16, color: "#1B2433", fontWeight: "500" },
  toggleSubtitle: { marginTop: 4, fontSize: 12, color: "#7B828D" },
  emptyText: { fontSize: 16, color: "#697386", marginBottom: 16 },
  retryButton: { borderRadius: 8, backgroundColor: BLUE, paddingHorizontal: 22, paddingVertical: 11 },
  retryText: { color: "#FFFFFF", fontWeight: "700" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  modalCard: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 16 },
  input: { height: 48, borderWidth: 1, borderColor: "#D9DDE4", borderRadius: 9, paddingHorizontal: 13, marginBottom: 12, color: "#111827" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  cancelButton: { paddingHorizontal: 18, paddingVertical: 13 },
  cancelText: { color: "#5E6673", fontWeight: "600" },
  primaryButton: { minWidth: 92, alignItems: "center", borderRadius: 9, backgroundColor: BLUE, paddingHorizontal: 18, paddingVertical: 13 },
  primaryText: { color: "#FFFFFF", fontWeight: "700" },
  languageOption: { minHeight: 52, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#EEF0F2" },
  languageText: { fontSize: 16, color: "#1B2433" },
  logoutButton: { minHeight: 52, marginTop: 2, marginBottom: 8, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#E53935" },
  logoutButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
