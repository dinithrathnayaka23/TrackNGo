import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSession } from "../../store/sessionStore";
import { createCorporateContract, getCorporateContracts } from "../../services/corporateApi";
import { API_BASE_URL as ENV_API_BASE_URL } from "../../config/env";

const API_BASE_URL = `${ENV_API_BASE_URL}/api`;

// ─── Entrance animation hook ──────────────────────────────────────────────────

function useFadeSlide(delay: number, trigger: number = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(18);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, trigger, opacity, translateY]);

  return { opacity, translateY };
}

// ─── Mock Data for Buses ─────────────────────────────────────────────────────

const LUXURY_BUSES = [
  {
    id: 1,
    name: "Executive Voyager X1",
    capacity: 40,
    image: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80",
    amenities: ["Wi-Fi", "Full AC", "Charger"],
    fee: 150000,
  },
  {
    id: 2,
    name: "Urban Shuttle Pro",
    capacity: 28,
    image: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&q=80",
    amenities: ["Wi-Fi", "Full AC"],
    fee: 90000,
  },
  {
    id: 3,
    name: "Premium Coach XL",
    capacity: 28,
    image: "https://images.unsplash.com/photo-1464219789935-c2d9d9aba644?w=800&q=80",
    amenities: ["Entertainment"],
    fee: 110000,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewContractScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { currentUser } = useSession();

  const initContractId = params.contractId ? parseInt(params.contractId as string, 10) : null;
  const initStep = params.step ? parseInt(params.step as string, 10) : 1;

  const [step, setStep] = useState(initStep);
  const [submitting, setSubmitting] = useState(false);

  // 🔹 Location State (Mirrors BookATrip.tsx)
  const [startLocationQuery, setStartLocationQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [startLocationObj, setStartLocationObj] = useState<any>(null);
  const [destinationObj, setDestinationObj] = useState<any>(null);
  const [startLocationResults, setStartLocationResults] = useState<any[]>([]);
  const [destinationResults, setDestinationResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // 🔹 Other Form State
  const [employees, setEmployees] = useState("");
  
  // 🔹 Date & Time State
  const [startDateObj, setStartDateObj] = useState<Date | null>(null);
  const [endDateObj, setEndDateObj] = useState<Date | null>(null);
  const [startTimeObj, setStartTimeObj] = useState<Date | null>(null);
  const [endTimeObj, setEndTimeObj] = useState<Date | null>(null);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [selectedBusId, setSelectedBusId] = useState<number | null>(null);

  // 🔹 Negotiation / Contract Submission State
  const [contractId, setContractId] = useState<number | null>(initContractId);
  const [contractStatus, setContractStatus] = useState<string>("pending");
  const [submittingContract, setSubmittingContract] = useState(false);

  // Load existing contract details if jumping into negotiation
  useEffect(() => {
    if (initContractId && currentUser) {
      getCorporateContracts(currentUser.userId).then((contracts) => {
        const current = contracts.find(c => c.contractId === initContractId);
        if (current) {
          setStartLocationObj({ name: current.startingLocation });
          setDestinationObj({ name: current.destination });
          setStartTimeObj(new Date(`1970-01-01T${current.startShiftTime}`));
          setEndTimeObj(new Date(`1970-01-01T${current.endShiftTime}`));
          setSelectedBusId(current.busId || null);
          setContractStatus(current.status);
          setEmployees("N/A"); // Default fallback, as it's not saved in DB
          setStartDateObj(new Date(current.startDate));
          setEndDateObj(new Date(current.endDate));
        }
      });
    }
  }, [initContractId, currentUser]);

  // Admin contact info (mock — replace with actual data if available)
  const ADMIN_INFO = {
    name: "Dinith Rathnayaka",
    role: "Main Admin",
    phone: "+94701803826",
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
  };

  const anim = useFadeSlide(0, step);

  // Derived
  const selectedBus = LUXURY_BUSES.find((b) => b.id === selectedBusId);
  const monthlyAmount = selectedBus ? selectedBus.fee / 12 : 120000;

  // Per-step validation — button turns blue only when all required fields are filled
  const isStepValid =
    step === 1
      ? !!(startLocationObj && destinationObj && employees && startTimeObj && endTimeObj && startDateObj && endDateObj)
      : step === 2
      ? !!selectedBusId
      : true; // Step 3 (negotiation) always shows footer; Accept Offer has its own logic

  // ─── Polling: check contract approval status while on step 3 ───
  useEffect(() => {
    if (step !== 3 || !contractId || !currentUser) return;
    const poll = async () => {
      try {
        const contracts = await getCorporateContracts(currentUser.userId);
        const current = contracts.find((c) => c.contractId === contractId);
        if (current) setContractStatus(current.status);
      } catch (e) {
        console.warn("[Negotiation] Poll failed:", e);
      }
    };
    poll(); // immediate first check
    const interval = setInterval(poll, 10000); // every 10s
    return () => clearInterval(interval);
  }, [step, contractId, currentUser]);

  // ─── Location Search Logic ───
  useEffect(() => {
    const search = async (query: string, setResults: (data: any[]) => void, selectedItem: any) => {
      if (selectedItem && selectedItem.name === query) {
        setResults([]);
        return;
      }
      if (query.length < 3) {
        setResults([]);
        return;
      }
      try {
        setLoadingSearch(true);
        const response = await fetch(`${API_BASE_URL}/locations/search?query=${query}`);
        const data = await response.json();
        setResults(data);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoadingSearch(false);
      }
    };

    const timer = setTimeout(() => search(startLocationQuery, setStartLocationResults, startLocationObj), 300);
    return () => clearTimeout(timer);
  }, [startLocationQuery, startLocationObj]);

  useEffect(() => {
    const search = async (query: string, setResults: (data: any[]) => void, selectedItem: any) => {
      if (selectedItem && selectedItem.name === query) {
        setResults([]);
        return;
      }
      if (query.length < 3) {
        setResults([]);
        return;
      }
      try {
        setLoadingSearch(true);
        const response = await fetch(`${API_BASE_URL}/locations/search?query=${query}`);
        const data = await response.json();
        setResults(data);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoadingSearch(false);
      }
    };

    const timer = setTimeout(() => search(destinationQuery, setDestinationResults, destinationObj), 300);
    return () => clearTimeout(timer);
  }, [destinationQuery, destinationObj]);

  // ─── Step Management ───
  const handleNext = async () => {
    if (step === 1) {
      if (!startLocationObj || !destinationObj || !employees || !startTimeObj || !endTimeObj || !startDateObj || !endDateObj) {
        Alert.alert("Missing Fields", "Please fill in all details, making sure to select locations from the dropdown list.");
        return;
      }
      if (startDateObj && endDateObj && endDateObj < startDateObj) {
        Alert.alert("Invalid Dates", "End Date cannot be before Start Date.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!selectedBusId) {
        Alert.alert("Selection Required", "Please choose a bus.");
        return;
      }
      // Submit contract to backend when entering negotiation
      if (!currentUser || !startLocationObj || !destinationObj || !startTimeObj || !endTimeObj || !startDateObj || !endDateObj) return;
      setSubmittingContract(true);
      try {
        const formatApiDate = (dt: Date) => dt.toISOString().split('T')[0];
        const formatApiTime = (dt: Date) => dt.toTimeString().split(' ')[0];
        const created = await createCorporateContract({
          contractName: `${startLocationObj.name} to ${destinationObj.name} Contract`,
          startingLocation: startLocationObj.name,
          destination: destinationObj.name,
          startShiftTime: formatApiTime(startTimeObj),
          endShiftTime: formatApiTime(endTimeObj),
          billingAmount: monthlyAmount,
          startDate: formatApiDate(startDateObj),
          endDate: formatApiDate(endDateObj),
          corporateUserId: currentUser.userId,
        });

        // Backend returns the created contract. If null (older backend), fetch the latest one.
        let resolvedId: number | null = created?.contractId ?? null;
        let resolvedStatus: string = created?.status ?? "pending";

        if (!resolvedId) {
          // Fallback: fetch the latest contract for this user
          const allContracts = await getCorporateContracts(currentUser.userId);
          if (allContracts.length > 0) {
            const latest = allContracts[0]; // ordered by created_at DESC
            resolvedId = latest.contractId;
            resolvedStatus = latest.status;
          }
        }

        setContractId(resolvedId);
        setContractStatus(resolvedStatus);
        setStep(3);
      } catch (err) {
        Alert.alert("Submission Error", "Failed to submit contract request. Please try again.");
        console.error(err);
      } finally {
        setSubmittingContract(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleAccept = () => {
    // Step 4 final acceptance — navigate back to contract list
    Alert.alert("Success", "Contract has been accepted!", [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  const handleAcceptOffer = () => {
    // Move from Negotiation → Contract Proposal
    setStep(4);
  };


  // ─── UI Helpers ───
  const renderCityDropdown = (query: string, setQuery: (t: string) => void, results: any[], setResults: (data: any[]) => void, setSelected: (item: any) => void, selectedItem: any, icon: keyof typeof Ionicons.glyphMap, placeholder: string) => (
    <View style={{ marginBottom: 16, zIndex: results.length > 0 ? 100 : 1 }}>
      <View style={styles.inputWrapper}>
        <Ionicons name={icon} size={20} color="#067BF9" style={styles.inputIcon} />
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          value={query}
          onChangeText={(text) => { setQuery(text); setSelected(null); }}
          placeholderTextColor="#94A3B8"
        />
      </View>
      {loadingSearch && query.length >= 3 && <ActivityIndicator size="small" color="#2F6BFF" style={{ marginTop: 4, alignSelf: 'flex-start' }} />}
      {query.length >= 3 && results.length === 0 && !loadingSearch && !selectedItem && <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Searching for locations...</Text>}
      {query.length >= 3 && results.length > 0 && (
        <View style={styles.dropdownContainer}>
          <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {results.map((item) => (
              <TouchableOpacity key={item.id} style={styles.dropdownItem} onPress={() => { setSelected(item); setQuery(item.name); setResults([]); }}>
                <Text style={styles.dropdownItemText}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  // ─── Render Steps ─────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Logistics Details</Text>
      <Text style={styles.stepSubtitle}>Step 1 of 4: Set up your initial route and employee capacity details.</Text>

      <Text style={styles.inputLabelOutside}>Route Start Point</Text>
      {renderCityDropdown(startLocationQuery, setStartLocationQuery, startLocationResults, setStartLocationResults, setStartLocationObj, startLocationObj, "location", "Type or select start point")}

      <Text style={styles.inputLabelOutside}>Destination</Text>
      {renderCityDropdown(destinationQuery, setDestinationQuery, destinationResults, setDestinationResults, setDestinationObj, destinationObj, "flag", "Type or select destination")}

      <Text style={styles.inputLabelOutside}>Estimated Employees</Text>
      <View style={[styles.inputWrapper, { marginBottom: 20 }]}>
        <TextInput
          style={styles.textInput}
          placeholder="e.g. 50"
          value={employees}
          onChangeText={setEmployees}
          keyboardType="numeric"
          placeholderTextColor="#94A3B8"
        />
      </View>

      <Text style={styles.inputLabelOutside}>Shift Timings</Text>
      <View style={styles.row}>
        <View style={[styles.inputWrapper, { flex: 1, marginBottom: 0 }]}>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onPress={() => setShowStartTimePicker(true)}>
            <Text style={[styles.textInput, { color: startTimeObj ? '#1E293B' : '#94A3B8' }]}>
              {startTimeObj ? startTimeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Start Time"}
            </Text>
            <Ionicons name="time-outline" size={20} color="#64748B" />
          </TouchableOpacity>
          {showStartTimePicker && <DateTimePicker value={startTimeObj || new Date()} mode="time" display="default" onChange={(e, d) => { setShowStartTimePicker(false); if (d) setStartTimeObj(d); }} />}
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.inputWrapper, { flex: 1, marginBottom: 0 }]}>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onPress={() => setShowEndTimePicker(true)}>
            <Text style={[styles.textInput, { color: endTimeObj ? '#1E293B' : '#94A3B8' }]}>
              {endTimeObj ? endTimeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "End Time"}
            </Text>
            <Ionicons name="time-outline" size={20} color="#64748B" />
          </TouchableOpacity>
          {showEndTimePicker && <DateTimePicker value={endTimeObj || new Date()} mode="time" display="default" onChange={(e, d) => { setShowEndTimePicker(false); if (d) setEndTimeObj(d); }} />}
        </View>
      </View>
      <View style={{ marginBottom: 20 }} />

      <Text style={styles.inputLabelOutside}>Contract Duration</Text>
      <View style={styles.row}>
        <View style={[styles.inputWrapper, { flex: 1 }]}>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onPress={() => setShowStartDatePicker(true)}>
            <Text style={[styles.textInput, { color: startDateObj ? '#1E293B' : '#94A3B8' }]}>
              {startDateObj ? startDateObj.toLocaleDateString() : "Start Date"}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#64748B" />
          </TouchableOpacity>
          {showStartDatePicker && <DateTimePicker value={startDateObj || new Date()} mode="date" display="default" minimumDate={new Date()} onChange={(e, d) => { setShowStartDatePicker(false); if (d) setStartDateObj(d); }} />}
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.inputWrapper, { flex: 1 }]}>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onPress={() => setShowEndDatePicker(true)}>
            <Text style={[styles.textInput, { color: endDateObj ? '#1E293B' : '#94A3B8' }]}>
              {endDateObj ? endDateObj.toLocaleDateString() : "End Date"}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#64748B" />
          </TouchableOpacity>
          {showEndDatePicker && <DateTimePicker value={endDateObj || startDateObj || new Date()} mode="date" display="default" minimumDate={startDateObj || new Date()} onChange={(e, d) => { setShowEndDatePicker(false); if (d) setEndDateObj(d); }} />}
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose your Bus</Text>
      <Text style={styles.stepSubtitle}>Select a luxury bus model for your corporate contract.</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color="#000" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.textInput}
          placeholder="Search luxury buses or capacity"
          placeholderTextColor="#64748B"
        />
      </View>

      <View style={styles.filterRow}>
        <View style={styles.filterChipActive}>
          <Text style={styles.filterChipTextActive}>All Buses</Text>
        </View>
        <View style={styles.filterChip}>
          <Text style={styles.filterChipText}>Luxury</Text>
          <Ionicons name="chevron-down" size={14} color="#1E293B" style={{ marginLeft: 4 }} />
        </View>
        <View style={styles.filterChip}>
          <Text style={styles.filterChipText}>30-50 Seats</Text>
          <Ionicons name="chevron-down" size={14} color="#1E293B" style={{ marginLeft: 4 }} />
        </View>
      </View>

      <Text style={styles.availableText}>Available Fleets ({LUXURY_BUSES.length})</Text>

      {LUXURY_BUSES.map((bus) => (
        <View
          key={bus.id}
          style={[
            styles.busCard,
            selectedBusId === bus.id && styles.busCardSelected,
          ]}
        >
          <Image source={{ uri: bus.image }} style={styles.busImage} />
          <View style={styles.busInfo}>
            <View style={styles.busTopRow}>
              <Text style={styles.busName}>{bus.name}</Text>
              <View style={{ alignItems: "center" }}>
                <View style={styles.capacityRow}>
                  <MaterialCommunityIcons name="wheelchair-accessibility" size={14} color="#64748B" />
                  <Text style={styles.busCapacity}>{bus.capacity}</Text>
                </View>
                <Text style={styles.capacityLabel}>Capacity</Text>
              </View>
            </View>

            <View style={styles.busBottomRow}>
              <View style={styles.amenitiesRow}>
                {bus.amenities.map((amenity, i) => (
                  <View key={i} style={styles.amenityItem}>
                    <Ionicons
                      name={amenity === "Wi-Fi" ? "wifi" : amenity === "Full AC" ? "snow" : "battery-charging"}
                      size={14}
                      color="#64748B"
                    />
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[
                  styles.selectBusBtn,
                  selectedBusId === bus.id && styles.selectBusBtnActive,
                ]}
                onPress={() => setSelectedBusId(bus.id)}
              >
                <Text style={styles.selectBusBtnText}>Select</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderStep3 = () => {
    const isApproved = contractStatus === "active";
    const submittedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={styles.stepContainer}>
        {/* Request Sent Hero */}
        <View style={styles.negoHeroCard}>
          <View style={styles.negoCheckCircle}>
            <Ionicons name="checkmark" size={28} color="#FFFFFF" />
          </View>
          <Text style={styles.negoHeroTitle}>Request Sent!</Text>
          <View style={styles.negoPendingBadge}>
            <View style={[styles.negoDot, { backgroundColor: isApproved ? "#10B981" : "#F59E0B" }]} />
            <Text style={[styles.negoPendingText, { color: isApproved ? "#065F46" : "#B45309" }]}>
              {isApproved ? "Approved" : "Pending Approval"}
            </Text>
          </View>
          <Text style={styles.negoHeroSubtitle}>
            Your contract request for the corporate fleet has been sent to our fleet managers. Admin will contact you shortly to finalize details.
          </Text>
        </View>

        {/* Admin Contact Card */}
        <Text style={styles.negoSectionLabel}>Admin</Text>
        <View style={styles.negoAdminCard}>
          <Image source={{ uri: ADMIN_INFO.avatar }} style={styles.negoAdminAvatar} />
          <View style={styles.negoAdminInfo}>
            <Text style={styles.negoAdminName}>{ADMIN_INFO.name}</Text>
            <Text style={styles.negoAdminRole}>{ADMIN_INFO.role}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Ionicons name="call" size={13} color="#10B981" />
              <Text style={styles.negoAdminPhone}>{ADMIN_INFO.phone}</Text>
            </View>
          </View>
        </View>
        <View style={styles.negoActionRow}>
          <TouchableOpacity style={styles.negoCallBtn} onPress={() => Linking.openURL(`tel:${ADMIN_INFO.phone}`)}>
            <Ionicons name="call" size={18} color="#FFFFFF" />
            <Text style={styles.negoCallText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.negoChatBtn} onPress={() => Alert.alert("Chat", "Chat feature coming soon!") }>
            <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
            <Text style={styles.negoChatText}>Chat</Text>
          </TouchableOpacity>
        </View>

        {/* Contract Summary */}
        <Text style={styles.negoSectionLabel}>Contract Summary</Text>
        <View style={styles.negoSummaryCard}>
          <View style={styles.negoSummaryRow}>
            <View style={styles.negoSummaryIcon}>
              <Ionicons name="swap-horizontal" size={18} color="#64748B" />
            </View>
            <View>
              <Text style={styles.negoSummaryRowLabel}>Route & Schedule</Text>
              <Text style={styles.negoSummaryRowValue}>
                {startLocationObj?.name} ↔ {destinationObj?.name}
              </Text>
              <Text style={styles.negoSummaryRowMeta}>
                {startTimeObj?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {endTimeObj?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} Shift
              </Text>
            </View>
          </View>
          <View style={styles.negoSummaryDivider} />
          <View style={styles.negoSummaryRow}>
            <View style={styles.negoSummaryIcon}>
              <Ionicons name="bus" size={18} color="#64748B" />
            </View>
            <View>
              <Text style={styles.negoSummaryRowLabel}>Selected Bus</Text>
              <Text style={styles.negoSummaryRowValue}>{selectedBus?.name} ({selectedBus?.capacity} Pax)</Text>
            </View>
          </View>
          <View style={styles.negoSummaryDivider} />
          <View style={styles.negoSummaryRow}>
            <View style={styles.negoSummaryIcon}>
              <Ionicons name="people" size={18} color="#64748B" />
            </View>
            <View>
              <Text style={styles.negoSummaryRowLabel}>Employees</Text>
              <Text style={styles.negoSummaryRowValue}>{employees}</Text>
            </View>
          </View>
        </View>

        {/* Progress Timeline */}
        <Text style={styles.negoSectionLabel}>Progress Timeline</Text>
        <View style={styles.negoTimeline}>
          {/* Step 1 */}
          <View style={styles.negoTimelineRow}>
            <View style={[styles.negoTimelineDot, { backgroundColor: "#067BF9" }]}>
              <Ionicons name="checkmark" size={12} color="#FFF" />
            </View>
            <View style={styles.negoTimelineContent}>
              <Text style={styles.negoTimelineTitle}>Request Submitted</Text>
              <Text style={styles.negoTimelineSub}>Today, {submittedTime}</Text>
            </View>
          </View>
          <View style={styles.negoTimelineConnector} />
          {/* Step 2 */}
          <View style={styles.negoTimelineRow}>
            <View style={[styles.negoTimelineDot, { backgroundColor: isApproved ? "#067BF9" : "#94A3B8" }]}>
              {isApproved
                ? <Ionicons name="checkmark" size={12} color="#FFF" />
                : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFF" }} />}
            </View>
            <View style={styles.negoTimelineContent}>
              <Text style={styles.negoTimelineTitle}>Negotiation in Progress</Text>
              <Text style={[styles.negoTimelineSub, { color: "#067BF9" }]}>
                {isApproved ? "Admin has approved your request" : `${ADMIN_INFO.name.split(" ")[0]} is reviewing your request`}
              </Text>
            </View>
          </View>
          <View style={styles.negoTimelineConnector} />
          {/* Step 3 */}
          <View style={styles.negoTimelineRow}>
            <View style={[styles.negoTimelineDot, { backgroundColor: isApproved ? "#10B981" : "#CBD5E1" }]}>
              {isApproved
                ? <Ionicons name="checkmark" size={12} color="#FFF" />
                : null}
            </View>
            <View style={styles.negoTimelineContent}>
              <Text style={[styles.negoTimelineTitle, { color: isApproved ? "#0F172A" : "#94A3B8" }]}>Final Contract Generation</Text>
              <Text style={styles.negoTimelineSub}>{isApproved ? "Ready to review" : "Expected in 1-2 hours"}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 16 }} />
        {!isApproved && (
          <Text style={styles.negoWaitingText}>Waiting for admin's offer...</Text>
        )}
        <View style={{ height: 60 }} />
      </View>
    );
  };

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <View style={styles.proposalHeader}>
        <View style={styles.inReviewBadge}>
          <Text style={styles.inReviewText}>In Review</Text>
        </View>
        <Text style={styles.proposalLabel}>Proposed Monthly Amount</Text>
        <Text style={styles.proposalAmount}>Rs. {monthlyAmount.toLocaleString()}</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeaderRow}>
          <Ionicons name="document-text" size={20} color="#067BF9" />
          <Text style={styles.summaryTitle}>Contract Summary</Text>
        </View>

        <View style={styles.routeSummaryRow}>
          <View style={styles.mapMockup}>
            {/* Simple mock map lines */}
            <View style={styles.mockPath1} />
            <View style={styles.mockPath2} />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.summarySubLabel}>Primary Route</Text>
            <Text style={styles.summaryRouteText}>
              {startLocationObj?.name || "Downtown"} to {destinationObj?.name || "Corporate Park"}
            </Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.summarySubLabel}>Employee Count</Text>
            <Text style={styles.statValue}>{employees || "36"}</Text>
          </View>
          <View style={{ width: 12 }} />
          <View style={styles.statBox}>
            <Text style={styles.summarySubLabel}>Contract Period</Text>
            <Text style={styles.statValue}>12 Months</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Standard Inclusions</Text>
        <View style={{ height: 12 }} />
        <View style={styles.inclusionRow}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.inclusionText}>Automated Monthly Billing Reports</Text>
        </View>
      </View>

      <View style={{ height: 20 }} />
      <TouchableOpacity
        style={styles.acceptBtn}
        onPress={handleAccept}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.acceptBtnText}>Accept Contract</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.rejectBtn} onPress={handleBack} disabled={submitting}>
        <Ionicons name="close-circle" size={20} color="#EF4444" />
        <Text style={styles.rejectBtnText}>Reject Contract</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {step === 3 ? "Negotiation" : step === 4 ? "Contract Proposal" : "New Contract"}
        </Text>
        <TouchableOpacity style={styles.downloadBtn}>
          <Ionicons name="download-outline" size={22} color="#067BF9" />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressLine, step >= 1 && styles.progressActive]} />
        <View style={[styles.progressLine, step >= 2 && styles.progressActive]} />
        <View style={[styles.progressLine, step >= 3 && styles.progressActive]} />
        <View style={[styles.progressLine, step >= 4 && styles.progressActive]} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Animated.View
            style={{
              opacity: anim.opacity,
              transform: [{ translateY: anim.translateY }],
            }}
          >
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer Buttons */}
      {step < 4 && (
        <View style={styles.footer}>
          {step === 3 ? (
            // Negotiation step: Accept Final Offer button
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={handleAcceptOffer}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.nextBtnText}>Accept Final Offer</Text>
            </TouchableOpacity>
          ) : (
            // Normal Next Step button
            <TouchableOpacity
              style={[styles.nextBtn, !isStepValid && styles.nextBtnDisabled]}
              onPress={handleNext}
              activeOpacity={isStepValid ? 0.8 : 1}
              disabled={submittingContract}
            >
              {submittingContract ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>Next Step</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    height: 60,
    backgroundColor: "#FFFFFF",
  },
  backBtn: { width: 32, alignItems: "flex-start" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1E293B" },
  downloadBtn: { width: 32, alignItems: "flex-end" },

  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
    gap: 8,
  },
  progressLine: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DBEAFE",
  },
  progressActive: { backgroundColor: "#067BF9" },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },

  stepContainer: { flex: 1 },
  stepTitle: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginBottom: 6 },
  stepSubtitle: { fontSize: 13, color: "#64748B", marginBottom: 24, lineHeight: 18 },

  // Form Step 1
  inputLabelOutside: { fontSize: 13, fontWeight: "700", color: "#1E293B", marginBottom: 8, marginTop: 4 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 0,
  },
  inputIcon: { marginRight: 10 },
  textInput: { flex: 1, fontSize: 14, color: "#1E293B" },
  row: { flexDirection: "row" },
  
  // Dropdown for search
  dropdownContainer: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#067BF9',
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 5, // for android shadow
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: "500",
  },

  // Step 2 Bus Selection
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  filterRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  filterChipActive: {
    backgroundColor: "#BFDBFE",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipTextActive: { color: "#1D4ED8", fontSize: 12, fontWeight: "700" },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipText: { color: "#1E293B", fontSize: 12, fontWeight: "600" },
  availableText: { fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 12 },
  busCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    marginBottom: 16,
  },
  busCardSelected: { borderColor: "#067BF9", borderWidth: 2 },
  busImage: { width: "100%", height: 160, backgroundColor: "#E2E8F0" },
  busInfo: { padding: 16 },
  busTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  busName: { fontSize: 16, fontWeight: "700", color: "#1E293B", flex: 1 },
  capacityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  busCapacity: { fontSize: 14, fontWeight: "700", color: "#64748B" },
  capacityLabel: { fontSize: 11, fontWeight: "600", color: "#94A3B8" },
  busBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amenitiesRow: { flexDirection: "row", gap: 12 },
  amenityItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  amenityText: { fontSize: 11, color: "#64748B" },
  selectBusBtn: { backgroundColor: "#067BF9", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 },
  selectBusBtnActive: { backgroundColor: "#1D4ED8" },
  selectBusBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },

  // Step 3
  servicesCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  serviceItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  serviceText: { fontSize: 14, color: "#1E293B", fontWeight: "500" },

  // Step 4 Proposal
  proposalHeader: { alignItems: "center", marginBottom: 24, marginTop: 12 },
  inReviewBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  inReviewText: { color: "#2563EB", fontSize: 12, fontWeight: "600" },
  proposalLabel: { fontSize: 11, color: "#64748B", fontWeight: "600", marginBottom: 8 },
  proposalAmount: { fontSize: 28, fontWeight: "800", color: "#0F172A" },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  summaryHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  summaryTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  routeSummaryRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  mapMockup: {
    width: 60,
    height: 60,
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
    position: "relative",
    overflow: "hidden",
  },
  mockPath1: { position: "absolute", top: 10, left: 20, width: 2, height: 20, backgroundColor: "#067BF9" },
  mockPath2: { position: "absolute", top: 30, left: 20, width: 20, height: 2, backgroundColor: "#EF4444" },
  summarySubLabel: { fontSize: 11, fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", marginBottom: 4 },
  summaryRouteText: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  statsRow: { flexDirection: "row", gap: 12 },
  statBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  statValue: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  inclusionRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  inclusionText: { fontSize: 14, color: "#475569" },

  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  acceptBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  rejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  rejectBtnText: { color: "#EF4444", fontSize: 14, fontWeight: "700" },

  // Footer next
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  nextBtn: {
    backgroundColor: "#067BF9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
  },
  nextBtnDisabled: {
    backgroundColor: "#CBD5E1",
  },
  nextBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },

  // ─── Negotiation Screen Styles ────────────────────────────────────────────
  negoHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  negoCheckCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#067BF9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  negoHeroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  negoPendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  negoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  negoPendingText: {
    fontSize: 12,
    fontWeight: "700",
  },
  negoHeroSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  negoSectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  negoAdminCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  negoAdminAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E2E8F0",
  },
  negoAdminInfo: { flex: 1 },
  negoAdminName: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  negoAdminRole: { fontSize: 12, color: "#64748B", marginTop: 2 },
  negoAdminPhone: { fontSize: 13, fontWeight: "600", color: "#10B981" },
  negoActionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  negoCallBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  negoCallText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  negoChatBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#067BF9",
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  negoChatText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  negoSummaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 24,
  },
  negoSummaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 14,
  },
  negoSummaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  negoSummaryDivider: { height: 1, backgroundColor: "#F1F5F9", marginHorizontal: 14 },
  negoSummaryRowLabel: { fontSize: 11, fontWeight: "600", color: "#94A3B8", marginBottom: 3 },
  negoSummaryRowValue: { fontSize: 13, fontWeight: "600", color: "#0F172A" },
  negoSummaryRowMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  negoTimeline: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  negoTimelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  negoTimelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  negoTimelineConnector: {
    width: 2,
    height: 24,
    backgroundColor: "#E2E8F0",
    marginLeft: 13,
    marginVertical: 4,
  },
  negoTimelineContent: { flex: 1, paddingBottom: 4 },
  negoTimelineTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  negoTimelineSub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  negoWaitingText: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 8,
  },
});

