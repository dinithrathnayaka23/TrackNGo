import React from 'react';
import {
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

const routeStops = [
  { name: 'Fort', time: '06:00 AM', status: 'Start' },
  { name: 'Nittambuwa', time: '07:30 AM', status: 'ETA' },
  { name: 'Kegalle', time: '08:30 AM', status: 'ETA' },
  { name: 'Kandy', time: '10:00 AM', status: 'Destination' },
];

export default function BusDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    type?: string;
    rating?: string;
    depart?: string;
    arrive?: string;
    duration?: string;
    from?: string;
    to?: string;
    price?: string;
    seatsLeft?: string;
  }>();

  const busId = params.id ?? 'ND-4589';
  const busType = params.type ?? 'Super Luxury';
  const rating = params.rating ?? '4.8';
  const depart = params.depart ?? '06:00';
  const arrive = params.arrive ?? '09:30';
  const duration = params.duration ?? '3h 30m';
  const from = params.from ?? 'Colombo';
  const to = params.to ?? 'Kandy';
  const price = params.price ?? 'LKR 1200';
  const priceNumber = Number((price || '0').replace(/[^0-9.]/g, '')) || 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle}>Bus Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.busCard}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80' }}
            style={styles.busImage}
          />
          <View style={styles.busInfo}>
            <View style={styles.busText}>
              <Text style={styles.busType}>{busType}</Text>
              <Text style={styles.busId}>{busId}</Text>
              <Text style={styles.busRoute}>
                {from}  {'->'} {to}
              </Text>
            </View>
            <View style={styles.busBadge}>
              <Ionicons name="bus" size={16} color="#94A3B8" />
            </View>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.timeText}>{depart}</Text>
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
            <Text style={styles.timeText}>{arrive}</Text>
            <Text style={styles.timeSub}>{to}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Route Information</Text>
        <View style={styles.routeCard}>
          {routeStops.map((stop, index) => (
            <View key={stop.name} style={styles.routeRow}>
              <View style={styles.routeMarkerColumn}>
                <View
                  style={[
                    styles.routeMarker,
                    index === 0 ? styles.routeMarkerStart : undefined,
                    index === routeStops.length - 1 ? styles.routeMarkerEnd : undefined,
                  ]}
                />
                {index < routeStops.length - 1 && <View style={styles.routeLine} />}
              </View>
              <View>
                <Text style={styles.routeName}>{stop.name}</Text>
                <Text style={styles.routeSub}>
                  {stop.time}  -  {stop.status}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Vehicle & Driver</Text>
        <View style={styles.vehicleCard}>
          <Text style={styles.vehicleLabel}>AMENITIES</Text>
          <View style={styles.amenitiesRow}>
            <View style={styles.amenityItem}>
              <MaterialCommunityIcons name="snowflake" size={18} color="#2F6BFF" />
              <Text style={styles.amenityText}>A/C</Text>
            </View>
            <View style={styles.amenityItem}>
              <Ionicons name="wifi" size={18} color="#2F6BFF" />
              <Text style={styles.amenityText}>WiFi</Text>
            </View>
            <View style={styles.amenityItem}>
              <Ionicons name="water" size={18} color="#2F6BFF" />
              <Text style={styles.amenityText}>Water</Text>
            </View>
            <View style={styles.amenityItem}>
              <MaterialCommunityIcons name="power-plug" size={18} color="#2F6BFF" />
              <Text style={styles.amenityText}>Power</Text>
            </View>
          </View>
          <View style={styles.vehicleFooter}>
            <Text style={styles.layoutText}>Layout: 2+2 (45 Seats)</Text>
            <Pressable>
              <Text style={styles.viewLayout}>View Layout</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.driverCard}>
          <View style={styles.driverAvatar}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=200&q=80' }}
              style={styles.driverImage}
            />
          </View>
          <View style={styles.driverText}>
            <Text style={styles.driverName}>Sunil Perera</Text>
            <Text style={styles.driverSub}>Professional Driver - 5 Yrs Exp</Text>
          </View>
          <View style={styles.ratingPill}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
        </View>

        <Pressable
          style={styles.bookButton}
          onPress={() =>
            router.push({
              pathname: '/booking/seat-selection',
              params: {
                from,
                to,
                id: busId,
                type: busType,
                depart,
                price: String(priceNumber),
              },
            })
          }>
          <Text style={styles.bookButtonText}>Book Seat</Text>
          <Text style={styles.bookSubText}>{price} / person</Text>
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
