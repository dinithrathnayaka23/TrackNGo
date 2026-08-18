import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type LatLng,
  type Region,
} from 'react-native-maps';

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
}

const DEFAULT_REGION: Region = {
  latitude: 6.9271,
  longitude: 79.8612,
  latitudeDelta: 0.16,
  longitudeDelta: 0.16,
};

const GOOGLE_MAP_STYLE = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels',
    stylers: [{ visibility: 'simplified' }],
  },
];

export default function DriverRouteMap({
  stops,
  liveBusLocation,
  loading,
  darkMode,
}: DriverRouteMapProps) {
  const mapRef = useRef<MapView>(null);
  const [mapReady, setMapReady] = useState(false);

  const routeStops = useMemo(() => getStopsWithCoordinates(stops), [stops]);
  const routeCoordinates = useMemo(
    () =>
      routeStops.map((stop) => ({
        latitude: stop.latitude,
        longitude: stop.longitude,
      })),
    [routeStops]
  );

  const liveCoordinate = useMemo<LatLng | null>(() => {
    if (!isCoordinate(liveBusLocation)) return null;
    return {
      latitude: liveBusLocation.latitude,
      longitude: liveBusLocation.longitude,
    };
  }, [liveBusLocation]);

  const mapCoordinates = useMemo(() => {
    const coordinates = [...routeCoordinates];
    if (liveCoordinate) coordinates.push(liveCoordinate);
    return coordinates;
  }, [routeCoordinates, liveCoordinate]);

  const initialRegion = useMemo(() => buildRegion(mapCoordinates), [mapCoordinates]);

  useEffect(() => {
    if (!mapReady || mapCoordinates.length === 0) return;

    const timer = setTimeout(() => {
      if (mapCoordinates.length === 1) {
        mapRef.current?.animateToRegion(buildRegion(mapCoordinates), 500);
        return;
      }

      mapRef.current?.fitToCoordinates(mapCoordinates, {
        edgePadding: { top: 42, right: 42, bottom: 42, left: 42 },
        animated: true,
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [mapCoordinates, mapReady]);

  if (mapCoordinates.length === 0) {
    return (
      <View style={[styles.stateSurface, darkMode && styles.stateSurfaceDark]}>
        {loading ? (
          <>
            <MaterialCommunityIcons name="map-clock" size={28} color="#64748B" />
            <Text style={styles.stateText}>Loading route map...</Text>
          </>
        ) : (
          <>
            <MaterialCommunityIcons name="map-marker-off" size={28} color="#94A3B8" />
            <Text style={styles.stateText}>No route coordinates available</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      customMapStyle={darkMode ? undefined : GOOGLE_MAP_STYLE}
      showsCompass={false}
      showsMyLocationButton={false}
      showsPointsOfInterest={false}
      toolbarEnabled={false}
      onMapReady={() => setMapReady(true)}
    >
      {routeCoordinates.length > 1 ? (
        <Polyline
          coordinates={routeCoordinates}
          strokeColor="#2563EB"
          strokeWidth={5}
          geodesic
        />
      ) : null}

      {routeStops.map((stop, index) => {
        const isStart = index === 0;
        const isEnd = index === routeStops.length - 1;

        return (
          <Marker
            key={`${stop.name}-${index}`}
            coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
            title={stop.name}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              collapsable={false}
              style={[
                styles.stopMarker,
                isStart && styles.startMarker,
                isEnd && styles.endMarker,
              ]}
            />
          </Marker>
        );
      })}

      {liveCoordinate ? (
        <Marker
          coordinate={liveCoordinate}
          title={liveBusLocation?.busNumber ?? 'Live bus'}
          rotation={liveBusLocation?.heading ?? 0}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View collapsable={false} style={styles.busMarker}>
            <MaterialCommunityIcons name="bus" size={18} color="#FFFFFF" />
          </View>
        </Marker>
      ) : null}
    </MapView>
  );
}

function getStopsWithCoordinates(stops: DriverRouteMapStop[]) {
  return stops
    .filter(isCoordinate)
    .sort((a, b) => {
      const aPriority = typeof a.priority === 'number' ? a.priority : Number.MAX_SAFE_INTEGER;
      const bPriority = typeof b.priority === 'number' ? b.priority : Number.MAX_SAFE_INTEGER;
      return aPriority - bPriority;
    });
}

function isCoordinate<T extends { latitude: number | null; longitude: number | null }>(
  value: T | null | undefined
): value is T & { latitude: number; longitude: number } {
  return typeof value?.latitude === 'number' && typeof value.longitude === 'number';
}

function buildRegion(coordinates: LatLng[]): Region {
  if (coordinates.length === 0) return DEFAULT_REGION;

  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);

  return {
    latitude: (minLatitude + maxLatitude) / 2,
    longitude: (minLongitude + maxLongitude) / 2,
    latitudeDelta: Math.max((maxLatitude - minLatitude) * 1.6, 0.015),
    longitudeDelta: Math.max((maxLongitude - minLongitude) * 1.6, 0.015),
  };
}

const styles = StyleSheet.create({
  stateSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EAF2FF',
  },
  stateSurfaceDark: {
    backgroundColor: '#1E293B',
  },
  stateText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  stopMarker: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#2563EB',
  },
  startMarker: {
    backgroundColor: '#22C55E',
    borderColor: '#FFFFFF',
  },
  endMarker: {
    backgroundColor: '#EF4444',
    borderColor: '#FFFFFF',
  },
  busMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0066FF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
