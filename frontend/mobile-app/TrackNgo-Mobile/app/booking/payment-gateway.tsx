import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createBooking } from '../../services/bookingFlowApi';
import { useSession } from '../../store/sessionStore';

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
  const specialRequest = params.specialRequest ?? '';

  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardName, setCardName] = useState(fullName);
  const [saveCard, setSaveCard] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    cardNumber?: string;
    expiryDate?: string;
    cvv?: string;
    cardName?: string;
  }>({});

  const orderRef = `BUS-${Math.floor(10000 + Math.random() * 90000)}`;

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 16);
    const groups = cleaned.match(/.{1,4}/g);
    return groups ? groups.join(' ') : cleaned;
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length > 2) {
      return `${cleaned.slice(0, 2)} / ${cleaned.slice(2)}`;
    }
    return cleaned;
  };

  const getCardType = (): 'visa' | 'mastercard' | 'none' => {
    const num = cardNumber.replace(/\s/g, '');
    if (num.startsWith('4')) return 'visa';
    if (num.startsWith('5') || num.startsWith('2')) return 'mastercard';
    return 'none';
  };

  const isFormValid = cardNumber.replace(/\s/g, '').length >= 15 && expiryDate.length >= 5 && cvv.length >= 3 && cardName.length > 0;

  const luhnCheck = (num: string): boolean => {
    const digits = num.replace(/\D/g, '');
    let sum = 0;
    let alternate = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let n = parseInt(digits[i], 10);
      if (alternate) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alternate = !alternate;
    }
    return sum % 10 === 0;
  };

  const validatePayment = (): boolean => {
    const newErrors: typeof fieldErrors = {};
    const rawCard = cardNumber.replace(/\s/g, '');

    if (rawCard.length < 15 || rawCard.length > 16) {
      newErrors.cardNumber = 'Card number must be 15-16 digits';
    } else if (!luhnCheck(rawCard)) {
      newErrors.cardNumber = 'Invalid card number';
    }

    if (expiryDate.length < 5) {
      newErrors.expiryDate = 'Enter expiry as MM / YY';
    } else {
      const parts = expiryDate.replace(/\s/g, '').split('/');
      const month = parseInt(parts[0], 10);
      const year = parseInt(parts[1], 10);
      if (month < 1 || month > 12) {
        newErrors.expiryDate = 'Month must be 01-12';
      } else {
        const now = new Date();
        const expiry = new Date(2000 + year, month);
        if (expiry <= now) {
          newErrors.expiryDate = 'Card has expired';
        }
      }
    }

    if (cvv.length < 3) {
      newErrors.cvv = 'CVV must be 3-4 digits';
    }

    if (!cardName.trim()) {
      newErrors.cardName = 'Name on card is required';
    }

    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.content}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.headerSection}>
            <Text style={styles.headerTitle}>Secure Checkout</Text>
            <View style={styles.payhereBadge}>
              <Text style={styles.payhereText}>PayHere</Text>
              <Ionicons name="lock-closed" size={12} color="#22C55E" />
            </View>
          </View>

          {/* Amount Display */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Total Amount Due</Text>
            <Text style={styles.amountValue}>LKR {totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            <View style={styles.orderPill}>
              <Text style={styles.orderText}>Order #{orderRef}</Text>
            </View>
          </View>

          {/* Card Method Tab */}
          <View style={styles.methodTab}>
            <View style={styles.methodTabActive}>
              <Ionicons name="card-outline" size={20} color="#1474F2" />
              <Text style={styles.methodTabText}>Cards</Text>
            </View>
          </View>

          {/* Card Number */}
          <Text style={styles.fieldLabel}>Card Number</Text>
          <View style={[styles.cardInputRow, fieldErrors.cardNumber ? styles.inputError : null]}>
            <Ionicons name="card-outline" size={18} color="#94A3B8" />
            <TextInput
              style={styles.cardInput}
              value={cardNumber}
              onChangeText={(t) => { setCardNumber(formatCardNumber(t)); if (fieldErrors.cardNumber) setFieldErrors((e) => ({ ...e, cardNumber: undefined })); }}
              placeholder="0000 0000 0000 0000"
              placeholderTextColor="#CBD5E1"
              keyboardType="number-pad"
              maxLength={19}
            />
            {getCardType() === 'visa' && (
              <View style={styles.visaBadge}>
                <Text style={styles.visaBadgeText}>VISA</Text>
              </View>
            )}
            {getCardType() === 'mastercard' && (
              <View style={styles.mcBadgeRow}>
                <View style={styles.mcBadgeCircle1} />
                <View style={styles.mcBadgeCircle2} />
              </View>
            )}
          </View>
          {fieldErrors.cardNumber && <Text style={styles.errorText}>{fieldErrors.cardNumber}</Text>}

          {/* Expiry & CVV */}
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Expiry Date</Text>
              <View style={[styles.inputBox, fieldErrors.expiryDate ? styles.inputError : null]}>
                <TextInput
                  style={styles.inputText}
                  value={expiryDate}
                  onChangeText={(t) => { setExpiryDate(formatExpiry(t)); if (fieldErrors.expiryDate) setFieldErrors((e) => ({ ...e, expiryDate: undefined })); }}
                  placeholder="MM / YY"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="number-pad"
                  maxLength={7}
                />
              </View>
              {fieldErrors.expiryDate && <Text style={styles.errorText}>{fieldErrors.expiryDate}</Text>}
            </View>
            <View style={styles.halfField}>
              <View style={styles.cvvLabelRow}>
                <Text style={styles.fieldLabel}>CVV</Text>
                <Ionicons name="help-circle-outline" size={14} color="#94A3B8" />
              </View>
              <View style={[styles.inputBox, fieldErrors.cvv ? styles.inputError : null]}>
                <TextInput
                  style={styles.inputText}
                  value={cvv}
                  onChangeText={(t) => { setCvv(t.replace(/\D/g, '').slice(0, 4)); if (fieldErrors.cvv) setFieldErrors((e) => ({ ...e, cvv: undefined })); }}
                  placeholder="123"
                  placeholderTextColor="#CBD5E1"
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
              {fieldErrors.cvv && <Text style={styles.errorText}>{fieldErrors.cvv}</Text>}
            </View>
          </View>

          {/* Name on Card */}
          <Text style={styles.fieldLabel}>Name on Card</Text>
          <View style={[styles.inputBox, fieldErrors.cardName ? styles.inputError : null]}>
            <TextInput
              style={styles.inputText}
              value={cardName}
              onChangeText={(t) => { setCardName(t); if (fieldErrors.cardName) setFieldErrors((e) => ({ ...e, cardName: undefined })); }}
              placeholder="Enter name on card"
              placeholderTextColor="#CBD5E1"
            />
          </View>
          {fieldErrors.cardName && <Text style={styles.errorText}>{fieldErrors.cardName}</Text>}

          {/* Save Card Toggle */}
          <View style={styles.saveRow}>
            <Switch
              value={saveCard}
              onValueChange={setSaveCard}
              trackColor={{ false: '#E2E8F0', true: '#BBD3FF' }}
              thumbColor={saveCard ? '#1474F2' : '#FFFFFF'}
            />
            <Text style={styles.saveText}>Save card for future payments</Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom Buttons */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            style={[styles.payButton, (!isFormValid || submitting) && styles.payButtonDisabled]}
            disabled={!isFormValid || submitting}
            onPress={async () => {
              if (!validatePayment()) return;
              try {
                setSubmitting(true);
                const seatList = seats.split(',').filter(Boolean);
                const result = await createBooking({
                  busId: Number(busId),
                  journeyDate: date,
                  journeyTime: depart,
                  seatNumbers: seatList,
                  specialRequest,
                  paymentMethod: 'CARD',
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
                console.error('[PaymentGateway] booking failed', e);
                Alert.alert('Payment Failed', 'Could not complete payment. Please try again.');
              } finally {
                setSubmitting(false);
              }
            }}>
            {submitting ? (
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
    paddingBottom: 24,
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
    marginBottom: 10,
  },
  orderPill: {
    backgroundColor: '#EAF1FF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  orderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1474F2',
  },
  /* Card Method Tab */
  methodTab: {
    alignItems: 'center',
    marginBottom: 24,
  },
  methodTabActive: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAF1FF',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#1474F2',
  },
  methodTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1474F2',
  },
  /* Fields */
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    height: 18,
  },
  cardInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 10,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 0,
    marginLeft: 4,
  },
  cardInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    padding: 0,
    letterSpacing: 1,
  },
  visaBadge: {
    backgroundColor: '#1A1F71',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  visaBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  mcBadgeRow: {
    flexDirection: 'row',
    width: 30,
    height: 20,
  },
  mcBadgeCircle1: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EB001B',
    position: 'absolute',
    left: 0,
  },
  mcBadgeCircle2: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F79E1B',
    position: 'absolute',
    right: 0,
    opacity: 0.85,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  halfField: {
    flex: 1,
  },
  cvvLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
    height: 18,
  },
  inputBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inputText: {
    fontSize: 15,
    color: '#111827',
    padding: 0,
  },
  /* Save Card */
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  saveText: {
    fontSize: 13,
    color: '#64748B',
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
});
