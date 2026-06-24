import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';  
import { MaterialCommunityIcons } from '@expo/vector-icons'; 
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; 
import { apiUrl } from '@/config/env';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import DriverRouteMap from '@/components/DriverRouteMap';
import {
  getLatestBusLocation,
  publishDriverLocation,
  type LiveBusLocation,
} from '@/services/trackingApi';
import { resolveAssetUrl } from '@/utils/media';
import {
  formatStopEta,
  getOrderedStops,
  getStopsWithCoordinates,
  type RouteGeometry,
  type RouteStop,
} from '@/utils/routeNavigation';

const DRIVER_SHARE_LOCATION_KEY = 'driverShareLocation';

interface DriverProfile { 
  firstName?: string;
  lastName?: string;
  profilePhoto?: string | null;
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

type LocationSharingStatus = 'idle' | 'active' | 'disabled' | 'permission-denied' | 'error';

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
  const [shareLocationEnabled, setShareLocationEnabled] = useState(true);
  const [locationSharingStatus, setLocationSharingStatus] =
    useState<LocationSharingStatus>('idle');
  const earningsPulseOpacity = useRef(new Animated.Value(0.45)).current;
  const livePulseOpacity = useRef(new Animated.Value(1)).current;

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
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(earningsPulseOpacity, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(earningsPulseOpacity, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [earningsPulseOpacity]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      AsyncStorage.getItem(DRIVER_SHARE_LOCATION_KEY)
        .then((value) => {
          if (isActive) {
            setShareLocationEnabled(value !== 'false');
          }
        })
        .catch((error) => {
          console.warn('Failed to load location sharing preference:', error);
        });

      return () => {
        isActive = false;
      };
    }, [])
  );

  const fetchDashboardData = useCallback(async () => {
    if (!user?.userId || !user?.token) {
      setIsLoadingTrip(false);
      return;
    }

    try {
      setIsLoadingTrip(true);

      const response = await fetch(
        apiUrl(`/api/drivers/${user.userId}/profile-and-assignment`),
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

      const result = await response.json();
      if (!(result.success && result.data?.profile)) {
        throw new Error(result.message || 'Failed to load dashboard data');
      }

      const profile = result.data.profile as DriverProfile;
      const currentAssignment = result.data.assignment ?? null;
      setProfileData(profile);
      setAssignment(currentAssignment);

      if (profile.firstName) {
        setFirstName(profile.firstName);
      }

      const routeId = currentAssignment?.routeId;
      const busNumber = currentAssignment?.busNumber;

      if (routeId) {
        const geometryResponse = await fetch(apiUrl(`/api/tracking/routes/${routeId}/geometry`), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        });

        if (geometryResponse.ok) {
          const geometryResult = await geometryResponse.json();
          setRouteGeometry(geometryResult.data ?? null);
        } else {
          setRouteGeometry(null);
        }
      } else {
        setRouteGeometry(null);
      }

      if (busNumber) {
        const latestLocation = await getLatestBusLocation(user.token, busNumber);
        setLiveBusLocation(latestLocation);
      } else {
        setLiveBusLocation(null);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoadingTrip(false);
    }
  }, [user?.token, user?.userId]);

  useFocusEffect(
    useCallback(() => {
      void fetchDashboardData();
    }, [fetchDashboardData])
  );

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let isCancelled = false;
    const busNumber = assignment?.busNumber;

    if (!busNumber || !user?.token) {
      setLocationSharingStatus('idle');
      return;
    }

    if (!shareLocationEnabled) {
      setLocationSharingStatus('disabled');
      return;
    }

    const publishLocation = async (location: Location.LocationObject) => {
      const payload: LiveBusLocation = {
        busNumber,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: Date.now(),
      };

      setLiveBusLocation(payload);

      try {
        const publishedLocation = await publishDriverLocation(user.token, payload);

        if (!isCancelled) {
          setLiveBusLocation(publishedLocation);
          setLocationSharingStatus('active');
        }
      } catch (error) {
        console.warn('Failed to publish live driver location:', error);
        if (!isCancelled) {
          setLocationSharingStatus('error');
        }
      }
    };

    const startLocationSharing = async () => {
      try {
        const currentPermission = await Location.getForegroundPermissionsAsync();
        const permission = currentPermission.granted
          ? currentPermission
          : await Location.requestForegroundPermissionsAsync();

        if (isCancelled) return;

        if (permission.status !== 'granted') {
          setLocationSharingStatus('permission-denied');
          return;
        }

        setLocationSharingStatus('active');

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!isCancelled) {
          await publishLocation(currentLocation);
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (location) => {
            void publishLocation(location);
          }
        );
      } catch (error) {
        console.warn('Unable to start driver location sharing:', error);
        if (!isCancelled) {
          setLocationSharingStatus('error');
        }
      }
    };

    void startLocationSharing();

    return () => {
      isCancelled = true;
      subscription?.remove();
    };
  }, [assignment?.busNumber, shareLocationEnabled, user?.token]);

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
  const profilePhotoUri = resolveAssetUrl(profileData?.profilePhoto);
  const orderedStops = useMemo(
    () => getOrderedStops(routeGeometry?.stops ?? []),
    [routeGeometry?.stops]
  );
  const coordinateStopCount = getStopsWithCoordinates(orderedStops).length;
  const routeStart = orderedStops[0]?.name ?? routeGeometry?.startLocation;
  const routeEnd = orderedStops[orderedStops.length - 1]?.name ?? routeGeometry?.endLocation;
  const routeDisplay =
    routeStart && routeEnd
      ? `${routeStart} -> ${routeEnd}`
      : assignment?.routeName ?? 'No current route';

  const trackingStatusText = getTrackingStatusText(locationSharingStatus, liveBusLocation);
  const isTripLive = getTripLiveStatus(locationSharingStatus, liveBusLocation);

  useEffect(() => {
    if (!isTripLive) {
      livePulseOpacity.stopAnimation();
      livePulseOpacity.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulseOpacity, {
          toValue: 0.2,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(livePulseOpacity, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [isTripLive, livePulseOpacity]);
    

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

  const handleNavigation = () => {
    if (!assignment?.routeId && !routeGeometry) {
      Alert.alert('No Route Available', 'No route information available for navigation.');
      return;
    }

    router.push('/navigation');
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
                {profilePhotoUri ? (
                  <Image source={{ uri: profilePhotoUri }} style={styles.avatarImage} />
                ) : (
                  <MaterialCommunityIcons
                    name="account"
                    size={isSmallPhone ? 24 : 28}
                    color="#0066FF"
                  />
                )}
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

              <View style={styles.earningsIndicator}>
                <Animated.View
                  style={[styles.earningsPulseDot, { opacity: earningsPulseOpacity }]}
                />
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
              <View
                style={[
                  styles.liveStatusPill,
                  isTripLive ? styles.liveStatusPillActive : styles.liveStatusPillInactive,
                ]}
              >
                <Animated.View
                  style={[
                    styles.liveStatusDot,
                    isTripLive ? styles.liveStatusDotActive : styles.liveStatusDotInactive,
                    isTripLive ? { opacity: livePulseOpacity } : null,
                  ]}
                />
                <Text
                  style={[
                    styles.liveStatusText,
                    isTripLive ? styles.liveStatusTextActive : styles.liveStatusTextInactive,
                  ]}
                >
                  {isTripLive ? 'Live' : 'Not Live'}
                </Text>
              </View>
            </View>

            <View style={styles.mapContainer}>
              <DriverRouteMap
                stops={routeGeometry?.stops ?? []}
                liveBusLocation={liveBusLocation}
                loading={isLoadingTrip}
                darkMode={darkMode}
              />

              <TouchableOpacity
                style={styles.mapOpenButton}
                onPress={handleNavigation}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="google-maps" size={15} color="#FFFFFF" />
                <Text style={styles.mapOpenButtonText}>Map View</Text>
              </TouchableOpacity>

              <View style={styles.inTransitBadge}>
                <MaterialCommunityIcons name="play" size={12} color={theme.text} />
                <Text style={styles.inTransitText}>{trackingStatusText}</Text>
              </View>
            </View>

            <View style={[styles.tripDetails, isCompact && styles.tripDetailsStack]}>
              <View style={styles.routeContainer}>
                <Text style={styles.routeText} numberOfLines={1}>
                  {routeDisplay}
                </Text>
                {orderedStops.length > 0 ? (
                  <View style={styles.stopsBlock}>
                    <View style={styles.stopsHeader}>
                      <Text style={styles.stopsTitle}>Route Stops</Text>
                      <Text style={styles.stopsCount}>
                        {coordinateStopCount}/{orderedStops.length} mapped
                      </Text>
                    </View>

                    <ScrollView
                      horizontal
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.stopsTrack}
                    >
                      {orderedStops.map((stop, index) => {
                        const eta = formatStopEta(stop);

                        return (
                          <View
                            key={`${stop.name}-${index}`}
                            style={[
                              styles.stopChip,
                              index === 0 && styles.stopChipStart,
                              index === orderedStops.length - 1 && styles.stopChipEnd,
                            ]}
                          >
                            <View style={styles.stopNumber}>
                              <Text style={styles.stopNumberText}>{index + 1}</Text>
                            </View>
                            <Text style={styles.stopName} numberOfLines={1}>
                              {stop.name}
                            </Text>
                            {eta ? <Text style={styles.stopEta}>{eta}</Text> : null}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                ) : (
                  <Text style={styles.emptyStopsText}>Stops not loaded from route database</Text>
                )}
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
                onPress={handleNavigation}
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
      overflow: 'hidden',
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    greetingText: {
      flex: 1,
      minWidth: 0,
    },
    greetingTitle: {
      fontSize: isSmallPhone ? 14 : 15,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: 0,
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
    earningsIndicator: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#EAF2FF',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    earningsPulseDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: '#0066FF',
    },
    earningsAmount: {
      fontSize: isSmallPhone ? 22 : 26,
      fontWeight: '700',
      color: theme.text,
      marginVertical: 8,
      letterSpacing: 0,
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
    liveStatusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
    },
    liveStatusPillActive: {
      backgroundColor: '#ECFDF3',
      borderColor: '#BBF7D0',
    },
    liveStatusPillInactive: {
      backgroundColor: '#FEF2F2',
      borderColor: '#FECACA',
    },
    liveStatusDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    liveStatusDotActive: {
      backgroundColor: '#16A34A',
    },
    liveStatusDotInactive: {
      backgroundColor: '#DC2626',
    },
    liveStatusText: {
      fontSize: 11,
      fontWeight: '800',
    },
    liveStatusTextActive: {
      color: '#15803D',
    },
    liveStatusTextInactive: {
      color: '#B91C1C',
    },
    mapContainer: {
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 16,
      height: mapHeight,
      position: 'relative',
      backgroundColor: '#E0E7FF',
    },
    mapOpenButton: {
      position: 'absolute',
      top: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#0066FF',
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 20,
    },
    mapOpenButtonText: {
      fontSize: 11,
      color: '#FFFFFF',
      fontWeight: '700',
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
    stopsBlock: {
      marginTop: 8,
      marginBottom: 16,
    },
    stopsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 8,
    },
    stopsTitle: {
      fontSize: 10,
      color: theme.secondaryText,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    stopsCount: {
      fontSize: 10,
      color: '#64748B',
      fontWeight: '700',
    },
    stopsTrack: {
      gap: 10,
      paddingRight: 8,
      paddingBottom: 3,
    },
    stopChip: {
      minWidth: 88,
      maxWidth: 112,
      minHeight: 44,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    stopChipStart: {
      borderColor: '#86EFAC',
    },
    stopChipEnd: {
      borderColor: '#FCA5A5',
    },
    stopNumber: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#0066FF',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    stopNumberText: {
      fontSize: 8,
      color: '#FFFFFF',
      fontWeight: '800',
    },
    stopName: {
      fontSize: 10,
      color: theme.text,
      fontWeight: '700',
    },
    stopEta: {
      fontSize: 9,
      color: theme.secondaryText,
      fontWeight: '700',
      marginTop: 2,
    },
    emptyStopsText: {
      fontSize: 11,
      color: theme.secondaryText,
      fontWeight: '600',
      marginBottom: 8,
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

function getTrackingStatusText(
  status: LocationSharingStatus,
  liveBusLocation: LiveBusLocation | null
) {
  if (status === 'active') return 'Live sharing';
  if (status === 'disabled') return 'Sharing off';
  if (status === 'permission-denied') return 'Location denied';
  if (status === 'error') return 'Tracking retrying';
  return liveBusLocation ? 'Live Route' : 'Assigned Route';
}

function getTripLiveStatus(
  status: LocationSharingStatus,
  liveBusLocation: LiveBusLocation | null
) {
  if (!liveBusLocation) return false;
  return status !== 'disabled' && status !== 'permission-denied' && status !== 'error';
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
