import React, { useMemo, useState, useCallback } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  useWindowDimensions,
  Linking, // Import Linking to call phone
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; //prevent content overlap
import { useTheme } from '@/context/ThemeContext';
import { useUser } from '@/context/UserContext';
import { useLanguage } from '@/context/LanguageContext';
import { seatBookingService } from '@/services/seatBookingService';
import { createConversation } from '@/services/chatApi';

type SeatStatus = 'boarded' | 'booked' | 'blocked' | 'available'; // Define the possible seat statuses

interface Seat { //api response structure
  id: string;
  status: SeatStatus;
  passenger: { 
    name: string; 
    initials: string;
    phone?: string;
    seatBookingId?: number;
  } | null;
}

interface SeatLayoutRow {
  rowNum: number;
  left: string[];
  right: string[];
  lastRow: string[] | null;
}

interface JourneyData {
  routeName: string;
  startLocation: string;
  endLocation: string;
  busNumber: string;
  journeyDate: string;
  journeyTime: string;
  boardedCount: number;
  bookedCount: number;
  totalSeats: number;
}

interface PassengerDetails {
  name: string;
  phone: string;
  pickupLocation: string;
  dropoffLocation: string;
  seatNumber: string;
  specialRequest?: string;
  passengerId?: number;
  bookingReference?: string;
}

export default function DriverSeatLayoutScreen() { //main component
  const router = useRouter();
  const { darkMode } = useTheme(); //get dark mode state from themecontext
  const { user } = useUser(); //get user data from usercontext to check if user is logged in
  const { t } = useLanguage(); //get translation function from languagecontext
  const { width } = useWindowDimensions();
  const theme = useMemo(() => ({
    background: darkMode ? '#111' : '#F1F5F9',
    card: darkMode ? '#1E1E1E' : '#FFF',
    text: darkMode ? '#FFF' : '#000',
    secondaryText: darkMode ? '#AAA' : '#666',
    border: darkMode ? '#333' : '#E2E8F0',
  }), [darkMode]); //until darkmode changes
  const styles = useMemo(() => createStyles(theme, width), [theme, width]); // Create styles using the current theme. 

  // State management
  const [seatData, setSeatData] = useState<Seat[]>([]); // seat layout data (an array)
  const [seatRows, setSeatRows] = useState<SeatLayoutRow[]>([]); // seat layout rows
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null); // hold selected seat's data
  const [journeyData, setJourneyData] = useState<JourneyData | null>(null);
  const [selectedPassenger, setSelectedPassenger] = useState<PassengerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookedSeatsMap, setBookedSeatsMap] = useState<
    Map<string, { passenger: PassengerDetails; seatBookingId: number }>
  >(new Map());
  const [actionSheetVisible, setActionSheetVisible] = useState(false); // controls the tap-to-open passenger actions sheet
  const [isMessaging, setIsMessaging] = useState(false);

  // Fetch data whenever this screen gains focus (initial mount, and whenever the
  // driver returns from chat or the QR scanner) so boarded status stays current.
  useFocusEffect(
    useCallback(() => {
      if (user?.userId) {
        loadSeatLayoutData();
      }
    }, [user?.userId])
  );

  const loadSeatLayoutData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Starting seat layout data load...');
      console.log('Current user:', user); 

      // Get JWT token for API authentication
      const token = await seatBookingService.getToken();
      console.log('Token obtained:', token ? 'Yes' : 'No');

      // Get driver assignment
      const assignment = await seatBookingService.getDriverAssignment(user!.userId, token); //give parameters of not null user(id) and token
      console.log('Assignment received:', assignment);
      
      if (!assignment || !assignment.busId) {
        setError(t('allocations.noBusAssignment'));
        setLoading(false);
        return;
      }

      // Get bus details
      const busDetails = await seatBookingService.getBusDetails(assignment.busId, token);
      console.log('Bus details received:', busDetails);

      // Get seat layout rows from backend
      const seatLayout = await seatBookingService.getSeatLayout(assignment.busId, token);
      console.log('Seat layout rows received:', seatLayout);
      
      // Validate seat layout rows
      if (!Array.isArray(seatLayout)) { // Check if seat layout is an array and if not throw error
        console.warn('Seat layout is not an array, received:', seatLayout);
        throw new Error('Invalid seat layout response - expected array of rows');
      }
      
      if (seatLayout.length === 0) { // Check if seat layout is empty and if it is throw error
        console.warn('Seat layout is empty');
        throw new Error('No seat layout found for this bus');
      }
      
      setSeatRows(seatLayout); //update the state with received backend data

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0]; //split means split the date and time into two parts

      // Get booked seats for today
      const bookedSeats = await seatBookingService.getBookedSeats(
        assignment.busId,
        today,
        token
      );
      console.log('Booked seats received:', bookedSeats);

      const blockedSeats = await seatBookingService.getBlockedSeats(assignment.busId, token);
      console.log('Blocked seats received:', blockedSeats);

      // Get route details for start and end locations
      const NA = t('common.notAvailable');
      let startLocation = NA;
      let endLocation = NA;

      // First, try to parse route name if it exists (e.g., "Kandy to Nuwara Eliya")
      if (assignment.routeName && assignment.routeName.includes(' to ')) {
        const [start, end] = assignment.routeName.split(' to ').map(s => s.trim()); // Split the route name into start and end locations
        startLocation = start;
        endLocation = end;
        console.log('Route locations from route name:', { startLocation, endLocation });
      } else if (assignment.routeName) {
        // If route name doesn't contain ' to ', use it as start location
        startLocation = assignment.routeName;
        endLocation = NA;
        console.log('Using route name as start location:', startLocation);
      }

      // If we still don't have proper locations, try to get route details from API
      if ((startLocation === NA || endLocation === NA) && assignment.routeId) {
        const routeDetails = await seatBookingService.getRouteDetails(
          assignment.routeId,
          token
        );

        if (routeDetails) {
          if (startLocation === NA) startLocation = routeDetails.startLocation || NA;
          if (endLocation === NA) endLocation = routeDetails.endLocation || NA;
          console.log('Route locations from API:', { startLocation, endLocation });
        }
      }

      // Process and organize seat data, calling the func
      const processedSeats = processSeatData( // give parameters and convert to UI friendly format (booked seat with passenger details for each)
        seatLayout,
        bookedSeats,
        blockedSeats,
        assignment.seatCapacity
      );

      // Create booked seats map for quick lookup
      const bookedMap = new Map(); // Create a map to store booked seats and show passenger details when a seat is selected.
      bookedSeats.forEach((booking: any) => {
        // Handle seat numbers that might be comma-separated
        const seatNumbers = booking.seatNumber.split(',').map((s: string) => s.trim()); // Split seat numbers into an array
        
        seatNumbers.forEach((seatId: string) => {
          bookedMap.set(seatId, { //store seat id
            passenger: {          // store booked passenger if any
              name: booking.passengerName || t('allocations.passengerFallback'),
              phone: booking.passengerPhone || '',
              pickupLocation: booking.fromStop || t('common.notAvailable'),
              dropoffLocation: booking.toStop || t('common.notAvailable'),
              seatNumber: seatId,
              specialRequest: booking.specialRequest,
              passengerId: booking.passengerId,
              bookingReference: booking.bookingReference,
            },
            seatBookingId: booking.seatBookingId, // Store the seat booking ID for later use when marking as boarded
          });
        });
      });

      setBookedSeatsMap(bookedMap); //save map in usee state (useState)
      setSeatData(processedSeats);

      // Set journey data
      const journeyInfo: JourneyData = { //summary of the journey
        routeName: assignment.routeName,
        startLocation: startLocation,
        endLocation: endLocation,
        busNumber: assignment.busNumber,
        journeyDate: today,
        journeyTime: (assignment as any).startTime || '08:00 AM',
        boardedCount: processedSeats.filter((s: Seat) => s.status === 'boarded').length, // Filter and count boarded seats
        bookedCount: processedSeats.filter(
          (s: Seat) => s.status === 'booked' || s.status === 'boarded'
        ).length, // Filter and count occupied seats
        totalSeats: processedSeats.length,
      };

      console.log('Journey data created:', journeyInfo);
      setJourneyData(journeyInfo); //(useState)

      // Select first booked seat by default if available
      const firstBookedSeat = processedSeats.find((s: Seat) => s.status === 'booked'); // By default, display first booked seat in the processed seat data. 
      if (firstBookedSeat) {
        setSelectedSeat(firstBookedSeat.id); // update state, why becoz we need to display passenger details
        const passengerData = bookedMap.get(firstBookedSeat.id); // Use the booked seats map to get passenger details for the selected seat
        if (passengerData) {
          setSelectedPassenger(passengerData.passenger); // Set the selected passenger details in state, which will be displayed in the UI. 
        }
      } // If there are no booked seats, selectedSeat will remain null and the UI will show no passenger details.
    } catch (err) {
      console.error('Error loading seat layout:', err);
      
      // Provide helpful error messages
      let errorMessage = t('allocations.failedToLoadSeatLayout');

      if (err instanceof TypeError && err.message.includes('Network request failed')) { // If the error is a network error
        errorMessage = t('allocations.networkErrorMessage');
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const processSeatData = ( 
    seatLayout: SeatLayoutRow[],
    bookedSeats: any[],
    blockedSeats: string[],
    totalCapacity: number
  ): Seat[] => {
    if (!Array.isArray(seatLayout) || seatLayout.length === 0) { // if backend send invalid or empty seat layout, stop the func
      console.warn('Invalid or empty seat layout rows:', seatLayout);
      return []; // Return an empty array
    }

    if (!Array.isArray(bookedSeats)) { // not an array, log a warning and set bookedSeats to an empty array to prevent errors 
      console.warn('Invalid booked seats:', bookedSeats);
      bookedSeats = []; // Set bookedSeats to an empty array
    }

    const bookedSeatNumbers = new Set( // Create a set of booked seat numbers for quick lookup. set[a1,a2,a3] 
      bookedSeats.flatMap((b: any) => { //take each booking and return it to seat number
        if (typeof b === 'string' || typeof b === 'number') {
          return [b.toString()]; // If booked seat is a string or number, convert it to a string and return it
        }
        const seatNumbers = (b.seatNumber || b.seat || b.seatLabel || b.id || '') // different formats
          .toString() // Convert to string if not already
          .split(',') // Split by comma 
          .map((s: string) => s.trim()) // Trim whitespace 
          .filter((s: string) => s.length > 0); // Filter out any empty strings that might result from splitting or trimming
        return seatNumbers; //set{A1,A2,B1}
      })
    );
    const blockedSeatNumbers = new Set(
      (Array.isArray(blockedSeats) ? blockedSeats : [])
        .map((seat) => seat.toString().trim())
        .filter(Boolean)
    );

    console.log('Booked seat numbers set:', bookedSeatNumbers); // Log the set of booked seat numbers

    const seats: Seat[] = seatLayout.flatMap((row) => { // Create a flat list of Seat objects based on the seat layout rows. 
      const rowSeats: Seat[] = []; //now build the full row

      row.left.forEach((label) => { // For each seat label in the left side of the row
        rowSeats.push({ id: label, status: 'available', passenger: null }); 
      }); // Repeat the same process for the right side of the row
      row.right.forEach((label) => {
        rowSeats.push({ id: label, status: 'available', passenger: null });
      });
      (row.lastRow || []).forEach((label) => {
        rowSeats.push({ id: label, status: 'available', passenger: null });
      });

      return rowSeats; //this returns a flat list of Seat objects
    });

    return seats.map((seat) => { // Update the status of each seat based on whether it is in the set of booked seat numbers..
      if (blockedSeatNumbers.has(seat.id)) {
        return {
          ...seat,
          status: 'blocked',
          passenger: null,
        };
      }

      if (bookedSeatNumbers.has(seat.id)) { 
        const booking = bookedSeats.find((b: any) => { // Find the booking details
          if (typeof b === 'string' || typeof b === 'number') { //checking whether the booking is a string or number
            return b.toString() === seat.id; // If the booking is a simple string or number, we convert it to a string 
          }
          const seatNumbers = (b.seatNumber || b.seat || b.seatLabel || b.id || '') // Handle different possible fields that might contain seat numbers
            .toString()
            .split(',')
            .map((s: string) => s.trim());
          return seatNumbers.includes(seat.id); //eg. [a1,a2,a3]
        });

        return {
          ...seat, // Copy the original seat object
          status: normalizeSeatStatus(booking?.status),
          passenger: {
            name: booking?.passengerName || t('allocations.passengerFallback'), //get the name from the booking
            initials: getInitials(booking?.passengerName || t('allocations.passengerFallback')),
            phone: booking?.passengerPhone || booking?.phone,
            seatBookingId: booking?.seatBookingId || booking?.bookingId,
          },
        }; // Update the status of the seat to "booked" and attach the passenger details if available.
      }
      return seat;
    });
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ') // Split the name into individual words
      .slice(0, 2) // Take the first two words
      .map((n) => n[0]) // Get the first letter of each word
      .join('')
      .toUpperCase();
  }; // Utility function to get initials from a passenger's name. 

  const normalizeSeatStatus = (status?: string): SeatStatus => {
    const normalized = status?.toLowerCase();
    if (normalized === 'boarded') return 'boarded';
    return 'booked';
  };




  const getStatusColor = (status: string) => {
    switch (status) {
      case 'boarded':
        return '#22C55E';
      case 'booked':
        return '#EF4444';
      case 'blocked':
        return '#64748B';
      case 'available':
        return '#D1D5DB';
      default:
        return '#D1D5DB';
    }
  };

  const getSeatStyles = (status: string) => {
    return {
      backgroundColor: getStatusColor(status), // Set the background color based on the seat status
    };
  };

  const handleCall = () => {
    if (selectedPassenger?.phone) { // If the selected passenger has a phone number
      Linking.openURL(`tel:${selectedPassenger.phone}`);
    }
    setActionSheetVisible(false);
  };

  const handleMessagePassenger = async () => {
    if (!selectedPassenger?.passengerId || !user?.userId || !user?.token) {
      Alert.alert(t('allocations.error'), t('allocations.cannotOpenChat'));
      return;
    }

    setActionSheetVisible(false);
    try {
      setIsMessaging(true);
      const conversation = await createConversation({
        token: user.token,
        user1Id: user.userId,
        user1Type: 'DRIVER',
        user2Id: selectedPassenger.passengerId,
        user2Type: 'PASSENGER',
      });

      router.push({
        pathname: '/chat/[id]',
        params: {
          id: String(conversation.conversationId),
          name: selectedPassenger.name,
          otherUserId: String(selectedPassenger.passengerId),
          otherUserType: 'PASSENGER',
        },
      });
    } catch (err) {
      console.error('Error opening conversation with passenger:', err);
      Alert.alert(t('allocations.error'), t('allocations.cannotOpenChat'));
    } finally {
      setIsMessaging(false);
    }
  };

  const handleScanQr = () => {
    if (!selectedSeat) return;
    const bookedData = bookedSeatsMap.get(selectedSeat);
    if (!bookedData) return;

    setActionSheetVisible(false);
    router.push({
      pathname: '/qr-scan',
      params: {
        seatBookingId: String(bookedData.seatBookingId),
        bookingReference: bookedData.passenger.bookingReference ?? '',
        seatId: selectedSeat,
        passengerName: bookedData.passenger.name,
      },
    });
  };

  const handleMarkBoarded = async () => {
    if (!selectedSeat) return; // If no seat is selected, simply return and do nothing. This is a safety check to ensure that we don't attempt to mark a passenger as boarded without a valid seat selection, which could lead to errors or unintended behavior in the app.

    const bookedData = bookedSeatsMap.get(selectedSeat); // Get the booking data for the selected seat from the bookedSeatsMap. This will include the passenger details and the seat booking ID needed to call the API to mark the passenger as boarded.
    if (!bookedData) {
      Alert.alert(t('allocations.error'), t('allocations.seatNotBooked'));
      return;
    }

    setActionSheetVisible(false);
    try {
      setLoading(true);
      const token = await seatBookingService.getToken(); // Get the JWT token for API authentication. This is necessary to authorize the request to mark the passenger as boarded in the backend.
      const success = await seatBookingService.markPassengerBoarded( // Call the API to mark the passenger as boarded, passing the seat booking ID and the token for authentication. The API will update the status of the booking in the backend, and if successful, we will proceed to update the local state to reflect this change in the UI.
        bookedData.seatBookingId,
        token
      );

      if (success) {
        // Update local seat status
        const updatedSeats = seatData.map((seat) => {
          if (seat.id === selectedSeat && seat.status === 'booked') {
            return {
              ...seat,
              status: 'boarded' as SeatStatus,
            };
          }
          return seat;
        });

        setSeatData(updatedSeats);

        // Update journey data
        if (journeyData) {
          setJourneyData({
            ...journeyData,
            boardedCount: updatedSeats.filter((s) => s.status === 'boarded').length,
          });
        }

        Alert.alert(
          t('allocations.success'),
          t('allocations.passengerMarkedBoarded', { name: selectedPassenger?.name ?? '' }),
        );
      } else {
        Alert.alert(t('allocations.error'), t('allocations.failedToMarkBoarded'));
      }
    } catch (err) {
      console.error('Error marking passenger as boarded:', err);
      Alert.alert(t('allocations.error'), t('allocations.failedToMarkBoarded'));
    } finally {
      setLoading(false);
    }
  };

  const handleSeatPress = (seatId: string) => {
    setSelectedSeat(seatId); // Set the selected seat ID in state when a seat is pressed. This will allow us to display the passenger details for that seat if it is booked, or clear the passenger details if it is not booked. The UI will update to show the selected seat and its associated information based on this state change.

    const seat = seatData.find((item) => item.id === seatId);
    if (seat?.status === 'blocked') {
      setSelectedPassenger(null);
      Alert.alert(t('allocations.blockedSeatTitle'), t('allocations.blockedSeatMessage'));
      return;
    }

    // Find and display passenger details if seat is booked
    const passengerData = bookedSeatsMap.get(seatId);
    if (passengerData) {
      setSelectedPassenger(passengerData.passenger); // If the seat is booked and we have passenger data for it, set the selected passenger details in state. This will allow the UI to display the passenger's name, phone number, pickup and dropoff locations, seat number, and any special requests when a booked seat is selected.
      setActionSheetVisible(true); // Booked/boarded seats immediately surface the call/message/scan/board actions.
    } else {
      setSelectedPassenger(null); // If the seat is not booked, clear the selected passenger details. This will ensure that when an available seat is selected, the UI does not show any passenger information, indicating that the seat is currently unoccupied.
    }
  };

  const renderSeat = (seat: Seat) => ( // Render a single seat as a TouchableOpacity component. The appearance of the seat will change based on its status (boarded, booked, or available) using the getSeatStyles function to determine the background color. If the seat is selected, it will also apply additional styles to indicate that it is selected. When the seat is pressed, it will call the handleSeatPress function to update the selected seat and display passenger details if applicable. The seat will display an icon and its ID as a label for easy identification in the UI.
    <TouchableOpacity
      key={seat.id}
      style={[
        styles.seat,
        getSeatStyles(seat.status),
        selectedSeat === seat.id && styles.selectedSeat,
      ]}
      onPress={() => handleSeatPress(seat.id)}
    >
      <MaterialCommunityIcons
        name={seat.status === 'blocked' ? 'close' : 'account'}
        size={20}
        color="#FFF"
      />
      <Text style={styles.seatLabel}>{seat.id}</Text>
    </TouchableOpacity>
  );

  // Format date for display
  const formatDateForDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short', // Use 'short' for weekday eg. 'Mon'
      month: 'short', // Use 'short' for month eg. 'Jan'
      day: 'numeric', // Use 'numeric' for day of the month eg. '1'
    };
    return date.toLocaleDateString('en-US', options); // Return the formatted date
  };

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2F6BFF" />
          <Text style={[styles.loadingText, { color: theme.text }]}>{t('allocations.loadingSeatLayout')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error || !journeyData) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <View style={styles.centerContainer}>
          <MaterialCommunityIcons name="alert-circle" size={48} color="#EF4444" />
          <Text style={[styles.errorText, { color: theme.text }]}>{error || t('allocations.noDataAvailable')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSeatLayoutData}>
            <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.tripNumber}>{journeyData?.busNumber}</Text>
          <View style={styles.routeContainer}>
            <Text style={styles.routeText}>{journeyData?.startLocation}</Text>
            <MaterialCommunityIcons name="arrow-right" size={14} color="#999" />
            <Text style={styles.routeText}>{journeyData?.endLocation}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={loadSeatLayoutData}>
          <MaterialCommunityIcons name="refresh" size={24} color={theme.text} />
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
            <Text style={styles.detailLabel}>{t('allocations.departure')}</Text>
            <Text style={styles.detailValue}>{journeyData?.journeyTime}</Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailLabel}>{t('allocations.journeyDate')}</Text>
            <Text style={styles.detailValue}>{formatDateForDisplay(journeyData?.journeyDate || '')}</Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailLabel}>{t('allocations.passengers')}</Text>
            <Text style={styles.detailValue}>
              {journeyData?.bookedCount}/{journeyData?.totalSeats}
            </Text>
            <Text style={styles.detailSubtitle}>
              {t('allocations.boardedCount', { count: journeyData?.boardedCount ?? 0 })}
            </Text>
          </View>
        </View>

        {/* Status Indicators */}
        <View style={styles.statusIndicators}>
          <View style={styles.indicator}>
            <View style={[styles.indicatorDot, { backgroundColor: '#22C55E' }]} />
            <Text style={styles.indicatorText}>{t('allocations.boarded')}</Text>
          </View>
          <View style={styles.indicator}>
            <View style={[styles.indicatorDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.indicatorText}>{t('allocations.booked')}</Text>
          </View>
          <View style={styles.indicator}>
            <View style={[styles.indicatorDot, { backgroundColor: '#D1D5DB' }]} />
            <Text style={styles.indicatorText}>{t('allocations.available')}</Text>
          </View>
          <View style={styles.indicator}>
            <View style={[styles.indicatorDot, { backgroundColor: '#64748B' }]} />
            <Text style={styles.indicatorText}>{t('allocations.blocked')}</Text>
          </View>
        </View>

        {/* Seat Layout */}
        <View style={styles.seatLayoutSection}>
          {/* Driver Icon */}
          <View style={styles.driverSection}>
            <View style={styles.driverIcon}>
              <MaterialCommunityIcons name="steering" size={32} color="#000" />
            </View>
            <Text style={styles.driverLabel}>{t('allocations.driver')}</Text>
          </View>

          {/* Seats Grid */}
          <View style={styles.seatsContainer}>
            {seatRows.length > 0 ? (
              <>
                {seatRows.map((row) => {
                  const hasRegularSeats = row.left.length > 0 || row.right.length > 0;

                  return (
                    <View key={row.rowNum} style={styles.rowGroup}>
                      {hasRegularSeats ? (
                        <View style={styles.seatsRowGroup}>
                          <View style={styles.sideSeats}>
                            {row.left.map((seatId) => renderSeat(seatData.find((s) => s.id === seatId) || { // Find the seat data based on the seatId and use it to render the seat. If the seat is not found, use a default seat data object with an 'available' status and null passenger data.
                              id: seatId,
                              status: 'available',
                              passenger: null,
                            }))}
                          </View>

                          <View style={styles.aisle} />

                          <View style={styles.sideSeats}>
                            {row.right.map((seatId) => renderSeat(seatData.find((s) => s.id === seatId) || {
                              id: seatId,
                              status: 'available',
                              passenger: null,
                            }))}
                          </View>
                        </View>
                      ) : null}

                      {row.lastRow && row.lastRow.length > 0 && (
                        <View style={[styles.backRow, hasRegularSeats && styles.backRowSpacing]}>
                          {row.lastRow.map((seatId) => renderSeat(seatData.find((s) => s.id === seatId) || {
                            id: seatId,
                            status: 'available',
                            passenger: null,
                          }))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            ) : (
              <Text style={[styles.noSeatsText, { color: theme.secondaryText }]}>
                {t('allocations.noSeatsAvailable')}
              </Text>
            )}
          </View>
        </View>

        {/* Selected Passenger Details */}
        {selectedPassenger && (
          <View style={styles.passengerDetailsSection}>
            <View style={styles.passengerHeader}>
              <View style={styles.passengerAvatar}>
                <Text style={styles.passengerInitials}>
                  {getInitials(selectedPassenger.name)}
                </Text>
              </View>
              <View style={styles.passengerInfo}>
                <Text style={styles.passengerName}>{selectedPassenger.name}</Text>
                <Text style={styles.seatInfo}>{t('allocations.seatNumber', { seat: selectedSeat ?? '' })}</Text>
              </View>
              <TouchableOpacity onPress={() => setActionSheetVisible(true)}>
                <MaterialCommunityIcons name="pencil" size={20} color="#2F6BFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Location Details */}
        {selectedPassenger && (
          <View style={styles.locationSection}>
            <View style={styles.locationCard}>
              <View style={styles.locationIconContainer}>
                <MaterialCommunityIcons name="map-marker" size={20} color="#000" />
              </View>
              <View style={styles.locationDetails}>
                <Text style={styles.locationLabel}>{t('allocations.pickUp')}</Text>
                <Text style={styles.locationName}>{selectedPassenger.pickupLocation}</Text>
              </View>
            </View>

            <View style={styles.locationCard}>
              <View style={styles.locationIconContainer}>
                <MaterialCommunityIcons name="map-marker" size={20} color="#000" />
              </View>
              <View style={styles.locationDetails}>
                <Text style={styles.locationLabel}>{t('allocations.dropOff')}</Text>
                <Text style={styles.locationName}>{selectedPassenger.dropoffLocation}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Special Requests */}
        {selectedPassenger?.specialRequest && (
          <View style={styles.specialRequestsSection}>
            <Text style={styles.sectionTitle}>{t('allocations.specialRequests')}</Text>
            <View style={styles.requestItem}>
              <MaterialCommunityIcons name="bag-suitcase" size={20} color={theme.text} />
              <Text style={styles.requestText}>{selectedPassenger.specialRequest}</Text>
            </View>
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Passenger Actions Sheet: opens immediately when a booked/boarded seat is tapped */}
      <Modal
        transparent
        visible={actionSheetVisible}
        animationType="slide"
        onRequestClose={() => setActionSheetVisible(false)}
      >
        <Pressable style={styles.actionSheetOverlay} onPress={() => setActionSheetVisible(false)}>
          <Pressable style={styles.actionSheetContainer} onPress={() => {}}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>{selectedPassenger?.name}</Text>
            <Text style={styles.actionSheetSubtitle}>
              {t('allocations.seatNumber', { seat: selectedSeat ?? '' })}
            </Text>

            <TouchableOpacity
              style={[styles.actionSheetItem, !selectedPassenger?.phone && styles.actionSheetItemDisabled]}
              onPress={handleCall}
              disabled={!selectedPassenger?.phone}
            >
              <View style={[styles.actionSheetIcon, { backgroundColor: '#DCFCE7' }]}>
                <MaterialCommunityIcons name="phone" size={22} color="#16A34A" />
              </View>
              <Text style={styles.actionSheetItemText}>{t('allocations.call')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionSheetItem,
                (isMessaging || !selectedPassenger?.passengerId) && styles.actionSheetItemDisabled,
              ]}
              onPress={() => void handleMessagePassenger()}
              disabled={isMessaging || !selectedPassenger?.passengerId}
            >
              <View style={[styles.actionSheetIcon, { backgroundColor: '#DBEAFE' }]}>
                {isMessaging ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <MaterialCommunityIcons name="message-text" size={22} color="#2563EB" />
                )}
              </View>
              <Text style={styles.actionSheetItemText}>{t('allocations.message')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionSheetItem} onPress={handleScanQr}>
              <View style={[styles.actionSheetIcon, { backgroundColor: '#EDE9FE' }]}>
                <MaterialCommunityIcons name="qrcode-scan" size={22} color="#7C3AED" />
              </View>
              <Text style={styles.actionSheetItemText}>{t('allocations.scanQrCode')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionSheetItem,
                seatData.find((s) => s.id === selectedSeat)?.status === 'boarded' &&
                  styles.actionSheetItemDisabled,
              ]}
              onPress={handleMarkBoarded}
              disabled={seatData.find((s) => s.id === selectedSeat)?.status === 'boarded'}
            >
              <View style={[styles.actionSheetIcon, { backgroundColor: '#DCFCE7' }]}>
                <MaterialCommunityIcons name="check-circle" size={22} color="#16A34A" />
              </View>
              <Text style={styles.actionSheetItemText}>
                {seatData.find((s) => s.id === selectedSeat)?.status === 'boarded'
                  ? t('allocations.alreadyBoarded')
                  : t('allocations.markAsBoarded')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetCancel}
              onPress={() => setActionSheetVisible(false)}
            >
              <Text style={styles.actionSheetCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
function createStyles(theme: any, width: number) {
  const seatSize = width < 360 ? 36 : width < 430 ? 40 : 45;
  const seatGap = width < 360 ? 6 : 8;
  const aisleWidth = width < 360 ? 14 : 20;

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
    fontSize: 16,
    fontWeight: "700",
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
    fontWeight: "500",
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
    fontWeight: "600",
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.text,
  },
  detailSubtitle: {
    fontSize: 11,
    color: theme.secondaryText,
    marginTop: 4,
    fontWeight: "600",
  },
  statusCard: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBadge: {
    backgroundColor: '#2F6BFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: "700",
  },
  statusIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
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
    fontWeight: "600",
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
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.border,
  },
  driverLabel: {
    fontSize: 11,
    color: theme.secondaryText,
    marginTop: 6,
    marginRight:10,
    fontWeight: "600",
  },
  seatsContainer: {
    gap: 8,
    backgroundColor: theme.card,
    padding: 12,
    borderRadius: 8,
  },
  rowGroup: {
    marginBottom: 8,
  },
  seatsRowGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: seatGap,
  },
  sideSeats: {
    flexDirection: 'row',
    gap: seatGap,
    flexWrap: 'nowrap',
    justifyContent: 'center',
    flex: 1,
  },
  aisle: {
    width: aisleWidth,
  },
  backRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: seatGap,
    flexWrap: 'wrap',
  },
  backRowSpacing: {
    marginTop: 12,
  },
  seatsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  seat: {
    width: seatSize,
    height: seatSize,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 3,
  },
  seatLabel: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: "600",
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
    backgroundColor: '#EAF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerInitials: {
    fontSize: 13,
    fontWeight: "700",
    color: '#2F6BFF',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.text,
  },
  seatInfo: {
    fontSize: 11,
    color: theme.secondaryText,
    marginTop: 2,
    fontWeight: "500",
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
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  locationDetails: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: theme.secondaryText,
    fontWeight: "600",
    marginBottom: 2,
  },
  locationName: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.text,
  },
  locationTime: {
    fontSize: 10,
    color: theme.secondaryText,
    marginTop: 2,
    fontWeight: "500",
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
    fontSize: 16,
    fontWeight: "700",
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
    fontWeight: "600",
  },
  spacer: {
    height: 80,
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: theme.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  actionSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
    textAlign: 'center',
  },
  actionSheetSubtitle: {
    fontSize: 12,
    color: theme.secondaryText,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  actionSheetItemDisabled: {
    opacity: 0.4,
  },
  actionSheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionSheetItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.text,
  },
  actionSheetCancel: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionSheetCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.secondaryText,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: 'center',
    marginTop: 12,
    marginHorizontal: 32,
  },
  retryButton: {
    backgroundColor: '#2F6BFF',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: "700",
  },
  noSeatsText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: 'center',
    paddingVertical: 20,
  },
  selectedSeat: {
    borderWidth: 3,
    borderColor: '#2F6BFF',
  },
  });
};

