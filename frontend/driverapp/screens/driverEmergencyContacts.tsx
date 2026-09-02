import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@/context/UserContext";
import {
  addEmergencyContact,
  deleteEmergencyContact,
  getEmergencyContacts,
  type EmergencyContactDto,
} from "@/services/emergencyContactApi";

export default function DriverEmergencyContactsScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [contacts, setContacts] = useState<EmergencyContactDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [teleNumber, setTeleNumber] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saving, setSaving] = useState(false);

  const loadContacts = useCallback(async () => {
    if (!user?.userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getEmergencyContacts(user.userId);
      setContacts(data);
    } catch (error) {
      console.error("Failed to load driver emergency contacts", error);
      Alert.alert("Error", "Failed to load emergency contacts.");
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useFocusEffect(
    useCallback(() => {
      void loadContacts();
    }, [loadContacts]),
  );

  const resetForm = () => {
    setName("");
    setTeleNumber("");
    setRelationship("");
  };

  const handleDelete = (contact: EmergencyContactDto) => {
    Alert.alert(
      "Delete Contact",
      `Remove ${contact.name} from emergency contacts?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEmergencyContact(contact.contactId);
              setContacts((current) =>
                current.filter((item) => item.contactId !== contact.contactId),
              );
            } catch {
              Alert.alert("Error", "Failed to delete contact.");
            }
          },
        },
      ],
    );
  };

  const handleAdd = async () => {
    if (!name.trim() || !teleNumber.trim()) {
      Alert.alert("Validation", "Name and phone number are required.");
      return;
    }
    if (!user?.userId) return;

    setSaving(true);
    try {
      const created = await addEmergencyContact({
        ownerId: user.userId,
        name: name.trim(),
        teleNumber: teleNumber.trim(),
        relationship: relationship.trim() || undefined,
      });
      setContacts((current) => [created, ...current]);
      resetForm();
      setModalVisible(false);
    } catch {
      Alert.alert("Error", "Failed to add contact.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1F2937" />
        </Pressable>
        <Text style={styles.headerTitle}>Emergency contacts</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#1A73E8" />
        </View>
      ) : (
        <View style={styles.list}>
          {contacts.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>No emergency contacts yet.</Text>
            </View>
          ) : null}

          {contacts.map((contact) => (
            <View key={contact.contactId} style={styles.contactRow}>
              <View style={styles.contactTextWrap}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactNumber}>{contact.teleNumber}</Text>
                {contact.relationship ? (
                  <Text style={styles.contactRelationship}>
                    {contact.relationship}
                  </Text>
                ) : null}
              </View>
              <Pressable
                testID={`delete-contact-${contact.contactId}`}
                onPress={() => handleDelete(contact)}
              >
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={18}
                  color="#EF4444"
                />
              </Pressable>
            </View>
          ))}

          <Pressable
            testID="open-add-contact-modal"
            style={styles.addRow}
            onPress={() => setModalVisible(true)}
          >
            <View style={styles.addLeft}>
              <View style={styles.addIcon}>
                <MaterialCommunityIcons name="account" size={16} color="#F97316" />
              </View>
              <Text style={styles.addText}>Add contact</Text>
            </View>
            <MaterialCommunityIcons name="plus" size={18} color="#1A73E8" />
          </Pressable>
        </View>
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Emergency Contact</Text>

            <Text style={styles.inputLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Contact name"
              placeholderTextColor="#A6B0C3"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.inputLabel}>Phone Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="+94XXXXXXXXX"
              placeholderTextColor="#A6B0C3"
              keyboardType="phone-pad"
              value={teleNumber}
              onChangeText={setTeleNumber}
            />

            <Text style={styles.inputLabel}>Relationship</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Spouse, Friend"
              placeholderTextColor="#A6B0C3"
              value={relationship}
              onChangeText={setRelationship}
            />

            <View style={styles.modalButtons}>
              <Pressable
                testID="cancel-add-contact"
                style={styles.cancelButton}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                testID="save-contact-button"
                style={styles.saveButton}
                onPress={() => void handleAdd()}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7F9FC",
  },
  headerRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerSpacer: {
    width: 34,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    marginTop: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
  },
  emptyRow: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
  },
  contactRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contactTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  contactName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1F2937",
  },
  contactNumber: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: "#9AA4B2",
  },
  contactRelationship: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "500",
    color: "#64748B",
  },
  addRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  addLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FDEBD2",
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A73E8",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
    marginBottom: 14,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#1A73E8",
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
