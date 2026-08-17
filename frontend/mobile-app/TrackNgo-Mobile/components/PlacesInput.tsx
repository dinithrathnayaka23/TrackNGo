import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../utils/i18n';
import { GOOGLE_MAPS_API_KEY } from '../config/env';

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

type Props = {
  label: string;
  placeholder?: string;
  onSelect: (locationName: string) => void;
  initialValue?: string;
  fallbackSuggestions?: string[];
};

type Suggestion = {
  id: string;
  description: string;
  mainText: string;
};

type GooglePrediction = {
  place_id?: string;
  description?: string;
  structured_formatting?: { main_text?: string };
};

function normalizeSuggestion(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/g, ' ');
}

async function searchGooglePlaces(query: string): Promise<Suggestion[]> {
  const url =
    'https://maps.googleapis.com/maps/api/place/autocomplete/json' +
    `?input=${encodeURIComponent(query)}` +
    `&key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}` +
    '&language=en&components=country:lk';

  const response = await fetch(url);
  const payload = await response.json();

  if (payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
    throw new Error(payload.error_message || payload.status || 'Google Places request failed');
  }

  return ((payload.predictions ?? []) as GooglePrediction[])
    .filter((prediction) => prediction.description?.trim())
    .map((prediction, index) => {
      const description = prediction.description!.trim();
      return {
        id: prediction.place_id || `google-${description}-${index}`,
        description,
        mainText: prediction.structured_formatting?.main_text?.trim() || description,
      };
    });
}

export default function PlacesInput({
  label,
  placeholder,
  onSelect,
  initialValue,
  fallbackSuggestions = [],
}: Props) {
  const [text, setText] = useState(initialValue ?? '');
  const [googleSuggestions, setGoogleSuggestions] = useState<Suggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setText(initialValue ?? '');
  }, [initialValue]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      requestIdRef.current += 1;
    };
  }, []);

  const routeSuggestions = useMemo<Suggestion[]>(() => {
    const query = normalizeSuggestion(text);
    if (query.length < MIN_QUERY_LENGTH) return [];

    return fallbackSuggestions
      .filter((stop) => normalizeSuggestion(stop).includes(query))
      .slice(0, 8)
      .map((stop, index) => ({
        id: `route-stop-${normalizeSuggestion(stop)}-${index}`,
        description: stop,
        mainText: stop,
      }));
  }, [fallbackSuggestions, text]);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return [...routeSuggestions, ...googleSuggestions]
      .filter((suggestion) => {
        const key = normalizeSuggestion(suggestion.description);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 8);
  }, [googleSuggestions, routeSuggestions]);

  const handleChangeText = (nextText: string) => {
    setText(nextText);
    setFocused(true);
    setGoogleSuggestions([]);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = nextText.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      requestIdRef.current += 1;
      setSearching(false);
      return;
    }

    setSearching(true);
    const requestId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchGooglePlaces(query);
        if (requestId !== requestIdRef.current) return;
        setGoogleSuggestions(results);
      } catch {
        // Route-stop suggestions remain visible if Google is unavailable.
        if (requestId === requestIdRef.current) setGoogleSuggestions([]);
      } finally {
        if (requestId === requestIdRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleSelect = (suggestion: Suggestion) => {
    setText(suggestion.mainText);
    setFocused(false);
    setGoogleSuggestions([]);
    Keyboard.dismiss();
    onSelect(suggestion.mainText);
  };

  const showSuggestions = focused && text.trim().length >= MIN_QUERY_LENGTH;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        value={text}
        placeholder={placeholder ?? 'Search location...'}
        placeholderTextColor="#94A3B8"
        selectionColor="#2F6BFF"
        autoCorrect={false}
        autoCapitalize="words"
        returnKeyType="done"
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChangeText={handleChangeText}
        style={styles.textInput}
      />

      {showSuggestions && (searching || suggestions.length > 0) && (
        <View style={styles.listView}>
          {searching && suggestions.length === 0 ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#2F6BFF" />
              <Text style={styles.loadingText}>Searching locations...</Text>
            </View>
          ) : (
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              renderItem={({ item }) => (
                <Pressable
                  accessible
                  accessibilityRole="button"
                  onPress={() => handleSelect(item)}
                  style={styles.suggestionRow}>
                  <Ionicons name="location-outline" size={14} color="#64748B" />
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {item.description}
                  </Text>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    overflow: 'visible',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  textInput: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 0,
    height: 28,
    marginBottom: 0,
  },
  listView: {
    position: 'absolute',
    top: 52,
    left: -46,
    right: -16,
    maxHeight: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 9999,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
});
