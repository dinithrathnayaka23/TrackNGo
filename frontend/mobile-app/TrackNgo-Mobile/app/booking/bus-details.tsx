import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getBusDetails, type BusDetailResult } from '../../services/bookingFlowApi';
import { getBusImage } from '../../utils/busImage';

const AMENITY_ICONS: Record<string, { icon: React.ReactNode; label: string }> = {
  ac: { icon: <MaterialCommunityIcons name="snowflake" size={18} color="#2F6BFF" />, label: 'A/C' },
  wifi: { icon: <Ionicons name="wifi" size={18} color="#2F6BFF" />, label: 'WiFi' },
  charging: { icon: <MaterialCommunityIcons name="power-plug" size={18} color="#2F6BFF" />, label: 'Power' },
  charging_ports: { icon: <MaterialCommunityIcons name="power-plug" size={18} color="#2F6BFF" />, label: 'Power' },
  entertainment: { icon: <Ionicons name="tv-outline" size={18} color="#2F6BFF" />, label: 'TV' },
  tv: { icon: <Ionicons name="tv-outline" size={18} color="#2F6BFF" />, label: 'TV' },
  water: { icon: <Ionicons name="water" size={18} color="#2F6BFF" />, label: 'Water' },
  gps: { icon: <MaterialCommunityIcons name="crosshairs-gps" size={18} color="#2F6BFF" />, label: 'GPS' },
  cctv: { icon: <MaterialCommunityIcons name="cctv" size={18} color="#2F6BFF" />, label: 'CCTV' },
};

function formatDuration(start: string, end: string): string {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function BusDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    busId?: string;
    from?: string;
    to?: string;
    date?: string;
    price?: string;
    adults?: string;
    children?: string;
  }>();

  const busId = Number(params.busId ?? '0');
  const from = params.from ?? 'Colombo';
  const to = params.to ?? 'Kandy';
  const date = params.date ?? (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const price = params.price ?? '0';
  const adults = params.adults ?? '1';
  const children = params.children ?? '0';

  const [details, setDetails] = useState<BusDetailResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBusDetails(busId, from, to);
      setDetails(data);
    } catch (e: any) {
      console.error('[BusDetails] load failed', e);
      Alert.alert('Error', 'Failed to load bus details.');
    } finally {
      setLoading(false);
    }
  }, [busId, from, to]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2F6BFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (!details) {
    return (
      <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#94A3B8' }}>Bus details not available.</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
            <Text style={{ color: '#2F6BFF', fontWeight: '700' }}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const duration = formatDuration(details.startTime, details.endTime);
  const routeStops = details.routeStops.sort((a, b) => a.priority - b.priority);
  const driverRating = details.driver?.rating?.toFixed(1) ?? 'N/A';

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle}>Bus Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.busCard}>
          {(() => {
            const busImg = getBusImage(details.busBrand, details.amenities);
            return busImg ? (
              <Image source={busImg} style={styles.busImage} />
            ) : (
              <View style={[styles.busImage, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="bus" size={48} color="#94A3B8" />
              </View>
            );
          })()}
          <View style={styles.busInfo}>
            <View style={styles.busText}>
              <Text style={styles.busType}>{details.busBrand} • {details.busType}</Text>
              <Text style={styles.busId}>{details.busNumber}</Text>
              <Text style={styles.busRoute}>
                {from}  {'→'}  {to}
              </Text>
              {details.routeName ? (
                <Text style={styles.routeLabel}>{details.routeName} Bus</Text>
              ) : null}
            </View>
            <View style={styles.busBadge}>
              <Ionicons name="bus" size={16} color="#94A3B8" />
            </View>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.timeText}>{details.startTime}</Text>
            <Text style={styles.timeSub}>{from}</Text>
          </View>
          <View style={styles.timelineWrap}>
            <Text style={styles.durationText}>{duration}</Text>
            <View style={styles.timeline}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineLine} />
              <View style={styles.timelineDot} />
            </View>
          </View>
          <View>
            <Text style={styles.timeText}>{details.endTime}</Text>
            <Text style={styles.timeSub}>{to}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Route Information</Text>
        <View style={styles.routeCard}>
          {routeStops.map((stop, index) => {
            const isFirst = index === 0;
            const isLast = index === routeStops.length - 1;
            const label = isFirst ? 'Start' : isLast ? 'Destination' : undefined;
            return (
            <View key={stop.name} style={styles.routeRow}>
              <View style={styles.routeMarkerColumn}>
                <View
                  style={[
                    styles.routeMarker,
                    isFirst ? styles.routeMarkerStart : undefined,
                    isLast ? styles.routeMarkerEnd : undefined,
                  ]}
                />
                {index < routeStops.length - 1 && <View style={styles.routeLine} />}
              </View>
              <View>
                <Text style={styles.routeName}>{stop.name}</Text>
                <Text style={styles.routeSub}>
                  {stop.estimatedTime ? `ETA ${stop.estimatedTime}` : '—'}
                  {label ? `  •  ${label}` : ''}
                </Text>
              </View>
            </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Vehicle & Driver</Text>
        <View style={styles.vehicleCard}>
          <Text style={styles.vehicleLabel}>AMENITIES</Text>
          <View style={styles.amenitiesRow}>
            {details.amenities.map((a) => {
              const entry = AMENITY_ICONS[a.toLowerCase()];
              if (!entry) return null;
              return (
                <View key={a} style={styles.amenityItem}>
                  {entry.icon}
                  <Text style={styles.amenityText}>{entry.label}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.vehicleFooter}>
            <Text style={styles.layoutText}>Layout: 2+2 ({details.seatCapacity} Seats)</Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/booking/seat-selection',
                  params: {
                    busId: String(details.busId),
                    from,
                    to,
                    date,
                    busType: details.busType,
                    depart: details.startTime,
                    price: String(details.fee),
                    busBrand: details.busBrand,
                    amenities: JSON.stringify(details.amenities),
                    viewOnly: 'true',
                  },
                })
              }>
              <Text style={styles.viewLayout}>View Layout</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.driverCard}>
          <View style={styles.driverAvatar}>
            {details.driver?.profilePhoto ? (
              <Image source={{ uri: details.driver.profilePhoto }} style={styles.driverImage} />
            ) : (
              <View style={[styles.driverImage, { backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={20} color="#94A3B8" />
              </View>
            )}
          </View>
          <View style={styles.driverText}>
            <Text style={styles.driverName}>{details.driver?.name ?? 'Driver'}</Text>
            <Text style={styles.driverSub}>Professional Driver</Text>
          </View>
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.ratingText}>{driverRating}</Text>
          </View>
        </View>

        <Pressable
          style={styles.bookButton}
          onPress={() =>
            router.push({
              pathname: '/booking/seat-selection',
              params: {
                busId: String(details.busId),
                from,
                to,
                date,
                busType: details.busType,
                depart: details.startTime,
                price: String(details.fee),
                adults,
                children,
                busBrand: details.busBrand,
                amenities: JSON.stringify(details.amenities),
              },
            })
          }>
          <Text style={styles.bookButtonText}>Book Seat</Text>
          <Text style={styles.bookSubText}>LKR {Number(details.fee).toLocaleString('en-US')} / person</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    backgroundColor: '#F6F7F9',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  headerSpacer: {
    width: 36,
  },
  busCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    gap: 10,
  },
  busImage: {
    width: '100%',
    height: 170,
    borderRadius: 14,
  },
  busInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  busText: {
    gap: 2,
  },
  busType: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  busId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  busRoute: {
    fontSize: 11,
    color: '#94A3B8',
  },
  routeLabel: {
    fontSize: 10,
    color: '#2F6BFF',
    fontWeight: '600',
    marginTop: 2,
  },
  busBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  timeSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  timelineWrap: {
    alignItems: 'center',
    gap: 6,
  },
  durationText: {
    fontSize: 10,
    color: '#94A3B8',
  },
  timeline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C7D2FE',
  },
  timelineLine: {
    width: 70,
    height: 2,
    backgroundColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 4,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
    gap: 12,
  },
  routeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  routeMarkerColumn: {
    alignItems: 'center',
  },
  routeMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#CBD5F5',
    backgroundColor: '#FFFFFF',
  },
  routeMarkerStart: {
    borderColor: '#2F6BFF',
    backgroundColor: '#2F6BFF',
  },
  routeMarkerEnd: {
    borderColor: '#F43F5E',
    backgroundColor: '#F43F5E',
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
  },
  routeName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  routeSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  vehicleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 10,
  },
  amenitiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amenityItem: {
    alignItems: 'center',
    gap: 4,
  },
  amenityText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  vehicleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  layoutText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  viewLayout: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  driverAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  driverImage: {
    width: '100%',
    height: '100%',
  },
  driverText: {
    flex: 1,
  },
  driverName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  driverSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FFF7ED',
  },
  ratingText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
  },
  bookButton: {
    marginTop: 4,
    backgroundColor: '#1474F2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bookSubText: {
    color: '#DBEAFE',
    fontSize: 10,
    marginTop: 2,
  },
});
