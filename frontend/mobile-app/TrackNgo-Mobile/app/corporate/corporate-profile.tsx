import React, { useCallback, useRef, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useSession } from "../../store/sessionStore";
import {
  type CorporateProfileDto,
  getCorporateProfile,
  updateCorporateProfile,
} from "../../services/corporateApi";

// ─── Entrance animation hook ──────────────────────────────────────────────────
function useFadeSlide(delay: number) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 480,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 480,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, translateY]);
  return { opacity, translateY };
}

// ─── Info Card Component ────────────────────────────────────────────────────────
function InfoCard({ title, data, onEdit }: { title: string, data: { label: string, value: string, icon: any }[], onEdit: () => void }) {
  const filledData = data.filter((d) => !!d.value);

  return (
    <View style={styles.infoCard}>
      <View style={styles.infoCardHeader}>
        <Text style={styles.infoCardTitle}>{title}</Text>
        <TouchableOpacity onPress={onEdit} style={styles.infoCardEditBtn} hitSlop={10}>
          <Text style={styles.infoCardEditText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {filledData.length === 0 ? (
        <Text style={styles.emptyInfoText}>No details added yet. Tap edit to add them.</Text>
      ) : (
        <View style={styles.infoList}>
          {filledData.map((item, index) => (
            <View key={index} style={[styles.infoRow, index > 0 && styles.infoRowBorder]}>
              <View style={styles.infoRowLeft}>
                <Ionicons name={item.icon} size={16} color="#94A3B8" />
                <Text style={styles.infoLabel}>{item.label}</Text>
              </View>
              <Text style={styles.infoValue} numberOfLines={2}>{item.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CorporateProfileScreen() {
  const router = useRouter();
  const { currentUser, clearCurrentUser } = useSession();

  const [profile, setProfile] = useState<CorporateProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal Visibility
  const [companyModalVisible, setCompanyModalVisible] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [industryModalVisible, setIndustryModalVisible] = useState(false);

  // Form State
  const [form, setForm] = useState({
    companyName: "",
    businessRegistrationNumber: "",
    industry: "",
    address: "",
    website: "", // UI Only
    employeeCount: "", // UI Only
    contactPersonName: "",
    contactPersonDesignation: "",
    contactPhone: "",
    contactEmail: "", // UI Only
    profilePhoto: "",
  });

  const avatarAnim = useFadeSlide(0);
  const detailsAnim = useFadeSlide(100);
  const logoutAnim = useFadeSlide(200);

  const loadProfile = useCallback(
    async (isRefresh = false) => {
      if (!currentUser?.userId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const data = await getCorporateProfile(currentUser.userId);
        setProfile(data);
        setForm({
          companyName: data.companyName || "",
          businessRegistrationNumber: data.businessRegistrationNumber || "",
          industry: data.industry || "",
          address: data.address || "",
          website: "",
          employeeCount: "",
          contactPersonName: data.contactPersonName || "",
          contactPersonDesignation: data.contactPersonDesignation || "",
          contactPhone: data.contactPhone || "",
          contactEmail: data.email || "",
          profilePhoto: data.profilePhoto || "",
        });
      } catch (err) {
        console.error("[CorporateProfile] Failed to load profile:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser]
  );

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await clearCurrentUser();
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0].uri) {
      const newPhotoUri = result.assets[0].uri;
      setForm((prev) => ({ ...prev, profilePhoto: newPhotoUri }));

      // Instantly save the new photo
      if (currentUser?.userId) {
        try {
          await updateCorporateProfile(currentUser.userId, { profilePhoto: newPhotoUri });
        } catch (e) {
          console.warn("Failed to upload photo immediately:", e);
        }
      }
    }
  };

  const handleSave = async (closeModalFn: () => void) => {
    if (!currentUser?.userId) return;
    setSaving(true);
    try {
      const updated = await updateCorporateProfile(currentUser.userId, {
        companyName: form.companyName,
        businessRegistrationNumber: form.businessRegistrationNumber,
        industry: form.industry,
        address: form.address,
        contactPersonName: form.contactPersonName,
        contactPersonDesignation: form.contactPersonDesignation,
        contactPhone: form.contactPhone,
        profilePhoto: form.profilePhoto,
      });
      setProfile(updated);
      Alert.alert("Success", "Profile updated successfully!");
      closeModalFn();
    } catch (err) {
      console.error("Save failed:", err);
      Alert.alert("Error", "Failed to save profile updates.");
    } finally {
      setSaving(false);
    }
  };

  const displayName = form.companyName.trim() || `User ${currentUser?.userId ?? ""}`;
  const companyInitials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  // ── Render Helpers ─────────────────────────────────────────────
  const renderField = (
    label: string,
    fieldKey: keyof typeof form,
    placeholder: string,
    icon: keyof typeof Ionicons.glyphMap,
    keyboardType: any = "default",
    isMandatory: boolean = false,
    isDropdown: boolean = false
  ) => {
    const inputContent = (
      <View style={styles.inputWrapperEdit}>
        <Ionicons name={icon} size={18} color="#94A3B8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          value={form[fieldKey]}
          onChangeText={(text) => setForm((prev) => ({ ...prev, [fieldKey]: text }))}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType={keyboardType}
          editable={!isDropdown}
          pointerEvents={isDropdown ? "none" : "auto"}
        />
        {isDropdown && <Ionicons name="chevron-down" size={18} color="#94A3B8" />}
      </View>
    );

    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>
          {label} {isMandatory && <Text style={{ color: "#EF4444" }}>*</Text>}
        </Text>
        {isDropdown ? (
          <TouchableOpacity activeOpacity={0.7} onPress={() => setIndustryModalVisible(true)}>
            {inputContent}
          </TouchableOpacity>
        ) : (
          inputContent
        )}
      </View>
    );
  };

  const INDUSTRIES = [
    "IT & Software",
    "Manufacturing",
    "Healthcare",
    "Finance & Banking",
    "Education",
    "Retail",
    "Logistics",
    "Telecommunications",
    "Other"
  ];

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadProfile(true)} tintColor="#2F6BFF" />
        }
      >
        {/* Avatar Section */}
        <Animated.View
          style={[
            styles.avatarSection,
            { opacity: avatarAnim.opacity, transform: [{ translateY: avatarAnim.translateY }] },
          ]}
        >
          <TouchableOpacity onPress={handlePickImage} style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              {loading ? (
                <ActivityIndicator size="small" color="#2F6BFF" />
              ) : form.profilePhoto ? (
                <Image source={{ uri: form.profilePhoto }} style={styles.profileImage} />
              ) : (
                <Text style={styles.avatarText}>{companyInitials}</Text>
              )}
            </View>
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          <Text style={styles.companyName}>{displayName}</Text>
          <View style={styles.accountBadge}>
            <MaterialCommunityIcons name="office-building" size={13} color="#2F6BFF" />
            <Text style={styles.accountBadgeText}>Corporate Account</Text>
          </View>
        </Animated.View>

        {/* Details Section */}
        {!loading && (
          <Animated.View
            style={{ opacity: detailsAnim.opacity, transform: [{ translateY: detailsAnim.translateY }] }}
          >
            <InfoCard
              title="Company Information"
              onEdit={() => setCompanyModalVisible(true)}
              data={[
                { label: "Company Name", value: form.companyName, icon: "business-outline" },
                { label: "Registration No.", value: form.businessRegistrationNumber, icon: "document-text-outline" },
                { label: "Industry", value: form.industry, icon: "cog-outline" },
                { label: "Address", value: form.address, icon: "location-outline" },
                { label: "Website", value: form.website, icon: "globe-outline" },
                { label: "Employee Count", value: form.employeeCount, icon: "people-outline" },
              ]}
            />
            
            <View style={{ height: 16 }} />

            <InfoCard
              title="Contact Person"
              onEdit={() => setContactModalVisible(true)}
              data={[
                { label: "Full Name", value: form.contactPersonName, icon: "person-outline" },
                { label: "Designation", value: form.contactPersonDesignation, icon: "briefcase-outline" },
                { label: "Email Address", value: form.contactEmail, icon: "mail-outline" },
                { label: "Phone Number", value: form.contactPhone, icon: "call-outline" },
              ]}
            />
          </Animated.View>
        )}

        {/* Logout */}
        <Animated.View
          style={{ opacity: logoutAnim.opacity, transform: [{ translateY: logoutAnim.translateY }], marginTop: 16 }}
        >
          <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.82} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ─── Company Modal ─── */}
      <Modal visible={companyModalVisible} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Company Information</Text>
            <TouchableOpacity onPress={() => setCompanyModalVisible(false)}>
              <Ionicons name="close-circle" size={28} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            {renderField("Company Name", "companyName", "e.g., Dialog Axiata", "business-outline")}
            {renderField("Registration Number", "businessRegistrationNumber", "e.g., PV 12345", "document-text-outline", "default", true)}
            {renderField("Industry", "industry", "Select your industry", "cog-outline", "default", true, true)}
            {renderField("Address", "address", "Company Headquarters Address", "location-outline", "default", true)}
            {renderField("Website", "website", "https://example.com", "globe-outline")}
            {renderField("Employee Count", "employeeCount", "e.g., 500+", "people-outline")}
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => handleSave(() => setCompanyModalVisible(false))}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Details</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Contact Person Modal ─── */}
      <Modal visible={contactModalVisible} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Contact Person</Text>
            <TouchableOpacity onPress={() => setContactModalVisible(false)}>
              <Ionicons name="close-circle" size={28} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            {renderField("Full Name", "contactPersonName", "Contact Person Name", "person-outline")}
            {renderField("Designation", "contactPersonDesignation", "e.g., HR Manager", "briefcase-outline", "default", true)}
            {renderField("Email Address", "contactEmail", "admin@company.com", "mail-outline", "email-address")}
            {renderField("Phone Number", "contactPhone", "+94 77 123 4567", "call-outline", "phone-pad", true)}
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => handleSave(() => setContactModalVisible(false))}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Details</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Industry Picker Modal ─── */}
      <Modal visible={industryModalVisible} animationType="slide" transparent={true}>
        <View style={styles.dropdownModalOverlay}>
          <View style={styles.dropdownModalContent}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownTitle}>Select Industry</Text>
              <TouchableOpacity onPress={() => setIndustryModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {INDUSTRIES.map((ind, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setForm(prev => ({ ...prev, industry: ind }));
                    setIndustryModalVisible(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    form.industry === ind && { color: "#2F6BFF", fontWeight: "700" }
                  ]}>
                    {ind}
                  </Text>
                  {form.industry === ind && <Ionicons name="checkmark-circle" size={20} color="#2F6BFF" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("/corporate/co-op-dashboard")}>
          <Ionicons name="grid-outline" size={22} color="#64748B" />
          <Text style={styles.tabLabel}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("/corporate/corporate-contract")}>
          <Ionicons name="document-text-outline" size={22} color="#64748B" />
          <Text style={styles.tabLabel}>Contracts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("/corporate/corporate-billing")}>
          <Ionicons name="receipt-outline" size={22} color="#64748B" />
          <Text style={styles.tabLabel}>Billing</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("/corporate/corporate-profile")}>
          <Ionicons name="person" size={22} color="#2F6BFF" />
          <Text style={[styles.tabLabel, styles.tabLabelActive]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F0F2F5" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 30, paddingBottom: 20, flexGrow: 1 },

  avatarSection: { alignItems: "center", marginBottom: 32 },
  avatarWrapper: { position: "relative", marginBottom: 16 },
  avatarCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 3,
    borderColor: "#F1F5F9",
  },
  profileImage: { width: "100%", height: "100%", resizeMode: "cover" },
  avatarText: { fontSize: 32, fontWeight: "800", color: "#2F6BFF" },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2F6BFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  companyName: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginBottom: 6, textAlign: "center" },
  accountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EEF4FF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  accountBadgeText: { fontSize: 12, fontWeight: "700", color: "#2F6BFF" },

  // Info Card Styles
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E8EDF3",
  },
  infoCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  infoCardEditBtn: {
    backgroundColor: "#EEF4FF",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  infoCardEditText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2F6BFF",
  },
  emptyInfoText: {
    fontSize: 13,
    color: "#94A3B8",
    fontStyle: "italic",
    marginTop: 8,
  },
  infoList: {
    marginTop: 4,
  },
  infoRow: {
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  infoRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 16,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    textAlign: "right",
    flexShrink: 1,
  },

  logoutBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E8EDF3",
    marginTop: 8,
  },
  logoutText: { fontSize: 16, fontWeight: "700", color: "#EF4444" },

  tabBar: {
    flexDirection: "row",
    height: 64,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingBottom: 4,
  },
  tabItem: { flex: 1, justifyContent: "center", alignItems: "center", gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: "600", color: "#64748B", marginTop: 2 },
  tabLabelActive: { color: "#2F6BFF" },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: "#F8FAFC" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  modalScroll: { padding: 20, paddingBottom: 40, gap: 16 },
  fieldContainer: {},
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#64748B", marginBottom: 6, marginLeft: 2 },
  inputWrapperEdit: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: "#1E293B", fontWeight: "500" },
  modalFooter: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  saveBtn: {
    backgroundColor: "#2F6BFF",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },

  // Dropdown Modal Styles
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },
  dropdownModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  dropdownHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 10,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1E293B",
  },
});
