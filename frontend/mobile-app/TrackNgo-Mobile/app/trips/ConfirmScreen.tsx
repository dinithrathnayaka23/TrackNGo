import React, { useRef, useState } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  Image
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ViewShot from "react-native-view-shot";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LocalizedText as Text } from "../../utils/i18n";

const { width } = Dimensions.get('window');

export default function ConfirmScreen() {
  const router = useRouter();
  const { tripDetails: tripDetailsStr } = useLocalSearchParams<{ tripDetails: string }>();
  const tripDetails = tripDetailsStr ? JSON.parse(tripDetailsStr) : {};
  const bookingData = tripDetails;

  const ticketRef = useRef<ViewShot>(null);
  const modalTicketRef = useRef<ViewShot>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleViewTicket = () => setModalVisible(true);
  const handleCloseTicket = () => setModalVisible(false);

  const formatDate = (date: any) => {
    if (!date) return "Select Date";
    return new Date(date).toDateString();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F7FB" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/tabs')}>
             <Ionicons name="chevron-back" size={22} />
          </TouchableOpacity>
          <Text style={styles.headerText}>
            Booking #{bookingData?.bookingId || "8392"}
          </Text>
          <View style={{ width: 20 }} />
        </View>

        {/* Payment Success */}
        <View style={{ alignItems: "center", marginVertical: 24 }}>
          <View style={styles.successIconContainer}>
             <Ionicons name="checkmark" size={40} color="white" />
          </View>
          <Text style={{ color: "#111827", fontSize: 22, fontWeight: "bold", marginTop: 16 }}>
            Booking Confirmed!
          </Text>
          <Text style={{ color: "#6B7280", fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 }}>
            Your trip has been successfully scheduled. You can view your ticket below.
          </Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: "100%" }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.completedStep}>Sent</Text>
            <Text style={styles.completedStep}>Negotiation</Text>
            <Text style={styles.completedStep}>Payment</Text>
            <Text style={styles.completedStep}>Confirmed</Text>
          </View>
        </View>

        {/* Main Card View */}
        <View style={styles.card}>
            <View style={styles.tripHeader}>
              <Text style={styles.tripId}>REF: #{bookingData?.bookingId || "8392"}</Text>
              <Text style={styles.tripTitle}>
                {bookingData?.pickup || "Colombo"} → {bookingData?.drop || "Kandy"}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Departure</Text><Text style={styles.detailValue}>{formatDate(bookingData?.depart)}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Passengers</Text><Text style={styles.detailValue}>{bookingData?.passengers || 1} People</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Type</Text><Text style={styles.detailValue}>{bookingData?.selectedRequirement || "Standard"}</Text></View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity style={styles.primaryButton} onPress={handleViewTicket}>
          <Ionicons name="ticket-outline" size={20} color="white" style={{ marginRight: 8 }} />
          <Text style={styles.primaryButtonText}>View Digital Ticket</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={() => router.push('/tabs')}>
          <Text style={styles.secondaryButtonText}>Return to Home</Text>
        </TouchableOpacity>

        {/* ── TICKET MODAL ────────────────────────────────────────── */}
        <Modal visible={modalVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <SafeAreaView style={styles.modalContent}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 40 }}>
                
                {/* THE TICKET DESIGN */}
                <View style={styles.ticketContainer}>
                  {/* Top Section */}
                  <View style={styles.ticketTop}>
                    <View style={styles.ticketHeader}>
                      <Text style={styles.ticketBrand}>TRACKNGo</Text>
                      <Text style={styles.ticketType}>E-TICKET</Text>
                    </View>
                    
                    <View style={styles.ticketRoute}>
                      <View>
                        <Text style={styles.cityCode}>{bookingData?.pickup?.substring(0,3).toUpperCase() || "CMB"}</Text>
                        <Text style={styles.cityName}>{bookingData?.pickup || "Colombo"}</Text>
                      </View>
                      <Ionicons name="bus" size={24} color="#2563EB" />
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.cityCode}>{bookingData?.drop?.substring(0,3).toUpperCase() || "KND"}</Text>
                        <Text style={styles.cityName}>{bookingData?.drop || "Kandy"}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Perforation Line with Side Notches */}
                  <View style={styles.perforationContainer}>
                    <View style={styles.leftNotch} />
                    <View style={styles.dottedLine} />
                    <View style={styles.rightNotch} />
                  </View>

                  {/* Bottom Section */}
                  <View style={styles.ticketBottom}>
                    <View style={styles.ticketGrid}>
                      <View style={styles.gridItem}>
                        <Text style={styles.gridLabel}>DATE</Text>
                        <Text style={styles.gridValue}>{formatDate(bookingData?.depart).split(' ').slice(1,3).join(' ')}</Text>
                      </View>
                      <View style={styles.gridItem}>
                        <Text style={styles.gridLabel}>TIME</Text>
                        <Text style={styles.gridValue}>08:30 AM</Text>
                      </View>
                      <View style={styles.gridItem}>
                        <Text style={styles.gridLabel}>BOOKING ID</Text>
                        <Text style={styles.gridValue}>#{bookingData?.bookingId || "8392"}</Text>
                      </View>
                      <View style={styles.gridItem}>
                        <Text style={styles.gridLabel}>PASSENGERS</Text>
                        <Text style={styles.gridValue}>{bookingData?.passengers || 1}</Text>
                      </View>
                    </View>

                    {/* QR Code - Real Dynamic QR! */}
                    <View style={styles.qrContainer}>
                       <View style={styles.qrSquare}>
                          <Image 
                            source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                              `TrackNGo VERIFIED\n-----------------\nID: #${bookingData?.bookingId}\nRoute: ${bookingData?.pickup} to ${bookingData?.drop}\nDate: ${formatDate(bookingData?.depart)}\nStatus: PAID`
                            )}` }}
                            style={{ width: 140, height: 140 }}
                          />
                       </View>
                       <Text style={styles.qrText}>Scan to Verify Booking</Text>
                    </View>
                  </View>
                </View>

                {/* Close Button */}
                <TouchableOpacity style={styles.closeButton} onPress={handleCloseTicket}>
                  <Ionicons name="close-circle" size={50} color="white" />
                </TouchableOpacity>

              </ScrollView>
            </SafeAreaView>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  headerText: { fontSize: 16, fontWeight: "600", color: "#111827" },
  
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#22C55E",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#22C55E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  progressContainer: { marginBottom: 24 },
  progressBar: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 10 },
  progressFill: { height: 6, backgroundColor: "#2563EB", borderRadius: 10 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  completedStep: { fontSize: 11, color: "#2563EB", fontWeight: "600" },
  
  card: { backgroundColor: "white", borderRadius: 16, padding: 20, marginBottom: 16, elevation: 2 },
  tripHeader: { marginBottom: 12 },
  tripId: { fontSize: 12, fontWeight: "700", color: "#94A3B8", marginBottom: 4 },
  tripTitle: { fontSize: 18, fontWeight: "bold", color: "#111827" },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 16 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  detailLabel: { fontSize: 14, color: "#64748B" },
  detailValue: { fontSize: 14, color: "#111827", fontWeight: "600" },

  primaryButton: { 
    backgroundColor: "#2563EB", 
    padding: 16, 
    borderRadius: 14, 
    flexDirection: 'row',
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    elevation: 2
  },
  primaryButtonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  secondaryButton: { padding: 16, alignItems: "center" },
  secondaryButtonText: { color: "#64748B", fontWeight: "600", fontSize: 14 },

  /* ── TICKET STYLES ───────────────────────────────────────── */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center" },
  modalContent: { flex: 1 },
  
  ticketContainer: {
    backgroundColor: 'white',
    marginHorizontal: 30,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
  },
  ticketTop: {
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  ticketBrand: {
    fontSize: 14,
    fontWeight: '900',
    color: '#2563EB',
    letterSpacing: 1,
  },
  ticketType: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ticketRoute: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cityCode: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
  },
  cityName: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  perforationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: '#FFFFFF',
  },
  leftNotch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
    marginLeft: -10,
  },
  rightNotch: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
    marginRight: -10,
  },
  dottedLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 10,
  },

  ticketBottom: {
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  ticketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  gridItem: {
    width: '50%',
    marginBottom: 16,
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  qrContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  qrSquare: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
  },
  qrText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 8,
    fontWeight: '500',
  },
  closeButton: {
    alignItems: 'center',
    marginTop: 30,
  },
});
