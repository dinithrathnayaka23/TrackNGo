import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Alert,
} from 'react-native';

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '@/context/UserContext';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';

export default function DriverDashboardScreen() {
  const { user } = useUser();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();

  const driverName = user ? `${user.firstName} ${user.lastName}` : 'Driver';

  const isSmallPhone = width < 360;
  const isCompact = width < 390;
  const horizontalPadding = isSmallPhone ? 14 : 16;
  const contentWidth = Math.min(width - horizontalPadding * 2, 560);
  const mapHeight = Math.max(150, Math.min(contentWidth * 0.42, 220));

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
    });
  }, []);

  const theme = {
    background: darkMode ? '#111' : '#F5F5F5',
    card: darkMode ? '#1E1E1E' : '#FFF',
    text: darkMode ? '#FFF' : '#000',
    secondaryText: darkMode ? '#AAA' : '#666',
    border: darkMode ? '#333' : '#E0E0E0',
  };

  const styles = useMemo(
    () => createStyles({
      horizontalPadding,
      mapHeight,
      bottomInset: insets.bottom,
      isSmallPhone,
      theme,
    }),
    [horizontalPadding, mapHeight, insets.bottom, isSmallPhone, darkMode]
  );

  const handleNavigate = () => {
  Alert.alert('Navigate to current trip', 'Loading current trip...');
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
              <TouchableOpacity
                style={styles.avatarPlaceholder}
                onPress={handleProfilePress}
              >
                <MaterialCommunityIcons
                  name="account"
                  size={isSmallPhone ? 24 : 28}
                  color="#0066FF"
                />
              </TouchableOpacity>

              <View style={styles.greetingText}>
                <Text style={styles.greetingTitle} numberOfLines={1}>
                  Good Morning, {driverName}
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
              {[1, 2, 3, 4].map((i) => (
                <MaterialCommunityIcons key={i} name="star" size={18} color="#FFD700" />
              ))}
              <MaterialCommunityIcons name="star" size={18} color="#D3D3D3" />
            </View>
            <Text style={styles.ratingText}>4.5/5.0</Text>
          </View>

          <TouchableOpacity
              style={styles.card}
              onPress={handleEarningsPress}
              activeOpacity={0.9}
            >
            <View style={styles.earningsHeader}>
              <Text style={styles.sectionLabel}>Today's Earnings</Text>

              <View style={styles.chartPlaceholder}>
                <View style={styles.chartSegment} />
              </View>
            </View>

            <Text style={styles.earningsAmount}>LKR 12,500</Text>

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

            <View style={styles.mapContainer}>
              <Image
                source={require('@/assets/images/partial-react-logo.png')}
                style={styles.mapImage}
              />
              <View style={styles.inTransitBadge}>
                <MaterialCommunityIcons name="play" size={12} color={theme.text} />
                <Text style={styles.inTransitText}>In Transit</Text>
              </View>
            </View>

            <View style={[styles.tripDetails, isCompact && styles.tripDetailsStack]}>
              <View style={styles.routeContainer}>
                <Text style={styles.routeText} numberOfLines={1}>
                  Kandy → Colombo
                </Text>
                <Text style={styles.etaLabel}>ETA</Text>
                <Text style={styles.etaTime}>10:45 AM</Text>
              </View>

              <View style={[styles.passengerContainer, isCompact && styles.passengerCompact]}>
                <MaterialCommunityIcons name="account-multiple" size={20} color={theme.text} />
                <Text style={styles.passengerText}>42/50 Pax</Text>
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

              <View style={[styles.statCard, styles.statCardSecondary, isSmallPhone && styles.statCardStackSpacing]}>
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
    mapImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
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
