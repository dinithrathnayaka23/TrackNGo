import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { createBooking, createStripeCheckoutSession, getStripeSessionStatus } from '../../services/bookingFlowApi';
import { useSession } from '../../store/sessionStore';
import { API_BASE_URL } from '../../config/env';
import { isPastOrInvalidBookingDate, PAST_BOOKING_DATE_MESSAGE, todayDateString } from '../../utils/bookingDate';
import { LocalizedText as Text } from '../../utils/i18n';

/*
 * PaymentGatewayScreen - Orchestrates the Stripe checkout process.
 * It initiates a checkout session, renders the Stripe UI in a WebView,
 * and then finalizes the booking upon successful payment.
*/

export default function PaymentGatewayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useSession();
  
  // Data passed from the summary screen required for checkout and booking
  const params = useLocalSearchParams<{
    from?: string;
    to?: string;
    busId?: string;
    busType?: string;
    depart?: string;
    date?: string;
    seats?: string;
    totalPrice?: string;
    originalAmount?: string;
    discountAmount?: string;
    promotionId?: string;
    promoCode?: string;
    fullName?: string;
    mobile?: string;
    email?: string;
    specialRequest?: string;
    routeName?: string;
  }>();

  // Default values and numeric parsing for cost details
  const from = params.from ?? 'Colombo Fort';
  const to = params.to ?? 'Kandy';
  const busId = params.busId ?? '0';
  const busType = params.busType ?? 'Super Luxury A/C';
  const depart = params.depart ?? '08:30';
  const date = params.date ?? todayDateString();
  const seats = params.seats ?? '';
  const totalPrice = Number(params.totalPrice ?? '2500') || 2500;
  const originalAmount = Number(params.originalAmount ?? params.totalPrice ?? '2500') || totalPrice;
  const discountAmount = Number(params.discountAmount ?? '0') || 0;
  const promotionId = params.promotionId ? Number(params.promotionId) : null;
  const promoCode = params.promoCode ?? '';
  const fullName = params.fullName ?? '';
  const mobile = params.mobile ?? '';
  const email = params.email ?? '';
  const specialRequest = params.specialRequest ?? '';
  const invalidBookingDate = isPastOrInvalidBookingDate(date);

  // State for managing the payment WebView and backend processing
  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [processingResult, setProcessingResult] = useState(false);

  useEffect(() => {
    if (invalidBookingDate) {
      Alert.alert('Invalid date', PAST_BOOKING_DATE_MESSAGE);
      router.replace({ pathname: '/booking/search-buses' });
    }
  }, [invalidBookingDate, router]);

  /**
   * Contacts the backend to generate a Stripe Checkout Session URL.
   */
  const handlePayWithStripe = async () => {
    if (invalidBookingDate) {
      Alert.alert('Invalid date', PAST_BOOKING_DATE_MESSAGE);
      return;
    }
    setLoading(true);
    const orderId = `BUS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
      const result = await createStripeCheckoutSession({
        orderId,
        amount: totalPrice,
        currency: 'LKR',
        itemName: `Bus Ticket: ${from} → ${to}`,
        itemDescription: `${date} at ${depart} | Seats: ${seats}`,
        email: email || 'passenger@trackngo.lk',
        successUrl: `${API_BASE_URL}/api/booking-flow/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${API_BASE_URL}/api/booking-flow/stripe/cancel?session_id={CHECKOUT_SESSION_ID}`,
      });

      setSessionId(result.sessionId);
      setCheckoutUrl(result.url);
      setShowWebView(true);
    } catch (e: any) {
      console.error('[Stripe] Failed to create checkout session', e);
      Alert.alert('Payment Error', 'Could not initialize payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Verifies the payment with the backend and finally creates the bus booking record.
   */
  const completeBooking = useCallback(async () => {
    if (invalidBookingDate) {
      Alert.alert('Invalid date', PAST_BOOKING_DATE_MESSAGE);
      return;
    }
    setShowWebView(false);
    setProcessingResult(true);
    try {
      // Verify payment with backend
      const status = await getStripeSessionStatus(sessionId);
      if (status.paymentStatus !== 'paid') {
        Alert.alert('Payment Incomplete', 'Payment was not completed. Please try again.');
        setProcessingResult(false);
        return;
      }

      const seatList = seats.split(',').filter(Boolean);
      const result = await createBooking({
        busId: Number(busId),
        journeyDate: date,
        journeyTime: depart,
        seatNumbers: seatList,
        specialRequest,
        paymentMethod: 'stripe',
        totalAmount: totalPrice,
        passengerId: currentUser?.userId ?? 0,
        fromLocation: from,
        toLocation: to,
        originalAmount,
        discountAmount,
        promotionId,
        promoCode,
        paymentProviderReference: status.paymentIntentId,
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
          transactionId: result.transactionId ?? status.paymentIntentId,
          status: result.status,
          routeName: params.routeName ?? '',
        },
      });
    } catch (e: any) {
      console.error('[Stripe] Booking creation failed', e);
      Alert.alert(
        'Booking Failed',
        'Payment was successful but booking creation failed. Please contact support.'
      );
    } finally {
      setProcessingResult(false);
    }
  }, [sessionId, seats, busId, date, depart, specialRequest, totalPrice, currentUser, router, originalAmount, discountAmount, promotionId, promoCode, invalidBookingDate]);

  /*
   * Listens for messages sent from the WebView (e.g. from the success/cancel pages).
  */
  const handleWebViewMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'completed') {
        completeBooking();
      } else if (data.type === 'cancelled') {
        setShowWebView(false);
        Alert.alert('Payment Cancelled', 'You cancelled the payment. You can try again.');
      }
    } catch {
      // ignore non-JSON messages
    }
  }, [completeBooking]);

  // ── UI Render State: WebView full-screen ─────────────────────────────────
  if (showWebView) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.webViewHeader}>
          <Pressable onPress={() => setShowWebView(false)} style={styles.webViewBack}>
            <Ionicons name="close" size={24} color="#111827" />
          </Pressable>
          <Text style={styles.webViewTitle}>Stripe Checkout</Text>
          <Ionicons name="lock-closed" size={16} color="#22C55E" />
        </View>
        <WebView
          source={{ uri: checkoutUrl }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          mixedContentMode="compatibility"
          originWhitelist={['*']}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loadingText}>Loading Stripe...</Text>
            </View>
          )}
          onShouldStartLoadWithRequest={(request) => {
            const url = request.url;
            // Intercept success redirect
            if (url.includes('/api/booking-flow/stripe/success')) {
              completeBooking();
              return false;
            }
            // Intercept cancel redirect
            if (url.includes('/api/booking-flow/stripe/cancel')) {
              setShowWebView(false);
              Alert.alert('Payment Cancelled', 'You cancelled the payment. You can try again.');
              return false;
            }
            return true;
          }}
          style={{ flex: 1 }}
        />
      </SafeAreaView>
    );
  }

  // ── UI Render State: Finalizing booking overlay ───────────────────────────
  if (processingResult) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.processingText}>Confirming your booking...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── UI Render State: Main Summary + Pay button ────────────────────────────────
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.headerSection}>
            <Text style={styles.headerTitle}>Secure Checkout</Text>
            <View style={styles.stripeBadge}>
              <Text style={styles.stripeText}>Powered by Stripe</Text>
              <Ionicons name="lock-closed" size={12} color="#22C55E" />
            </View>
          </View>

          {/* Amount Display */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Total Amount Due</Text>
            <Text style={styles.amountValue}>
              LKR {totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            {discountAmount > 0 && (
              <Text style={styles.discountText}>
                Saved LKR {discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
            )}
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
            {discountAmount > 0 && (
              <>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Ionicons name="pricetag-outline" size={18} color="#22C55E" />
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <Text style={[styles.summaryValue, styles.discountValue]}>
                    - LKR {discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Payment methods info */}
          <View style={styles.methodsInfo}>
            <Ionicons name="card-outline" size={20} color="#2563EB" />
            <Text style={styles.methodsText}>
              Visa, MasterCard, AMEX & more via Stripe
            </Text>
          </View>
        </View>

        {/* Bottom Buttons */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            style={[styles.payButton, (loading || invalidBookingDate) && styles.payButtonDisabled]}
            disabled={loading || invalidBookingDate}
            onPress={handlePayWithStripe}>
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

// Stylesheet for the Payment Gateway screen components
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
  stripeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stripeText: {
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
    color: '#2563EB',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
  },
  discountText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#16A34A',
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
  discountValue: {
    color: '#16A34A',
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
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  methodsText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2563EB',
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
    backgroundColor: '#2563EB',
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
