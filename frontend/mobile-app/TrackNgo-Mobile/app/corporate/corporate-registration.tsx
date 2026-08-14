import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { httpPost } from "../../services/http";
import { useSession } from "../../store/sessionStore";

const INDUSTRIES = [
  "Telecommunications",
  "Conglomerate",
  "Manufacturing",
  "Information Technology",
  "Finance & Banking",
  "Private Transport",
  "Logistics & Supply Chain",
  "Education",
  "Healthcare",
  "Retail & E-commerce",
];

export default function CorporateRegistrationScreen() {
  const router = useRouter();
  const { currentUser } = useSession();

  // Form State
  const [companyName, setCompanyName] = useState("");
  const [brn, setBrn] = useState("");
  const [industry, setIndustry] = useState("Private Transport");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");

  // Contact Person State
  const [contactName, setContactName] = useState("");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");

  // UI Control
  const [loading, setLoading] = useState(false);
  const [showIndustryModal, setShowIndustryModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (!companyName.trim()) nextErrors.companyName = "Company Name is required";
    if (!brn.trim()) nextErrors.brn = "Business Registration Number is required";
    if (!industry.trim()) nextErrors.industry = "Industry is required";
    if (!address.trim()) nextErrors.address = "Address is required";
    if (!email.trim()) nextErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      nextErrors.email = "Enter a valid email address";

    if (!contactName.trim()) nextErrors.contactName = "Full Name is required";
    if (!designation.trim()) nextErrors.designation = "Designation is required";
    if (!phone.trim()) nextErrors.phone = "Phone number is required";
    else if (!/^\d{9,10}$/.test(phone.trim().replace(/[-\s+]/g, "")))
      nextErrors.phone = "Enter a valid phone number";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;
    if (!currentUser?.userId) {
      Alert.alert("Error", "User session not found. Please log in again.");
      router.replace("/auth/login?userType=corporate");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        companyName: companyName.trim(),
        businessRegistrationNumber: brn.trim(),
        industry: industry,
        address: address.trim(),
        contactPersonName: contactName.trim(),
        contactPersonDesignation: designation.trim(),
        contactPhone: phone.trim(),
      };

      await httpPost<any>(
        `/api/users/${currentUser.userId}/corporate`,
        undefined,
        payload
      );

      Alert.alert("Success", "Corporate profile registered successfully!", [
        { text: "OK", onPress: () => router.replace("/corporate/co-op-dashboard") },
      ]);
    } catch (err: any) {
      let errorMsg = err.message;
      if (err.message && err.message.includes("{")) {
        try {
          const parsed = JSON.parse(err.message.substring(err.message.indexOf("{")));
          if (parsed.message) errorMsg = parsed.message;
        } catch {}
      }
      Alert.alert("Registration Failed", errorMsg || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#0D141C" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Registration</Text>
          <TouchableOpacity style={styles.moreBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color="#0D141C" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Company Information Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Company Information</Text>
            <Text style={styles.sectionSub}>Please enter your business details below.</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Company Name</Text>
            <TextInput
              style={[styles.input, errors.companyName ? styles.inputError : null]}
              placeholder="e.g. Blue Line Travels"
              placeholderTextColor="#9CA3AF"
              value={companyName}
              onChangeText={(text) => {
                setCompanyName(text);
                if (errors.companyName) setErrors((e) => ({ ...e, companyName: "" }));
              }}
            />
            {errors.companyName ? <Text style={styles.errorText}>{errors.companyName}</Text> : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Business Registration No.</Text>
            <TextInput
              style={[styles.input, errors.brn ? styles.inputError : null]}
              placeholder="PV-XXXXX"
              placeholderTextColor="#9CA3AF"
              value={brn}
              onChangeText={(text) => {
                setBrn(text);
                if (errors.brn) setErrors((e) => ({ ...e, brn: "" }));
              }}
              autoCapitalize="characters"
            />
            {errors.brn ? <Text style={styles.errorText}>{errors.brn}</Text> : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Industry</Text>
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setShowIndustryModal(true)}
            >
              <Text style={styles.dropdownText}>{industry}</Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, errors.address ? styles.inputError : null]}
              placeholder="Moratuwa, Sri Lanka"
              placeholderTextColor="#9CA3AF"
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                if (errors.address) setErrors((e) => ({ ...e, address: "" }));
              }}
            />
            {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="abccompany@gmail.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((e) => ({ ...e, email: "" }));
              }}
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Contact Person Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Contact Person</Text>
            <Text style={styles.sectionSub}>Who should we contact for operations?</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.contactName ? styles.inputError : null]}
              placeholder="Amal Perera"
              placeholderTextColor="#9CA3AF"
              value={contactName}
              onChangeText={(text) => {
                setContactName(text);
                if (errors.contactName) setErrors((e) => ({ ...e, contactName: "" }));
              }}
            />
            {errors.contactName ? <Text style={styles.errorText}>{errors.contactName}</Text> : null}
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1.1, marginRight: 10 }]}>
              <Text style={styles.label}>Designation</Text>
              <TextInput
                style={[styles.input, errors.designation ? styles.inputError : null]}
                placeholder="Manager"
                placeholderTextColor="#9CA3AF"
                value={designation}
                onChangeText={(text) => {
                  setDesignation(text);
                  if (errors.designation) setErrors((e) => ({ ...e, designation: "" }));
                }}
              />
              {errors.designation ? <Text style={styles.errorText}>{errors.designation}</Text> : null}
            </View>

            <View style={[styles.formGroup, { flex: 0.9 }]}>
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={[styles.input, errors.phone ? styles.inputError : null]}
                placeholder="07X XXXXXX"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (errors.phone) setErrors((e) => ({ ...e, phone: "" }));
                }}
              />
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>
          </View>

          {/* Spacer */}
          <View style={{ height: 20 }} />

          {/* Register Button */}
          <TouchableOpacity
            style={styles.registerBtn}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.registerBtnText}>Register</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Industry Dropdown Modal */}
      <Modal visible={showIndustryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Industry</Text>
              <TouchableOpacity onPress={() => setShowIndustryModal(false)}>
                <Ionicons name="close" size={24} color="#0D141C" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={INDUSTRIES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setIndustry(item);
                    setShowIndustryModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, industry === item && styles.modalItemTextActive]}>
                    {item}
                  </Text>
                  {industry === item && <Ionicons name="checkmark" size={20} color="#067BF9" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: "#CEDBE9",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0D141C",
  },
  moreBtn: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0D141C",
  },
  sectionSub: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0D141C",
    marginBottom: 6,
  },
  input: {
    height: 48,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CEDBE9",
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#000000",
  },
  inputError: {
    borderColor: "#EF4444",
  },
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CEDBE9",
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  dropdownText: {
    fontSize: 16,
    color: "#000000",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 11,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 24,
  },
  registerBtn: {
    height: 52,
    backgroundColor: "#067BF9",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#067BF9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  registerBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  // Modal Styles
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
    color: "#0D141C",
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
    color: "#067BF9",
    fontWeight: "600",
  },
});
