import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { useSession } from "../../store/sessionStore";
import { API_BASE_URL as ENV_API_BASE_URL, GOOGLE_MAPS_API_KEY } from "../../config/env";
import { LocalizedText as Text, LocalizedTextInput as TextInput } from "../../utils/i18n";

// ─────────────────────────────────────────────────────────────
// API CONFIG
// ─────────────────────────────────────────────────────────────
const API_BASE_URL = `${ENV_API_BASE_URL}/api`;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/** A Google Places Autocomplete suggestion item shown in the dropdown */
type PlaceSuggestion = {
  place_id: string;
  description: string;          // Full text e.g. "Colombo, Sri Lanka"
  main_text: string;            // Short name e.g. "Colombo"
};

/** A fully resolved location with coordinates — used to pin on the map */
type ResolvedLocation = {
  name: string;
  latitude?: number;
  longitude?: number;
  place_id?: string;
};

// ─────────────────────────────────────────────────────────────
// GOOGLE PLACES HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Calls the Google Places Autocomplete API.
 *
 * WHY: We replaced the broken backend call (/api/locations/search)
 * with a direct call to Google so we get real, worldwide location
 * suggestions — exactly like the Google Maps app does.
 *
 * Restricts to Sri Lanka (components=country:lk).
 * Remove that param if you need worldwide results.
 */
async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  if (query.trim().length < 2) return [];
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query)}` +
      `&key=${GOOGLE_MAPS_API_KEY}` +
      `&language=en` +
      `&components=country:lk`;   // ← restrict to Sri Lanka

    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      console.warn("[Places Autocomplete] status:", json.status, json.error_message);
      return [];
    }

    // Map each prediction to a simpler shape
    return (json.predictions ?? []).map((p: any) => ({
      place_id: p.place_id,
      description: p.description,
      main_text: p.structured_formatting?.main_text ?? p.description,
    }));
  } catch (e) {
    console.error("[Places Autocomplete] fetch error:", e);
    return [];
  }
}

/**
 * Calls the Google Places Details API to get lat/lng for a chosen place.
 *
 * WHY: The Autocomplete API only returns names and place_ids, not
 * coordinates. We need coordinates to drop the map marker and draw
 * the MapViewDirections route line. So after the user taps a suggestion,
 * we make a second call to get the exact lat/lng.
 */
async function getPlaceDetails(placeId: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=geometry` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== "OK") {
      console.warn("[Places Details] status:", json.status, json.error_message);
      return null;
    }

    const loc = json.result?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch (e) {
    console.error("[Places Details] fetch error:", e);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// HAVERSINE DISTANCE (used for price estimate)
// ─────────────────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────────────────────────
// LOCATION INPUT COMPONENT
// ─────────────────────────────────────────────────────────────

/**
 * A self-contained location search input.
 * Shows a TextInput. As the user types, it debounces 300ms then
 * calls Google Places Autocomplete and shows a dropdown.
 * When the user taps a suggestion, it calls Google Places Details
 * to get lat/lng, then fires onSelect with a ResolvedLocation.
 */
type LocationInputProps = {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (loc: ResolvedLocation) => void;
  error?: string;
};

function LocationInput({ placeholder, value, onChangeText, onSelect, error }: LocationInputProps) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any pending debounce timer when the component unmounts.
  // Without this, the timer fires after unmount and tries to call
  // setState on an unmounted component, causing a memory leak warning.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Temporarily simplified to bypass Google Places API billing issue
  const handleChange = useCallback(
    (text: string) => {
      onChangeText(text);
      onSelect({ name: text }); // Immediately accept the typed text

      /* Google Places search temporarily disabled
      setSuggestions([]);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (text.trim().length < 2) {
        setSearching(false);
        return;
      }

      setSearching(true);
      debounceRef.current = setTimeout(async () => {
        const results = await searchPlaces(text);
        setSuggestions(results);
        setSearching(false);
      }, 300);
      */
    },
    [onChangeText, onSelect]
  );

  // When the user taps a suggestion, fetch coordinates then notify parent
  const handleSelect = useCallback(
    async (suggestion: PlaceSuggestion) => {
      onChangeText(suggestion.main_text);
      setSuggestions([]);
      setResolving(true);
      Keyboard.dismiss();

      const coords = await getPlaceDetails(suggestion.place_id);
      setResolving(false);

      if (coords) {
        onSelect({
          name: suggestion.main_text,
          latitude: coords.lat,
          longitude: coords.lng,
          place_id: suggestion.place_id,
        });
      }
    },
    [onChangeText, onSelect]
  );

  return (
    // overflow: 'visible' is required so the absolute-positioned dropdown
    // floats outside the bounds of this wrapper View
    <View style={{ marginTop: 4, marginBottom: error ? 4 : 14, zIndex: 10, overflow: 'visible' }}>
      {/* ── Text input ────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1,
          borderColor: error ? "red" : "#D1D5DB",
          borderRadius: 8,
          backgroundColor: "#F3F4F6",
          paddingHorizontal: 10,
        }}
      >
        <Ionicons name="location-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
        <TextInput
          placeholder={placeholder}
          value={value}
          onChangeText={handleChange}
          onBlur={() => {
            // If the user typed something but never tapped a Google suggestion
            // (e.g. because billing isn't set up), accept the typed text as-is.
            // No coordinates will be set so map preview stays hidden,
            // but the form becomes valid and Next Step button turns blue.
            if ((value || "").trim().length >= 3 && !resolving) {
              onSelect({ name: value.trim() });
            }
          }}
          style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: "#111827" }}
          placeholderTextColor="#9CA3AF"
          autoCorrect={false}
          autoCapitalize="words"
        />
        {/* Show spinner while searching Google or resolving coordinates */}
        {(searching || resolving) && (
          <ActivityIndicator size="small" color="#2563EB" style={{ marginLeft: 6 }} />
        )}
        {/* Clear button — calls handleChange so it also cancels debounce + clears suggestions */}
        {value.length > 0 && !searching && !resolving && (
          <TouchableOpacity
            onPress={() => handleChange('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Error message ──────────────────────────── */}
      {error ? <Text style={{ color: "red", fontSize: 11, marginTop: 2 }}>{error}</Text> : null}

      {/* ── Suggestions dropdown ───────────────────── */}
      {suggestions.length > 0 && (
        <View
          style={{
            position: "absolute",
            // 48 = height of the TextInput row (paddingVertical:10 top+bottom + ~28px font line)
            // 4 = marginTop of this wrapper = total offset from top of wrapper to bottom of input
            top: 48,
            left: 0,
            right: 0,
            backgroundColor: "#FFFFFF",
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#2563EB",
            zIndex: 9999,
            elevation: 12,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.place_id}
            keyboardShouldPersistTaps="always"   // ← crucial: lets taps on dropdown register
            style={{ maxHeight: 220 }}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 12,
                  borderBottomWidth: index < suggestions.length - 1 ? 1 : 0,
                  borderBottomColor: "#F1F5F9",
                }}
              >
                <Ionicons name="location-outline" size={14} color="#6B7280" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#111827" }}>
                    {item.main_text}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }} numberOfLines={1}>
                    {item.description}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────────────────────

export default function BookATrip() {
  const router = useRouter();
  const { currentUser } = useSession();
  const mapRef = useRef<MapView>(null);
  const isSubmitting = useRef(false);

  // ── Location state ────────────────────────────────────────
  const [pickupText, setPickupText] = useState("");
  const [dropText, setDropText] = useState("");
  const [pickup, setPickup] = useState<ResolvedLocation | null>(null);
  const [drop, setDrop] = useState<ResolvedLocation | null>(null);

  // ── Trip details ──────────────────────────────────────────
  const [depart, setDepart] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [showDepartPicker, setShowDepartPicker] = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [duration, setDuration] = useState<number>(3);
  const [passengers, setPassengers] = useState<number>(2);
  const [selectedRequirement, setSelectedRequirement] = useState<string | null>("AC");

  // ── Derived / computed ────────────────────────────────────
  const [errors, setErrors] = useState<any>({});
  const [formValid, setFormValid] = useState(false);
  const [distance, setDistance] = useState<number>(0);
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // ── Zoom map to fit both markers when both locations are set ──
  useEffect(() => {
    if (
      pickup?.latitude && pickup?.longitude &&
      drop?.latitude && drop?.longitude &&
      mapRef.current
    ) {
      const dist = haversineKm(pickup.latitude, pickup.longitude, drop.latitude, drop.longitude);
      setDistance(Math.round(dist));
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [
            { latitude: pickup.latitude!, longitude: pickup.longitude! },
            { latitude: drop.latitude!, longitude: drop.longitude! },
          ],
          { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true }
        );
      }, 500);
    } else {
      setDistance(0);
    }
  }, [pickup, drop]);

  // ── Duration = diff between depart and return dates ───────
  useEffect(() => {
    if (depart && returnDate) {
      const diff = Math.max(
        Math.ceil((returnDate.getTime() - depart.getTime()) / (1000 * 60 * 60 * 24)),
        1
      );
      setDuration(diff);
    }
  }, [depart, returnDate]);

  // ── Estimated price calculation ────────────────────────────
  useEffect(() => {
    if (distance > 0) {
      const dailyRate = 12000;
      const days = duration || 1;
      const ratePerKm = passengers <= 20 ? 250 : 400;
      let distanceCost = distance * ratePerKm;
      if (selectedRequirement === "AC") distanceCost *= 1.25;
      let total = dailyRate * days + distanceCost;
      if (selectedRequirement === "WIFI") total += 1000;
      if (selectedRequirement && selectedRequirement !== "AC" && selectedRequirement !== "First Aid")
        total += 1500;
      setEstimatedPrice(Math.round(total));
    } else {
      setEstimatedPrice(0);
    }
  }, [distance, passengers, selectedRequirement, duration]);

  // ── Form validation live check ─────────────────────────────
  useEffect(() => {
    setFormValid(
      pickup !== null &&
      drop !== null &&
      depart !== null &&
      returnDate !== null &&
      duration > 0 &&
      passengers > 0 &&
      selectedRequirement !== null &&
      !(returnDate && depart && returnDate < depart)
    );
  }, [pickup, drop, depart, returnDate, duration, passengers, selectedRequirement]);

  // ── Form validation with error messages ───────────────────
  const validateForm = (): boolean => {
    const e: any = {};
    if (!pickup) e.pickup = "Please select a Pickup Location";
    if (!drop) e.drop = "Please select a Drop-off Location";
    if (!depart) e.depart = "Please select Departure Date";
    if (!returnDate) e.returnDate = "Please select Return Date";
    if (depart && returnDate && returnDate < depart) e.returnDate = "Return cannot be before departure";
    if (duration < 1) e.duration = "Duration must be at least 1 day";
    if (passengers < 1) e.passengers = "At least 1 passenger required";
    if (!selectedRequirement) e.requirements = "Select at least one bus requirement";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleNext = async () => {
    if (isSubmitting.current) return;
    if (!validateForm()) return;

    isSubmitting.current = true;
    setLoading(true);

    try {
      const totalPayment = estimatedPrice || 0;
      const advancePayment = Math.round(totalPayment * 0.15);
      const dueAmount = totalPayment - advancePayment;

      // Use typed/selected values, fallback to empty strings if not filled
      const pickupName = pickup?.name || pickupText || "TBD";
      const dropName = drop?.name || dropText || "TBD";

      const bookingData = {
        startLocation: pickupName,
        destination: dropName,
        startDate: depart?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
        returnDate: returnDate?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
        passengerCount: passengers,
        advancePayment,
        finalPrice: totalPayment,
        bookingStatus: "PENDING",
        passengerId: currentUser?.userId || 4,
      };

      const response = await fetch(`${API_BASE_URL}/trips/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      });

      const savedBooking = await response.json();

      const tripDetails = {
        tripTitle: `Bus Trip from ${pickupName} to ${dropName}`,
        bookingId: savedBooking.id,
        pickup: pickupName,
        drop: dropName,
        depart: depart?.toDateString() || "",
        returnDate: returnDate?.toDateString() || "",
        duration,
        passengers,
        selectedRequirement,
        distance,
        totalPayment,
        advancePayment,
        dueAmount,
      };

      router.push({
        pathname: "/trips/available-trip-bus",
        params: { tripData: JSON.stringify(tripDetails) },
      });
    } catch (error) {
      console.error("Booking failed:", error);
      alert("Failed to save booking. Check if the backend is running.");
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    // NOTE: TouchableWithoutFeedback is intentionally NOT used here.
    // It conflicts with keyboardShouldPersistTaps="always" on the ScrollView
    // and swallows taps on the suggestions dropdown.
    // Keyboard dismissal is handled by the ScrollView's own tap behaviour.
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F7FB" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: 40 }}
      >
        {/* ── Header ───────────────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Ionicons name="chevron-back" size={22} onPress={() => router.back()} />
          <Text style={{ fontSize: 18, fontWeight: "bold" }}>Book a Trip</Text>
          <View style={{ width: 20 }} />
        </View>

        {/* ── Progress bar ──────────────────────────────── */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
          <Text style={{ fontSize: 12, color: "#2563EB" }}>Step 1 of 5</Text>
          <Text style={{ fontSize: 12, color: "#9CA3AF" }}>20% completed</Text>
        </View>
        <View style={{ height: 6, backgroundColor: "#E5E7EB", borderRadius: 10, marginTop: 6 }}>
          <View style={{ width: "20%", height: 6, backgroundColor: "#2563EB", borderRadius: 10 }} />
        </View>

        {/* ── Journey Details card ──────────────────────── */}
        <View
          style={{
            backgroundColor: "white",
            padding: 14,
            borderRadius: 12,
            marginTop: 14,
            // overflow visible so dropdown floats over the card below
            overflow: "visible",
            zIndex: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Ionicons name="map-outline" size={18} color="#2563EB" />
            <Text style={{ fontWeight: "bold", marginLeft: 6 }}>Journey Details</Text>
          </View>

          {/* Pickup */}
          <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>Pickup Location</Text>
          {/*
              LocationInput calls Google Places Autocomplete as the user types.
              onSelect receives a ResolvedLocation (name + lat/lng) so the map
              can show a marker and draw the route.
            */}
          {/*
              Pickup zIndex is higher (20) than drop-off (10) so if both
              dropdowns are visible at the same time, pickup wins on top.
            */}
          <View style={{ zIndex: 20 }}>
            <LocationInput
              placeholder="Search pickup location..."
              value={pickupText}
              onChangeText={(t) => {
                setPickupText(t);
                // Clear resolved location if user manually edits the text
                if (pickup && t !== pickup.name) setPickup(null);
              }}
              onSelect={(loc) => {
                setPickup(loc);
                setPickupText(loc.name);
              }}
              error={errors.pickup}
            />
          </View>

          {/* Drop-off */}
          <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>Drop-off Location</Text>
          {/* Drop-off zIndex is lower (10) so pickup dropdown floats above it */}
          <View style={{ zIndex: 10 }}>
            <LocationInput
              placeholder="Search drop-off location..."
              value={dropText}
              onChangeText={(t) => {
                setDropText(t);
                if (drop && t !== drop.name) setDrop(null);
              }}
              onSelect={(loc) => {
                setDrop(loc);
                setDropText(loc.name);
              }}
              error={errors.drop}
            />
          </View>

          {/* Date pickers */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
            {/* Departure */}
            <View style={{ width: "48%" }}>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 10 }}>Departure</Text>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#F3F4F6",
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: errors.depart ? "red" : "#D1D5DB",
                }}
                onPress={() => setShowDepartPicker(true)}
              >
                <Text style={{ flex: 1, color: depart ? "#111827" : "#9CA3AF", fontSize: 13 }}>
                  {depart ? depart.toDateString() : "Select Date"}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>
              {showDepartPicker && (
                <DateTimePicker
                  value={depart || new Date()}
                  mode="date"
                  minimumDate={new Date()}
                  display="default"
                  onChange={(_, d) => { setShowDepartPicker(false); if (d) setDepart(d); }}
                />
              )}
              {errors.depart && (
                <Text style={{ color: "red", fontSize: 11, marginTop: 2 }}>{errors.depart}</Text>
              )}
            </View>

            {/* Return */}
            <View style={{ width: "48%" }}>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 10 }}>Return</Text>
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#F3F4F6",
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: errors.returnDate ? "red" : "#D1D5DB",
                }}
                onPress={() => setShowReturnPicker(true)}
              >
                <Text style={{ flex: 1, color: returnDate ? "#111827" : "#9CA3AF", fontSize: 13 }}>
                  {returnDate ? returnDate.toDateString() : "Select Date"}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
              </TouchableOpacity>
              {showReturnPicker && (
                <DateTimePicker
                  value={returnDate || new Date()}
                  mode="date"
                  minimumDate={depart || new Date()}
                  display="default"
                  onChange={(_, d) => { setShowReturnPicker(false); if (d) setReturnDate(d); }}
                />
              )}
              {errors.returnDate && (
                <Text style={{ color: "red", fontSize: 11, marginTop: 2 }}>{errors.returnDate}</Text>
              )}
            </View>
          </View>

          {/* Duration & passengers */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
            <View style={{ width: "48%" }}>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 10 }}>Duration (Days)</Text>
              <TextInput
                value={duration.toString()}
                editable={false}
                style={{
                  backgroundColor: "#F3F4F6",
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#D1D5DB",
                  color: "#111827",
                }}
              />
            </View>
            <View style={{ width: "48%" }}>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 10 }}>Passengers</Text>
              <TextInput
                value={passengers.toString()}
                keyboardType="numeric"
                onChangeText={(t) => setPassengers(Number(t) || 0)}
                style={{
                  backgroundColor: "#F3F4F6",
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: errors.passengers ? "red" : "#D1D5DB",
                  color: "#111827",
                }}
              />
              {errors.passengers && (
                <Text style={{ color: "red", fontSize: 11, marginTop: 2 }}>{errors.passengers}</Text>
              )}
            </View>
          </View>
        </View>

        {/* ── Route Preview Map ──────────────────────────── */}
        <View
          style={{
            backgroundColor: "white",
            padding: 14,
            borderRadius: 12,
            marginTop: 14,
            overflow: "hidden",
            zIndex: 1,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Ionicons name="navigate-circle-outline" size={18} color="#2563EB" />
            <Text style={{ fontWeight: "bold", marginLeft: 6 }}>Route Preview</Text>
            {pickup?.latitude && drop?.latitude && distance > 0 && (
              <View
                style={{
                  marginLeft: "auto",
                  backgroundColor: "#EEF2FF",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 20,
                }}
              >
                <Text style={{ fontSize: 11, color: "#2563EB", fontWeight: "600" }}>
                  ~{distance} km
                </Text>
              </View>
            )}
          </View>

          <View style={{ height: 200, borderRadius: 10, overflow: "hidden", backgroundColor: "#F3F4F6" }}>
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: 7.8731,
                longitude: 80.7718,
                latitudeDelta: 3.5,
                longitudeDelta: 3.5,
              }}
            >
              {/* Pickup marker — green */}
              {pickup?.latitude && pickup?.longitude && (
                <Marker
                  coordinate={{ latitude: pickup.latitude, longitude: pickup.longitude }}
                  title="Pickup"
                  description={pickup.name}
                  pinColor="green"
                />
              )}

              {/* Drop-off marker — red */}
              {drop?.latitude && drop?.longitude && (
                <Marker
                  coordinate={{ latitude: drop.latitude, longitude: drop.longitude }}
                  title="Drop-off"
                  description={drop.name}
                  pinColor="red"
                />
              )}

              {/* Road route via Google Directions API */}
              {pickup?.latitude != null && pickup?.longitude != null &&
                drop?.latitude != null && drop?.longitude != null && (
                <>
                  {/*
                      MapViewDirections draws the actual road route.
                      It uses GOOGLE_MAPS_API_KEY (now real) and the
                      real lat/lng we got from Places Details API.
                    */}
                  <MapViewDirections
                    origin={{ latitude: pickup.latitude, longitude: pickup.longitude }}
                    destination={{ latitude: drop.latitude, longitude: drop.longitude }}
                    apikey={GOOGLE_MAPS_API_KEY}
                    strokeWidth={4}
                    strokeColor="#2563EB"
                    optimizeWaypoints={true}
                    onError={(e) => console.warn("[MapViewDirections] route error:", e)}
                  />
                  {/* Faint dashed straight line shown while road route loads */}
                  <Polyline
                    coordinates={[
                      { latitude: pickup.latitude, longitude: pickup.longitude },
                      { latitude: drop.latitude, longitude: drop.longitude },
                    ]}
                    strokeColor="rgba(37,99,235,0.25)"
                    strokeWidth={2}
                    lineDashPattern={[6, 6]}
                  />
                </>
              )}
            </MapView>

            {/* Overlay shown before locations are selected or if coordinates are missing */}
            {(!pickup?.latitude || !drop?.latitude) && (
              <View
                style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "rgba(243,244,246,0.85)",
                }}
              >
                <Ionicons name="map-outline" size={32} color="#9CA3AF" />
                <Text style={{ color: "#6B7280", fontSize: 12, marginTop: 8, textAlign: "center", paddingHorizontal: 20 }}>
                  {(!pickup || !drop) 
                    ? "Search locations to see the route preview" 
                    : "Route preview will show once Google Maps is fully activated"}
                </Text>
              </View>
            )}
          </View>

          {/* Estimated price badge */}
          {estimatedPrice > 0 && (
            <View
              style={{
                marginTop: 10,
                backgroundColor: "#F0FDF4",
                borderRadius: 8,
                padding: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ fontSize: 12, color: "#166534" }}>Estimated Price</Text>
              <Text style={{ fontSize: 16, fontWeight: "bold", color: "#166534" }}>
                LKR {estimatedPrice.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* ── Requirements ──────────────────────────────── */}
        <View style={{ backgroundColor: "white", padding: 14, borderRadius: 12, marginTop: 14, zIndex: 1 }}>
          <Text style={{ fontWeight: "bold" }}>Requirements</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10, gap: 8 }}>
            {["Standard", "AC", "Mini Bus"].map((req) => (
              <TouchableOpacity
                key={req}
                onPress={() => setSelectedRequirement(req)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: selectedRequirement === req ? "#EEF2FF" : "#F3F4F6",
                  padding: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: selectedRequirement === req ? "#2563EB" : "transparent",
                }}
              >
                <Ionicons
                  name={selectedRequirement === req ? "radio-button-on" : "radio-button-off"}
                  size={16}
                  color={selectedRequirement === req ? "#2563EB" : "#9CA3AF"}
                />
                <Text
                  style={{
                    marginLeft: 6,
                    color: selectedRequirement === req ? "#2563EB" : "#4B5563",
                    fontSize: 12,
                  }}
                >
                  {req}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.requirements && (
            <Text style={{ color: "red", fontSize: 11, marginTop: 4 }}>{errors.requirements}</Text>
          )}
          <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 10 }}>
            Progress saved automatically
          </Text>
        </View>

        {/* ── Next Step button ───────────────────────────── */}
        <TouchableOpacity
          style={{
            flexDirection: "row",
            padding: 16,
            borderRadius: 10,
            justifyContent: "center",
            alignItems: "center",
            marginTop: 16,
            marginBottom: 10,
            backgroundColor: formValid && !loading ? "#2563EB" : "#9CA3AF",
          }}
          onPress={handleNext}
          disabled={!formValid || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text style={{ color: "white", fontWeight: "bold", marginRight: 8 }}>Next Step</Text>
              <Ionicons name="arrow-forward" size={18} color="white" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
