import React, { useRef, useCallback } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/*
 * BookingConfirmationScreen - Displays the digital bus ticket after a successful booking.
 * Features a scannable QR code and functionality to download/share a PDF version of the ticket.
 */

export default function BookingConfirmationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  // Extract finalized booking details passed from the payment gateway
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
    routeName?: string;
  }>();

  // Default values for display
  const from = params.from ?? 'Colombo Fort';
  const to = params.to ?? 'Kandy';
  const depart = params.depart ?? '08:30';
  const date = params.date ?? (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
  const seats = params.seats ?? '';
  const totalPrice = Number(params.totalPrice ?? '0') || 0;
  const bookingId = params.bookingRef ?? 'N/A';

  // Build the QR payload with all ticket information for driver verification
  const qrData = JSON.stringify({
    bookingId,
    from,
    to,
    date,
    depart,
    seats,
    totalPrice,
    busNumber: params.busNumber ?? '',
    routeName: params.routeName ?? '',
    transactionId: params.transactionId ?? '',
  });

  // Ref to the SVG QR component so we can extract base64 for the PDF
  const qrSvgRef = useRef<any>(null);

  /** 
   * Get a base64 data-URI of the QR code from the SVG ref.
   * This is required to embed the QR code into the PDF document.
   */
  const getQrBase64 = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!qrSvgRef.current) return reject(new Error('QR ref not ready'));
      qrSvgRef.current.toDataURL((data: string) => {
        resolve(`data:image/png;base64,${data}`);
      });
    });
  }, []);

  /** 
   * Build an HTML ticket template and generate a PDF document.
   * Uses expo-print to convert HTML to a high-quality PDF.
   */
  const generateTicketPdf = useCallback(async (): Promise<string> => {
    const qrImageUri = await getQrBase64();
    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 24px; background: #f6f7f9; }
            .ticket { background: #fff; border-radius: 16px; padding: 32px 28px; max-width: 400px; margin: 0 auto; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
            .header { text-align: center; margin-bottom: 20px; }
            .logo { font-size: 22px; font-weight: 800; color: #22C55E; letter-spacing: 1px; }
            .subtitle { font-size: 11px; color: #94a3b8; margin-top: 2px; }
            .divider { border: none; border-top: 2px dashed #e2e8f0; margin: 18px 0; }
            .qr-section { text-align: center; margin: 18px 0; }
            .qr-section img { width: 180px; height: 180px; border: 3px solid #111827; border-radius: 8px; padding: 8px; background: #fff; }
            .scan-badge { display: inline-block; background: #111827; color: #fff; font-size: 10px; font-weight: 800; letter-spacing: 2px; padding: 4px 14px; border-radius: 4px; margin-top: -12px; }
            .scan-hint { font-size: 11px; color: #94a3b8; margin-top: 10px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 16px 0; }
            .info-box label { display: block; font-size: 9px; font-weight: 700; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 3px; }
            .info-box span { font-size: 14px; font-weight: 700; color: #111827; }
            .route { text-align: center; margin: 10px 0 6px; }
            .route-text { font-size: 20px; font-weight: 800; color: #111827; }
            .route-arrow { color: #22C55E; margin: 0 6px; }
            .price-row { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; background: #f0fdf4; padding: 14px 18px; border-radius: 10px; }
            .price-label { font-size: 10px; font-weight: 700; color: #94a3b8; letter-spacing: 1px; }
            .price-value { font-size: 22px; font-weight: 800; color: #22C55E; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; color: #cbd5e1; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">
              <div class="logo">TrackNGo</div>
              <div class="subtitle">E-Bus Ticket</div>
            </div>

            <div class="route">
              <span class="route-text">${from} <span class="route-arrow">→</span> ${to}</span>
              <div class="subtitle" style="font-size: 14px; font-weight: 700; color: #2563EB; margin-top: 4px;">${params.routeName || ''}</div>
            </div>

            <hr class="divider" />

            <div class="qr-section">
              <img src="${qrImageUri}" alt="QR Ticket" /><br/>
              <span class="scan-badge">SCAN ME</span>
              <div class="scan-hint">Show this QR code to the driver at boarding</div>
            </div>

            <hr class="divider" />

            <div class="info-grid">
              <div class="info-box">
                <label>Booking ID</label>
                <span>#${bookingId}</span>
              </div>
              <div class="info-box">
                <label>Bus Number</label>
                <span>${params.busNumber ?? 'N/A'}</span>
              </div>
              <div class="info-box">
                <label>Date</label>
                <span>${date}</span>
              </div>
              <div class="info-box">
                <label>Departure</label>
                <span>${depart}</span>
              </div>
              <div class="info-box">
                <label>Seats</label>
                <span>${seats.replace(/,/g, ', ')}</span>
              </div>
              <div class="info-box">
                <label>Transaction</label>
                <span>${params.transactionId ?? 'N/A'}</span>
              </div>
            </div>

            <div class="price-row">
              <div>
                <div class="price-label">TOTAL PAID</div>
              </div>
              <div class="price-value">LKR ${totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>

            <div class="footer">This is a system-generated ticket. No signature required.</div>
          </div>
        </body>
      </html>
    `;
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return uri;
  }, [bookingId, from, to, date, depart, seats, totalPrice, params.busNumber, params.transactionId, getQrBase64]);

  /** Download — generate a PDF ticket and let the user save it */
  const handleDownload = useCallback(async () => {
    try {
      const pdfUri = await generateTicketPdf();
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Save your TrackNGo bus ticket',
        UTI: 'com.adobe.pdf',
      });
    } catch (e: any) {
      console.error('Download error:', e);
      Alert.alert('Error', 'Could not generate the ticket PDF. Please try again.');
    }
  }, [generateTicketPdf]);

  /** Share — generate a PDF ticket and share via system share sheet */
  const handleShare = useCallback(async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
        return;
      }
      const pdfUri = await generateTicketPdf();
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share your TrackNGo bus ticket',
        UTI: 'com.adobe.pdf',
      });
    } catch (e: any) {
      console.error('Share error:', e);
      Alert.alert('Error', 'Could not share the ticket. Please try again.');
    }
  }, [generateTicketPdf]);

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

          {/* QR Code Card - This is the primary boarding pass */}
          <View style={styles.qrCard}>
            {/* Real scannable QR code */}
            <View style={styles.qrContainer}>
              <View style={styles.qrBorder}>
                <QRCode
                  value={qrData}
                  size={150}
                  color="#111827"
                  backgroundColor="#FFFFFF"
                  ecl="M"
                  getRef={(ref: any) => { qrSvgRef.current = ref; }}
                />
              </View>
              <View style={styles.scanBadge}>
                <Text style={styles.scanBadgeText}>SCAN ME</Text>
              </View>
            </View>

            <Text style={styles.scanTitle}>Scan at boarding</Text>
            <Text style={styles.scanSub}>Show this QR code to the driver</Text>

            {/* Inline ticket summary snippet */}
            <View style={styles.ticketInfo}>
              <Text style={styles.ticketRoute}>{from}  →  {to}</Text>
              {params.routeName ? <Text style={[styles.ticketMeta, { color: '#1474F2', fontWeight: '700', fontSize: 12 }]}>{params.routeName}</Text> : null}
              <Text style={styles.ticketMeta}>{date}  •  {depart}   |   Seats: {seats.replace(/,/g, ', ')}</Text>
              <Text style={styles.ticketMeta}>Booking #{bookingId}   •   LKR {totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
            </View>
          </View>

          {/* Detailed Trip Card */}
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

          {/* Ticket Export Options */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn} onPress={handleDownload}>
              <Ionicons name="download-outline" size={22} color="#374151" />
              <Text style={styles.actionBtnText}>Download</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={22} color="#374151" />
              <Text style={styles.actionBtnText}>Share</Text>
            </Pressable>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Navigation Return to Home */}
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

// Stylesheet for the Booking Confirmation screen components
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
  qrBorder: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#111827',
    borderRadius: 8,
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
  ticketInfo: {
    marginTop: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
    width: '100%',
  },
  ticketRoute: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  ticketMeta: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
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
