import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
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
import {
  createCorporateContract,
  getCorporateContracts,
  getAvailableCorporateBuses,
  finalizeCorporateContract,
  getSupportContact,
  formatAmount,
  parseBusAmenities,
  type ShiftType,
  type WorkingDays,
  type BusType,
  type ShiftLeg,
  type ContractBus,
  type CorporateContract,
  type SupportContact,
} from "../../services/corporateApi";
import GooglePlaceField, { type PlaceValue } from "../../components/GooglePlaceField";
import { createConversation } from "../../services/chatApi";
import { ADMIN_SUPPORT_USER_ID, API_BASE_URL } from "../../config/env";
import { WebView } from "react-native-webview";
import { createStripeCheckoutSession, getStripeSessionStatus } from "../../services/bookingFlowApi";
import { payAdvanceDeposit } from "../../services/corporateApi";
import { getUserProfile } from "../../services/userProfileApi";

// ─── Road-distance helper (same OSRM approach used in BookATrip.tsx) ─────────
// Avoids Google Directions billing: any two selected locations get a real
// road-distance figure, which feeds directly into the standard fare formula.
type Coord = { latitude: number; longitude: number };

function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = (b.latitude - a.latitude) * (Math.PI / 180);
  const dLon = (b.longitude - a.longitude) * (Math.PI / 180);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * (Math.PI / 180)) *
      Math.cos(b.latitude * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

type RoadRoute = { distanceKm: number; durationMinutes: number };

// Fallback average speed when OSRM is unreachable — used only to keep the
// pickup/drop-off time estimate roughly sane, not for pricing (pricing always
// uses the real OSRM distance when available).
const FALLBACK_AVERAGE_KMH = 35;

async function getRoadRoute(start: Coord, end: Coord): Promise<RoadRoute> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${start.longitude},${start.latitude};${end.longitude},${end.latitude}` +
      "?overview=false&steps=false";
    const response = await fetch(url);
    const payload = await response.json();
    const route = payload?.routes?.[0];
    if (payload.code === "Ok" && Number(route?.distance) > 0) {
      return {
        distanceKm: Math.round((Number(route.distance) / 1000) * 10) / 10,
        durationMinutes: Math.max(1, Math.round(Number(route.duration) / 60)),
      };
    }
  } catch {
    // Fall through to the straight-line estimate below.
  }
  const distanceKm = Math.round(haversineKm(start, end) * 10) / 10;
  return { distanceKm, durationMinutes: Math.max(1, Math.round((distanceKm / FALLBACK_AVERAGE_KMH) * 60)) };
}

// ─── Contract term rules: at least a week's notice, a one-month minimum term,
// and a one-year maximum before the company needs to renew. ───
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewContractScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { currentUser } = useSession();

  const initContractId = params.contractId ? parseInt(params.contractId as string, 10) : null;
  const initStep = params.step ? parseInt(params.step as string, 10) : 1;

  const [step, setStep] = useState(initStep);
  const [submitting, setSubmitting] = useState(false);

  // 🔹 Other Form State
  const [employees, setEmployees] = useState("");

  // 🔹 Shift & Service Options
  const [shiftType, setShiftType] = useState<ShiftType>("both");
  const [workingDays, setWorkingDays] = useState<WorkingDays>("weekdays");
  const [busType, setBusType] = useState<BusType>("standard");

  // 🔹 Route State — place-accurate Google Places selections per shift leg
  const [morningPickup, setMorningPickup] = useState<PlaceValue>(null);
  const [morningDropoff, setMorningDropoff] = useState<PlaceValue>(null);
  const [eveningPickup, setEveningPickup] = useState<PlaceValue>(null);
  const [eveningDropoff, setEveningDropoff] = useState<PlaceValue>(null);
  // When both shifts run, the evening commute is usually the morning route
  // reversed — but the company may run a different route home, so this is a
  // convenience default the user can turn off to pick evening locations independently.
  const [sameAsMorningReversed, setSameAsMorningReversed] = useState(true);

  // 🔹 Date & Time State
  const [startDateObj, setStartDateObj] = useState<Date | null>(null);
  const [endDateObj, setEndDateObj] = useState<Date | null>(null);
  const [morningPickupObj, setMorningPickupObj] = useState<Date | null>(null);
  const [morningDropoffObj, setMorningDropoffObj] = useState<Date | null>(null);
  const [eveningPickupObj, setEveningPickupObj] = useState<Date | null>(null);
  const [eveningDropoffObj, setEveningDropoffObj] = useState<Date | null>(null);

  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showMorningDropoffPicker, setShowMorningDropoffPicker] = useState(false);
  const [showEveningPickupPicker, setShowEveningPickupPicker] = useState(false);

  // 🔹 Distance & Pricing State
  const [morningDistanceKm, setMorningDistanceKm] = useState<number | null>(null);
  const [eveningDistanceKm, setEveningDistanceKm] = useState<number | null>(null);
  const [morningDurationMin, setMorningDurationMin] = useState<number | null>(null);
  const [eveningDurationMin, setEveningDurationMin] = useState<number | null>(null);
  const [morningDistanceLoading, setMorningDistanceLoading] = useState(false);
  const [eveningDistanceLoading, setEveningDistanceLoading] = useState(false);

  // 🔹 Bus Selection State
  const [availableBuses, setAvailableBuses] = useState<ContractBus[]>([]);
  const [busesLoading, setBusesLoading] = useState(false);
  const [busesError, setBusesError] = useState<string | null>(null);
  const [selectedBusIds, setSelectedBusIds] = useState<number[]>([]);
  const [busSearch, setBusSearch] = useState("");
  const [busSort, setBusSort] = useState<"seats_desc" | "seats_asc">("seats_desc");

  // 🔹 Negotiation / Contract Submission State
  const [contractId, setContractId] = useState<number | null>(initContractId);
  const [contractStatus, setContractStatus] = useState<string>("pending");
  const [submittingContract, setSubmittingContract] = useState(false);
  const [createdContract, setCreatedContract] = useState<CorporateContract | null>(null);

  // 🔹 Advance Payment (Stripe) State
  const [showWebView, setShowWebView] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Load existing contract details if jumping into negotiation
  useEffect(() => {
    if (initContractId && currentUser) {
      getCorporateContracts(currentUser.userId).then((contracts) => {
        const current = contracts.find(c => c.contractId === initContractId);
        if (current) {
          setShiftType(current.shiftType || "both");
          setWorkingDays(current.workingDays || "weekdays");
          setBusType(current.busType || "standard");
          setSameAsMorningReversed(false);

          const applyLeg = (
            leg: typeof current.morningPickup,
            setPlace: (p: PlaceValue) => void,
            setTime: (d: Date) => void,
          ) => {
            if (!leg) return;
            setPlace({ name: leg.location, latitude: leg.latitude, longitude: leg.longitude });
            if (leg.time) setTime(new Date(`1970-01-01T${leg.time}`));
          };
          applyLeg(current.morningPickup, setMorningPickup, setMorningPickupObj);
          applyLeg(current.morningDropoff, setMorningDropoff, setMorningDropoffObj);
          applyLeg(current.eveningPickup, setEveningPickup, setEveningPickupObj);
          applyLeg(current.eveningDropoff, setEveningDropoff, setEveningDropoffObj);
          setMorningDistanceKm(current.morningDistanceKm ?? null);
          setEveningDistanceKm(current.eveningDistanceKm ?? null);

          setSelectedBusIds(current.busIds && current.busIds.length > 0 ? current.busIds : current.busId ? [current.busId] : []);
          setContractStatus(current.status);
          setEmployees(current.employeeCount ? String(current.employeeCount) : "");
          setStartDateObj(new Date(current.startDate));
          setEndDateObj(new Date(current.endDate));
          setCreatedContract(current);
        }
      });
    }
  }, [initContractId, currentUser]);

  // Admin-configured support contact, editable from the admin dashboard
  // (Settings → Corporate Support Contact). Falls back to a safe default
  // only if the fetch fails.
  const [adminInfo, setAdminInfo] = useState<SupportContact>({
    name: "TrackNGo Support",
    role: "Support Team",
    phone: "+94701803826",
  });
  useEffect(() => {
    getSupportContact()
      .then(setAdminInfo)
      .catch((e) => console.warn("[Negotiation] Failed to load support contact:", e));
  }, []);
  const adminInitials = adminInfo.name
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const anim = useFadeSlide(0, step);

  // Derived
  const selectedBuses = availableBuses.filter((b) => selectedBusIds.includes(b.busId));
  const selectedSeats = selectedBuses.reduce((sum, b) => sum + (b.seatCapacity ?? 0), 0);
  const neededSeats = parseInt(employees, 10) || 0;
  const seatsFulfilled = neededSeats > 0 && selectedSeats >= neededSeats;
  const monthlyAmount = createdContract?.billingAmount ?? 0;
  const hasDiscount = (createdContract?.discountAmount ?? 0) > 0;

  const needsMorning = shiftType === "morning" || shiftType === "both";
  const needsEvening = shiftType === "evening" || shiftType === "both";
  const useSameEveningRoute = shiftType === "both" && sameAsMorningReversed;

  const morningLegsFilled = !needsMorning || !!(morningPickup && morningDropoff && morningPickupObj && morningDropoffObj);
  const eveningLegsFilled =
    !needsEvening ||
    (useSameEveningRoute
      ? !!(morningDropoff && morningPickup && eveningPickupObj && eveningDropoffObj)
      : !!(eveningPickup && eveningDropoff && eveningPickupObj && eveningDropoffObj));
  const shiftDetailsFilled = morningLegsFilled && eveningLegsFilled;

  const morningDistanceReady = !needsMorning || !!morningDistanceKm;
  const eveningDistanceReady = !needsEvening || !!eveningDistanceKm;

  // Contract term bounds: at least a week's notice, one-month minimum, one-year maximum.
  const earliestStartDate = addDays(new Date(), 7);
  const minEndDate = addMonths(startDateObj || earliestStartDate, 1);
  const maxEndDate = addYears(startDateObj || earliestStartDate, 1);

  // Per-step validation — button turns blue only when all required fields are filled
  const isStepValid =
    step === 1
      ? !!(employees && shiftDetailsFilled && morningDistanceReady && eveningDistanceReady && startDateObj && endDateObj)
      : step === 2
      ? seatsFulfilled
      : true; // Step 3 (negotiation) always shows footer; Accept Offer has its own logic

  // ─── Clear a previously-picked end date if it falls outside the new term bounds ───
  useEffect(() => {
    if (!startDateObj || !endDateObj) return;
    const min = addMonths(startDateObj, 1);
    const max = addYears(startDateObj, 1);
    if (endDateObj < min || endDateObj > max) {
      setEndDateObj(null);
    }
  }, [startDateObj]);

  // ─── Fetch buses free for the contract's whole term when entering Step 2 ───
  const loadAvailableBuses = useCallback(() => {
    if (!startDateObj || !endDateObj) return;
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    setBusesLoading(true);
    setBusesError(null);
    getAvailableCorporateBuses(fmt(startDateObj), fmt(endDateObj))
      .then((buses) => setAvailableBuses(buses))
      .catch(() => setBusesError("Could not load available buses. Please try again."))
      .finally(() => setBusesLoading(false));
  }, [startDateObj, endDateObj]);

  useEffect(() => {
    if (step === 2) loadAvailableBuses();
  }, [step, loadAvailableBuses]);

  // Drop any previously-selected bus that is no longer in the available list
  // (e.g. the user went back and changed the contract dates).
  useEffect(() => {
    if (availableBuses.length === 0) return;
    const availableIds = new Set(availableBuses.map((b) => b.busId));
    setSelectedBusIds((prev) => prev.filter((id) => availableIds.has(id)));
  }, [availableBuses]);

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

  // ─── "Same as morning, reversed" convenience for the evening route ───
  useEffect(() => {
    if (!useSameEveningRoute) return;
    setEveningPickup(morningDropoff);
    setEveningDropoff(morningPickup);
  }, [useSameEveningRoute, morningPickup, morningDropoff]);

  // ─── Auto-calculate real road distance + travel time for each active shift's route ───
  useEffect(() => {
    if (!needsMorning || !morningPickup?.latitude || !morningDropoff?.latitude) {
      setMorningDistanceKm(null);
      setMorningDurationMin(null);
      return;
    }
    let cancelled = false;
    setMorningDistanceLoading(true);
    getRoadRoute(
      { latitude: morningPickup.latitude, longitude: morningPickup.longitude },
      { latitude: morningDropoff.latitude, longitude: morningDropoff.longitude },
    )
      .then(({ distanceKm, durationMinutes }) => {
        if (cancelled) return;
        setMorningDistanceKm(distanceKm);
        setMorningDurationMin(durationMinutes);
      })
      .finally(() => { if (!cancelled) setMorningDistanceLoading(false); });
    return () => { cancelled = true; };
  }, [needsMorning, morningPickup, morningDropoff]);

  useEffect(() => {
    if (!needsEvening) {
      setEveningDistanceKm(null);
      setEveningDurationMin(null);
      return;
    }
    if (useSameEveningRoute) {
      // Same route, opposite direction — distance and travel time are identical either way.
      setEveningDistanceKm(morningDistanceKm);
      setEveningDurationMin(morningDurationMin);
      return;
    }
    if (!eveningPickup?.latitude || !eveningDropoff?.latitude) {
      setEveningDistanceKm(null);
      setEveningDurationMin(null);
      return;
    }
    let cancelled = false;
    setEveningDistanceLoading(true);
    getRoadRoute(
      { latitude: eveningPickup.latitude, longitude: eveningPickup.longitude },
      { latitude: eveningDropoff.latitude, longitude: eveningDropoff.longitude },
    )
      .then(({ distanceKm, durationMinutes }) => {
        if (cancelled) return;
        setEveningDistanceKm(distanceKm);
        setEveningDurationMin(durationMinutes);
      })
      .finally(() => { if (!cancelled) setEveningDistanceLoading(false); });
    return () => { cancelled = true; };
  }, [needsEvening, useSameEveningRoute, morningDistanceKm, morningDurationMin, eveningPickup, eveningDropoff]);

  // ─── Morning shift: user sets the required arrival (drop-off) time; pickup
  // time is derived by subtracting the estimated journey duration, since we
  // can't guarantee an exact pickup time without knowing how long the trip takes. ───
  useEffect(() => {
    if (!needsMorning || !morningDropoffObj || morningDurationMin == null) {
      if (needsMorning && !morningDropoffObj) setMorningPickupObj(null);
      return;
    }
    setMorningPickupObj(new Date(morningDropoffObj.getTime() - morningDurationMin * 60000));
  }, [needsMorning, morningDropoffObj, morningDurationMin]);

  // ─── Evening shift: user sets the departure (pickup) time; drop-off time is
  // derived by adding the estimated journey duration. ───
  useEffect(() => {
    if (!needsEvening || !eveningPickupObj || eveningDurationMin == null) {
      if (needsEvening && !eveningPickupObj) setEveningDropoffObj(null);
      return;
    }
    setEveningDropoffObj(new Date(eveningPickupObj.getTime() + eveningDurationMin * 60000));
  }, [needsEvening, eveningPickupObj, eveningDurationMin]);

  // ─── Step Management ───
  const formatApiTime = (dt: Date) => dt.toTimeString().split(' ')[0];
  const buildLeg = (place: PlaceValue, time: Date | null): ShiftLeg | null =>
    place && time
      ? { location: place.name, latitude: place.latitude, longitude: place.longitude, time: formatApiTime(time) }
      : null;

  const handleNext = async () => {
    if (step === 1) {
      if (!employees || !shiftDetailsFilled || !startDateObj || !endDateObj) {
        Alert.alert("Missing Fields", "Please fill in all details, making sure to select places from the search results and set your shift times.");
        return;
      }
      if (!morningDistanceReady || !eveningDistanceReady) {
        Alert.alert("Distance Unavailable", "Could not calculate the route distance yet. Please re-select your pickup and drop-off places.");
        return;
      }
      if (startDateObj < earliestStartDate) {
        Alert.alert("Invalid Start Date", "The contract start date must be at least one week from today.");
        return;
      }
      if (endDateObj < minEndDate) {
        Alert.alert("Invalid Contract Term", "The contract term must be at least one month.");
        return;
      }
      if (endDateObj > maxEndDate) {
        Alert.alert("Invalid Contract Term", "The contract term cannot exceed one year — you'll need to renew after a year.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (selectedBusIds.length === 0) {
        Alert.alert("Selection Required", "Please choose at least one bus.");
        return;
      }
      if (!seatsFulfilled) {
        Alert.alert("Not Enough Seats", `Selected buses seat ${selectedSeats}, but ${neededSeats} employees need transport. Select more buses.`);
        return;
      }
      // Submit contract to backend when entering negotiation
      if (!currentUser || !startDateObj || !endDateObj) return;
      setSubmittingContract(true);
      try {
        const formatApiDate = (dt: Date) => dt.toISOString().split('T')[0];
        const routeName = (needsMorning ? morningPickup?.name : eveningPickup?.name) ?? "Corporate Route";
        const created = await createCorporateContract({
          contractName: `${routeName} Corporate Contract`,
          shiftType,
          morningPickup: needsMorning ? buildLeg(morningPickup, morningPickupObj) : null,
          morningDropoff: needsMorning ? buildLeg(morningDropoff, morningDropoffObj) : null,
          morningDistanceKm: needsMorning ? morningDistanceKm : null,
          eveningPickup: needsEvening ? buildLeg(useSameEveningRoute ? morningDropoff : eveningPickup, eveningPickupObj) : null,
          eveningDropoff: needsEvening ? buildLeg(useSameEveningRoute ? morningPickup : eveningDropoff, eveningDropoffObj) : null,
          eveningDistanceKm: needsEvening ? eveningDistanceKm : null,
          employeeCount: parseInt(employees, 10) || 0,
          workingDays,
          busType,
          busIds: selectedBusIds,
          startDate: formatApiDate(startDateObj),
          endDate: formatApiDate(endDateObj),
          corporateUserId: currentUser.userId,
        });

        // Backend returns the created contract. If null (older backend), fetch the latest one.
        let resolvedContract: CorporateContract | null = created ?? null;

        if (!resolvedContract) {
          // Fallback: fetch the latest contract for this user
          const allContracts = await getCorporateContracts(currentUser.userId);
          if (allContracts.length > 0) {
            resolvedContract = allContracts[0]; // ordered by created_at DESC
          }
        }

        setContractId(resolvedContract?.contractId ?? null);
        setContractStatus(resolvedContract?.status ?? "pending");
        setCreatedContract(resolvedContract);
        setStep(3);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to submit contract request. Please try again.";
        Alert.alert("Submission Error", message);
        console.error(err);
      } finally {
        setSubmittingContract(false);
      }
    }
  };

  // Once the contract is submitted (step 3+), it already exists on the
  // server as "pending" — going back into the wizard would let the user
  // re-submit and create a duplicate contract. Instead, "back" exits the
  // flow (with confirmation) rather than un-submitting anything.
  const confirmLeaveNegotiation = () => {
    Alert.alert(
      "Leave this request?",
      "Your contract has already been submitted and is pending admin approval. You can check its status anytime from your contracts list.",
      [
        { text: "Stay", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => router.back() },
      ],
    );
  };

  const handleBack = () => {
    if (step === 3) {
      confirmLeaveNegotiation();
      return;
    }
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  // Mirror the same rules for the Android hardware/gesture back action.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === 3) {
        confirmLeaveNegotiation();
        return true;
      }
      if (step > 1) {
        setStep((s) => s - 1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  const handlePayDeposit = async () => {
    if (!contractId || !currentUser) return;
    setSubmitting(true);
    try {
      let email = "corporate@trackngo.lk";
      try {
        email = (await getUserProfile(currentUser.userId)).email || email;
      } catch {
        // Stripe accepts the fallback email.
      }
      const orderId = `CORP-ADV-${contractId}`;
      const result = await createStripeCheckoutSession({
        orderId,
        amount: monthlyAmount,
        currency: 'LKR',
        itemName: `Advance Deposit: ${createdContract?.contractName ?? contractId}`,
        itemDescription: `Corporate Contract ID: ${contractId}`,
        email,
        successUrl: `${API_BASE_URL}/api/booking-flow/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${API_BASE_URL}/api/booking-flow/stripe/cancel?session_id={CHECKOUT_SESSION_ID}`,
      });
      setSessionId(result.sessionId);
      setCheckoutUrl(result.url);
      setShowWebView(true);
    } catch (err: any) {
      console.error("[Stripe] Failed to create checkout session", err);
      Alert.alert("Payment Error", "Could not initialize payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const completePayment = useCallback(async () => {
    setShowWebView(false);
    setPaymentProcessing(true);
    try {
      const status = await getStripeSessionStatus(sessionId);
      if (status.paymentStatus !== 'paid') {
        Alert.alert("Payment Incomplete", "Payment was not completed. Please try again.");
        setPaymentProcessing(false);
        return;
      }

      // Pay deposit — the backend independently re-verifies the session with
      // Stripe. Treat "already paid" as success rather than an error: it
      // means an earlier attempt's payment went through but finalize didn't
      // complete (e.g. the app closed mid-flow), so this is just a retry.
      try {
        await payAdvanceDeposit(contractId!, { sessionId });
      } catch (payErr: any) {
        const alreadyPaid = String(payErr?.message || "").toLowerCase().includes("already paid");
        if (!alreadyPaid) throw payErr;
      }

      // Finalize contract
      await finalizeCorporateContract(contractId!, currentUser!.userId);

      Alert.alert("Success", "Deposit paid and contract is now active!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      console.error("[Stripe] Advance payment failed", e);
      Alert.alert("Error", e.message || "Failed to finalize contract after payment.");
    } finally {
      setPaymentProcessing(false);
    }
  }, [sessionId, contractId, currentUser, router]);

  const handleActivateWithoutPayment = async () => {
    if (!contractId || !currentUser) return;
    setSubmitting(true);
    try {
      await finalizeCorporateContract(contractId, currentUser.userId);
      Alert.alert("Success", "Contract is now active!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to activate contract.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWebViewNavigation = (navState: any) => {
    const url = navState.url;
    if (url.includes('/api/booking-flow/stripe/success')) {
      completePayment();
    } else if (url.includes('/api/booking-flow/stripe/cancel')) {
      setShowWebView(false);
      Alert.alert("Cancelled", "Advance deposit payment was cancelled.");
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'completed') {
        completePayment();
      } else if (data.type === 'cancelled') {
        setShowWebView(false);
        Alert.alert("Cancelled", "Advance deposit payment was cancelled.");
      }
    } catch (e) {}
  };

  const handleAcceptOffer = () => {
    // Move from Negotiation → Contract Proposal — only once admin has approved.
    if (contractStatus !== "active") {
      Alert.alert("Not Yet Approved", "This contract is still awaiting admin approval.");
      return;
    }
    setStep(4);
  };


  // ─── UI Helpers ───
  const renderTimeField = (
    label: string,
    value: Date | null,
    setValue: (d: Date) => void,
    show: boolean,
    setShow: (b: boolean) => void,
  ) => (
    <View style={{ flex: 1 }}>
      <Text style={styles.inputLabelOutside}>{label}</Text>
      <View style={[styles.inputWrapper, { marginBottom: 0 }]}>
        <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onPress={() => setShow(true)}>
          <Text style={[styles.textInput, { color: value ? '#1E293B' : '#94A3B8' }]}>
            {value ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
          </Text>
          <Ionicons name="time-outline" size={18} color="#64748B" />
        </TouchableOpacity>
        {show && <DateTimePicker value={value || new Date()} mode="time" display="default" onChange={(e, d) => { setShow(false); if (d) setValue(d); }} />}
      </View>
    </View>
  );

  const renderComputedTimeField = (label: string, value: Date | null, loading: boolean) => (
    <View style={{ flex: 1 }}>
      <Text style={styles.inputLabelOutside}>{label}</Text>
      <View style={[styles.inputWrapper, styles.computedTimeWrapper]}>
        {loading ? (
          <ActivityIndicator size="small" color="#067BF9" />
        ) : (
          <Text style={[styles.textInput, { color: value ? '#1E293B' : '#94A3B8' }]}>
            {value ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
          </Text>
        )}
        <Ionicons name="calculator-outline" size={16} color="#94A3B8" />
      </View>
    </View>
  );

  const describeShiftSummary = () => {
    const fmt = (d: Date | null) => d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--";
    const parts: string[] = [];
    if (needsMorning) parts.push(`Morning ${fmt(morningPickupObj)}–${fmt(morningDropoffObj)}`);
    if (needsEvening) parts.push(`Evening ${fmt(eveningPickupObj)}–${fmt(eveningDropoffObj)}`);
    return parts.join("  •  ");
  };

  const describeRoutes = () => {
    const parts: string[] = [];
    if (needsMorning && morningPickup && morningDropoff) {
      parts.push(`${morningPickup.name} → ${morningDropoff.name}`);
    }
    if (needsEvening) {
      const pickup = useSameEveningRoute ? morningDropoff : eveningPickup;
      const dropoff = useSameEveningRoute ? morningPickup : eveningDropoff;
      if (pickup && dropoff) parts.push(`${pickup.name} → ${dropoff.name}`);
    }
    return parts.length > 0 ? parts.join("  •  ") : "Route not set";
  };

  const busTypeDisplayLabel = (type: BusType | undefined) => {
    if (type === "ac") return "AC (+25% surcharge)";
    if (type === "mini") return "Mini Bus (+flat surcharge)";
    return "Standard";
  };

  // ─── Render Steps ─────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Logistics Details</Text>
      <Text style={styles.stepSubtitle}>Step 1 of 4: Choose your service and set up each shift's route.</Text>

      <Text style={styles.inputLabelOutside}>Service Required For</Text>
      <View style={[styles.row, { gap: 8, marginBottom: 20 }]}>
        {([
          { key: "morning", label: "Morning Only", icon: "sunny-outline" },
          { key: "evening", label: "Evening Only", icon: "moon-outline" },
          { key: "both", label: "Both Shifts", icon: "swap-vertical-outline" },
        ] as const).map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.shiftChip, shiftType === opt.key && styles.shiftChipActive]}
            onPress={() => setShiftType(opt.key)}
          >
            <Ionicons name={opt.icon as any} size={16} color={shiftType === opt.key ? "#FFFFFF" : "#1E293B"} />
            <Text style={[styles.shiftChipText, shiftType === opt.key && styles.shiftChipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {needsMorning && (
        <View style={styles.routeSection}>
          <Text style={styles.routeSectionTitle}>Morning Shift Route</Text>
          <GooglePlaceField label="Pickup Location" placeholder="Search employee pickup point..." value={morningPickup} onChange={setMorningPickup} icon="location" />
          <GooglePlaceField label="Drop-off Location" placeholder="Search office / drop-off point..." value={morningDropoff} onChange={setMorningDropoff} icon="flag" />
          <View style={[styles.row, { marginBottom: 4, gap: 12 }]}>
            {renderTimeField("Required Arrival Time", morningDropoffObj, setMorningDropoffObj, showMorningDropoffPicker, setShowMorningDropoffPicker)}
            {renderComputedTimeField("Estimated Pickup Time", morningPickupObj, morningDistanceLoading)}
          </View>
          <Text style={styles.computedHint}>
            Pickup time is calculated automatically from the estimated journey duration — we can't guarantee an exact pickup time, only the required arrival.
          </Text>
          {(morningDistanceLoading || morningDistanceKm) && (
            <View style={styles.distancePill}>
              <Ionicons name="navigate-outline" size={14} color="#067BF9" />
              <Text style={styles.distancePillText}>
                {morningDistanceLoading ? "Calculating route distance..." : `Morning route: ${morningDistanceKm} km`}
              </Text>
            </View>
          )}
        </View>
      )}

      {needsEvening && (
        <View style={styles.routeSection}>
          <Text style={styles.routeSectionTitle}>Evening Shift Route</Text>

          {shiftType === "both" && (
            <TouchableOpacity style={styles.acToggleRow} onPress={() => setSameAsMorningReversed(!sameAsMorningReversed)}>
              <View style={styles.acToggleLeft}>
                <Ionicons name="swap-horizontal-outline" size={18} color="#067BF9" />
                <Text style={styles.acToggleLabel}>Same route as morning, reversed</Text>
              </View>
              <View style={[styles.checkbox, sameAsMorningReversed && styles.checkboxActive]}>
                {sameAsMorningReversed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
            </TouchableOpacity>
          )}
          <View style={{ marginBottom: 12 }} />

          {useSameEveningRoute ? (
            <View style={styles.reversedRouteBox}>
              <Ionicons name="information-circle-outline" size={16} color="#64748B" />
              <Text style={styles.reversedRouteText}>
                Pickup at {morningDropoff?.name ?? "the morning drop-off point"}, drop-off at {morningPickup?.name ?? "the morning pickup point"}.
              </Text>
            </View>
          ) : (
            <>
              <GooglePlaceField label="Pickup Location" placeholder="Search employee pickup point..." value={eveningPickup} onChange={setEveningPickup} icon="location" />
              <GooglePlaceField label="Drop-off Location" placeholder="Search drop-off point..." value={eveningDropoff} onChange={setEveningDropoff} icon="flag" />
            </>
          )}

          <View style={[styles.row, { marginBottom: 4, gap: 12 }]}>
            {renderTimeField("Departure (Pickup) Time", eveningPickupObj, setEveningPickupObj, showEveningPickupPicker, setShowEveningPickupPicker)}
            {renderComputedTimeField("Estimated Drop-off Time", eveningDropoffObj, eveningDistanceLoading)}
          </View>
          <Text style={styles.computedHint}>
            Drop-off time is calculated automatically from the estimated journey duration.
          </Text>
          {(eveningDistanceLoading || eveningDistanceKm) && (
            <View style={styles.distancePill}>
              <Ionicons name="navigate-outline" size={14} color="#067BF9" />
              <Text style={styles.distancePillText}>
                {eveningDistanceLoading ? "Calculating route distance..." : `Evening route: ${eveningDistanceKm} km`}
              </Text>
            </View>
          )}
        </View>
      )}

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

      <Text style={styles.inputLabelOutside}>Working Days</Text>
      <View style={[styles.row, { gap: 8, marginBottom: 20 }]}>
        <TouchableOpacity
          style={[styles.shiftChip, { flex: 1 }, workingDays === "weekdays" && styles.shiftChipActive]}
          onPress={() => setWorkingDays("weekdays")}
        >
          <Text style={[styles.shiftChipText, workingDays === "weekdays" && styles.shiftChipTextActive]}>Weekdays (Mon–Fri)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.shiftChip, { flex: 1 }, workingDays === "all_days" && styles.shiftChipActive]}
          onPress={() => setWorkingDays("all_days")}
        >
          <Text style={[styles.shiftChipText, workingDays === "all_days" && styles.shiftChipTextActive]}>All Days</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.inputLabelOutside}>Contract Duration</Text>
      <Text style={styles.computedHint}>
        Start date must be at least one week from today. Contracts run 1 month to 1 year — renew after a year.
      </Text>
      <View style={styles.row}>
        <View style={[styles.inputWrapper, { flex: 1 }]}>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onPress={() => setShowStartDatePicker(true)}>
            <Text style={[styles.textInput, { color: startDateObj ? '#1E293B' : '#94A3B8' }]}>
              {startDateObj ? startDateObj.toLocaleDateString() : "Start Date"}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#64748B" />
          </TouchableOpacity>
          {showStartDatePicker && <DateTimePicker value={startDateObj || earliestStartDate} mode="date" display="default" minimumDate={earliestStartDate} onChange={(e, d) => { setShowStartDatePicker(false); if (d) setStartDateObj(d); }} />}
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.inputWrapper, { flex: 1 }]}>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onPress={() => startDateObj && setShowEndDatePicker(true)}>
            <Text style={[styles.textInput, { color: endDateObj ? '#1E293B' : '#94A3B8' }]}>
              {endDateObj ? endDateObj.toLocaleDateString() : startDateObj ? "End Date" : "Pick start date first"}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#64748B" />
          </TouchableOpacity>
          {showEndDatePicker && <DateTimePicker value={endDateObj || minEndDate} mode="date" display="default" minimumDate={minEndDate} maximumDate={maxEndDate} onChange={(e, d) => { setShowEndDatePicker(false); if (d) setEndDateObj(d); }} />}
        </View>
      </View>
    </View>
  );

  const amenityIcon = (key: string): keyof typeof Ionicons.glyphMap => {
    switch (key.toLowerCase()) {
      case "ac": return "snow";
      case "wifi": return "wifi";
      case "charging_ports": case "charger": return "battery-charging";
      case "entertainment": case "tv": return "tv-outline";
      default: return "checkmark-circle-outline";
    }
  };
  const amenityLabel = (key: string) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const toggleBusSelection = (busId: number) => {
    setSelectedBusIds((prev) =>
      prev.includes(busId) ? prev.filter((id) => id !== busId) : [...prev, busId]
    );
  };

  const busMatchesType = (bus: ContractBus, type: BusType) => {
    const isMini = (bus.busBrand ?? "").toLowerCase().includes("rosa");
    const isAc = parseBusAmenities(bus.amenities).some((a) => a.toLowerCase() === "ac");
    if (type === "mini") return isMini;
    if (type === "ac") return isAc && !isMini;
    return !isMini && !isAc;
  };

  const filteredBuses = availableBuses
    .filter((bus) => {
      if (!busMatchesType(bus, busType)) return false;
      if (busSearch.trim().length > 0) {
        const q = busSearch.trim().toLowerCase();
        const haystack = `${bus.busNumber ?? ""} ${bus.busBrand ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const diff = (a.seatCapacity ?? 0) - (b.seatCapacity ?? 0);
      return busSort === "seats_desc" ? -diff : diff;
    });

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Choose your Bus(es)</Text>
      <Text style={styles.stepSubtitle}>
        Only buses free for your entire contract term are shown. Select as many as needed to cover your headcount.
      </Text>

      <View style={[styles.seatsSummaryCard, seatsFulfilled && styles.seatsSummaryCardDone]}>
        <Ionicons name={seatsFulfilled ? "checkmark-circle" : "people-outline"} size={20} color={seatsFulfilled ? "#10B981" : "#067BF9"} />
        <View style={{ flex: 1 }}>
          <Text style={styles.seatsSummaryText}>
            {selectedSeats} / {neededSeats || 0} seats selected
          </Text>
          <Text style={styles.seatsSummarySub}>
            {seatsFulfilled ? "Enough seats for your employee count" : `Select more buses to cover ${Math.max(0, neededSeats - selectedSeats)} more seats`}
          </Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.textInput}
          placeholder="Search bus number or brand"
          placeholderTextColor="#94A3B8"
          value={busSearch}
          onChangeText={setBusSearch}
        />
      </View>

      <Text style={styles.inputLabelOutside}>Bus Type</Text>
      <View style={[styles.row, { gap: 8, marginBottom: 16 }]}>
        {([
          { key: "standard", label: "Standard" },
          { key: "ac", label: "AC" },
          { key: "mini", label: "Mini Bus" },
        ] as const).map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.shiftChip, busType === opt.key && styles.shiftChipActive]}
            onPress={() => setBusType(opt.key)}
          >
            <Text style={[styles.shiftChipText, busType === opt.key && styles.shiftChipTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={styles.filterChip}
          onPress={() => setBusSort(busSort === "seats_desc" ? "seats_asc" : "seats_desc")}
        >
          <Text style={styles.filterChipText}>Seats: {busSort === "seats_desc" ? "High to Low" : "Low to High"}</Text>
          <Ionicons name={busSort === "seats_desc" ? "arrow-down" : "arrow-up"} size={12} color="#1E293B" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      <Text style={styles.availableText}>Available Fleet ({filteredBuses.length})</Text>

      {busesLoading ? (
        <View style={styles.busStateBox}>
          <ActivityIndicator size="small" color="#067BF9" />
          <Text style={styles.busStateText}>Finding buses available for your dates...</Text>
        </View>
      ) : busesError ? (
        <View style={styles.busStateBox}>
          <Ionicons name="warning-outline" size={28} color="#94A3B8" />
          <Text style={styles.busStateText}>{busesError}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadAvailableBuses}>
            <Ionicons name="refresh" size={14} color="#067BF9" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredBuses.length === 0 ? (
        <View style={styles.busStateBox}>
          <Ionicons name="bus-outline" size={28} color="#94A3B8" />
          <Text style={styles.busStateText}>No buses available</Text>
          <Text style={[styles.busStateText, { fontSize: 11, marginTop: 2 }]}>
            {availableBuses.length === 0
              ? "No corporate buses are free for your entire contract term."
              : "No buses of this type match your filters right now."}
          </Text>
        </View>
      ) : (
        filteredBuses.map((bus) => {
          const isSelected = selectedBusIds.includes(bus.busId);
          const amenities = parseBusAmenities(bus.amenities);
          return (
            <TouchableOpacity
              key={bus.busId}
              activeOpacity={0.85}
              style={[styles.busCard, isSelected && styles.busCardSelected]}
              onPress={() => toggleBusSelection(bus.busId)}
            >
              <View style={styles.busInfo}>
                <View style={styles.busTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.busName}>{bus.busBrand || "Bus"} · {bus.busNumber}</Text>
                    {bus.busCondition && (
                      <Text style={styles.busConditionText}>{amenityLabel(bus.busCondition)} condition</Text>
                    )}
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <View style={styles.capacityRow}>
                      <MaterialCommunityIcons name="seat-passenger" size={14} color="#64748B" />
                      <Text style={styles.busCapacity}>{bus.seatCapacity ?? "—"}</Text>
                    </View>
                    <Text style={styles.capacityLabel}>Seats</Text>
                  </View>
                </View>

                <View style={styles.busBottomRow}>
                  <View style={styles.amenitiesRow}>
                    {amenities.length > 0 ? amenities.map((amenity, i) => (
                      <View key={i} style={styles.amenityItem}>
                        <Ionicons name={amenityIcon(amenity)} size={14} color="#64748B" />
                        <Text style={styles.amenityText}>{amenityLabel(amenity)}</Text>
                      </View>
                    )) : <Text style={styles.amenityText}>Standard fit-out</Text>}
                  </View>
                  <View style={[styles.selectBusBtn, isSelected && styles.selectBusBtnActive]}>
                    <Ionicons name={isSelected ? "checkmark" : "add"} size={14} color={isSelected ? "#FFFFFF" : "#067BF9"} />
                    <Text style={[styles.selectBusBtnText, !isSelected && { color: "#067BF9" }]}>
                      {isSelected ? "Added" : "Add"}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

  const handleChatAdmin = async () => {
    if (!currentUser?.userId) {
      Alert.alert("Sign in required", "Please sign in again to start a chat with TrackNGo admin.");
      return;
    }
    try {
      const conversation = await createConversation({ user1Id: currentUser.userId, user2Id: ADMIN_SUPPORT_USER_ID });
      router.push({
        pathname: "/chat/chat-room",
        params: {
          conversationId: String(conversation.conversationId),
          otherUserId: String(ADMIN_SUPPORT_USER_ID),
          otherUserType: "ADMIN",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not open the admin chat.";
      Alert.alert("Chat unavailable", message);
    }
  };

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
          <View style={styles.negoAdminAvatar}>
            <Text style={styles.negoAdminAvatarText}>{adminInitials}</Text>
          </View>
          <View style={styles.negoAdminInfo}>
            <Text style={styles.negoAdminName}>{adminInfo.name}</Text>
            <Text style={styles.negoAdminRole}>{adminInfo.role}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Ionicons name="call" size={13} color="#10B981" />
              <Text style={styles.negoAdminPhone}>{adminInfo.phone}</Text>
            </View>
          </View>
        </View>
        <View style={styles.negoActionRow}>
          <TouchableOpacity style={styles.negoCallBtn} onPress={() => Linking.openURL(`tel:${adminInfo.phone}`)}>
            <Ionicons name="call" size={18} color="#FFFFFF" />
            <Text style={styles.negoCallText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.negoChatBtn} onPress={() => void handleChatAdmin()}>
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
              <Text style={styles.negoSummaryRowValue}>{describeRoutes()}</Text>
              <Text style={styles.negoSummaryRowMeta}>{describeShiftSummary()}</Text>
            </View>
          </View>
          <View style={styles.negoSummaryDivider} />
          <View style={styles.negoSummaryRow}>
            <View style={styles.negoSummaryIcon}>
              <Ionicons name="bus" size={18} color="#64748B" />
            </View>
            <View>
              <Text style={styles.negoSummaryRowLabel}>{selectedBuses.length > 1 ? "Selected Buses" : "Selected Bus"}</Text>
              <Text style={styles.negoSummaryRowValue}>
                {selectedBuses.map((b) => b.busNumber).join(", ")} ({selectedSeats} seats)
              </Text>
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
          <View style={styles.negoSummaryDivider} />
        </View>

        {/* Pricing Breakdown */}
        <Text style={styles.negoSectionLabel}>Estimated Monthly Bill</Text>
        <View style={styles.pricingCard}>
          <Text style={styles.pricingTotal}>{formatAmount(monthlyAmount)}</Text>
          <Text style={styles.pricingTotalSub}>per month, billed while the contract is active</Text>
          <View style={styles.pricingDivider} />
          <View style={styles.pricingRow}>
            <Text style={styles.pricingRowLabel}>One-way distance</Text>
            <Text style={styles.pricingRowValue}>{createdContract?.distanceKm ?? "—"} km</Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingRowLabel}>Bus type</Text>
            <Text style={styles.pricingRowValue}>{busTypeDisplayLabel(createdContract?.busType)}</Text>
          </View>
          <View style={styles.pricingRow}>
            <Text style={styles.pricingRowLabel}>Working days / month</Text>
            <Text style={styles.pricingRowValue}>{createdContract?.workingDays === "all_days" ? "30 (all days)" : "22 (weekdays)"}</Text>
          </View>
          {hasDiscount && (
            <>
              <View style={styles.pricingDivider} />
              <View style={styles.pricingRow}>
                <Text style={styles.pricingRowLabel}>Subtotal</Text>
                <Text style={styles.pricingRowValue}>{formatAmount(createdContract?.originalBillingAmount ?? monthlyAmount)}</Text>
              </View>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingRowLabel}>Discount</Text>
                <Text style={[styles.pricingRowValue, { color: "#10B981" }]}>−{formatAmount(createdContract?.discountAmount ?? 0)}</Text>
              </View>
              <View style={styles.pricingRow}>
                <Text style={[styles.pricingRowLabel, { fontWeight: "700", color: "#0F172A" }]}>Total</Text>
                <Text style={styles.pricingRowValue}>{formatAmount(monthlyAmount)}</Text>
              </View>
            </>
          )}
          <Text style={styles.pricingHint}>
            Based on your route, bus type and schedule. Rates are set by TrackNGo admin.
          </Text>
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
                {isApproved ? "Admin has approved your request" : `${adminInfo.name.split(" ")[0]} is reviewing your request`}
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

  const depositStatus = createdContract?.advancePaymentStatus;
  const depositResolved = depositStatus === "waived" || depositStatus === "paid";

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
            <Text style={styles.summaryRouteText}>{describeRoutes()}</Text>
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

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeaderRow}>
          <Ionicons name="card" size={20} color="#067BF9" />
          <Text style={styles.summaryTitle}>Advance Deposit</Text>
        </View>
        <View style={{ height: 12 }} />
        <View style={styles.pricingRow}>
          <Text style={styles.pricingRowLabel}>Monthly billing</Text>
          <Text style={styles.pricingRowValue}>Rs. {monthlyAmount.toLocaleString()}</Text>
        </View>
        <View style={styles.pricingRow}>
          <Text style={styles.pricingRowLabel}>Advance deposit (1 month)</Text>
          <Text style={[styles.pricingRowValue, { color: "#067BF9" }]}>Rs. {monthlyAmount.toLocaleString()}</Text>
        </View>
        {depositStatus === "waived" ? (
          <Text style={styles.pricingHint}>Waived by admin — no payment required to activate.</Text>
        ) : depositStatus === "paid" ? (
          <Text style={styles.pricingHint}>Already paid — ready to activate.</Text>
        ) : (
          <Text style={styles.pricingHint}>
            Refundable on contract expiry. Must be paid to activate the contract.
          </Text>
        )}
      </View>

      <View style={{ height: 20 }} />
      {depositResolved ? (
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={handleActivateWithoutPayment}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.acceptBtnText}>Activate Contract</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.acceptBtn}
          onPress={handlePayDeposit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="card" size={20} color="#FFFFFF" />
              <Text style={styles.acceptBtnText}>Pay Deposit & Accept</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.rejectBtn} onPress={handleBack} disabled={submitting}>
        <Ionicons name="close-circle" size={20} color="#EF4444" />
        <Text style={styles.rejectBtnText}>Reject Contract</Text>
      </TouchableOpacity>
    </View>
  );

  if (showWebView && checkoutUrl) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <View style={styles.webViewHeader}>
          <TouchableOpacity
            style={styles.webViewCloseBtn}
            onPress={() => setShowWebView(false)}
          >
            <Ionicons name="close" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.webViewTitle}>Stripe Checkout</Text>
          <View style={{ width: 40 }} />
        </View>
        <WebView
          source={{ uri: checkoutUrl }}
          style={{ flex: 1 }}
          onNavigationStateChange={handleWebViewNavigation}
          onMessage={handleWebViewMessage}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color="#067BF9" />
              <Text style={styles.loadingText}>Loading Stripe...</Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

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
            // Negotiation step: only actionable once admin has approved.
            <TouchableOpacity
              style={[styles.nextBtn, contractStatus !== "active" && styles.nextBtnDisabled]}
              onPress={handleAcceptOffer}
              activeOpacity={contractStatus === "active" ? 0.8 : 1}
              disabled={contractStatus !== "active"}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.nextBtnText}>
                {contractStatus === "active" ? "Accept Final Offer" : "Waiting for Admin Approval"}
              </Text>
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

  // Shift type / working days chips
  shiftChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flex: 1,
  },
  shiftChipActive: { backgroundColor: "#067BF9", borderColor: "#067BF9" },
  shiftChipText: { fontSize: 12, fontWeight: "700", color: "#1E293B" },
  shiftChipTextActive: { color: "#FFFFFF" },

  routeSection: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  routeSectionTitle: { fontSize: 13, fontWeight: "800", color: "#067BF9", marginBottom: 12 },
  reversedRouteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  reversedRouteText: { flex: 1, fontSize: 12, color: "#475569", lineHeight: 17 },
  computedTimeWrapper: {
    backgroundColor: "#F1F5F9",
    borderStyle: "dashed",
    justifyContent: "space-between",
  },
  computedHint: { fontSize: 11, color: "#94A3B8", marginBottom: 12, lineHeight: 15 },

  // WebView (Stripe) Styles
  webViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  webViewCloseBtn: { width: 40, alignItems: "flex-start" },
  webViewTitle: { fontSize: 16, fontWeight: "700", color: "#1E293B" },
  webViewLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: { marginTop: 12, fontSize: 14, color: "#64748B" },

  acToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  acToggleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  acToggleLabel: { fontSize: 13, fontWeight: "600", color: "#1E293B" },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: "#067BF9", borderColor: "#067BF9" },

  distancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  distancePillText: { fontSize: 12, fontWeight: "600", color: "#1D4ED8" },


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
    flexDirection: "row",
    alignItems: "center",
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

  seatsSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  seatsSummaryCardDone: { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" },
  seatsSummaryText: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  seatsSummarySub: { fontSize: 11, color: "#64748B", marginTop: 2 },

  busStateBox: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 40,
  },
  busStateText: { fontSize: 13, color: "#64748B", textAlign: "center", paddingHorizontal: 20 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  retryBtnText: { color: "#067BF9", fontSize: 12, fontWeight: "700" },

  busCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    marginBottom: 16,
  },
  busCardSelected: { borderColor: "#067BF9", borderWidth: 2 },
  busInfo: { padding: 16 },
  busTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  busName: { fontSize: 16, fontWeight: "700", color: "#1E293B", flex: 1 },
  busConditionText: { fontSize: 11, color: "#94A3B8", marginTop: 2, textTransform: "capitalize" },
  capacityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  busCapacity: { fontSize: 14, fontWeight: "700", color: "#64748B" },
  capacityLabel: { fontSize: 11, fontWeight: "600", color: "#94A3B8" },
  busBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amenitiesRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", flex: 1 },
  amenityItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  amenityText: { fontSize: 11, color: "#64748B" },
  selectBusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  selectBusBtnActive: { backgroundColor: "#067BF9", borderColor: "#067BF9" },
  selectBusBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

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
    alignItems: "center",
    justifyContent: "center",
  },
  negoAdminAvatarText: { fontSize: 18, fontWeight: "700", color: "#475569" },
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

  pricingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 24,
  },
  pricingTotal: { fontSize: 28, fontWeight: "800", color: "#0F172A", textAlign: "center" },
  pricingTotalSub: { fontSize: 12, color: "#94A3B8", textAlign: "center", marginTop: 2, marginBottom: 14 },
  pricingDivider: { height: 1, backgroundColor: "#F1F5F9", marginBottom: 10 },
  pricingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  pricingRowLabel: { fontSize: 13, color: "#64748B" },
  pricingRowValue: { fontSize: 13, fontWeight: "700", color: "#1E293B" },
  pricingHint: { fontSize: 11, color: "#94A3B8", lineHeight: 16, marginTop: 12 },

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

