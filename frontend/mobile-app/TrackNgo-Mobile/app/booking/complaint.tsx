import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  createComplaint,
  getMyComplaints,
  type ComplaintDto,
} from "../../services/complaintsApi";
import { uploadMedia } from "../../services/chatApi";
import { extractApiMessage } from "../../services/http";
import { useSession } from "../../store/sessionStore";
import { LocalizedText as Text, LocalizedTextInput as TextInput } from "../../utils/i18n";

type PriorityLevel = "Low" | "Medium" | "High";

type ComplaintItem = {
  id: string;
  title: string;
  description: string;
  status: "Pending" | "Under Review" | "Resolved" | "Rejected";
  adminResponse?: string | null;
  createdAt?: string | null;
};

type EvidenceImage = {
  id: string;
  uri: string;
  fileName: string;
  mimeType: string;
};

// Mirrors MIN/MAX_DESCRIPTION_LENGTH in the backend's ComplaintServiceImpl.
const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 500;

const CATEGORY_OPTIONS = [
  "Late Arrival",
  "Driver Behavior",
  "Bus Condition",
  "Route Issue",
  "Safety Concern",
  "Payment Issue",
  "Booking Issue",
  "Other",
];

const PRIORITY_OPTIONS: PriorityLevel[] = ["Low", "Medium", "High"];
const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  late_arrival: "Late Arrival",
  driver_behavior: "Driver Behavior",
  bus_condition: "Bus Condition",
  route_issue: "Route Issue",
  payment_issue: "Payment Issue",
  booking_issue: "Booking Issue",
  safety_concern: "Safety Concern",
  other: "Other",
};

/** Renders the complaint submission screen and the latest complaint summary for the passenger. */
export default function ComplaintScreen() {
  const router = useRouter();
  const { currentUser } = useSession();
  const params = useLocalSearchParams<{
    bookingRef?: string;
  }>();

  const [selectedCategory, setSelectedCategory] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const [priority, setPriority] = useState<PriorityLevel>("Low");
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState<EvidenceImage[]>([]);
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  /** Converts API complaint data into the smaller UI card model used by this screen. */
  const mapComplaintDtoToItem = useCallback((item: ComplaintDto): ComplaintItem => {
    const typeLabel =
      COMPLAINT_TYPE_LABELS[item.complaintType] ?? item.complaintType;
    const normalizedStatus = item.status?.toLowerCase();
    const status =
      normalizedStatus === "resolved"
        ? "Resolved"
        : normalizedStatus === "under_review"
          ? "Under Review"
          : normalizedStatus === "rejected"
            ? "Rejected"
            : "Pending";

    return {
      id: `COMP-${String(item.id).padStart(4, "0")}`,
      title: typeLabel,
      description: item.description,
      status,
      adminResponse: item.adminResponse?.trim() || null,
      createdAt: item.createdAt ?? null,
    };
  }, []);

  /** Loads the current user's complaint history and keeps the preview list in sync. */
  const loadComplaints = useCallback(async () => {
    if (!currentUser) {
      setComplaints([]);
      setLoadingComplaints(false);
      return;
    }

    try {
      setLoadingComplaints(true);
      const data = await getMyComplaints(currentUser.userId);
      setComplaints(data.map(mapComplaintDtoToItem));
    } catch (error) {
      console.error("[ComplaintScreen] Failed to load complaints", error);
      setComplaints([]);
    } finally {
      setLoadingComplaints(false);
    }
  }, [currentUser, mapComplaintDtoToItem]);

  useFocusEffect(
    useCallback(() => {
      void loadComplaints();
    }, [loadComplaints]),
  );

  /** Adds a chosen image asset to the evidence list shown in the form. */
  const addEvidenceAsset = (asset: ImagePicker.ImagePickerAsset) => {
    setEvidence((current) => [
      ...current,
      {
        id: `${Date.now()}-${current.length}`,
        uri: asset.uri,
        fileName:
          asset.fileName ??
          `complaint-${Date.now()}.${guessImageExtension(asset.mimeType)}`,
        mimeType: asset.mimeType ?? "image/jpeg",
      },
    ]);
  };

  /** Opens the photo library so the user can attach complaint evidence. */
  const pickEvidenceFromGallery = async () => {
    if (evidence.length >= 4) {
      Alert.alert("Limit reached", "You can upload up to 4 images only.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Please allow photo library access to upload evidence.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    addEvidenceAsset(result.assets[0]);
  };

  /** Opens the camera so the user can capture new complaint evidence. */
  const captureEvidenceImage = async () => {
    if (evidence.length >= 4) {
      Alert.alert("Limit reached", "You can upload up to 4 images only.");
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Please allow camera access to capture evidence.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      cameraType: ImagePicker.CameraType.back,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    addEvidenceAsset(result.assets[0]);
  };

  /** Lets the user choose whether evidence should come from the gallery or camera. */
  const openEvidencePicker = () => {
    Alert.alert("Add Evidence", "Choose image source", [
      { text: "Gallery", onPress: () => void pickEvidenceFromGallery() },
      { text: "Camera", onPress: () => void captureEvidenceImage() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  /** Removes a single image from the evidence list. */
  const removeEvidenceImage = (id: string) => {
    setEvidence((current) => current.filter((item) => item.id !== id));
  };

  /** Validates the form, uploads evidence, submits the complaint, and refreshes the preview list. */
  const handleSubmit = async () => {
    if (!selectedCategory) {
      Alert.alert("Missing category", "Please select a complaint category.");
      return;
    }

    if (!description.trim()) {
      Alert.alert("Missing description", "Please describe the issue in detail.");
      return;
    }
    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      Alert.alert(
        "Description too short",
        `Please describe the issue in at least ${MIN_DESCRIPTION_LENGTH} characters.`,
      );
      return;
    }

    if (!currentUser) {
      Alert.alert("Not signed in", "Please sign in to submit a complaint.");
      return;
    }

    if (!params.bookingRef) {
      Alert.alert(
        "Missing booking",
        "This complaint must be submitted from a past booking.",
      );
      return;
    }

    try {
      setSubmitting(true);
      const uploadedImageUrls = await Promise.all(
        evidence.map(async (item) => {
          const uploaded = await uploadMedia({
            uri: item.uri,
            fileName: item.fileName,
            mimeType: item.mimeType,
            compressed: false,
          });
          return uploaded.mediaUrl;
        }),
      );

      await createComplaint(
        {
          image:
            uploadedImageUrls.length > 0
              ? JSON.stringify(uploadedImageUrls)
              : undefined,
          bookingReference: params.bookingRef,
          complaintType: toComplaintTypeValue(selectedCategory),
          priority: priority.toLowerCase(),
          description: description.trim(),
        },
        currentUser.userId,
      );

      setSelectedCategory("");
      setShowCategories(false);
      setPriority("Low");
      setDescription("");
      setEvidence([]);
      await loadComplaints();

      Alert.alert(
        "Complaint submitted",
        "Your complaint has been submitted successfully.",
      );
    } catch (error) {
      console.error("[ComplaintScreen] Submit failed", error);
      Alert.alert(
        "Submit failed",
        extractApiMessage(error, "Could not submit your complaint."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle}>Submit a Complaint</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.sectionLabel}>Complaint Type</Text>
        <Pressable
          style={styles.selectField}
          onPress={() => setShowCategories((current) => !current)}
        >
          <Text
            style={[
              styles.selectText,
              !selectedCategory && styles.placeholderText,
            ]}
          >
            {selectedCategory || "Select category"}
          </Text>
          <Ionicons
            name={showCategories ? "chevron-up" : "chevron-down"}
            size={18}
            color="#6B7280"
          />
        </Pressable>

        {showCategories ? (
          <View style={styles.categoryMenu}>
            {CATEGORY_OPTIONS.map((option) => (
              <Pressable
                key={option}
                style={styles.categoryOption}
                onPress={() => {
                  setSelectedCategory(option);
                  setShowCategories(false);
                }}
              >
                <Text style={styles.categoryOptionText}>{option}</Text>
                {selectedCategory === option ? (
                  <Ionicons name="checkmark" size={16} color="#2F6BFF" />
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Priority Level</Text>
        <View style={styles.priorityRow}>
          {PRIORITY_OPTIONS.map((option) => {
            const active = priority === option;
            return (
              <Pressable
                key={option}
                style={[styles.priorityButton, active && styles.priorityActive]}
                onPress={() => setPriority(option)}
              >
                <Text
                  style={[
                    styles.priorityText,
                    active && styles.priorityTextActive,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>Description</Text>
        <TextInput
          multiline
          value={description}
          onChangeText={(text) => setDescription(text.slice(0, MAX_DESCRIPTION_LENGTH))}
          placeholder="Please describe the issue in detail..."
          placeholderTextColor="#9CA3AF"
          style={styles.descriptionInput}
          textAlignVertical="top"
          maxLength={MAX_DESCRIPTION_LENGTH}
        />
        <Text style={styles.charCount}>{description.length}/{MAX_DESCRIPTION_LENGTH}</Text>

        <Text style={styles.sectionLabel}>Supporting Evidence</Text>
        <View style={styles.evidenceRow}>
          {evidence.length < 4 ? (
            <Pressable style={styles.uploadTile} onPress={openEvidencePicker}>
              <Ionicons name="camera" size={24} color="#4B5563" />
            </Pressable>
          ) : null}

          {evidence.map((item) => (
            <View key={item.id} style={styles.previewTile}>
              <Image source={{ uri: item.uri }} style={styles.previewImage} />
              <Pressable
                style={styles.removeImageButton}
                onPress={() => removeEvidenceImage(item.id)}
              >
                <Ionicons name="close" size={12} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>
        <Text style={styles.helperText}>Upload up to 4 images (JPG, PNG)</Text>

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={() => void handleSubmit()}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
          <Text style={styles.submitButtonText}>Submit Complaint</Text>
          )}
        </Pressable>

        <View style={styles.complaintsHeader}>
          <Text style={styles.complaintsTitle}>My Complaints</Text>
          <Pressable onPress={() => router.push("/booking/complaint-history")}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
        </View>

        {loadingComplaints ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="small" color="#2F6BFF" />
          </View>
        ) : complaints.length === 0 ? (
          <View style={styles.complaintCard}>
            <Text style={styles.emptyComplaintsText}>No complaints submitted yet.</Text>
          </View>
        ) : (
          complaints.slice(0, 1).map((item) => (
            <View key={item.id} style={styles.complaintCard}>
              <View style={styles.complaintTopRow}>
                <Text style={styles.complaintId}>ID: {item.id}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    item.status === "Pending"
                      ? styles.statusPending
                      : item.status === "Under Review"
                        ? styles.statusReview
                      : item.status === "Rejected"
                        ? styles.statusRejected
                        : styles.statusResolved,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      item.status === "Pending"
                        ? styles.statusPendingText
                        : item.status === "Under Review"
                          ? styles.statusReviewText
                        : item.status === "Rejected"
                          ? styles.statusRejectedText
                          : styles.statusResolvedText,
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.complaintTitle}>{item.title}</Text>
              <Text style={styles.complaintDescription}>{item.description}</Text>
              {item.adminResponse ? (
                <View style={styles.adminResponseBox}>
                  <Text style={styles.adminResponseLabel}>Admin Response</Text>
                  <Text style={styles.adminResponseText}>{item.adminResponse}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Converts a complaint label shown in the UI into the API enum value expected by the backend. */
export function toComplaintTypeValue(category: string): string {
  switch (category.trim().toLowerCase()) {
    case "late arrival":
      return "late_arrival";
    case "driver behavior":
      return "driver_behavior";
    case "bus condition":
      return "bus_condition";
    case "route issue":
      return "route_issue";
    case "payment issue":
      return "payment_issue";
    case "booking issue":
      return "booking_issue";
    case "safety concern":
      return "safety_concern";
    default:
      return "other";
  }
}

/** Picks a filename extension for uploaded evidence when the picker does not provide one. */
export function guessImageExtension(mimeType?: string | null): string {
  if (!mimeType) {
    return "jpg";
  }
  if (mimeType.includes("png")) {
    return "png";
  }
  if (mimeType.includes("webp")) {
    return "webp";
  }
  return "jpg";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSpacer: {
    width: 24,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 8,
    marginLeft: 2,
  },
  selectField: {
    minHeight: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6ECF3",
  },
  selectText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  placeholderText: {
    color: "#6B7280",
  },
  categoryMenu: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginTop: -4,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E6ECF3",
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  categoryOptionText: {
    fontSize: 13,
    color: "#1F2937",
    fontWeight: "600",
  },
  priorityRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E6ECF3",
  },
  priorityButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  priorityActive: {
    backgroundColor: "#2F6BFF",
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  priorityTextActive: {
    color: "#FFFFFF",
  },
  descriptionInput: {
    minHeight: 128,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 18,
    color: "#111827",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#E6ECF3",
  },
  charCount: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    textAlign: "right",
    marginBottom: 12,
  },
  evidenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  uploadTile: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#D7E0EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  previewTile: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#E5E7EB",
    borderWidth: 1,
    borderColor: "#E6ECF3",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeImageButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(31, 41, 55, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  helperText: {
    fontSize: 11, fontWeight: "500",
    color: "#94A3B8",
    marginBottom: 22,
    marginLeft: 2,
  },
  submitButton: {
    backgroundColor: "#2F6BFF",
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1D4ED8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 22,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  submitButtonDisabled: {
    opacity: 0.8,
  },
  complaintsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  complaintsTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1F2937",
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#3B82F6",
  },
  complaintCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E6ECF3",
  },
  complaintTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  complaintId: {
    fontSize: 10,
    fontWeight: "700",
    color: "#CBD5E1",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPending: {
    backgroundColor: "#FEF3C7",
  },
  statusReview: {
    backgroundColor: "#DBEAFE",
  },
  statusResolved: {
    backgroundColor: "#DCFCE7",
  },
  statusRejected: {
    backgroundColor: "#F3F4F6",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusPendingText: {
    color: "#D97706",
  },
  statusReviewText: {
    color: "#2563EB",
  },
  statusResolvedText: {
    color: "#15803D",
  },
  statusRejectedText: {
    color: "#6B7280",
  },
  complaintTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 6,
  },
  complaintDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748B",
  },
  adminResponseBox: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E6ECF3",
    padding: 10,
  },
  adminResponseLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 5,
    textTransform: "uppercase",
  },
  adminResponseText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#475569",
  },
  loadingBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  emptyComplaintsText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
});
