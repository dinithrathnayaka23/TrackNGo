import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const buses = [
  {
    id: 'ND-4567',
    type: 'Semi-Luxury',
    rating: 4.5,
    depart: '06:00',
    arrive: '09:30',
    duration: '3h 30m',
    from: 'Colombo',
    to: 'Kandy',
    price: 'LKR 1,800',
    seatsLeft: 5,
  },
  {
    id: 'WP-1234',
    type: 'Super Luxury',
    rating: 4.8,
    depart: '07:15',
    arrive: '11:00',
    duration: '3h 45m',
    from: 'Colombo',
    to: 'Kandy',
    price: 'LKR 2,500',
    seatsLeft: 12,
  },
  {
    id: 'WP-1234',
    type: 'Super Luxury',
    rating: 4.8,
    depart: '07:15',
    arrive: '11:00',
    duration: '3h 45m',
    from: 'Colombo',
    to: 'Kandy',
    price: 'LKR 2,500',
    seatsLeft: 12,
  },
  {
    id: 'ND-4567',
    type: 'Normal',
    rating: 4.5,
    depart: '06:00',
    arrive: '09:30',
    duration: '3h 30m',
    from: 'Colombo',
    to: 'Kandy',
    price: 'LKR 450',
    seatsLeft: 5,
  },
];

export default function BusSelectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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
            <Text style={styles.summaryTitle}>Colombo  →  Kandy</Text>
            <Text style={styles.summarySub}>Fri, 24 Oct  •  1 Passenger</Text>
          </View>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.summaryEdit}>Edit</Text>
          </Pressable>
        </View>

        {buses.map((bus, index) => (
          <View key={`${bus.id}-${index}`} style={styles.busCard}>
            <View style={styles.busHeader}>
              <View style={styles.busIdWrap}>
                <View style={styles.busBadge}>
                  <Ionicons name="bus" size={14} color="#64748B" />
                </View>
                <View>
                  <Text style={styles.busId}>{bus.id}</Text>
                  <Text style={styles.busType}>Reg: {bus.id}  {bus.type}</Text>
                </View>
              </View>
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.ratingText}>{bus.rating}</Text>
              </View>
            </View>

            <View style={styles.timeRow}>
              <View>
                <Text style={styles.timeText}>{bus.depart}</Text>
                <Text style={styles.timeSub}>{bus.from}</Text>
              </View>
              <View style={styles.timelineWrap}>
                <Text style={styles.durationText}>{bus.duration}</Text>
                <View style={styles.timeline}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineLine} />
                  <View style={styles.timelineDot} />
                </View>
              </View>
              <View>
                <Text style={styles.timeText}>{bus.arrive}</Text>
                <Text style={styles.timeSub}>{bus.to}</Text>
              </View>
            </View>

            <View style={styles.featuresRow}>
              <MaterialCommunityIcons name="snowflake" size={16} color="#94A3B8" />
              <Ionicons name="tv-outline" size={16} color="#94A3B8" />
              <Ionicons name="wifi" size={16} color="#94A3B8" />
              <MaterialCommunityIcons name="power-plug" size={16} color="#94A3B8" />
            </View>

            <View style={styles.bottomRow}>
              <View>
                <Text style={styles.priceLabel}>Per person</Text>
                <Text style={styles.priceText}>{bus.price}</Text>
              </View>
              <View style={styles.bottomRight}>
                <View
                  style={[
                    styles.seatsPill,
                    bus.seatsLeft <= 6 ? styles.seatsPillAlert : styles.seatsPillOk,
                  ]}>
                  <Text
                    style={[
                      styles.seatsText,
                      bus.seatsLeft <= 6 ? styles.seatsTextAlert : styles.seatsTextOk,
                    ]}>
                    {bus.seatsLeft} seats left
                  </Text>
                </View>
                <Pressable
                  style={styles.selectButton}
                  onPress={() =>
                    router.push({
                      pathname: '/booking/bus-details',
                      params: {
                        id: bus.id,
                        type: bus.type,
                        rating: String(bus.rating),
                        depart: bus.depart,
                        arrive: bus.arrive,
                        duration: bus.duration,
                        from: bus.from,
                        to: bus.to,
                        price: bus.price,
                        seatsLeft: String(bus.seatsLeft),
                      },
                    })
                  }>
                  <Text style={styles.selectButtonText}>Select</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
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
