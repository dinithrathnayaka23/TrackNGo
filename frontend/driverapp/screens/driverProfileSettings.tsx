import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '@/context/UserContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export default function DriverProfileSettingsScreen() {
  const router = useRouter();
  const { user, logout } = useUser();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [completionTab, setCompletionTab] = useState('profile');
  const [shareLocation, setShareLocation] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const { darkMode, setDarkMode } = useTheme();
  const [systemNotifications, setSystemNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [bookingUpdates, setBookingUpdates] = useState(true);

  const profileCompletion = 85;
  const driverName = user ? `${user.firstName} ${user.lastName}` : 'Kamal Perera';

  const isSmallPhone = width < 360;
  const isCompact = width < 390;
  const horizontalPadding = isSmallPhone ? 14 : 16;

  const theme = {
  background: darkMode ? '#111' : '#F5F5F5',
  card: darkMode ? '#1E1E1E' : '#FFF',
  text: darkMode ? '#FFF' : '#000',
  secondaryText: darkMode ? '#AAA' : '#666',
  border: darkMode ? '#333' : '#E0E0E0',

  fontRegular: 'System',
  fontBold: 'System',
  };

  const styles = useMemo(
    () =>
      createStyles({
        horizontalPadding,
        bottomInset: insets.bottom,
        isSmallPhone,
        isCompact,
        theme,
      }),
    [horizontalPadding, insets.bottom, isSmallPhone, isCompact, darkMode]
  );
  

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Logout',
        onPress: () => {
          logout();
          router.replace('/login');
        },
      },
    ]);
  };
  
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const pickImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert('Permission Required', 'Please allow gallery access.');
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (!result.canceled) {
    setProfileImage(result.assets[0].uri);
  }
};


  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerSide} onPress={() => router.back()}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={theme.text} />
            </TouchableOpacity>

            <Text style={styles.headerTitle} numberOfLines={1}>
              Profile & Settings
            </Text>

            <View style={styles.headerSide} />
          </View>

          <View style={styles.card}>
            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                <TouchableOpacity style={styles.avatar} onPress={pickImage}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileImage} resizeMode="cover"/>
                ) : (
                  <MaterialCommunityIcons
                    name="account"
                    size={isSmallPhone ? 42 : 50}
                    color="#0066FF"
                  />
                )}
                </TouchableOpacity>
                <View style={styles.verificationBadge}>
                  <MaterialCommunityIcons name="pencil" size={20} color="#0066FF" />
                </View>
              </View>

              <Text style={styles.profileName} numberOfLines={1}>
                {driverName}
              </Text>
              <Text style={styles.profileId}>ID: DRV-082</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.completionHeader}>
              <Text style={styles.sectionTitle}>Profile Completion</Text>
              <Text style={styles.completionPercent}>{profileCompletion}%</Text>
            </View>

            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${profileCompletion}%` }]} />
            </View>

            <Text style={styles.completionSubtitle}>
              Complete your bank details to reach 100%
            </Text>

            <View style={styles.completionTabs}>
              <TouchableOpacity
                style={[
                  styles.completionTab,
                  completionTab === 'license' && styles.activeCompletionTab,
                ]}
                onPress={() => setCompletionTab('license')}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={16}
                  color={completionTab === 'license' ? '#0066FF' : '#22C55E'}
                />
                <Text
                  style={[
                    styles.completionTabText,
                    completionTab === 'license' && styles.activeCompletionTabText,
                  ]}
                >
                  License
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.completionTab,
                  completionTab === 'background' && styles.activeCompletionTab,
                ]}
                onPress={() => setCompletionTab('background')}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={16}
                  color={completionTab === 'background' ? '#0066FF' : '#22C55E'}
                />
                <Text
                  style={[
                    styles.completionTabText,
                    completionTab === 'background' && styles.activeCompletionTabText,
                  ]}
                >
                  Background
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.completionTab,
                  completionTab === 'profile' && styles.activeCompletionTab,
                ]}
                onPress={() => setCompletionTab('profile')}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={16}
                  color={completionTab === 'profile' ? '#0066FF' : '#D1D5DB'}
                />
                <Text
                  style={[
                    styles.completionTabText,
                    completionTab === 'profile' && styles.activeCompletionTabText,
                  ]}
                >
                  Profile
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Professional Details</Text>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="pencil" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Full Name</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  Kamal Perera
                </Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="email" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>E-mail Address</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  kamalperera@gmail.com
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.detailItem}
              onPress={() =>
                Alert.alert('Change Password', 'Password change screen loading...')
              }
            >
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="lock" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Change Password</Text>
                <Text style={styles.detailValue}>••••••••••</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999"/>
              </TouchableOpacity>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="phone" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Mobile Number</Text>
                <Text style={styles.detailValue}>0711356924</Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="card-account-details" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>License Number</Text>
                <Text style={styles.detailValue}>B1234567</Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="calendar" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>License Expiry</Text>
                <View style={styles.expiryContainer}>
                  <Text style={styles.detailValue}>12 Dec 2025</Text>
                  <View style={styles.validBadge}>
                    <Text style={styles.validText}>Valid</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.detailItem, styles.lastItem]}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="briefcase" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Experience</Text>
                <Text style={styles.detailValue}>8 Years</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Current Assignment</Text>

            <View style={styles.assignmentItem}>
              <MaterialCommunityIcons name="bus" size={20} color="#0066FF" />
              <View style={styles.assignmentContent}>
                <Text style={styles.detailLabel}>Trip ID</Text>
                <Text style={styles.assignmentValue}>WP-NB-1234 (Ayuband Viking)</Text>
              </View>
            </View>

            <View style={[styles.assignmentItem, styles.lastItem]}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#0066FF" />
              <View style={styles.assignmentContent}>
                <Text style={styles.detailLabel}>Route</Text>
                <Text style={styles.assignmentValue}>Colombo - Kandy</Text>
              </View>
              <Text style={styles.routeCode}>RI-01</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ratings</Text>
            <TouchableOpacity style={styles.rowButton}>
              <MaterialCommunityIcons name="star-half" size={20} color="#0066FF" />
              <Text style={styles.rowButtonText}>Reviews and Feedback</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <TouchableOpacity
              style={styles.rowButton}
              onPress={() =>
                Alert.alert(
                  'Choose Language',
                  'Select App Language',
                  [
                    { text: 'English' },
                    { text: 'Sinhala' },
                    { text: 'Tamil' },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                )
              }
            >
              <MaterialCommunityIcons name="translate" size={20} color="#0066FF" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Language</Text>
                <Text style={styles.settingValue}>English</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Privacy</Text>

            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <MaterialCommunityIcons name="map-marker" size={20} color="#0066FF" />
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchLabel}>Share Location</Text>
                  <Text style={styles.switchDescription}>Required for tracking</Text>
                </View>
              </View>
              <Switch
                value={shareLocation}
                onValueChange={setShareLocation}
                trackColor={{ false: '#E0E0E0', true: '#0066FF' }}
                thumbColor="#FFF"
              />
            </View>

            <View style={[styles.switchRow, styles.lastItem]}>
              <View style={styles.switchLeft}>
                <MaterialCommunityIcons name="shield-account" size={20} color="#0066FF" />
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchLabel}>Two-Factor Authentication</Text>
                </View>
              </View>
              <Switch
                value={twoFactor}
                onValueChange={setTwoFactor}
                trackColor={{ false: '#E0E0E0', true: '#0066FF' }}
                thumbColor="#FFF"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Support & Legal</Text>

            <TouchableOpacity style={styles.supportItem}>
              <MaterialCommunityIcons name="help-circle" size={20} color="#0066FF" />
              <Text style={styles.rowButtonText}>Help & Support</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.supportItem}  onPress={() => Alert.alert('Privacy Policy', 'Loading privacy policy...')}>
              <MaterialCommunityIcons name="lock" size={20} color="#0066FF" />
              <Text style={styles.rowButtonText}>Privacy Policy</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.supportItem} onPress={() => Alert.alert('Terms & Conditions', 'Loading terms...')}>
              <MaterialCommunityIcons name="file-document" size={20} color="#0066FF" />
              <Text style={styles.rowButtonText}>Terms & Conditions</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.supportItem, styles.lastItem]} onPress={() => Alert.alert('About Us', 'Loading company info...')}>
              <MaterialCommunityIcons name="information" size={20} color="#0066FF" />
              <Text style={styles.rowButtonText}>About Us</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Preferences</Text>

            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <MaterialCommunityIcons
                  name="moon-waning-crescent"
                  size={20}
                  color="#0066FF"
                />
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchLabel}>Light/Dark Mode</Text>
                </View>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: '#E0E0E0', true: '#0066FF' }}
                thumbColor="#FFF"
              />
            </View>

            <View style={[styles.switchRow, styles.lastItem]}>
              <View style={styles.switchLeft}>
                <MaterialCommunityIcons name="bell" size={20} color="#0066FF" />
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchLabel}>System Notifications</Text>
                </View>
              </View>
              <Switch
                value={systemNotifications}
                onValueChange={setSystemNotifications}
                trackColor={{ false: '#E0E0E0', true: '#0066FF' }}
                thumbColor="#FFF"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notifications</Text>

            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchLabel}>Push Notifications</Text>
                </View>
              </View>
              <Switch
                value={pushNotifications}
                onValueChange={setPushNotifications}
                trackColor={{ false: '#E0E0E0', true: '#0066FF' }}
                thumbColor="#FFF"
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchLabel}>SMS Alerts</Text>
                </View>
              </View>
              <Switch
                value={smsAlerts}
                onValueChange={setSmsAlerts}
                trackColor={{ false: '#E0E0E0', true: '#0066FF' }}
                thumbColor="#FFF"
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchLabel}>Email Updates</Text>
                </View>
              </View>
              <Switch
                value={emailUpdates}
                onValueChange={setEmailUpdates}
                trackColor={{ false: '#E0E0E0', true: '#0066FF' }}
                thumbColor="#FFF"
              />
            </View>

            <View style={[styles.switchRow, styles.lastItem]}>
              <View style={styles.switchLeft}>
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchLabel}>Booking Updates</Text>
                </View>
              </View>
              <Switch
                value={bookingUpdates}
                onValueChange={setBookingUpdates}
                trackColor={{ false: '#E0E0E0', true: '#0066FF' }}
                thumbColor="#FFF"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color= '#FFF' />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles({
  horizontalPadding,
  bottomInset,
  isSmallPhone,
  isCompact,
  theme,
}: {
  horizontalPadding: number;
  bottomInset: number;
  isSmallPhone: boolean;
  isCompact: boolean;
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: horizontalPadding,
      paddingVertical: 12,
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerSide: {
      width: 36,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: isSmallPhone ? 15 : 16,
      fontWeight: '700',
      color: theme.text,
      paddingHorizontal: 8,
    },
    profileSection: {
      alignItems: 'center',
      paddingVertical: 15,
      backgroundColor: theme.card,
      
    },
    avatarContainer: {
      position: 'relative',
      marginBottom: 14,
    },
    avatar: {
      width: isSmallPhone ? 68 : 76,
      height: isSmallPhone ? 68 : 76,
      borderRadius: 999,
      backgroundColor: '#E3F2FD',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    verificationBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
    },
    profileName: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 4,
      maxWidth: '80%',
    },
    profileId: {
      fontSize: 11,
      color: '#999',
      fontWeight: '500',
    },
    card: {
      marginHorizontal: horizontalPadding,
      marginVertical: 12,
      padding: 16,
      backgroundColor: theme.card,
      borderRadius: 12,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 14,
    },
    completionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    completionPercent: {
      fontSize: 15,
      fontWeight: '700',
      color: '#0066FF',
    },
    progressBar: {
      height: 5,
      backgroundColor: '#E0E0E0',
      borderRadius: 2.5,
      marginBottom: 12,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#0066FF',
      borderRadius: 2.5,
    },
    completionSubtitle: {
      fontSize: 11,
      color: '#999',
      marginBottom: 12,
      fontWeight: '500',
    },
    completionTabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    completionTab: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: '#F5F5F5',
      borderRadius: 8,
      minWidth: isCompact ? '47%' : 0,
      flexGrow: 1,
    },
    activeCompletionTab: {
      backgroundColor: '#E3F2FD',
    },
    completionTabText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#666',
    },
    activeCompletionTabText: {
      color: '#0066FF',
      fontWeight: '700',
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    lastItem: {
      borderBottomWidth: 0,
    },
    detailIcon: {
      width: 38,
      height: 38,
      borderRadius: 8,
      backgroundColor: '#F5F5F5',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    detailContent: {
      flex: 1,
      minWidth: 0,
    },
    detailLabel: {
      fontSize: 10,
      color: '#999',
      fontWeight: '600',
      marginBottom: 2,
    },
    detailValue: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
    expiryContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    validBadge: {
      backgroundColor: '#E7F5EC',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 3,
    },
    validText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#22C55E',
    },
    assignmentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    assignmentContent: {
      flex: 1,
      minWidth: 0,
    },
    assignmentValue: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
    routeCode: {
      fontSize: 10,
      fontWeight: '700',
      color: '#999',
      flexShrink: 0,
    },
    rowButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rowButtonText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
      minWidth: 0,
    },
    settingContent: {
      flex: 1,
      minWidth: 0,
    },
    settingLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    settingValue: {
      fontSize: 10,
      color: '#999',
      marginTop: 2,
      fontWeight: '500',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    switchLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
      minWidth: 0,
    },
    switchTextWrap: {
      flex: 1,
      minWidth: 0,
    },
    switchLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    switchDescription: {
      fontSize: 10,
      color: '#999',
      marginTop: 2,
      fontWeight: '500',
    },
    supportItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    logoutButton: {
      marginHorizontal: horizontalPadding,
      marginVertical: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: '#0066FF',
      backgroundColor: '#0066FF',
    },
    logoutText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFF',
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
  });
}
