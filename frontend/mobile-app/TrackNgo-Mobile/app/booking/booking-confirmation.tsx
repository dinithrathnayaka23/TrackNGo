import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function BookingConfirmationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    bookingRef?: string;
    from?: string;
    to?: string;
    busNumber?: string;
    depart?: string;
    date?: string;
    seats?: string;
    totalPrice?: string;
    transactionId?: string;
    status?: string;
  }>();

  const from = params.from ?? 'Colombo Fort';
  const to = params.to ?? 'Kandy';
  const depart = params.depart ?? '08:30';
  const date = params.date ?? new Date().toISOString().split('T')[0];
  const seats = params.seats ?? '';
  const totalPrice = Number(params.totalPrice ?? '0') || 0;
  const bookingId = params.bookingRef ?? 'N/A';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.content}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}>

          {/* Header */}
          <Text style={styles.headerTitle}>Confirmation</Text>

          {/* Success Icon */}
          <View style={styles.successCircle}>
            <View style={styles.successInner}>
              <Ionicons name="checkmark" size={40} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.confirmedTitle}>Booking Confirmed!</Text>
          <Text style={styles.bookingIdText}>Booking ID: #{bookingId}</Text>

          {/* QR Code Card */}
          <View style={styles.qrCard}>
            {/* QR Code - Generated pattern */}
            <View style={styles.qrContainer}>
              <View style={styles.qrGrid}>
                {/* Top-left finder */}
                <View style={[styles.qrFinder, styles.qrFinderTL]} />
                {/* Top-right finder */}
                <View style={[styles.qrFinder, styles.qrFinderTR]} />
                {/* Bottom-left finder */}
                <View style={[styles.qrFinder, styles.qrFinderBL]} />
                {/* Pattern rows */}
                {Array.from({ length: 8 }).map((_, rowIdx) => (
                  <View key={`qr-row-${rowIdx}`} style={styles.qrRow}>
                    {Array.from({ length: 8 }).map((_, colIdx) => (
                      <View
                        key={`qr-${rowIdx}-${colIdx}`}
                        style={[
                          styles.qrDot,
                          ((rowIdx + colIdx) % 3 === 0 || (rowIdx * colIdx) % 2 === 0) && styles.qrDotFilled,
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
              <View style={styles.scanBadge}>
                <Text style={styles.scanBadgeText}>SCAN ME</Text>
              </View>
            </View>

            <Text style={styles.scanTitle}>Scan at boarding</Text>
            <Text style={styles.scanSub}>Show this QR code to the driver</Text>
          </View>

          {/* Trip Details Card */}
          <View style={styles.detailsCard}>
            {/* Route */}
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="bus" size={18} color="#94A3B8" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>ROUTE</Text>
                <View style={styles.routeRow}>
                  <Text style={styles.detailValueBold}>{from}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#94A3B8" style={{ marginHorizontal: 6 }} />
                  <Text style={styles.detailValueBold}>{to}</Text>
                </View>
              </View>
            </View>

            <View style={styles.detailDivider} />

            {/* Date & Time */}
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar-outline" size={18} color="#94A3B8" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>DATE & TIME</Text>
                <Text style={styles.detailValueBold}>{date} • {depart}</Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            {/* Seats & Price */}
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="people-outline" size={18} color="#94A3B8" />
              </View>
              <View style={[styles.detailContent, styles.seatsPriceRow]}>
                <View>
                  <Text style={styles.detailLabel}>SEATS</Text>
                  <Text style={styles.detailValueBold}>{seats.replace(/,/g, ', ')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.paidLabel}>PAID</Text>
                  <Text style={styles.paidValue}>LKR {totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn}>
              <Ionicons name="download-outline" size={22} color="#374151" />
              <Text style={styles.actionBtnText}>Download</Text>
            </Pressable>
            <Pressable style={styles.actionBtn}>
              <Ionicons name="share-social-outline" size={22} color="#374151" />
              <Text style={styles.actionBtnText}>Share</Text>
            </Pressable>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Done Button */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            style={styles.doneButton}
            onPress={() => {
              router.dismissAll();
              router.replace('/tabs');
            }}>
            <Text style={styles.doneButtonText}>Done</Text>
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  /* Header */
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 24,
  },
  /* Success */
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  bookingIdText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22C55E',
    marginBottom: 24,
  },
  /* QR Card */
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 20,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrGrid: {
    width: 160,
    height: 160,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#111827',
    borderRadius: 8,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  qrFinder: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 4,
    borderColor: '#111827',
    borderRadius: 4,
  },
  qrFinderTL: {
    top: 6,
    left: 6,
  },
  qrFinderTR: {
    top: 6,
    right: 6,
  },
  qrFinderBL: {
    bottom: 6,
    left: 6,
  },
  qrRow: {
    flexDirection: 'row',
    gap: 3,
  },
  qrDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  qrDotFilled: {
    backgroundColor: '#111827',
  },
  scanBadge: {
    backgroundColor: '#111827',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: -14,
  },
  scanBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  scanTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 14,
    marginBottom: 4,
  },
  scanSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  /* Details Card */
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 12,
  },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailValueBold: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  seatsPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  paidLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  paidValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#22C55E',
  },
  /* Actions */
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 8,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
  },
  actionBtnText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  /* Bottom */
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  doneButton: {
    backgroundColor: '#22C55E',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
