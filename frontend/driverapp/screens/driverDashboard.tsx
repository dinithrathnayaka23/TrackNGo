import React, { useEffect, useMemo, useState } from 'react'; 
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Linking, // Import Linking to go to google maps
} from 'react-native';  
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; 
import { useUser } from '@/context/UserContext';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DriverProfile { 
  averageRating: number;
  driverEarnings: number;
}

interface DriverAssignment {
  busNumber: string;
  busBrand: string;
  registrationNumber: string;
  routeId: number | null;
  routeName?: string | null;
  startTime?: string;
  endTime?: string;
  seatCapacity?: number;
}

interface RouteStop {
  name: string;
  latitude: number | null;
  longitude: number | null;
  estimatedArrivalMins?: number | null;
}

interface RouteGeometry {
  routeId: number;
  routeName: string;
  startLocation: string;
  endLocation: string;
  stops: RouteStop[];
}

interface LiveBusLocation {
  busNumber: string;
  latitude: number;
  longitude: number;
}

interface RoutePoint { //represents a point on the route
  name: string;
  x: number;
  y: number;
  isBus?: boolean;
}

export default function DriverDashboardScreen() { 
  const { user } = useUser(); // Accessing user information from the user context
  const router = useRouter(); 
  const { width } = useWindowDimensions(); //responsive design
  const insets = useSafeAreaInsets(); //ensure content is not hidden behind notches or system UI elements
  const { darkMode } = useTheme(); // Accessing the theme context 
  const [firstName, setFirstName] = useState('Driver'); 
  const [profileData, setProfileData] = useState<DriverProfile | null>(null); 
  const [assignment, setAssignment] = useState<DriverAssignment | null>(null); 
  const [routeGeometry, setRouteGeometry] = useState<RouteGeometry | null>(null); 
  const [liveBusLocation, setLiveBusLocation] = useState<LiveBusLocation | null>(null); 
  const [isLoadingTrip, setIsLoadingTrip] = useState(true); 
  const [stopsWithCoordinates, setStopsWithCoordinates] = useState<RouteStop[]>([]); 
  const [waypoints, setWaypoints] = useState<string>(''); // Store the waypoints string for Google Maps URL

  useEffect(() => {                         
    const loadUser = async () => { 
      const userStr = await AsyncStorage.getItem('user'); // retrieve the 'user' item from AsyncStorage
      if (!userStr) return; 

      const storedUser = JSON.parse(userStr); // string to js obj
      const name =
        storedUser.firstName ||
        storedUser.fullName ||
        storedUser.email?.split('@')[0] || 
        'Driver'; 
      setFirstName(name); 
    };
    

    loadUser(); 
  }, []); //every refresh

  useEffect(() => {      
    const fetchDashboardData = async () => { 
      if (!user?.userId || !user?.token) { 
        setIsLoadingTrip(false); // user data is not available
        return;
      }

      try {
        const response = await fetch(
          `http://10.233.234.185:8080/api/drivers/${user.userId}/profile-and-assignment`, 
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${user.token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
        }

        const result = await response.json();  // Parse the JSON response from the API call to an object. 
        console.log("API FULL RESPONSE", result);
        if (!(result.success && result.data?.profile)) { 
          throw new Error(result.message || 'Failed to load dashboard data');
        }

        setProfileData(result.data.profile);    
        setAssignment(result.data.assignment ?? null);  

        const routeId = result.data.assignment?.routeId; 
        const busNumber = result.data.assignment?.busNumber;  
        console.log('Dashboard Data - routeId:', routeId, 'busNumber:', busNumber);  

        if (routeId) {
          const geometryResponse = await fetch(
            `http://10.233.234.185:8080/api/tracking/routes/${routeId}/geometry`, // Make an API call to fetch the geometry of the route using the extracted route ID. 
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${user.token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          console.log('Route geometry response status:', geometryResponse.status); 

          if (geometryResponse.ok) {
            const geometryResult = await geometryResponse.json(); // Parse the JSON response to get the route geometry data. This should include the start and end locations, as well as the stops along the route with their coordinates and estimated arrival times. The geometry data will be used to display the route on the map and calculate ETAs.
            console.log('Route geometry result:', geometryResult); 
            setRouteGeometry(geometryResult.data ?? null); 
          } else {
            const errorText = await geometryResponse.text();
            console.error('Route geometry error:', geometryResponse.status, errorText);
            setRouteGeometry(null);
          }
        } else {
          console.warn('No routeId in assignment');
          setRouteGeometry(null);
        }

        if (busNumber) {
          const liveLocationResponse = await fetch(
            `http://10.233.234.185:8080/api/tracking/live-location/${encodeURIComponent(busNumber)}`, //encodeURIComponent(busNumber) is used to encode the bus number in the URL.
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${user.token}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (liveLocationResponse.ok) {
            const liveLocationResult = await liveLocationResponse.json();
            setLiveBusLocation(liveLocationResult.data ?? null); 
          }
        } else {
          setLiveBusLocation(null);
        }
      } catch (error) { 
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoadingTrip(false);
      }
    };

    fetchDashboardData();         
  }, [user?.token, user?.userId]);  // useEffect 

  useEffect(() => {
  if (!routeGeometry?.stops) return; // If there are no stops in the route geometry, exit early

  const waypointNames = routeGeometry.stops // Extract the names of the stops from the route geometry
    .map((stop) => stop.name) // Get the name property of each stop
    .join(' → ');

  setWaypoints(waypointNames); //update the waypoints in useState
}, [routeGeometry]); 

  const isSmallPhone = width < 360;  
  const isCompact = width < 390;  
  const horizontalPadding = isSmallPhone ? 14 : 16; 
  const contentWidth = Math.min(width - horizontalPadding * 2, 560);  // Calculate the content width by taking the window width and subtracting the horizontal padding on both sides, while also capping it at a maximum of 560 pixels 
  const mapHeight = Math.max(150, Math.min(contentWidth * 0.42, 220)); // Calculate the map height by taking the content width and multiplying it by a ratio of 0.42. This will ensure that the map is at least 150 pixels tall and never exceeds 220 pixels.

  const todayLabel = useMemo(  
    () =>
      new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
      }),
    []
  );

  const ratingValue = profileData?.averageRating ?? 0;  
  const roundedRating = Math.round(ratingValue);  
  const earningsAmount = profileData?.driverEarnings ?? 0;  

  const routePoints = useMemo( // useMemo to memoize the route points calculation
    () => buildRoutePoints(routeGeometry?.stops ?? [], contentWidth, mapHeight, liveBusLocation),
    [routeGeometry?.stops, contentWidth, mapHeight, liveBusLocation] // useMemo to memoize the route points calculation based on the route geometry, content width, map height, and live bus location.
  ); 
  const routeDisplay = routeGeometry
    ? `${routeGeometry.startLocation} -> ${routeGeometry.endLocation}`
    : assignment?.routeName ?? 'No current route';
    

  const etaText = getEtaText(routeGeometry?.stops ?? []); 
  const passengerText = assignment?.seatCapacity ? `0/${assignment.seatCapacity} Pax` : 'No passenger data'; 

  const theme = {
    background: darkMode ? '#111' : '#F5F5F5',
    card: darkMode ? '#1E1E1E' : '#FFF',
    text: darkMode ? '#FFF' : '#000',
    secondaryText: darkMode ? '#AAA' : '#666',
    border: darkMode ? '#333' : '#E0E0E0',
  };

  const styles = useMemo( // useMemo to create the styles 
    () =>
      createStyles({
        horizontalPadding,
        mapHeight,
        bottomInset: insets.bottom, //bottom inset is the height of the bottom navigation bar
        isSmallPhone,
        theme,
      }),
    [horizontalPadding, mapHeight, insets.bottom, isSmallPhone, darkMode]
  );

  const handleNavigate = () => {  
    Alert.alert( 'Navigation integration is not connected yet.');
  };

  const handleMapPress = async () => {  // Function to handle when the map is pressed. This will attempt to open Google Maps with the route from the current trip. It checks if route geometry is available and constructs a Google Maps URL with the stops as waypoints. If no coordinates are available, it falls back to using location names. It also includes error handling for cases where Google Maps cannot be opened.
    console.log('Map pressed - routeGeometry:', routeGeometry);
    
    if (!routeGeometry) {
      Alert.alert('No Route Available', 'No route information available for navigation.');
      return; //
    }

    try {
      // Get all stops with valid coordinates
      const stopsWithCoordinates = (routeGeometry.stops || []).filter( 
        (stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number' 
      ); // Filter out stops without valid coordinates

      console.log('Stops with coordinates:', stopsWithCoordinates);


      if (stopsWithCoordinates.length === 0) {
        // Fallback to location names if no coordinates available
        console.log('No stops with coordinates, using location names');
        const startLocation = encodeURIComponent(routeGeometry.startLocation); //make sure to encode the location names, beocze they can contain special characters
        const endLocation = encodeURIComponent(routeGeometry.endLocation);
        const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${startLocation}&destination=${endLocation}&travelmode=driving`; // Construct a Google Maps URL using the start and end location names if no coordinates are available. This will allow the user to still navigate to the general area of the route, even if we don't have precise coordinates for the stops. We encode the location names to ensure they are properly formatted for a URL.

        console.log('Google Maps URL (names):', googleMapsUrl);

        const supported = await Linking.canOpenURL(googleMapsUrl);
        if (supported) {
          await Linking.openURL(googleMapsUrl);
        } else {
          Alert.alert('Error', 'Unable to open Google Maps. Please make sure Google Maps is installed.');
        }
        return;
      }

      // Build URL with coordinates and waypoints
      const origin = `${stopsWithCoordinates[0].latitude},${stopsWithCoordinates[0].longitude}`;
      const destination = `${stopsWithCoordinates[stopsWithCoordinates.length - 1].latitude},${stopsWithCoordinates[stopsWithCoordinates.length - 1].longitude}`;
      
      // Add intermediate stops as waypoints
      const waypoints = stopsWithCoordinates
        .slice(1, -1)
        .map((stop) => stop.name)
        .join(' → '); // Construct the waypoints parameter by taking all stops except the first and last

      console.log('Origin:', origin);
      console.log('Destination:', destination);
      console.log('Waypoints:', waypoints);
      setWaypoints(waypoints); // Store stops with coordinates in state for potential use elsewhere in the component


      let googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
      
      if (waypoints) {
        googleMapsUrl += `&waypoints=${waypoints}`; // If there are waypoints, add them to the Google Maps URL.
      }

      console.log('Google Maps URL (coordinates):', googleMapsUrl);

      const supported = await Linking.canOpenURL(googleMapsUrl);
      if (supported) {
        console.log('Opening Google Maps...');
        await Linking.openURL(googleMapsUrl);
      } else {
        Alert.alert('Error', 'Unable to open Google Maps. Please make sure Google Maps is installed.');
      }
    } catch (error) {
      console.error('Error opening Google Maps:', error);
      Alert.alert('Error', 'Failed to open Google Maps navigation.');
    }
  };

  const handleDetails = () => {
    router.push('/allocations');
  };

  const handleNotifications = () => {
    Alert.alert('Notifications', 'Loading notifications...');
  };

  const handleProfilePress = () => {
    router.push('/settings');
  };

  const handleEarningsPress = () => {
    router.push('/earnings');
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false} 
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={styles.headerContainer}>
            <View style={styles.greetingContainer}>
              <TouchableOpacity style={styles.avatarPlaceholder} onPress={handleProfilePress}>
                <MaterialCommunityIcons
                  name="account"
                  size={isSmallPhone ? 24 : 28}
                  color="#0066FF"
                />
              </TouchableOpacity>

              <View style={styles.greetingText}>
                <Text style={styles.greetingTitle} numberOfLines={1}>
                  Hello, {firstName}
                </Text>

                <View style={styles.dateContainer}>
                  <MaterialCommunityIcons name="calendar" size={14} color="#999" />
                  <Text style={styles.dateText}>{todayLabel}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.notificationIcon} onPress={handleNotifications}>
              <MaterialCommunityIcons name="bell" size={22} color={theme.text} />
              <View style={styles.notificationBadge} />
            </TouchableOpacity>
          </View>

          <View style={styles.ratingContainer}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((i) => ( // Render 5 stars and set color based on rounded rating
                <MaterialCommunityIcons
                  key={i}
                  name="star"
                  size={18}
                  color={i <= roundedRating ? '#FFD700' : '#D3D3D3'} // Yellow for filled stars, gray for empty stars
                />
              ))}
            </View>
            <Text style={styles.ratingText}>{ratingValue.toFixed(1)}/5.0</Text> 
          </View>

          <TouchableOpacity style={styles.card} onPress={handleEarningsPress} activeOpacity={0.9}>
            <View style={styles.earningsHeader}>
              <Text style={styles.sectionLabel}>Monthly Earnings</Text>

              <View style={styles.chartPlaceholder}>
                <View style={styles.chartSegment} />
              </View>
            </View>

            <Text style={styles.earningsAmount}>
              LKR{' '}
              {earningsAmount.toLocaleString('en-US', { // Format earnings amount with commas and 2 decimal places
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>

            <View style={styles.growthContainer}>
              <MaterialCommunityIcons name="trending-up" size={16} color="#00AA00" />
              <Text style={styles.growthText}>5% vs yesterday</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.tripHeader}>
              <Text style={styles.sectionTitle}>Current Trip</Text>
              <TouchableOpacity>
                <Text style={styles.liveButton}>Live</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.mapContainer} onPress={handleMapPress} activeOpacity={0.9}>
              {routePoints.length > 0 ? (
                <View style={styles.routeMapSurface}>
                  {routePoints.slice(0, -1).map((point, index) => { // Render route segments and bus stops, slice off the last point coz it has no next point
                    const nextPoint = routePoints[index + 1]; // Get the next point
                    const segment = buildSegmentStyle(point, nextPoint); // Build the segment style means calculate the angle

                    return ( // this will return a view for each segment
                      <View
                        key={`segment-${index}`} 
                        style={[
                          styles.routeSegment,
                          {
                            left: segment.left,
                            top: segment.top,
                            width: segment.length,
                            transform: [{ rotateZ: `${segment.angle}deg` }], // Rotate the segment based on its angle
                          },
                        ]}
                      />
                    );
                  })}

                  {routePoints.map((point, index) => (
                    <View
                      key={`${point.name}-${index}`}
                      style={[
                        styles.routeStop,
                        point.isBus && styles.routeBusStop,
                        {
                          left: point.x - (point.isBus ? 8 : 5),
                          top: point.y - (point.isBus ? 8 : 5),
                        },
                      ]}
                    />
                  ))}

                  <View style={styles.mapLegend}>
                    <Text style={styles.mapLegendText}>
                      {liveBusLocation ? 'Live bus position shown in blue' : 'Assigned route stop layout'} • Tap to navigate
                    </Text>
                  </View>
                </View>
              ) : isLoadingTrip ? (
                <View style={styles.mapState}>
                  <ActivityIndicator size="small" color="#0066FF" />
                  <Text style={styles.mapStateText}>Loading route map...</Text>
                </View>
              ) : (
                <View style={styles.mapState}>
                  <MaterialCommunityIcons name="map-marker-path" size={28} color="#94A3B8" />
                  <Text style={styles.mapStateText}>No route map available</Text>
                </View>
              )}

              <View style={styles.inTransitBadge}>
                <MaterialCommunityIcons name="play" size={12} color={theme.text} />
                <Text style={styles.inTransitText}>
                  {liveBusLocation ? 'Live Route' : 'Assigned Route'} 
                </Text>
              </View>
            </TouchableOpacity>

            <View style={[styles.tripDetails, isCompact && styles.tripDetailsStack]}>
              <View style={styles.routeContainer}>
                <Text style={styles.routeText} numberOfLines={1}>
                  {routeDisplay}
                </Text>
                <Text style={styles.waypointText}>{waypoints}</Text>
                <Text style={styles.etaLabel}>ETA</Text>
                <Text style={styles.etaTime}>{etaText}</Text>
              </View>

              <View style={[styles.passengerContainer, isCompact && styles.passengerCompact]}>
                <MaterialCommunityIcons name="account-multiple" size={20} color={theme.text} />
                <Text style={styles.passengerText}>{passengerText}</Text>
              </View>
            </View>

            <View style={[styles.actionButtons, isSmallPhone && styles.actionButtonsStack]}>
              <TouchableOpacity
                style={[styles.detailsButton, isSmallPhone && styles.fullWidthButton]}
                onPress={handleDetails}
              >
                <MaterialCommunityIcons name="eye" size={20} color="#0066FF" />
                <Text style={styles.detailsButtonText}>Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.navigateButton, isSmallPhone && styles.fullWidthButton]}
                onPress={handleNavigate}
              >
                <MaterialCommunityIcons name="navigation" size={20} color="#FFF" />
                <Text style={styles.navigateButtonText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Quick Stats</Text>

            <View style={[styles.statsContainer, isSmallPhone && styles.statsStack]}>
              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#00AA00" />
                </View>
                <Text style={styles.statNumber}>3</Text>
                <Text style={styles.statLabel}>Trips Done</Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  styles.statCardSecondary,
                  isSmallPhone && styles.statCardStackSpacing,
                ]}
              >
                <View style={styles.statIcon}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#0066FF" />
                </View>
                <Text style={styles.statNumber}>5</Text>
                <Text style={styles.statLabel}>Total Trips</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles({
  horizontalPadding,
  mapHeight,
  bottomInset,
  isSmallPhone,
  theme,
}: {
  horizontalPadding: number;
  mapHeight: number;
  bottomInset: number;
  isSmallPhone: boolean;
  theme: any;
}) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      paddingBottom: Math.max(24, bottomInset + 16),
    },
    content: {
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: horizontalPadding,
      paddingVertical: 16,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    greetingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      minWidth: 0,
      marginRight: 12,
    },
    avatarPlaceholder: {
      width: isSmallPhone ? 42 : 48,
      height: isSmallPhone ? 42 : 48,
      borderRadius: 999,
      backgroundColor: '#E3F2FD',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      flexShrink: 0,
    },
    greetingText: {
      flex: 1,
      minWidth: 0,
    },
    greetingTitle: {
      fontSize: isSmallPhone ? 14 : 15,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.3,
    },
    dateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    dateText: {
      fontSize: 11,
      color: '#999',
      marginLeft: 4,
      fontWeight: '500',
    },
    notificationIcon: {
      position: 'relative',
      padding: 8,
      flexShrink: 0,
    },
    waypointText:{
      fontSize: 12,
      color: '#334155',
      fontWeight: '500',
      marginBottom: 4,
    },
    notificationBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#0066FF',
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: horizontalPadding,
      marginTop: 12,
      marginBottom: 8,
    },
    stars: {
      flexDirection: 'row',
      marginRight: 8,
    },
    ratingText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    card: {
      marginHorizontal: horizontalPadding,
      marginTop: 12,
      padding: 16,
      backgroundColor: theme.card,
      borderRadius: 12,
    },
    earningsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      gap: 12,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      flexShrink: 1,
    },
    chartPlaceholder: {
      width: isSmallPhone ? 44 : 50,
      height: isSmallPhone ? 44 : 50,
      borderRadius: 999,
      backgroundColor: '#E0E7FF',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    chartSegment: {
      width: isSmallPhone ? 34 : 40,
      height: isSmallPhone ? 34 : 40,
      borderRadius: 999,
      backgroundColor: '#0066FF',
    },
    earningsAmount: {
      fontSize: isSmallPhone ? 22 : 26,
      fontWeight: '700',
      color: theme.text,
      marginVertical: 8,
      letterSpacing: -0.5,
    },
    growthContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    growthText: {
      fontSize: 11,
      color: '#00AA00',
      fontWeight: '600',
      marginLeft: 6,
    },
    tripHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    liveButton: {
      fontSize: 11,
      fontWeight: '700',
      color: '#0066FF',
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    mapContainer: {
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
      height: mapHeight,
      position: 'relative',
      backgroundColor: '#E0E7FF',
    },
    routeMapSurface: {
      flex: 1,
      backgroundColor: '#ECF5FF',
    },
    routeSegment: {
      position: 'absolute',
      height: 3,
      backgroundColor: '#60A5FA',
      borderRadius: 999,
    },
    routeStop: {
      position: 'absolute',
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#1D4ED8',
      borderWidth: 2,
      borderColor: '#DBEAFE',
    },
    routeBusStop: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#0066FF',
      borderWidth: 3,
      borderColor: '#FFFFFF',
    },
    mapLegend: {
      position: 'absolute',
      top: 12,
      left: 12,
      right: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: 'rgba(255,255,255,0.88)',
    },
    mapLegendText: {
      fontSize: 11,
      color: '#334155',
      fontWeight: '600',
    },
    mapState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    mapStateText: {
      fontSize: 12,
      color: '#64748B',
      fontWeight: '600',
    },
    inTransitBadge: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    inTransitText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: '600',
      marginLeft: 6,
    },
    tripDetails: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      gap: 12,
    },
    tripDetailsStack: {
      alignItems: 'flex-start',
      flexDirection: 'column',
    },
    routeContainer: {
      flex: 1,
      minWidth: 0,
    },
    routeText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
    },
    etaLabel: {
      fontSize: 10,
      color: '#999',
      fontWeight: '600',
    },
    etaTime: {
      fontSize: 13,
      fontWeight: '700',
      color: '#0066FF',
    },
    passengerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flexShrink: 0,
    },
    passengerCompact: {
      marginTop: 4,
    },
    passengerText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      marginLeft: 6,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButtonsStack: {
      flexDirection: 'column',
    },
    fullWidthButton: {
      width: '100%',
    },
    detailsButton: {
      flex: 1,
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: '#0066FF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    detailsButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#0066FF',
      marginLeft: 6,
    },
    navigateButton: {
      flex: 1,
      flexDirection: 'row',
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: '#0066FF',
      justifyContent: 'center',
      alignItems: 'center',
    },
    navigateButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: '#FFF',
      marginLeft: 6,
    },
    statsSection: {
      marginHorizontal: horizontalPadding,
      marginTop: 12,
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 12,
    },
    statsStack: {
      flexDirection: 'column',
    },
    statCard: {
      flex: 1,
      padding: 16,
      backgroundColor: theme.card,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statCardSecondary: {
      backgroundColor: theme.card,
    },
    statCardStackSpacing: {
      marginTop: 0,
    },
    statIcon: {
      marginBottom: 8,
    },
    statNumber: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
      marginVertical: 4,
    },
    statLabel: {
      fontSize: 11,
      color: '#999',
      fontWeight: '600',
      textAlign: 'center',
    },
  });
}

function buildRoutePoints(
  stops: RouteStop[],
  width: number,
  height: number,
  liveBusLocation: LiveBusLocation | null
): RoutePoint[] {
  const validStops = stops.filter(
    (stop) => typeof stop.latitude === 'number' && typeof stop.longitude === 'number'
  ) as Array<RouteStop & { latitude: number; longitude: number }>;

  if (validStops.length === 0) {
    return [];
  }

  const latitudes = validStops.map((stop) => stop.latitude);
  const longitudes = validStops.map((stop) => stop.longitude);

  if (liveBusLocation) {
    latitudes.push(liveBusLocation.latitude);
    longitudes.push(liveBusLocation.longitude);
  }

  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;
  const padding = 18;
  const innerWidth = Math.max(width - padding * 2, 10);
  const innerHeight = Math.max(height - padding * 2, 10);

  const points: RoutePoint[] = validStops.map((stop) => ({
    name: stop.name,
    x: padding + ((stop.longitude - minLng) / lngRange) * innerWidth,
    y: padding + (1 - (stop.latitude - minLat) / latRange) * innerHeight,
  }));

  if (liveBusLocation) {
    points.push({
      name: liveBusLocation.busNumber,
      x: padding + ((liveBusLocation.longitude - minLng) / lngRange) * innerWidth,
      y: padding + (1 - (liveBusLocation.latitude - minLat) / latRange) * innerHeight,
      isBus: true,
    });
  }

  return points;
}

function buildSegmentStyle(start: RoutePoint, end: RoutePoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  return {
    left: start.x,
    top: start.y,
    length: Math.sqrt(dx * dx + dy * dy),
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

function getEtaText(stops: RouteStop[]) {
  const validEta = stops
    .map((stop) => stop.estimatedArrivalMins)
    .filter((value): value is number => typeof value === 'number');

  if (validEta.length === 0) {
    return 'N/A';
  }

  const maxEta = Math.max(...validEta);
  const hours = Math.floor(maxEta / 60);
  const minutes = maxEta % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes} min`;
}
