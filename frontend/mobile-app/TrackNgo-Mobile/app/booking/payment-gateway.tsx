import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { createBooking } from '../../services/bookingFlowApi';
import { useSession } from '../../store/sessionStore';
import { API_BASE_URL } from '../../config/env';

export default function PaymentGatewayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useSession();
  const params = useLocalSearchParams<{
    from?: string;
    to?: string;
    busId?: string;
    busType?: string;
    depart?: string;
    date?: string;
    seats?: string;
    totalPrice?: string;
    fullName?: string;
    mobile?: string;
    email?: string;
    specialRequest?: string;
  }>();

  const from = params.from ?? 'Colombo Fort';
  const to = params.to ?? 'Kandy';
  const busId = params.busId ?? '0';
  const busType = params.busType ?? 'Super Luxury A/C';
  const depart = params.depart ?? '08:30';
  const date = params.date ?? new Date().toISOString().split('T')[0];
  const seats = params.seats ?? '';
  const totalPrice = Number(params.totalPrice ?? '2500') || 2500;
  const fullName = params.fullName ?? '';
  const mobile = params.mobile ?? '';
  const email = params.email ?? '';
  const specialRequest = params.specialRequest ?? '';

  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [processingResult, setProcessingResult] = useState(false);

  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || 'Passenger';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'N/A';

  const handlePayWithPayHere = async () => {
    setLoading(true);
    const orderId = `BUS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const amountFormatted = totalPrice.toFixed(2);
    const itemsText = `Bus Ticket: ${from} to ${to}`;
    const emailVal = email || 'passenger@trackngo.lk';
    const phoneVal = mobile || '0770000000';

    try {
      const params = new URLSearchParams({
        order_id: orderId,
        amount: amountFormatted,
        currency: 'LKR',
        items: itemsText,
        first_name: firstName,
        last_name: lastName,
        email: emailVal,
        phone: phoneVal,
        address: 'N/A',
        city: 'Colombo',
        country: 'Sri Lanka',
        base_url: API_BASE_URL,
      });

      const backendCheckoutUrl = `${API_BASE_URL}/api/booking-flow/payhere/checkout?${params.toString()}`;
      setCheckoutUrl(backendCheckoutUrl);
      setShowWebView(true);
    } catch (e: any) {
      console.error('[PayHere] Failed to initialize checkout', e);
      Alert.alert('Payment Error', 'Could not initialize payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWebViewMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'completed') {
        setShowWebView(false);
        setProcessingResult(true);
        try {
          const seatList = seats.split(',').filter(Boolean);
          const result = await createBooking({
            busId: Number(busId),
            journeyDate: date,
            journeyTime: depart,
            seatNumbers: seatList,
            specialRequest,
            paymentMethod: 'PAYHERE',
            totalAmount: totalPrice,
            passengerId: currentUser?.userId ?? 0,
          });
          router.push({
            pathname: '/booking/booking-confirmation',
            params: {
              bookingRef: result.bookingReference,
              from: result.fromLocation,
              to: result.toLocation,
              busNumber: result.busNumber,
              seats: result.seatNumbers,
              totalPrice: String(result.totalAmount),
              date: result.journeyDate,
              depart: result.journeyTime,
              transactionId: result.transactionId,
              status: result.status,
            },
          });
        } catch (e: any) {
          console.error('[PayHere] Booking creation failed', e);
          Alert.alert(
            'Booking Failed',
            'Payment was successful but booking creation failed. Please contact support.'
          );
        } finally {
          setProcessingResult(false);
        }
      } else if (data.type === 'dismissed' || data.type === 'cancelled') {
        setShowWebView(false);
        Alert.alert('Payment Cancelled', 'You cancelled the payment. You can try again.');
      } else if (data.type === 'error') {
        setShowWebView(false);
        Alert.alert('Payment Error', data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      // ignore non-JSON messages
    }
  }, [seats, busId, date, depart, specialRequest, totalPrice, currentUser, router]);

  // ── WebView full-screen ─────────────────────────────────
  if (showWebView) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.webViewHeader}>
          <Pressable onPress={() => setShowWebView(false)} style={styles.webViewBack}>
            <Ionicons name="close" size={24} color="#111827" />
          </Pressable>
          <Text style={styles.webViewTitle}>PayHere Checkout</Text>
          <Ionicons name="lock-closed" size={16} color="#22C55E" />
        </View>
        <WebView
          source={{ uri: checkoutUrl }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          javaScriptCanOpenWindowsAutomatically
          thirdPartyCookiesEnabled
          mixedContentMode="compatibility"
          originWhitelist={['*']}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color="#1474F2" />
              <Text style={styles.loadingText}>Loading PayHere...</Text>
            </View>
          )}
          onShouldStartLoadWithRequest={(request) => {
            const url = request.url;
            const isReturnUrl = url.includes('/api/booking-flow/payhere/return');
            const isCancelUrl = url.includes('/api/booking-flow/payhere/cancel');

            // Fallback interception in case WebView cannot load callback page.
            if (isReturnUrl && (url.includes('localhost') || url.startsWith(API_BASE_URL))) {
              setShowWebView(false);
              setProcessingResult(true);
              const seatList = seats.split(',').filter(Boolean);
              createBooking({
                busId: Number(busId),
                journeyDate: date,
                journeyTime: depart,
                seatNumbers: seatList,
                specialRequest,
                paymentMethod: 'PAYHERE',
                totalAmount: totalPrice,
                passengerId: currentUser?.userId ?? 0,
              }).then((result) => {
                router.push({
                  pathname: '/booking/booking-confirmation',
                  params: {
                    bookingRef: result.bookingReference,
                    from: result.fromLocation,
                    to: result.toLocation,
                    busNumber: result.busNumber,
                    seats: result.seatNumbers,
                    totalPrice: String(result.totalAmount),
                    date: result.journeyDate,
                    depart: result.journeyTime,
                    transactionId: result.transactionId,
                    status: result.status,
                  },
                });
              }).catch((e) => {
                console.error('[PayHere] Booking creation failed', e);
                Alert.alert('Booking Failed', 'Payment was successful but booking creation failed. Please contact support.');
              }).finally(() => setProcessingResult(false));
              return false; // block the navigation
            }
            if (isCancelUrl && (url.includes('localhost') || url.startsWith(API_BASE_URL))) {
              setShowWebView(false);
              Alert.alert('Payment Cancelled', 'You cancelled the payment. You can try again.');
              return false;
            }
            return true; // allow all other navigations
          }}
          style={{ flex: 1 }}
        />
      </SafeAreaView>
    );
  }

  // ── Processing result overlay ───────────────────────────
  if (processingResult) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#1474F2" />
          <Text style={styles.processingText}>Confirming your booking...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Summary + Pay button ────────────────────────────────
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerSection}>
            <Text style={styles.headerTitle}>Secure Checkout</Text>
            <View style={styles.payhereBadge}>
              <Text style={styles.payhereText}>Powered by PayHere</Text>
              <Ionicons name="lock-closed" size={12} color="#22C55E" />
            </View>
          </View>

          {/* Amount Display */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Total Amount Due</Text>
            <Text style={styles.amountValue}>
              LKR {totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          {/* Trip Summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Ionicons name="bus-outline" size={18} color="#64748B" />
              <Text style={styles.summaryLabel}>Route</Text>
              <Text style={styles.summaryValue}>{from} → {to}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Ionicons name="calendar-outline" size={18} color="#64748B" />
              <Text style={styles.summaryLabel}>Date</Text>
              <Text style={styles.summaryValue}>{date}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Ionicons name="time-outline" size={18} color="#64748B" />
              <Text style={styles.summaryLabel}>Departure</Text>
              <Text style={styles.summaryValue}>{depart}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Ionicons name="person-outline" size={18} color="#64748B" />
              <Text style={styles.summaryLabel}>Seats</Text>
              <Text style={styles.summaryValue}>{seats}</Text>
            </View>
          </View>

          {/* Payment methods info */}
          <View style={styles.methodsInfo}>
            <Ionicons name="card-outline" size={20} color="#1474F2" />
            <Text style={styles.methodsText}>
              Visa, MasterCard, AMEX, Lanka QR, mPay & more
            </Text>
          </View>
        </View>

        {/* Bottom Buttons */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            style={[styles.payButton, loading && styles.payButtonDisabled]}
            disabled={loading}
            onPress={handlePayWithPayHere}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.payButtonText}>
                  Pay LKR {totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
                <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
              </>
            )}
          </Pressable>

          <Pressable style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel Transaction</Text>
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
    paddingTop: 24,
    flex: 1,
  },
  /* Header */
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  payhereBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  payhereText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  /* Amount */
  amountSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1474F2',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
  },
  /* Trip Summary Card */
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    width: 80,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  /* Payment methods info */
  methodsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EAF1FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  methodsText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1474F2',
  },
  /* Bottom */
  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1474F2',
    borderRadius: 12,
    paddingVertical: 16,
    width: '100%',
  },
  payButtonDisabled: {
    opacity: 0.5,
  },
  payButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  /* WebView */
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  webViewBack: {
    padding: 4,
  },
  webViewTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  /* Processing */
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});
