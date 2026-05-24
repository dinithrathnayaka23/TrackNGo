import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getSeatLayout, getBookedSeats, getBlockedSeats, type SeatLayoutRow } from '../../services/bookingFlowApi';

type SeatStatus = 'available' | 'selected' | 'booked' | 'blocked';

export default function SeatSelectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    busId?: string;
    from?: string;
    to?: string;
    date?: string;
    busType?: string;
    depart?: string;
    price?: string;
    adults?: string;
    children?: string;
    busBrand?: string;
    busNumber?: string;
    routeName?: string;
    amenities?: string;
    viewOnly?: string;
  }>();

  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [seatRows, setSeatRows] = useState<SeatLayoutRow[]>([]);
  const [bookedSeats, setBookedSeats] = useState<Set<string>>(new Set());
  const [blockedSeatSet, setBlockedSeatSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const busId = Number(params.busId ?? '0');
  const from = params.from ?? 'Colombo';
  const to = params.to ?? 'Kandy';
  const date = params.date ?? (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const busType = params.busType ?? 'Super Luxury';
  const depart = params.depart ?? '08:30';
  const pricePerSeat = Number(params.price ?? '1200') || 1200;
  const adults = Number(params.adults ?? '1') || 1;
  const children = Number(params.children ?? '0') || 0;
  const maxSeats = adults + children;
  const viewOnly = params.viewOnly === 'true';

  const loadSeats = useCallback(async () => {
    try {
      setLoading(true);
      const [layout, booked, blocked] = await Promise.all([
        getSeatLayout(busId),
        getBookedSeats(busId, date),
        getBlockedSeats(busId),
      ]);
      setSeatRows(layout);
      setBookedSeats(new Set(booked));
      setBlockedSeatSet(new Set(blocked));
    } catch (e: any) {
      console.error('[SeatSelection] load failed', e);
      Alert.alert('Error', 'Failed to load seat layout.');
    } finally {
      setLoading(false);
    }
  }, [busId, date]);

  useEffect(() => { void loadSeats(); }, [loadSeats]);

  const seatStatus = (seatId: string): SeatStatus => {
    if (blockedSeatSet.has(seatId)) return 'blocked';
    if (bookedSeats.has(seatId)) return 'booked';
    if (selectedSeats.includes(seatId)) return 'selected';
    return 'available';
  };

  const toggleSeat = (seatId: string) => {
    if (bookedSeats.has(seatId) || blockedSeatSet.has(seatId)) return;
    setSelectedSeats((prev) => {
      if (prev.includes(seatId)) return prev.filter((seat) => seat !== seatId);
      if (prev.length >= maxSeats) {
        Alert.alert(
          'Seat limit reached',
          `You can select up to ${maxSeats} seat${maxSeats > 1 ? 's' : ''} for ${adults} adult${adults > 1 ? 's' : ''}${children > 0 ? ` and ${children} child${children > 1 ? 'ren' : ''}` : ''}.`
        );
        return prev;
      }
      return [...prev, seatId];
    });
  };

  const totalPrice = useMemo(() => selectedSeats.length * pricePerSeat, [selectedSeats, pricePerSeat]);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.content}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </Pressable>
            <Text style={styles.headerTitle}>Select Seats</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Ionicons name="bus" size={18} color="#2F6BFF" />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.summaryTitle}>{from} - {to}</Text>
              <Text style={styles.summarySub}>
                Bus {params.busNumber || busId} - {depart} - {date}
              </Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillText}>{busType}</Text>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Show available only</Text>
            <Switch
              value={showAvailableOnly}
              onValueChange={setShowAvailableOnly}
              trackColor={{ false: '#E2E8F0', true: '#BBD3FF' }}
              thumbColor={showAvailableOnly ? '#2F6BFF' : '#FFFFFF'}
            />
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.legendAvailable]} />
              <Text style={styles.legendText}>Available</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.legendSelected]} />
              <Text style={styles.legendText}>Selected</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.legendBooked]} />
              <Text style={styles.legendText}>Booked</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, styles.legendBlocked]} />
              <Text style={styles.legendText}>Blocked</Text>
            </View>
          </View>

          <View style={styles.seatCard}>
            <View style={styles.seatHeader}>
              <View style={styles.seatHeaderBlock}>
                <MaterialCommunityIcons name="door" size={18} color="#94A3B8" />
                <Text style={styles.seatHeaderText}>ENTRY</Text>
              </View>
              <View style={styles.seatHeaderBlock}>
                <MaterialCommunityIcons name="steering" size={18} color="#94A3B8" />
                <Text style={styles.seatHeaderText}>DRIVER</Text>
              </View>
            </View>

            {loading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#2F6BFF" />
              </View>
            ) : seatRows.map((row, rowIndex) => {
              if (row.lastRow && row.lastRow.length > 0) {
                return (
                  <View key={`row-${rowIndex}`} style={styles.lastRow}>
                    {row.lastRow.map((seat) => {
                      const status = seatStatus(seat);
                      if (showAvailableOnly && (status === 'booked' || status === 'blocked')) {
                        return <View key={seat} style={styles.seatPlaceholder} />;
                      }
                      return (
                        <Pressable
                          key={seat}
                          onPress={() => toggleSeat(seat)}
                          style={[
                            styles.seatBox,
                            status === 'selected' && styles.seatSelected,
                            status === 'booked' && styles.seatBooked,
                            status === 'blocked' && styles.seatBlocked,
                          ]}>
                          <Text
                            style={[
                              styles.seatText,
                              status !== 'available' && styles.seatTextInverse,
                            ]}>
                            {seat}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              }

              return (
                <View key={`row-${rowIndex}`} style={styles.seatRow}>
                  <View style={styles.seatGroup}>
                    {row.left.map((seat) => {
                      const status = seatStatus(seat);
                      if (showAvailableOnly && (status === 'booked' || status === 'blocked')) {
                        return <View key={seat} style={styles.seatPlaceholder} />;
                      }
                      return (
                        <Pressable
                          key={seat}
                          onPress={() => toggleSeat(seat)}
                          style={[
                            styles.seatBox,
                            status === 'selected' && styles.seatSelected,
                            status === 'booked' && styles.seatBooked,
                            status === 'blocked' && styles.seatBlocked,
                          ]}>
                          <Text
                            style={[
                              styles.seatText,
                              status !== 'available' && styles.seatTextInverse,
                            ]}>
                            {seat}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.aisle} />
                  <View style={styles.seatGroup}>
                    {row.right.map((seat) => {
                      const status = seatStatus(seat);
                      if (showAvailableOnly && (status === 'booked' || status === 'blocked')) {
                        return <View key={seat} style={styles.seatPlaceholder} />;
                      }
                      return (
                        <Pressable
                          key={seat}
                          onPress={() => toggleSeat(seat)}
                          style={[
                            styles.seatBox,
                            status === 'selected' && styles.seatSelected,
                            status === 'booked' && styles.seatBooked,
                            status === 'blocked' && styles.seatBlocked,
                          ]}>
                          <Text
                            style={[
                              styles.seatText,
                              status !== 'available' && styles.seatTextInverse,
                            ]}>
                            {seat}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {!viewOnly && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}> 
          <View style={styles.bottomRow}>
            <View>
              <Text style={styles.bottomLabel}>Selected Seats</Text>
              <Text style={styles.bottomValue}>{selectedSeats.join(', ') || '-'}</Text>
            </View>
            <View style={styles.bottomPrice}>
              <Text style={styles.bottomLabel}>Total Price</Text>
              <Text style={styles.bottomPriceValue}>LKR {totalPrice.toLocaleString('en-US')}</Text>
            </View>
          </View>
          <Pressable
            style={[styles.payButton, selectedSeats.length === 0 && styles.payButtonDisabled]}
            onPress={() => {
              router.push({
                pathname: '/booking/booking-summary',
                params: {
                  from,
                  to,
                  busId: String(busId),
                  busType,
                  depart,
                  date,
                  seats: selectedSeats.join(','),
                  pricePerSeat: String(pricePerSeat),
                  totalPrice: String(totalPrice),
                  busBrand: params.busBrand ?? '',
                  busNumber: params.busNumber ?? '',
                  routeName: params.routeName ?? '',
                  amenities: params.amenities ?? '[]',
                },
              });
            }}
            disabled={selectedSeats.length === 0}>
            <Text style={styles.payButtonText}>Continue to Payment</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },
  content: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: '#F6F7F9',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  summaryPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#EAF1FF',
  },
  summaryPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  legendAvailable: {
    backgroundColor: '#FFFFFF',
  },
  legendSelected: {
    backgroundColor: '#2F6BFF',
    borderColor: '#2F6BFF',
  },
  legendBooked: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  legendBlocked: {
    backgroundColor: '#9CA3AF',
    borderColor: '#9CA3AF',
  },
  legendText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  seatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    gap: 14,
  },
  seatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  seatHeaderBlock: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  seatHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seatGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  aisle: {
    width: 20,
  },
  seatBox: {
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  seatSelected: {
    backgroundColor: '#2F6BFF',
    borderColor: '#2F6BFF',
  },
  seatBooked: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  seatBlocked: {
    backgroundColor: '#9CA3AF',
    borderColor: '#9CA3AF',
  },
  seatText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1F2937',
  },
  seatTextInverse: {
    color: '#FFFFFF',
  },
  seatPlaceholder: {
    width: 36,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  lastRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  bottomValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 4,
  },
  bottomPrice: {
    alignItems: 'flex-end',
  },
  bottomPriceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2F6BFF',
    marginTop: 4,
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1474F2',
    borderRadius: 12,
    paddingVertical: 12,
    opacity: 1,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
