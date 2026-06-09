import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import MapView, { Marker, Polyline } from "react-native-maps";
import MapViewDirections from 'react-native-maps-directions';
import { useSession } from "../../store/sessionStore";
import { API_BASE_URL as ENV_API_BASE_URL } from "../../config/env";

// 🔹 CONFIG: API & GOOGLE MAPS KEY
const API_BASE_URL = `${ENV_API_BASE_URL}/api`;
const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY_HERE";

export default function BookATrip() {
  const router = useRouter();
  const { currentUser } = useSession();

  // 🔹 STATE: LOCATION & SEARCH
  const [pickupQuery, setPickupQuery] = useState("");
  const [dropQuery, setDropQuery] = useState("");
  const [pickup, setPickup] = useState<any>(null);
  const [drop, setDrop] = useState<any>(null);
  const [pickupResults, setPickupResults] = useState<any[]>([]);
  const [dropResults, setDropResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const mapRef = React.useRef<MapView>(null);

  // 🔹 STATE: TRIP DETAILS (DATES, PASSENGERS, ETC)
  const [depart, setDepart] = useState<Date | null>(null);
  const [returnDate, setReturnDate] = useState<Date | null>(null);
  const [showDepartPicker, setShowDepartPicker] = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);
  const [duration, setDuration] = useState<number>(3);
  const [passengers, setPassengers] = useState<number>(2);
  const [selectedRequirement, setSelectedRequirement] = useState<string | null>("AC");

  // 🔹 STATE: VALIDATION & PRICING
  const [errors, setErrors] = useState<any>({});
  const [formValid, setFormValid] = useState(false);
  const [distance, setDistance] = useState<number>(0);
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const isSubmitting = React.useRef(false); // 🔹 THE DEADBOLT LOCK

  // 🔹 EFFECT: SEARCH TOWNS FROM BACKEND
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
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/locations/search?query=${query}`);
        const data = await response.json();
        setResults(data);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }
    };

    const timer1 = setTimeout(() => search(pickupQuery, setPickupResults, pickup), 300);
    return () => clearTimeout(timer1);
  }, [pickupQuery, pickup]);

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
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/locations/search?query=${query}`);
        const data = await response.json();
        setResults(data);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setLoading(false);
      }
    };

    const timer2 = setTimeout(() => search(dropQuery, setDropResults, drop), 300);
    return () => clearTimeout(timer2);
  }, [dropQuery, drop]);

  // 🔹 LOGIC: CALCULATE DISTANCE & ZOOM MAP
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  useEffect(() => {
    if (pickup && drop && mapRef.current) {
      const dist = calculateDistance(pickup.latitude, pickup.longitude, drop.latitude, drop.longitude);
      setDistance(Math.round(dist));
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([
          { latitude: Number(pickup.latitude), longitude: Number(pickup.longitude) },
          { latitude: Number(drop.latitude), longitude: Number(drop.longitude) }
        ], { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 }, animated: true });
      }, 500);
    }
  }, [pickup, drop]);

  // 🔹 LOGIC: REALISTIC BUS PRICING
  useEffect(() => {
    if (distance > 0) {
      const dailyRate = 12000;
      const days = duration || 1;
      let total = dailyRate * days;
      const ratePerKm = passengers <= 20 ? 250 : 400;
      let distanceCost = distance * ratePerKm;
      if (selectedRequirement === "AC") distanceCost *= 1.25;
      total += distanceCost;
      if (selectedRequirement === "WIFI") total += 1000;
      if (selectedRequirement && selectedRequirement !== "AC" && selectedRequirement !== "First Aid") total += 1500;
      setEstimatedPrice(Math.round(total));
    } else {
      setEstimatedPrice(0);
    }
  }, [distance, passengers, selectedRequirement, duration]);

  // 🔹 LOGIC: FORM VALIDATION
  const validateForm = () => {
    let tempErrors: any = {};
    if (!pickup) tempErrors.pickup = "Please select Pickup Location";
    if (!drop) tempErrors.drop = "Please select Drop-off Location";
    if (!depart) tempErrors.depart = "Please select Departure Date";
    if (!returnDate) tempErrors.returnDate = "Please select Return Date";
    if (depart && returnDate && returnDate < depart) tempErrors.returnDate = "Return cannot be before departure";
    if (duration < 1) tempErrors.duration = "Duration must be at least 1 day";
    if (passengers < 1) tempErrors.passengers = "At least 1 passenger required";
    if (!selectedRequirement) tempErrors.requirements = "Select at least one bus requirement";
    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  useEffect(() => {
    if (depart && returnDate) {
      const diffDays = Math.max(Math.ceil((returnDate.getTime() - depart.getTime()) / (1000 * 60 * 60 * 24)), 1);
      setDuration(diffDays);
    }
  }, [depart, returnDate]);

  useEffect(() => {
    setFormValid(pickup !== null && drop !== null && depart !== null && returnDate !== null && duration > 0 && passengers > 0 && selectedRequirement !== null && !(returnDate && depart && returnDate < depart));
  }, [pickup, drop, depart, returnDate, duration, passengers, selectedRequirement]);

  // 🔹 ACTION: HANDLE NEXT STEP
  const handleNext = async () => {
    if (isSubmitting.current) return; // 🛑 STOP! We are already saving

    if (validateForm()) {
      isSubmitting.current = true; // 🔐 LOCK IT NOW
      setLoading(true);
      try {
        const totalPayment = estimatedPrice;
        const advancePayment = Math.round(totalPayment * 0.15);
        const dueAmount = totalPayment - advancePayment;

        // 🔹 DATA: Prepare the object for the Java Backend
        const bookingData = {
          startLocation: pickup.name,
          destination: drop.name,
          startDate: depart?.toISOString().split('T')[0], // YYYY-MM-DD
          returnDate: returnDate?.toISOString().split('T')[0],
          passengerCount: passengers,
          advancePayment: advancePayment,
          finalPrice: totalPayment,
          bookingStatus: "PENDING",
          passengerId: currentUser?.userId || 4 // USE REAL USER ID IF AVAILABLE, ELSE 4 FOR DEMO
        };

        // 🔹 API: Save to MySQL Database
        const response = await fetch(`${API_BASE_URL}/trips/book`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookingData),
        });

        const savedBooking = await response.json();

        const tripDetails = {
          tripTitle: `Bus Trip from ${pickup.name} to ${drop.name}`,
          bookingId: savedBooking.id, // THE REAL DATABASE ID!
          pickup: pickup.name,
          drop: drop.name,
          depart: depart?.toDateString(),
          returnDate: returnDate?.toDateString(),
          duration,
          passengers,
          selectedRequirement,
          distance,
          totalPayment,
          advancePayment,
          dueAmount,
        };

        router.push({
          pathname: '/trips/available-trip-bus',
          params: { tripData: JSON.stringify(tripDetails) }
        });
      } catch (error) {
        console.error("Booking failed:", error);
        alert("Failed to save booking to database. Check if backend is running.");
      } finally {
        setLoading(false);
        isSubmitting.current = false; // 🔓 UNLOCK ALWAYS (allows clicking again if user goes back)
      }
    }
  };

  // 🔹 UI COMPONENT: CITY DROPDOWN RENDERER
  const renderCityDropdown = (query: string, setQuery: (t: string) => void, results: any[], setResults: (data: any[]) => void, setSelected: (item: any) => void, selectedItem: any, error?: string) => {
    return (
      <View style={{ marginTop: 4, marginBottom: error ? 8 : 16 }}>
        <TextInput
          placeholder="Type or select a city (Min 3 chars)"
          value={query}
          onChangeText={(text) => { setQuery(text); setSelected(null); }}
          style={[{ borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, backgroundColor: '#F3F4F6' }, error && { borderColor: "red" }]}
        />
        {error && <Text style={{ color: 'red', fontSize: 11, marginTop: 2 }}>{error}</Text>}
        {loading && query.length >= 3 && <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 5 }} />}
        {query.length >= 3 && results.length === 0 && !loading && !selectedItem && <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Searching for towns...</Text>}
        {query.length >= 3 && results.length > 0 && (
          <View style={{ marginTop: 5, backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#2563EB', padding: 2 }}>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {results.map((item) => (
                <TouchableOpacity key={item.id} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }} onPress={() => { setSelected(item); setQuery(item.name); setResults([]); }}>
                  <Text style={{ fontSize: 14, fontWeight: '500' }}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  // 🔹 MAIN UI RENDER
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F7FB", padding: 16, paddingTop: 20 }}>
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* 🔹 UI: HEADER */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Ionicons name="chevron-back" size={22} onPress={() => router.back()} />
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Book a Trip</Text>
            <View style={{ width: 20 }} />
          </View>

          {/* 🔹 UI: PROGRESS BAR */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
            <Text style={{ fontSize: 12, color: '#2563EB' }}>Step 1 of 5</Text>
            <Text style={{ fontSize: 12, color: '#9CA3AF' }}>20% completed</Text>
          </View>
          <View style={{ height: 6, backgroundColor: '#E5E7EB', borderRadius: 10, marginTop: 6 }}>
            <View style={{ width: '20%', height: 6, backgroundColor: '#2563EB', borderRadius: 10 }} />
          </View>

          {/* 🔹 UI: JOURNEY DETAILS CARD */}
          <View style={{ backgroundColor: 'white', padding: 14, borderRadius: 12, marginTop: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <Ionicons name="map-outline" size={18} color="#2563EB" />
              <Text style={{ fontWeight: 'bold', marginLeft: 6 }}>Journey Details</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 10 }}>Pickup Location</Text>
            {renderCityDropdown(pickupQuery, setPickupQuery, pickupResults, setPickupResults, setPickup, pickup, errors.pickup)}
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 10 }}>Drop-off Location</Text>
            {renderCityDropdown(dropQuery, setDropQuery, dropResults, setDropResults, setDrop, drop, errors.drop)}

            {/* 🔹 UI: DATE PICKERS */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <View style={{ width: '48%' }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 10 }}>Departure</Text>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: errors.depart ? 'red' : '#D1D5DB' }} onPress={() => setShowDepartPicker(true)}>
                  <Text style={{ flex: 1 }}>{depart ? depart.toDateString() : 'Select Date'}</Text>
                  <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
                {showDepartPicker && <DateTimePicker value={depart || new Date()} mode="date" minimumDate={new Date()} display="default" onChange={(e, d) => { setShowDepartPicker(false); if (d) setDepart(d); }} />}
              </View>
              <View style={{ width: '48%' }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 10 }}>Return</Text>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: errors.returnDate ? 'red' : '#D1D5DB' }} onPress={() => setShowReturnPicker(true)}>
                  <Text style={{ flex: 1 }}>{returnDate ? returnDate.toDateString() : 'Select Date'}</Text>
                  <Ionicons name="calendar-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
                {showReturnPicker && <DateTimePicker value={returnDate || new Date()} mode="date" minimumDate={depart || new Date()} display="default" onChange={(e, d) => { setShowReturnPicker(false); if (d) setReturnDate(d); }} />}
              </View>
            </View>
            {errors.returnDate && <Text style={{ color: 'red', fontSize: 11, marginTop: 2 }}>{errors.returnDate}</Text>}

            {/* 🔹 UI: DURATION & PASSENGERS */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
              <View style={{ width: '48%' }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 10 }}>Duration (Days)</Text>
                <TextInput value={duration.toString()} editable={false} style={{ backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB' }} />
              </View>
              <View style={{ width: '48%' }}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 10 }}>Passengers</Text>
                <TextInput value={passengers.toString()} keyboardType="numeric" onChangeText={(t) => setPassengers(Number(t) || 0)} style={{ backgroundColor: '#F3F4F6', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: errors.passengers ? 'red' : '#D1D5DB' }} />
              </View>
            </View>
          </View>

          {/* 🔹 UI: ROUTE PREVIEW MAP (UBER STYLE) */}
          <View style={{ backgroundColor: 'white', padding: 14, borderRadius: 12, marginTop: 14, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="navigate-circle-outline" size={18} color="#2563EB" />
              <Text style={{ fontWeight: 'bold', marginLeft: 6 }}>Route Preview</Text>

            </View>
            <View style={{ height: 180, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F3F4F6' }}>
              <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={{ latitude: 7.8731, longitude: 80.7718, latitudeDelta: 3, longitudeDelta: 3 }}>
                {pickup && <Marker coordinate={{ latitude: Number(pickup.latitude), longitude: Number(pickup.longitude) }} title="Start" pinColor="green" />}
                {drop && <Marker coordinate={{ latitude: Number(drop.latitude), longitude: Number(drop.longitude) }} title="End" pinColor="red" />}
                {pickup && drop && (
                  <>
                    <MapViewDirections origin={{ latitude: Number(pickup.latitude), longitude: Number(pickup.longitude) }} destination={{ latitude: Number(drop.latitude), longitude: Number(drop.longitude) }} apikey={GOOGLE_MAPS_API_KEY} strokeWidth={4} strokeColor="#2563EB" optimizeWaypoints={true} onError={(e) => console.log("Road route failed:", e)} />
                    <Polyline coordinates={[{ latitude: Number(pickup.latitude), longitude: Number(pickup.longitude) }, { latitude: Number(drop.latitude), longitude: Number(drop.longitude) }]} strokeColor="rgba(37, 99, 235, 0.3)" strokeWidth={2} lineDashPattern={[5, 5]} />
                  </>
                )}
              </MapView>
              {(!pickup || !drop) && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(243, 244, 246, 0.8)' }}><Ionicons name="map-outline" size={30} color="#9CA3AF" /><Text style={{ color: '#6B7280', fontSize: 12, marginTop: 8 }}>Select locations to view route</Text></View>}
            </View>
          </View>

          {/* 🔹 UI: REQUIREMENTS SECTION (RADIO BUTTONS) */}
          <View style={{ backgroundColor: 'white', padding: 14, borderRadius: 12, marginTop: 14 }}>
            <Text style={{ fontWeight: 'bold' }}>Requirements</Text>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              {['Standard', 'AC', 'Mini Bus'].map(req => (
                <TouchableOpacity key={req} onPress={() => setSelectedRequirement(req)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: selectedRequirement === req ? '#EEF2FF' : '#F3F4F6', padding: 8, borderRadius: 8, marginRight: 10, borderWidth: 1, borderColor: selectedRequirement === req ? '#2563EB' : 'transparent' }}>
                  <Ionicons name={selectedRequirement === req ? "radio-button-on" : "radio-button-off"} size={16} color={selectedRequirement === req ? "#2563EB" : "#9CA3AF"} />
                  <Text style={{ marginLeft: 6, color: selectedRequirement === req ? '#2563EB' : '#4B5563', fontSize: 12 }}>{req}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.requirements && <Text style={{ color: 'red', fontSize: 11, marginTop: 2 }}>{errors.requirements}</Text>}
            <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>Progress saved automatically</Text>
          </View>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              padding: 16,
              borderRadius: 10,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 16,
              marginBottom: 30,
              backgroundColor: (formValid && !loading) ? '#2563EB' : '#9CA3AF'
            }}
            onPress={handleNext}
            disabled={!formValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={{ color: 'white', fontWeight: 'bold', marginRight: 8 }}>Next Step</Text>
                <Ionicons name="arrow-forward" size={18} color="white" />
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}
