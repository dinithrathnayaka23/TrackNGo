import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { searchBuses, type BusSearchResult } from '../../services/bookingFlowApi';

const AMENITY_ICONS: Record<string, { icon: React.ReactNode }> = {
  ac: { icon: <MaterialCommunityIcons name="snowflake" size={16} color="#94A3B8" /> },
  wifi: { icon: <Ionicons name="wifi" size={16} color="#94A3B8" /> },
  charging: { icon: <MaterialCommunityIcons name="power-plug" size={16} color="#94A3B8" /> },
  charging_ports: { icon: <MaterialCommunityIcons name="power-plug" size={16} color="#94A3B8" /> },
  entertainment: { icon: <Ionicons name="tv-outline" size={16} color="#94A3B8" /> },
  tv: { icon: <Ionicons name="tv-outline" size={16} color="#94A3B8" /> },
  water: { icon: <Ionicons name="water" size={16} color="#94A3B8" /> },
  gps: { icon: <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#94A3B8" /> },
  cctv: { icon: <MaterialCommunityIcons name="cctv" size={16} color="#94A3B8" /> },
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

export default function BusSelectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    from?: string;
    to?: string;
    date?: string;
    passengers?: string;
    adults?: string;
    children?: string;
    busType?: string;
    timeStart?: string;
    timeEnd?: string;
    busCategory?: string;
  }>();

  const from = params.from ?? 'Colombo';
  const to = params.to ?? 'Kandy';
  const date = params.date ?? (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const passengers = params.passengers ?? '1';
  const adults = params.adults ?? '1';
  const children = params.children ?? '0';
  const busType = params.busType ?? '';
  const timeStart = params.timeStart ?? '';
  const timeEnd = params.timeEnd ?? '';
  const busCategory = params.busCategory ?? '';

  const [buses, setBuses] = useState<BusSearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  /** Convert "HH:MM" to minutes since midnight for comparison */
  function toMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  /** Filter buses by category, AC/Non-AC type, and departure time range */
  const filteredBuses = buses.filter((bus) => {
    // Bus category filter (highway / long_distance)
    if (busCategory && bus.busType.toLowerCase() !== busCategory.toLowerCase()) return false;

    // Bus type filter (AC / Non-AC)
    if (busType === 'AC' && !bus.amenities.some((a) => a.toLowerCase() === 'ac')) return false;
    if (busType === 'Non-AC' && bus.amenities.some((a) => a.toLowerCase() === 'ac')) return false;

    // Departure time range filter
    if (timeStart && timeEnd && bus.startTime) {
      const dep = toMinutes(bus.startTime);
      const lo = toMinutes(timeStart);
      const hi = toMinutes(timeEnd);
      if (dep < lo || dep > hi) return false;
    }

    return true;
  });

  const loadBuses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await searchBuses(from, to, date, busCategory || undefined);
      setBuses(data);
    } catch (e: any) {
      console.error('[BusSelection] search failed', e);
      Alert.alert('Error', 'Failed to load buses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [from, to, date, busCategory]);

  useEffect(() => { void loadBuses(); }, [loadBuses]);

  const dateLabel = (() => {
    const d = new Date(date + 'T00:00:00');
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const formatted = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
    if (isToday) return `Today, ${formatted}`;
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    return `${weekday}, ${formatted}`;
  })();

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle}>Select Bus</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="bus" size={18} color="#2F6BFF" />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>{from}  →  {to}</Text>
            <Text style={styles.summarySub}>{dateLabel}  •  {passengers} Passenger{Number(passengers) !== 1 ? 's' : ''}</Text>
          </View>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.summaryEdit}>Edit</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#2F6BFF" />
            <Text style={{ marginTop: 12, color: '#94A3B8', fontSize: 13 }}>Searching buses...</Text>
          </View>
        ) : filteredBuses.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <Ionicons name="bus-outline" size={48} color="#CBD5E1" />
            <Text style={{ marginTop: 12, color: '#94A3B8', fontSize: 13 }}>No buses found for this route.</Text>
          </View>
        ) : (
          filteredBuses.map((bus) => {
            const duration = formatDuration(bus.startTime, bus.endTime);
            return (
          <View key={bus.busId} style={styles.busCard}>
            <View style={styles.busHeader}>
              <View style={styles.busIdWrap}>
                <View style={styles.busBadge}>
                  <Ionicons name="bus" size={14} color="#64748B" />
                </View>
                <View>
                  <Text style={styles.busId}>{bus.busNumber}</Text>
                  <Text style={styles.busType}>{bus.busBrand}  •  {bus.busType}</Text>
                </View>
              </View>
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.ratingText}>{bus.driverRating.toFixed(1)}</Text>
              </View>
            </View>

            <View style={styles.timeRow}>
              <View>
                <Text style={styles.timeText}>{bus.startTime}</Text>
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
                <Text style={styles.timeText}>{bus.endTime}</Text>
                <Text style={styles.timeSub}>{to}</Text>
              </View>
            </View>

            <View style={styles.featuresRow}>
              {bus.amenities.map((a) => {
                const entry = AMENITY_ICONS[a.toLowerCase()];
                return entry ? <View key={a}>{entry.icon}</View> : null;
              })}
            </View>

            <View style={styles.bottomRow}>
              <View>
                <Text style={styles.priceLabel}>Per person</Text>
                <Text style={styles.priceText}>LKR {bus.fee.toLocaleString('en-US')}</Text>
              </View>
              <View style={styles.bottomRight}>
                <View
                  style={[
                    styles.seatsPill,
                    bus.availableSeats <= 6 ? styles.seatsPillAlert : styles.seatsPillOk,
                  ]}>
                  <Text
                    style={[
                      styles.seatsText,
                      bus.availableSeats <= 6 ? styles.seatsTextAlert : styles.seatsTextOk,
                    ]}>
                    {bus.availableSeats} seats left
                  </Text>
                </View>
                <Pressable
                  style={styles.selectButton}
                  onPress={() =>
                    router.push({
                      pathname: '/booking/bus-details',
                      params: {
                        busId: String(bus.busId),
                        from,
                        to,
                        date,
                        price: String(bus.fee),
                        adults,
                        children,
                      },
                    })
                  }>
                  <Text style={styles.selectButtonText}>Select</Text>
                </Pressable>
              </View>
            </View>
          </View>
            );
          })
        )}
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
    marginBottom: 8,
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
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EAF1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  summarySub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  summaryEdit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  busCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    gap: 10,
  },
  busHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  busIdWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  busBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busId: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  busType: {
    fontSize: 10,
    color: '#94A3B8',
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  featuresRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 10,
    color: '#94A3B8',
  },
  priceText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  bottomRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  seatsPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  seatsPillAlert: {
    backgroundColor: '#FEE2E2',
  },
  seatsPillOk: {
    backgroundColor: '#DCFCE7',
  },
  seatsText: {
    fontSize: 10,
    fontWeight: '600',
  },
  seatsTextAlert: {
    color: '#EF4444',
  },
  seatsTextOk: {
    color: '#22C55E',
  },
  selectButton: {
    backgroundColor: '#2F6BFF',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
