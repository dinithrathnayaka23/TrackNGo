import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getBusImage } from '../../utils/busImage';
import { PromotionQuoteResult, quotePromotion } from '../../services/bookingFlowApi';
import { useSession } from '../../store/sessionStore';
import { getUserProfile } from '../../services/userProfileApi';
import { isPastOrInvalidBookingDate, PAST_BOOKING_DATE_MESSAGE, todayDateString } from '../../utils/bookingDate';
import { formatBusTypeLabel } from '../../utils/busLabels';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../../utils/i18n';

/**
 * BookingSummaryScreen - The final step before payment where users review their selection,
 * enter contact details, apply promo codes, and see the final cost breakdown.
 */

export default function BookingSummaryScreen() {
  const router = useRouter();//Use to navigate between screens
  const insets = useSafeAreaInsets();//Handle safe device spacing
  const { currentUser } = useSession();

  // Extract booking details passed from the previous seat selection screen
  const params = useLocalSearchParams<{
    from?: string;
    to?: string;
    busId?: string;
    busType?: string;
    depart?: string;
    date?: string;
    seats?: string;
    pricePerSeat?: string;
    totalPrice?: string;
    busBrand?: string;
    busNumber?: string;
    routeName?: string;
    amenities?: string;
  }>();

  // Default values and formatted params
  const from = params.from ?? 'Colombo Fort';
  const to = params.to ?? 'Kandy';
  const busId = params.busId ?? '0';
  const busType = params.busType ?? 'Super Luxury A/C';
  const depart = params.depart ?? '08:30';
  const date = params.date ?? todayDateString();
  const seats = params.seats ? params.seats.split(',') : ['3A', '3B'];
  const pricePerSeat = Number(params.pricePerSeat ?? '1500') || 1500;
  const busBrand = params.busBrand ?? '';
  const amenities: string[] = (() => { try { return JSON.parse(params.amenities ?? '[]'); } catch { return []; } })();
  const busImage = getBusImage(busBrand, amenities);
  const invalidBookingDate = isPastOrInvalidBookingDate(date);

  // Form state for passenger contact details
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');

  // Load the logged-in user's profile to pre-fill contact details
  useEffect(() => {
    if (!currentUser) return;
    getUserProfile(currentUser.userId)
      .then((profile) => {
        setFullName(
          profile.fullName?.trim() ||
          profile.contactPersonName?.trim() ||
          ''
        );
        setMobile(profile.phoneNumber?.trim() ?? '');
        setEmail(profile.email?.trim() ?? '');
      })
      .catch(() => { });
  }, [currentUser]);

  useEffect(() => {
    if (invalidBookingDate) {
      Alert.alert('Invalid date', PAST_BOOKING_DATE_MESSAGE);
      router.replace({ pathname: '/booking/search-buses' });
    }
  }, [invalidBookingDate, router]);
  // Additional state for checkout flow
  const [specialRequest, setSpecialRequest] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromotion, setAppliedPromotion] = useState<PromotionQuoteResult | null>(null);
  const [promoMessage, setPromoMessage] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [errors, setErrors] = useState<{ fullName?: string; mobile?: string; email?: string }>({});

  // Validates the passenger contact fields before allowing checkout.
  const validateFields = (): boolean => {
    const newErrors: typeof errors = {};
    const trimmedName = fullName.trim();
    const trimmedMobile = mobile.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      newErrors.fullName = 'Full name is required';
    } else if (trimmedName.length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    if (!trimmedMobile) {
      newErrors.mobile = 'Mobile number is required';
    } else {
      const digits = trimmedMobile.replace(/[\s\-\(\)]/g, '');
      if (!/^\+?\d{9,15}$/.test(digits)) {
        newErrors.mobile = 'Enter a valid mobile number';
      }
    }

    if (!trimmedEmail) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const serviceFee = 200;
  const baseFare = pricePerSeat * seats.length;
  const originalAmount = baseFare + serviceFee;
  const discount = Number(appliedPromotion?.discountAmount ?? 0);
  const finalAmount = Math.max(originalAmount - discount, 0);
  const passengerId = currentUser?.userId ?? 0;

  // Requests the best available promotion quote for the current trip and optional promo code.
  const requestPromotionQuote = useCallback(async (code?: string) => {
    if (!Number(busId)) return;
    setPromoLoading(true);
    setPromoMessage('');
    try {
      const quote = await quotePromotion({
        passengerId,
        busId: Number(busId),
        fromLocation: from,
        toLocation: to,
        originalAmount,
        promoCode: code?.trim() || undefined,
      });
      setAppliedPromotion(quote.promotionId ? quote : null);
      setPromoMessage(quote.promotionId ? `${quote.name} applied.` : code?.trim() ? quote.message : '');
    } catch (error) {
      setAppliedPromotion(null);
      setPromoMessage(error instanceof Error && error.message ? error.message : 'Promo code could not be applied.');
    } finally {
      setPromoLoading(false);
    }
  }, [busId, from, originalAmount, passengerId, to]);

  // Loads the default promotion quote as soon as the trip summary is ready.
  useEffect(() => {
    requestPromotionQuote();
  }, [requestPromotionQuote]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.content}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </Pressable>
            <View style={styles.headerSpacer} />
          </View>

          {/* Route Card - Displays Origin, Destination, and Date */}

          {/* Route Card */}
          <View style={styles.routeCard}>
            <Text style={styles.routeLabel}>ROUTE</Text>
            <View style={styles.routeRow}>
              <Text style={styles.routeCity}>{from}</Text>
              <Ionicons name="arrow-forward" size={16} color="#94A3B8" style={{ marginHorizontal: 8 }} />
              <Text style={styles.routeCity}>{to}</Text>
            </View>
            <View style={styles.routeMetaRow}>
              <Ionicons name="bus-outline" size={14} color="#1474F2" />
              <Text style={styles.routeDateText}>{params.routeName || 'Express Route'}</Text>
            </View>
            <View style={styles.routeMetaRow}>
              <Ionicons name="calendar-outline" size={14} color="#1474F2" />
              <Text style={styles.routeDateText}>{date} | {depart}</Text>
            </View>
            <View style={styles.durationPill}>
              <Ionicons name="time-outline" size={12} color="#1474F2" />
              <Text style={styles.durationText}>Journey Date: {date}</Text>
            </View>

            {busImage ? (
              <Image source={busImage} style={styles.busImage} />
            ) : (
              <View style={[styles.busImage, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="bus" size={48} color="#94A3B8" />
              </View>
            )}
          </View>

          {/* Bus Details */}
          <Text style={styles.sectionTitle}>Bus Details</Text>
          <View style={styles.card}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bus Number</Text>
              <Text style={styles.detailValue}>{params.busNumber || busId}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bus Condition</Text>
              <Text style={styles.detailValue}>{formatBusTypeLabel(busType)}</Text>
            </View>
          </View>

          {/* Selected Seats & Passenger Contact Details */}
          <View style={styles.card}>
            <Text style={styles.cardInnerLabel}>Selected Seats</Text>
            <View style={styles.seatChips}>
              {seats.map((seat) => (
                <View key={seat} style={styles.seatChip}>
                  <Text style={styles.seatChipText}>{seat}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Full Name</Text>
            <View style={[styles.inputRow, errors.fullName ? styles.inputRowError : null]}>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={(t) => { setFullName(t); if (errors.fullName) setErrors((e) => ({ ...e, fullName: undefined })); }}
                placeholder="Enter your name"
                placeholderTextColor="#94A3B8"
              />
              <Pressable style={styles.editIcon}>
                <Ionicons name="pencil-outline" size={16} color="#94A3B8" />
              </Pressable>
            </View>
            {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}

            <Text style={styles.fieldLabel}>Mobile Number</Text>
            <View style={[styles.inputRow, errors.mobile ? styles.inputRowError : null]}>
              <TextInput
                style={styles.input}
                value={mobile}
                onChangeText={(t) => { setMobile(t); if (errors.mobile) setErrors((e) => ({ ...e, mobile: undefined })); }}
                placeholder="Enter mobile number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />
              <Pressable style={styles.editIcon}>
                <Ionicons name="pencil-outline" size={16} color="#94A3B8" />
              </Pressable>
            </View>
            {errors.mobile && <Text style={styles.errorText}>{errors.mobile}</Text>}

            <Text style={styles.fieldLabel}>Email Address</Text>
            <View style={[styles.inputRow, errors.email ? styles.inputRowError : null]}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(t) => { setEmail(t); if (errors.email) setErrors((e) => ({ ...e, email: undefined })); }}
                placeholder="Enter email address"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Pressable style={styles.editIcon}>
                <Ionicons name="pencil-outline" size={16} color="#94A3B8" />
              </Pressable>
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Optional Special Requests */}
          <Text style={styles.sectionTitle}>Special Request</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.textArea}
              value={specialRequest}
              onChangeText={setSpecialRequest}
              placeholder="Enter Your Request Here"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Selected Payment Method (Hardcoded to Card Payment for now) */}
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentMethodCard}>
            <View style={styles.paymentMethodRow}>
              <View style={styles.radioOuter}>
                <View style={styles.radioInner} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentMethodTitle}>Card Payment</Text>
                <Text style={styles.paymentMethodSub}>Visa, Mastercard, Amex</Text>
              </View>
              <View style={styles.cardLogos}>
                <View style={styles.visaLogo}>
                  <Text style={styles.visaText}>VISA</Text>
                </View>
                <View style={styles.mcLogo}>
                  <View style={styles.mcCircle1} />
                  <View style={styles.mcCircle2} />
                </View>
              </View>
            </View>
          </View>

          {/* Cost Breakdown - Fare, Fees, and Applied Promotions */}
          <Text style={styles.sectionTitle}>Cost Breakdown</Text>
          <View style={styles.card}>
            {/* Promo Code */}
            <View style={styles.promoRow}>
              <TextInput
                style={styles.promoInput}
                value={promoCode}
                onChangeText={(text) => {
                  setPromoCode(text);
                  // Reverts to the automatic promotion quote when the manual code is cleared.
                  if (!text.trim()) {
                    requestPromotionQuote();
                  }
                }}
                placeholder="Enter Promo Code"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
              />
              <Pressable
                style={[styles.promoButton, promoLoading && styles.promoButtonDisabled]}
                disabled={promoLoading}
                onPress={() => requestPromotionQuote(promoCode)}>
                {promoLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.promoButtonText}>Apply</Text>
                )}
              </Pressable>
            </View>
            {promoMessage ? (
              <Text style={[styles.promoMessage, appliedPromotion ? styles.promoMessageSuccess : styles.promoMessageMuted]}>
                {promoMessage}
              </Text>
            ) : null}

            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Base Fare (x{seats.length})</Text>
              <Text style={styles.costValue}>LKR {baseFare.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Service Fee</Text>
              <Text style={styles.costValue}>LKR {serviceFee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={[styles.costLabel, { color: '#22C55E' }]}>Promotion Discount</Text>
              <Text style={[styles.costValue, { color: '#22C55E' }]}>- LKR {discount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.costRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>LKR {finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>

          {/* Important Note */}
          <View style={styles.noteCard}>
            <View style={styles.noteHeader}>
              <Ionicons name="information-circle" size={18} color="#1474F2" />
              <Text style={styles.noteTitle}>Important Note</Text>
            </View>
            <Text style={styles.noteText}>
              Cancellations made within 5 hours before departure are not eligible for a refund. Proceeding will cancel your ticket without refund.
            </Text>
          </View>

          {/* Terms Checkbox */}
          <Pressable style={styles.termsRow} onPress={() => setAgreedToTerms(!agreedToTerms)}>
            <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
              {agreedToTerms && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsLink}>Terms & Conditions</Text>,{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text> and Operator Rules.
            </Text>
          </Pressable>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            style={[styles.ctaButton, (!agreedToTerms || invalidBookingDate) && styles.ctaButtonDisabled]}
            disabled={!agreedToTerms || invalidBookingDate}
            onPress={() => {
              if (invalidBookingDate) {
                Alert.alert('Invalid date', PAST_BOOKING_DATE_MESSAGE);
                return;
              }
              // Prevents the payment step until the passenger details are complete.
              if (!validateFields()) {
                Alert.alert('Missing Information', 'Please fix the highlighted fields before proceeding.');
                return;
              }
              router.push({
                pathname: '/booking/payment-gateway',
                params: {
                  from,
                  to,
                  busId,
                  busType,
                  depart,
                  date,
                  seats: seats.join(','),
                  totalPrice: String(finalAmount),
                  originalAmount: String(originalAmount),
                  discountAmount: String(discount),
                  promotionId: appliedPromotion?.promotionId ? String(appliedPromotion.promotionId) : '',
                  promoCode: appliedPromotion?.promoCode ?? '',
                  fullName,
                  mobile,
                  email,
                  specialRequest,
                  routeName: params.routeName ?? '',
                },
              });
            }}>
            <Text style={styles.ctaButtonText}>Confirm & Pay</Text>
            <Text style={styles.ctaButtonPrice}>LKR {finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

// Stylesheet for the Booking Summary screen components
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
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    flex: 1,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  routeLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeCity: {
    fontSize: 18,
    fontWeight: "700",
    color: '#111827',
  },
  routeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  routeDateText: {
    fontSize: 12,
    fontWeight: "600",
    color: '#1474F2',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAF1FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 12,
  },
  durationText: {
    fontSize: 11,
    fontWeight: "600",
    color: '#1474F2',
  },
  busImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: '#111827',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 11, fontWeight: "600",
    color: '#94A3B8',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#E9EDF3',
  },
  cardInnerLabel: {
    fontSize: 11, fontWeight: "600",
    color: '#94A3B8',
    marginBottom: 8,
  },
  seatChips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  seatChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1474F2',
    backgroundColor: '#FFFFFF',
  },
  seatChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: '#1474F2',
  },
  fieldLabel: {
    fontSize: 12, fontWeight: "600",
    color: '#94A3B8',
    marginTop: 12,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9EDF3',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputRowError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12, fontWeight: "600",
    marginTop: 2,
    marginLeft: 4,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },
  editIcon: {
    padding: 4,
  },
  textArea: {
    fontSize: 14,
    color: '#111827',
    minHeight: 90,
    padding: 0,
  },
  paymentMethodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1474F2',
    padding: 16,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1474F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1474F2',
  },
  paymentMethodTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: '#111827',
  },
  paymentMethodSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  cardLogos: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visaLogo: {
    backgroundColor: '#1A1F71',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  visaText: {
    fontSize: 12,
    fontWeight: "800",
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  mcLogo: {
    flexDirection: 'row',
    width: 28,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mcCircle1: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EB001B',
    position: 'absolute',
    left: 0,
  },
  mcCircle2: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F79E1B',
    position: 'absolute',
    right: 0,
    opacity: 0.85,
  },
  promoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E9EDF3',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  promoButton: {
    backgroundColor: '#1474F2',
    borderRadius: 10,
    paddingHorizontal: 20,
    justifyContent: 'center',
    minWidth: 78,
    alignItems: 'center',
  },
  promoButtonDisabled: {
    opacity: 0.6,
  },
  promoButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: '#FFFFFF',
  },
  promoMessage: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10,
  },
  promoMessageSuccess: {
    color: '#16A34A',
  },
  promoMessageMuted: {
    color: '#64748B',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  costLabel: {
    fontSize: 11, fontWeight: "600",
    color: '#111827',
  },
  costValue: {
    fontSize: 13,
    fontWeight: "600",
    color: '#111827',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: '#111827',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: '#111827',
  },
  noteCard: {
    backgroundColor: '#EAF1FF',
    borderRadius: 14,
    padding: 16,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: '#1474F2',
  },
  noteText: {
    fontSize: 11, fontWeight: "500",
    color: '#64748B',
    lineHeight: 18,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#1474F2',
    borderColor: '#1474F2',
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  termsLink: {
    color: '#1474F2',
    fontWeight: "600",
  },
  bottomBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1474F2',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  ctaButtonDisabled: {
    opacity: 0.5,
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: '#FFFFFF',
  },
  ctaButtonPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: '#FFFFFF',
  },
});
