import React, { useMemo, useState } from 'react';
import {
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

type SeatStatus = 'available' | 'selected' | 'booked';

type SeatRow = {
  left: string[];
  right?: string[];
  lastRow?: string[];
};

const seatRows: SeatRow[] = [
  { left: ['1A', '1B'], right: ['1C', '1D'] },
  { left: ['2A', '2B'], right: ['2C', '2D'] },
  { left: ['3A', '3B'], right: ['3C', '3D'] },
  { left: ['4A', '4B'], right: ['4C', '4D'] },
  { left: ['5A', '5B'], right: ['5C', '5D'] },
  { left: [], right: [], lastRow: ['6A', '6B', '6C', '6D', '6E'] },
];

const bookedSeats = new Set(['1D', '4A', '4B', '4C', '4D']);

export default function SeatSelectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    from?: string;
    to?: string;
    id?: string;
    type?: string;
    depart?: string;
    price?: string;
  }>();

  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<string[]>(['1C', '3C']);

  const from = params.from ?? 'Colombo';
  const to = params.to ?? 'Kandy';
  const busId = params.id ?? 'ND-4521';
  const busType = params.type ?? 'Super Luxury';
  const depart = params.depart ?? '08:30 AM';
  const pricePerSeat = Number(params.price ?? '1200') || 1200;

  const seatStatus = (seatId: string): SeatStatus => {
    if (bookedSeats.has(seatId)) return 'booked';
    if (selectedSeats.includes(seatId)) return 'selected';
    return 'available';
  };

  const toggleSeat = (seatId: string) => {
    if (bookedSeats.has(seatId)) return;
    setSelectedSeats((prev) =>
      prev.includes(seatId) ? prev.filter((seat) => seat !== seatId) : [...prev, seatId]
    );
  };

  const totalPrice = useMemo(() => selectedSeats.length * pricePerSeat, [selectedSeats, pricePerSeat]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: insets.top + 8 }]}
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
                Bus {busId} - {depart} - Today
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

            {seatRows.map((row, rowIndex) => {
              if (row.lastRow) {
                return (
                  <View key={`row-${rowIndex}`} style={styles.lastRow}>
                    {row.lastRow.map((seat) => {
                      const status = seatStatus(seat);
                      if (showAvailableOnly && status === 'booked') {
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
                      if (showAvailableOnly && status === 'booked') {
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
                    {row.right?.map((seat) => {
                      const status = seatStatus(seat);
                      if (showAvailableOnly && status === 'booked') {
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
            onPress={() => Alert.alert('Continue', 'Proceeding to payment.')}
            disabled={selectedSeats.length === 0}>
            <Text style={styles.payButtonText}>Continue to Payment</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
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
