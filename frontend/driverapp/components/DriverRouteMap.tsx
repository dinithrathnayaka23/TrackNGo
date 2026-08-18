import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface DriverRouteMapStop {
  name: string;
  latitude: number | null;
  longitude: number | null;
  priority?: number | null;
}

export interface DriverLiveBusLocation {
  busNumber: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
}

interface DriverRouteMapProps {
  stops: DriverRouteMapStop[];
  liveBusLocation: DriverLiveBusLocation | null;
  loading: boolean;
  darkMode: boolean;
  showStopMarkers?: boolean;
}

export default function DriverRouteMap({
  stops,
  liveBusLocation,
  loading,
  darkMode,
}: DriverRouteMapProps) {
  const stopCount = stops.filter(
    (stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
  ).length;

  return (
    <View style={[styles.surface, darkMode && styles.surfaceDark]}>
      <MaterialCommunityIcons
        name={liveBusLocation || stopCount > 0 ? 'map-marker-path' : 'map-marker-off'}
        size={28}
        color="#64748B"
      />
      <Text style={styles.title}>
        {loading
          ? 'Loading route map...'
          : liveBusLocation
            ? 'Live bus location ready'
            : stopCount > 0
              ? `${stopCount} route stops ready`
              : 'No route coordinates available'}
      </Text>
      <Text style={styles.detail}>Open on Android or iOS to view Google Maps.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    backgroundColor: '#EAF2FF',
  },
  surfaceDark: {
    backgroundColor: '#1E293B',
  },
  title: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
    textAlign: 'center',
  },
  detail: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
});
