import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GOOGLE_MAPS_API_KEY } from "../config/env";

export type PlaceValue = {
  name: string;
  latitude: number;
  longitude: number;
  placeId?: string;
} | null;

type Prediction = {
  place_id: string;
  description: string;
  main_text: string;
};

type SearchResult = { predictions: Prediction[]; error: string | null };

async function searchPlaces(query: string): Promise<SearchResult> {
  if (query.trim().length < 3) return { predictions: [], error: null };
  if (!GOOGLE_MAPS_API_KEY) {
    return { predictions: [], error: "Google Maps API key is not configured." };
  }
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query)}` +
      `&key=${GOOGLE_MAPS_API_KEY}` +
      `&language=en` +
      `&components=country:lk`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      console.warn("[GooglePlaceField] autocomplete status:", json.status, json.error_message);
      return { predictions: [], error: `${json.status}${json.error_message ? `: ${json.error_message}` : ""}` };
    }
    const predictions = (json.predictions ?? []).map((p: any) => ({
      place_id: p.place_id,
      description: p.description,
      main_text: p.structured_formatting?.main_text ?? p.description,
    }));
    return { predictions, error: null };
  } catch (e) {
    console.error("[GooglePlaceField] autocomplete fetch error:", e);
    return { predictions: [], error: "Network error while searching places." };
  }
}

async function getPlaceCoordinates(placeId: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=geometry` +
      `&key=${GOOGLE_MAPS_API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== "OK") {
      console.warn("[GooglePlaceField] details status:", json.status, json.error_message);
      return null;
    }
    const loc = json.result?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch (e) {
    console.error("[GooglePlaceField] details fetch error:", e);
    return null;
  }
}

type Props = {
  label: string;
  placeholder?: string;
  value: PlaceValue;
  onChange: (value: PlaceValue) => void;
  icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * A building/place-accurate location picker backed by Google Places
 * Autocomplete + Place Details — used wherever a corporate contract needs an
 * exact pickup or drop-off point rather than just a city name.
 */
export default function GooglePlaceField({ label, placeholder, value, onChange, icon = "location" }: Props) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setQuery(value?.name ?? "");
  }, [value?.name]);

  const handleChangeText = (text: string) => {
    setQuery(text);
    if (value) onChange(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 3) {
      setPredictions([]);
      setSearchError(null);
      requestIdRef.current += 1;
      return;
    }
    setSearching(true);
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      const { predictions: results, error } = await searchPlaces(text);
      if (requestId === requestIdRef.current) {
        setPredictions(results);
        setSearchError(error);
        setSearching(false);
      }
    }, 300);
  };

  const handleSelect = async (prediction: Prediction) => {
    setQuery(prediction.main_text);
    setPredictions([]);
    setResolving(true);
    const coords = await getPlaceCoordinates(prediction.place_id);
    setResolving(false);
    if (!coords) {
      onChange(null);
      return;
    }
    onChange({
      name: prediction.main_text,
      latitude: coords.lat,
      longitude: coords.lng,
      placeId: prediction.place_id,
    });
  };

  const showDropdown = query.trim().length >= 3 && !value && (searching || predictions.length > 0 || !!searchError);

  return (
    <View style={{ marginBottom: 16, zIndex: showDropdown ? 100 : 1 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <Ionicons name={icon} size={18} color="#067BF9" style={{ marginRight: 10 }} />
        <TextInput
          style={styles.textInput}
          placeholder={placeholder ?? "Search for a place or building..."}
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={handleChangeText}
        />
        {resolving && <ActivityIndicator size="small" color="#067BF9" />}
        {!!value && !resolving && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          {searching && predictions.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#067BF9" />
              <Text style={styles.loadingText}>Searching places...</Text>
            </View>
          ) : searchError ? (
            <View style={styles.loadingRow}>
              <Ionicons name="warning-outline" size={16} color="#DC2626" />
              <Text style={styles.errorText}>{searchError}</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {predictions.map((item) => (
                <TouchableOpacity key={item.place_id} style={styles.item} onPress={() => handleSelect(item)}>
                  <Ionicons name="location-outline" size={14} color="#64748B" />
                  <Text style={styles.itemText} numberOfLines={2}>{item.description}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "700", color: "#1E293B", marginBottom: 8 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  textInput: { flex: 1, fontSize: 14, color: "#1E293B" },
  dropdown: {
    marginTop: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#067BF9",
    position: "absolute",
    top: 78,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 5,
  },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12 },
  loadingText: { fontSize: 12, color: "#64748B" },
  errorText: { flex: 1, fontSize: 12, color: "#DC2626" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  itemText: { flex: 1, fontSize: 13, color: "#1E293B", fontWeight: "500" },
});
