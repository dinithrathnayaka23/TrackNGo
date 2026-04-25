import React, { useMemo,useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Linking,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

type SeatStatus = 'boarded' | 'booked' | 'available';


export default function DriverSeatLayoutScreen() {
  const router = useRouter();
  const { darkMode} = useTheme();
  const theme = useMemo(() => ({
    background: darkMode ? '#111' : '#F5F5F5',
    card: darkMode ? '#1E1E1E' : '#FFF',
    text: darkMode ? '#FFF' : '#000',
    secondaryText: darkMode ? '#AAA' : '#666',
    border: darkMode ? '#333' : '#E0E0E0',
  }), [darkMode]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selectedSeat, setSelectedSeat] = useState('1B');
  const [seatData, setSeatData] = useState([
  { id: '1A', status: 'boarded', passenger: null },
  { id: '1B', status: 'booked', passenger: { name: 'Nimali S.', initials: 'NS' } },
  { id: '1C', status: 'available', passenger: null },
  { id: '1D', status: 'available', passenger: null },
  { id: '2A', status: 'boarded', passenger: null },
  { id: '2B', status: 'boarded', passenger: null },
  { id: '2C', status: 'available', passenger: null },
  { id: '2D', status: 'available', passenger: null },
]);

  type Seat = {
  id: string;
  status: SeatStatus;
  passenger: { name: string; initials: string } | null;
};



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'boarded':
        return '#22C55E';
      case 'booked':
        return '#FBBF24';
      case 'available':
        return '#D1D5DB';
      default:
        return '#D1D5DB';
    }
  };

  const getSeatStyles = (status: string) => {
    return {
      backgroundColor: getStatusColor(status),
    };
  };

  const handleCall = () => {
    Linking.openURL('tel:+94771234567');
  };

  const handleMessage = () => {
    router.push('/chat');
  };

  const handlePassengerOptions = () => {
  Alert.alert(
  'Passenger Options',
  'Choose an action',
  [
    {
      text: 'Scan QR Code',
      onPress: () => console.log('Open QR Scanner'),
    },
    {
      text: 'Withdraw Passenger',
      onPress: () => console.log('Withdraw Passenger'),
    },
    {
      text: 'Cancel',
      onPress: () => {},
    },
  ]
  );
  };

  const handleMarkBoarded = () => {
    const updatedSeats = seatData.map((seat) => {
    if (seat.id === selectedSeat && seat.status === 'booked') {
      return {
        ...seat,
        status: 'boarded',
      };
    }
    return seat;
  });

  setSeatData(updatedSeats);
  Alert.alert('Success', 'Passenger boarded');
  };

  const renderSeat = (seat: any) => (
    <TouchableOpacity
      key={seat.id}
      style={[styles.seat, getSeatStyles(seat.status)]}
      onPress={() => setSelectedSeat(seat.id)}
    >
      <MaterialCommunityIcons name="account" size={20} color="#FFF" />
      <Text style={styles.seatLabel}>{seat.id}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.tripNumber}>Trip #LK-8992</Text>
          <View style={styles.routeContainer}>
            <Text style={styles.routeText}>Colombo</Text>
            <MaterialCommunityIcons name="arrow-right" size={14} color="#999" />
            <Text style={styles.routeText}>Kandy</Text>
          </View>
        </View>
        <TouchableOpacity>
          <MaterialCommunityIcons name="dots-vertical" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView 
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* Trip Details Section */}
        <View style={styles.tripDetailsSection}>
          <View style={styles.detailCard}>
            <Text style={styles.detailLabel}>Departure</Text>
            <Text style={styles.detailValue}>08:30 AM</Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailLabel}>Passengers</Text>
            <Text style={styles.detailValue}>32 /45</Text>
          </View>
          <View style={[styles.detailCard, styles.statusCard]}>
            <Text style={styles.detailLabel}>Status</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Boarding</Text>
            </View>
          </View>
        </View>

        {/* Status Indicators */}
        <View style={styles.statusIndicators}>
          <View style={styles.indicator}>
            <View style={[styles.indicatorDot, { backgroundColor: '#22C55E' }]} />
            <Text style={styles.indicatorText}>Boarded</Text>
          </View>
          <View style={styles.indicator}>
            <View style={[styles.indicatorDot, { backgroundColor: '#FBBF24' }]} />
            <Text style={styles.indicatorText}>Booked</Text>
          </View>
          <View style={styles.indicator}>
            <View style={[styles.indicatorDot, { backgroundColor: '#D1D5DB' }]} />
            <Text style={styles.indicatorText}>Available</Text>
          </View>
        </View>

        {/* Seat Layout */}
        <View style={styles.seatLayoutSection}>
          {/* Driver Icon */}
          <View style={styles.driverSection}>
            <View style={styles.driverIcon}>
              <MaterialCommunityIcons name="steering" size={32} color="#000" />
            </View>
            <Text style={styles.driverLabel}>Driver</Text>
          </View>

          {/* Seats Grid */}
          <View style={styles.seatsContainer}>
            <View style={styles.seatsRow}>
              {seatData.slice(0, 2).map(renderSeat)}
            </View>
            <View style={styles.seatsRow}>
              {seatData.slice(2, 4).map(renderSeat)}
            </View>
            <View style={styles.seatsRow}>
              {seatData.slice(4, 6).map(renderSeat)}
            </View>
            <View style={styles.seatsRow}>
              {seatData.slice(6, 8).map(renderSeat)}
            </View>
          </View>
        </View>

        {/* Selected Passenger Details */}
        <View style={styles.passengerDetailsSection}>
          <View style={styles.passengerHeader}>
            <View style={styles.passengerAvatar}>
              <Text style={styles.passengerInitials}>NS</Text>
            </View>
            <View style={styles.passengerInfo}>
              <Text style={styles.passengerName}>Nimali S.</Text>
              <Text style={styles.seatInfo}>Seat 1B</Text>
            </View>
            <TouchableOpacity onPress={handlePassengerOptions}>
              <MaterialCommunityIcons name="pencil" size={20} color="#0066FF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Location Details */}
        <View style={styles.locationSection}>
          <View style={styles.locationCard}>
            <View style={styles.locationIconContainer}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#000" />
            </View>
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>Pick up</Text>
              <Text style={styles.locationName}>Fort Station</Text>
              <Text style={styles.locationTime}>08:15 AM</Text>
            </View>
          </View>

          <View style={styles.locationCard}>
            <View style={styles.locationIconContainer}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#000" />
            </View>
            <View style={styles.locationDetails}>
              <Text style={styles.locationLabel}>Drop off</Text>
              <Text style={styles.locationName}>Peradeniya</Text>
            </View>
          </View>
        </View>

        {/* Special Requests */}
        <View style={styles.specialRequestsSection}>
          <Text style={styles.sectionTitle}>Special Requests</Text>
          <View style={styles.requestItem}>
            <MaterialCommunityIcons name="bag-suitcase" size={20} color={theme.text} />
            <Text style={styles.requestText}>Large suitcase in hold</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsSection}>
          <TouchableOpacity style={styles.callButton} onPress={handleCall}>
            <MaterialCommunityIcons name="phone" size={20} color="#FFF" />
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
            <MaterialCommunityIcons name="message-text" size={20} color={theme.text} />
            <Text style={styles.messageButtonText}>Message</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.boardButton} onPress={handleMarkBoarded}>
          <MaterialCommunityIcons name="check" size={20} color="#FFF" />
          <Text style={styles.boardButtonText}>Mark as Boarded</Text>
        </TouchableOpacity>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
function createStyles(theme: any) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  routeText: {
    fontSize: 11,
    color: theme.secondaryText,
    fontWeight: '500',
  },
  tripDetailsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  detailCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.card,
    borderRadius: 8,
  },
  detailLabel: {
    fontSize: 11,
    color: theme.secondaryText,
    fontWeight: '600',
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  statusCard: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#0066FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  statusIndicators: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  indicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  indicatorText: {
    fontSize: 11,
    color: theme.secondaryText,
    fontWeight: '600',
  },
  seatLayoutSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  driverSection: {
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  driverIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
  },
  driverLabel: {
    fontSize: 10,
    color: theme.secondaryText,
    marginTop: 6,
    marginRight:10,
    fontWeight: '600',
  },
  seatsContainer: {
    gap: 10,
    backgroundColor: theme.card,
    padding: 12,
    borderRadius: 8,
  },
  seatsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  seat: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  seatLabel: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '700',
  },
  passengerDetailsSection: {
    marginHorizontal: 16,
    marginVertical: 12,
    padding: 14,
    backgroundColor: theme.card,
    borderRadius: 8,
  },
  passengerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passengerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0066FF',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  seatInfo: {
    fontSize: 11,
    color: theme.secondaryText,
    marginTop: 2,
    fontWeight: '500',
  },
  locationSection: {
    marginHorizontal: 16,
    marginVertical: 12,
    gap: 10,
  },
  locationCard: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.card,
    borderRadius: 8,
    gap: 12,
    alignItems: 'flex-start',
  },
  locationIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  locationDetails: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    color: theme.secondaryText,
    fontWeight: '600',
    marginBottom: 2,
  },
  locationName: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
  },
  locationTime: {
    fontSize: 10,
    color: theme.secondaryText,
    marginTop: 2,
    fontWeight: '500',
  },
  specialRequestsSection: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.card,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.secondaryText,
    marginBottom: 8,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestText: {
    fontSize: 12,
    color: theme.text,
    fontWeight: '600',
  },
  actionButtonsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#22C55E',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  callButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  messageButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.card,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  messageButtonText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '700',
  },
  boardButton: {
    marginHorizontal: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#0066FF',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  boardButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  spacer: {
    height: 80,
  },
})
};
