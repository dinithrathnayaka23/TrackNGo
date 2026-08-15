import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons';
import { GOOGLE_MAPS_API_KEY } from '../config/env';

/**
 * Props for PlacesInput component.
 *
 * label        - The small label shown above the input (e.g. "From", "To")
 * placeholder  - Placeholder text shown inside the text box
 * onSelect     - Callback fired when the user taps a suggestion.
 *                Receives the place name as a string so the parent
 *                can store it in its own state (e.g. setFrom / setTo).
 * initialValue - Optional pre-filled text (used if navigating back to the screen)
 */
type Props = {
  label: string;
  placeholder?: string;
  onSelect: (locationName: string) => void;
  initialValue?: string;
};

export default function PlacesInput({ label, placeholder, onSelect, initialValue }: Props) {
  // Keep a ref to the autocomplete so we can clear it programmatically if needed
  const ref = useRef<any>(null);

  return (
    <View style={styles.wrapper}>
      {/* Small uppercase label — matches the existing inputLabel style in search-buses */}
      <Text style={styles.label}>{label}</Text>

      <GooglePlacesAutocomplete
        ref={ref}
        placeholder={placeholder ?? 'Search location...'}

        /**
         * onPress fires when the user taps one of the dropdown suggestions.
         * 'data' contains the place information.
         * We send only the short main_text (e.g. "Colombo") back to the parent,
         * falling back to the full description if main_text is missing.
         */
        onPress={(data) => {
          const name =
            data.structured_formatting?.main_text?.trim() ||
            data.description?.trim();
          onSelect(name);
        }}

        /**
         * Query config sent to Google Places API:
         * - key:        our API key from config/env.ts
         * - language:   results in English
         * - components: restrict to Sri Lanka ('lk') so suggestions are local
         *               Remove this line if you want worldwide suggestions
         */
        query={{
          key: GOOGLE_MAPS_API_KEY,
          language: 'en',
          components: 'country:lk',
        }}

        // We only need the name, not full coordinates/details
        fetchDetails={false}

        // Hide the "Powered by Google" footer to save space
        enablePoweredByContainer={false}

        // Pre-fill the text box if coming back to this screen
        textInputProps={{
          defaultValue: initialValue ?? '',
          placeholderTextColor: '#94A3B8',
        }}

        /**
         * Custom row renderer — shows a pin icon next to each suggestion.
         * Matches the style of the old autocomplete list in search-buses.tsx.
         */
        renderRow={(rowData) => (
          <View style={styles.suggestionRow}>
            <Ionicons name="location-outline" size={14} color="#64748B" />
            <Text style={styles.suggestionText} numberOfLines={1}>
              {rowData.description}
            </Text>
          </View>
        )}

        /**
         * Style overrides — these match the existing card/input look
         * already defined in search-buses.tsx so it feels consistent.
         */
        styles={{
          container: {
            flex: 1,
          },
          textInputContainer: {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            borderBottomWidth: 0,
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
            // The dropdown floats absolutely over content below it
            position: 'absolute',
            top: 52,           // sits just below the input card
            left: -46,         // stretches left to align with the card edge (past the icon)
            right: -16,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            elevation: 10,     // Android shadow
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            zIndex: 9999,
          },
          row: {
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#F1F5F9',
            backgroundColor: 'transparent',
          },
          separator: { height: 0 },
          description: { fontSize: 13, color: '#374151' },
          predefinedPlacesDescription: { color: '#2F6BFF' },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    // overflow visible is critical — without it the dropdown gets clipped
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
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionText: {
    fontSize: 13,
    color: '#374151',
    flexShrink: 1,
  },
});
