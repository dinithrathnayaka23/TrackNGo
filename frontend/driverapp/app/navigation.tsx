import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import DriverRouteMap from '@/components/DriverRouteMap';
import { apiUrl } from '@/config/env';
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import {
  buildGoogleMapsDirectionsUrl,
  formatStopEta,
  getOrderedStops,
  getStopsWithCoordinates,
  type RouteGeometry,
} from '@/utils/routeNavigation';

interface DriverAssignment {
  busNumber: string;
  routeId: number | null;
  routeName?: string | null;
}

interface LiveBusLocation {
  busNumber: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
}

export default function DriverNavigationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { darkMode } = useTheme();
  const [assignment, setAssignment] = useState<DriverAssignment | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<RouteGeometry | null>(null);
  const [liveBusLocation, setLiveBusLocation] = useState<LiveBusLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const theme = useMemo(
    () => ({
      background: darkMode ? '#111' : '#F5F5F5',
      card: darkMode ? '#1E1E1E' : '#FFFFFF',
      text: darkMode ? '#FFFFFF' : '#111827',
      secondaryText: darkMode ? '#AAAAAA' : '#64748B',
      border: darkMode ? '#333333' : '#E2E8F0',
    }),
    [darkMode]
  );
  const styles = useMemo(() => createStyles(theme, insets.bottom), [theme, insets.bottom]);

  const fetchNavigationData = useCallback(async () => {
    if (!user?.userId || !user?.token) {
      setLoading(false);
      setError('Please log in again to use navigation.');
      return;
    }

    try {
      setError(null);
      const profileResponse = await fetch(
        apiUrl(`/api/drivers/${user.userId}/profile-and-assignment`),
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!profileResponse.ok) {
        throw new Error('Could not load the current driver assignment.');
      }

      const profileResult = await profileResponse.json();
      const currentAssignment = profileResult.data?.assignment ?? null;
      setAssignment(currentAssignment);

      if (!currentAssignment?.routeId) {
        setRouteGeometry(null);
        throw new Error('No active route is assigned to this bus.');
      }

      const geometryResponse = await fetch(
        apiUrl(`/api/tracking/routes/${currentAssignment.routeId}/geometry`),
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!geometryResponse.ok) {
        throw new Error('Could not load route stops from the database.');
      }

      const geometryResult = await geometryResponse.json();
      setRouteGeometry(geometryResult.data ?? null);

      if (currentAssignment.busNumber) {
        const locationResponse = await fetch(
          apiUrl(`/api/tracking/live-location/${encodeURIComponent(currentAssignment.busNumber)}`),
          {
            headers: {
              Authorization: `Bearer ${user.token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (locationResponse.ok) {
          const locationResult = await locationResponse.json();
          setLiveBusLocation(locationResult.data ?? null);
        }
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Navigation is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [user?.token, user?.userId]);

  useEffect(() => {
    void fetchNavigationData();
  }, [fetchNavigationData]);

  useEffect(() => {
    if (!assignment?.busNumber || !user?.token) return;

    const interval = setInterval(() => {
      void fetch(apiUrl(`/api/tracking/live-location/${encodeURIComponent(assignment.busNumber)}`), {
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((result) => setLiveBusLocation(result?.data ?? null))
        .catch(() => undefined);
    }, 6000);

    return () => clearInterval(interval);
  }, [assignment?.busNumber, user?.token]);

  const orderedStops = useMemo(
    () => getOrderedStops(routeGeometry?.stops ?? []),
    [routeGeometry?.stops]
  );
  const mappedStops = getStopsWithCoordinates(orderedStops).length;
  const routeDisplay =
    orderedStops.length > 1
      ? `${orderedStops[0].name} -> ${orderedStops[orderedStops.length - 1].name}`
      : routeGeometry?.routeName ?? assignment?.routeName ?? 'Route navigation';

  const openTurnByTurn = async () => {
    if (!routeGeometry) {
      Alert.alert('No Route Available', 'No route information available for navigation.');
      return;
    }

    const url = buildGoogleMapsDirectionsUrl(routeGeometry);
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Google Maps unavailable', 'Unable to open turn-by-turn navigation.');
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.mapArea}>
        <DriverRouteMap
          stops={orderedStops}
          liveBusLocation={liveBusLocation}
          loading={loading}
          darkMode={darkMode}
        />

        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              Navigation
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {assignment?.busNumber ?? 'Assigned bus'}
            </Text>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={fetchNavigationData}>
            <MaterialCommunityIcons name="refresh" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingPill}>
            <ActivityIndicator size="small" color="#0066FF" />
            <Text style={styles.loadingText}>Loading map</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorPill}>
            <MaterialCommunityIcons name="alert-circle" size={16} color="#B91C1C" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.routeHeader}>
          <View style={styles.routeTextBlock}>
            <Text style={styles.routeLabel}>Current Route</Text>
            <Text style={styles.routeName} numberOfLines={1}>
              {routeDisplay}
            </Text>
          </View>
          <View style={styles.mappedBadge}>
            <Text style={styles.mappedBadgeText}>
              {mappedStops}/{orderedStops.length} mapped
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stopStrip}
        >
          {orderedStops.map((stop, index) => {
            const eta = formatStopEta(stop);
            return (
              <View key={`${stop.name}-${index}`} style={styles.stopCard}>
                <Text style={styles.stopIndex}>{index + 1}</Text>
                <Text style={styles.stopName} numberOfLines={1}>
                  {stop.name}
                </Text>
                <Text style={styles.stopMeta}>{eta ?? 'Stop'}</Text>
              </View>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={styles.primaryButton} onPress={openTurnByTurn}>
          <MaterialCommunityIcons name="navigation-variant" size={20} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Open Turn-by-turn</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme: any, bottomInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    mapArea: {
      flex: 1,
      position: 'relative',
      backgroundColor: '#EAF2FF',
    },
    header: {
      position: 'absolute',
      top: 12,
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    iconButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 16,
      color: theme.text,
      fontWeight: "700",
    },
    subtitle: {
      fontSize: 13,
      color: theme.secondaryText,
      fontWeight: "500",
      marginTop: 2,
    },
    loadingPill: {
      position: 'absolute',
      top: 86,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.card,
    },
    loadingText: {
      fontSize: 13,
      color: theme.text,
      fontWeight: "500",
    },
    errorPill: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: '#FEF2F2',
      borderWidth: 1,
      borderColor: '#FECACA',
    },
    errorText: {
      flex: 1,
      minWidth: 0,
      fontSize: 12,
      color: '#B91C1C',
      fontWeight: "600",
    },
    bottomPanel: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: Math.max(18, bottomInset + 12),
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    routeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    routeTextBlock: {
      flex: 1,
      minWidth: 0,
    },
    routeLabel: {
      fontSize: 11,
      color: theme.secondaryText,
      fontWeight: "600",
      textTransform: 'uppercase',
    },
    routeName: {
      fontSize: 16,
      color: theme.text,
      fontWeight: "800",
      marginTop: 3,
    },
    mappedBadge: {
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: '#EAF2FF',
    },
    mappedBadgeText: {
      fontSize: 11,
      color: '#0066FF',
      fontWeight: "700",
    },
    stopStrip: {
      gap: 8,
      paddingBottom: 12,
    },
    stopCard: {
      width: 116,
      padding: 10,
      borderRadius: 10,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    stopIndex: {
      width: 20,
      height: 20,
      borderRadius: 10,
      overflow: 'hidden',
      textAlign: 'center',
      lineHeight: 20,
      backgroundColor: '#0066FF',
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: "800",
      marginBottom: 7,
    },
    stopName: {
      fontSize: 12,
      color: theme.text,
      fontWeight: "800",
    },
    stopMeta: {
      fontSize: 10,
      color: theme.secondaryText,
      fontWeight: "700",
      marginTop: 2,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: '#0066FF',
    },
    primaryButtonText: {
      fontSize: 14,
      color: '#FFFFFF',
      fontWeight: "700",
    },
  });
}
