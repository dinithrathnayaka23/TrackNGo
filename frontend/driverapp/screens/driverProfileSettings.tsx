import React, { useMemo, useState, useEffect } from 'react'; //important hooks
import {
  View, //like a div
  Text,
  StyleSheet, //create stylesheets
  ScrollView, //scrollable content
  TouchableOpacity, //clickable content
  Switch, //toggle on and off
  Alert, //pop msgs
  useWindowDimensions, //get screen dimensions
  ActivityIndicator, // loading screen
  Modal, //popup screen for language
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; //navigation
import { useUser } from '@/context/UserContext'; //gloablly shared user data and auth functions
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; //prevent content overlap
import * as ImagePicker from 'expo-image-picker'; // opening gallery to pick
import { Image } from 'react-native'; //why because we need to diplay dp img
import { apiUrl } from '@/config/env';
import { useTheme } from '@/context/ThemeContext'; //global theme data
import { formatDate, isLicenseExpired } from '@/utils/dateFormatter'; // Import utility functions for date formatting and license expiry checking
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveAssetUrl } from '@/utils/media';

const DRIVER_SHARE_LOCATION_KEY = 'driverShareLocation';

interface DriverProfile {  //stricture of driver profile data we get from API
  driverId: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  licenseNumber: string;
  licenceExpiry: string;
  yearsOfExperience: number;
  joinedDate: string;
  status: string;
  isVerified: boolean;
  averageRating: number;
  driverEarnings: number;
  profilePhoto?: string;
  isPhoneVerified: boolean;
  accountNumber: string;
  bankName: string;
}

interface DriverAssignment { //driver assignment data structure from api
  busId: number;
  busNumber: string;
  busBrand: string;
  registrationNumber: string;
  routeId: number | null;
  routeName?: string | null;
  busType: string;
}

export default function DriverProfileSettingsScreen() { // screen component, this function returns the UI and logic
  //states
  const router = useRouter(); //navigation
  const { user, logout } = useUser(); //user context
  const { width } = useWindowDimensions(); //get screen width for responsive design and save in state
  const insets = useSafeAreaInsets(); //insets mean the safe area

  const [profileData, setProfileData] = useState<DriverProfile | null>(null); //initially null
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null); //state for error handling

  const [completionTab, setCompletionTab] = useState('profile'); //state for completion tab
  const [shareLocation, setShareLocation] = useState(true); //state for share location
  const [twoFactor, setTwoFactor] = useState(false);
  const { darkMode, setDarkMode } = useTheme(); //global theme data
  const [systemNotifications, setSystemNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [bookingUpdates, setBookingUpdates] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [assignment, setAssignment] = useState<DriverAssignment | null>(null);

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  console.log("USER:", user); // Log the user from UserContext when logged in.
  
  useEffect(() => { // Fetch driver profile when user data changes
    fetchDriverProfile();
  }, [user?.userId]); // re run everitime user id chnges

  useEffect(() => {
    AsyncStorage.getItem(DRIVER_SHARE_LOCATION_KEY)
      .then((value) => {
        setShareLocation(value !== 'false');
      })
      .catch((error) => {
        console.warn('Failed to load location sharing preference:', error);
      });
  }, []);

  const fetchDriverProfile = async () => {
    if (!user?.userId || !user?.token) { // Check if user data is available
      setIsLoadingProfile(false); // update state
      return;
    }

    try {
      setIsLoadingProfile(true); //update state
      setProfileError(null); //update state to clear previous errors
      
      // Fetch driver profile from API URL
      const response = await fetch(
        apiUrl(`/api/drivers/${user.userId}/profile-and-assignment`),
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }

      const result = await response.json(); //JSON to js object
      console.log("DRIVER PROFILE RESPONSE:", result); // this is in json
      
      if (result.success && result.data) { //if success is true and data is present
      const profile = result.data.profile as DriverProfile;
      setProfileData(profile); 
      setAssignment(result.data.assignment);

      console.log("PROFILE:", profile); // this is in js object form
      console.log("ASSIGNMENT:", result.data.assignment);

      setProfileImage(resolveAssetUrl(profile.profilePhoto));
      } else {
        throw new Error(result.message || 'Failed to fetch profile');
      }
    } catch (error) { 
      console.error('Error fetching driver profile:', error);
      setProfileError(error instanceof Error ? error.message : 'Failed to load profile'); //update state with error message
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const profileCompletion = 100; 
  const driverName = profileData 
    ? `${profileData.firstName} ${profileData.lastName}` //profileData is from the API
    : (user ? `${user.firstName} ${user.lastName}` : 'Driver'); //user here means from user context
  const driverId = profileData?.driverId || user?.userId;
  const driverEmail = profileData?.email || user?.email;
  const phoneNumber = profileData?.phoneNumber || 'N/A';
  const licenseNumber = profileData?.licenseNumber || 'N/A';
  const licenceExpiry = formatDate(profileData?.licenceExpiry); //function
  const joinedDate = formatDate(profileData?.joinedDate);

  const isSmallPhone = width < 360; 
  const isCompact = width < 390;
  const horizontalPadding = isSmallPhone ? 14 : 16;

  const theme = { //coming from themecontext
    background: darkMode ? '#111' : '#F5F5F5',
    card: darkMode ? '#1E1E1E' : '#FFF',
    text: darkMode ? '#FFF' : '#000',
    secondaryText: darkMode ? '#AAA' : '#666',
    border: darkMode ? '#333' : '#E0E0E0',

    fontRegular: 'System', //system font eg. sans-serif
    fontBold: 'System',  //system font with bold weight
  };

  const styles = useMemo( //create the styles for the component. 
    () =>
      createStyles({
        horizontalPadding,
        bottomInset: insets.bottom,
        isSmallPhone,
        isCompact,
        theme,
      }),
    [horizontalPadding, insets.bottom, isSmallPhone, isCompact, darkMode] //recalculate when these change
  );

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', onPress: () => {} }, //if cancel do nothing
      {
        text: 'Logout',
        onPress: () => {
          logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(); //asks fo device permission to access

    if (!permission.granted) {
      Alert.alert('Permission Required', 'Please allow gallery access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({ //allows the user to pick an image 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Allow only images to be selected
      allowsEditing: true, // Allow the user to edit (crop) the selected image
      aspect: [1, 1], // Set the aspect ratio to square
      quality: 1, //highest quality
    });

    if (!result.canceled) {
      await uploadProfileImage(result.assets[0]);
    }
  };

  const uploadProfileImage = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!user?.token) {
      Alert.alert('Login Required', 'Please log in again before updating your profile photo.');
      return;
    }

    const previousImage = profileImage;
    setProfileImage(asset.uri);
    setIsUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: getUploadFileName(asset),
        type: getUploadMimeType(asset),
      } as unknown as Blob);

      const response = await fetch(apiUrl('/api/profile/picture'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      const text = await response.text();
      const result = text ? JSON.parse(text) : null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Failed to upload profile picture');
      }

      const savedPhoto =
        result.data?.imageUrl ?? result.data?.originalUrl ?? result.data?.thumbnailUrl ?? null;
      const resolvedPhoto = resolveAssetUrl(savedPhoto) ?? asset.uri;

      setProfileImage(resolvedPhoto);
      setProfileData((current) =>
        current ? { ...current, profilePhoto: savedPhoto ?? resolvedPhoto } : current
      );
      await AsyncStorage.mergeItem('user', JSON.stringify({ profilePhoto: savedPhoto ?? resolvedPhoto }));
    } catch (error) {
      console.error('Profile photo upload failed:', error);
      setProfileImage(previousImage);
      Alert.alert(
        'Upload Failed',
        error instanceof Error ? error.message : 'Could not upload the selected photo.'
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleShareLocationChange = async (value: boolean) => {
    setShareLocation(value);
    try {
      await AsyncStorage.setItem(DRIVER_SHARE_LOCATION_KEY, String(value));
    } catch (error) {
      console.warn('Failed to save location sharing preference:', error);
    }
  };


  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {isLoadingProfile && ( 
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
          <ActivityIndicator size="large" color="#0066FF" />
          <Text style={{ marginTop: 10, color: theme.text }}>Loading profile...</Text>
        </View>
      )}

      {profileError && ( // If there's an error, display a message and a retry button
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
          <MaterialCommunityIcons name="alert-circle" size={48} color="#FF6B6B" />
          <Text style={{ marginTop: 10, color: theme.text, textAlign: 'center', marginHorizontal: 20 }}>
            {profileError}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#0066FF', borderRadius: 8 }}
            onPress={fetchDriverProfile}
          >
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoadingProfile && !profileError && ( // If not loading and no error, display the profile content
      <ScrollView
        showsVerticalScrollIndicator={false} 
        contentInsetAdjustmentBehavior="automatic" // Adjust the scroll view insets automatically
        contentContainerStyle={styles.scrollContent} //scroll content
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
                  <Image source={{ uri: profileImage }} style={styles.profileImage} resizeMode="cover"/> //display the profile image resizeMode  means how the image should fit in the container
                ) : (
                  <MaterialCommunityIcons
                    name="account"
                    size={isSmallPhone ? 42 : 50}
                    color="#0066FF"
                  />
                )}
                {isUploadingPhoto ? (
                  <View style={styles.photoUploadOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                ) : null}
                </TouchableOpacity>
                <View style={styles.verificationBadge}>
                  <MaterialCommunityIcons name="pencil" size={20} color="#0066FF" />
                </View>
              </View>

              <Text style={styles.profileName} numberOfLines={1}>
                {driverName}
              </Text>
              <Text style={styles.profileId}>ID: DRV-{driverId}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.completionHeader}>
              <Text style={styles.sectionTitle}>Profile Completion</Text>
              <Text style={styles.completionPercent}>{profileCompletion}%</Text>
            </View>

            <View style={styles.completionTabs}>
              <View
                style={[
                  styles.completionTab,
                ]}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={16}
                  color={'#22C55E'}
                />
                <Text
                  style={[
                    styles.completionTabText,
                  ]}
                >
                  License
                </Text>
              </View>

              <View
                style={[
                  styles.completionTab,
                ]}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={16}
                  color={'#22C55E'}
                />
                <Text
                  style={[
                    styles.completionTabText,
                  ]}
                >
                  Background
                </Text>
              </View>

              <View style={[
                  styles.completionTab,
                ]}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={16}
                  color={'#22C55E'}
                />
                <Text
                  style={[
                    styles.completionTabText,
                  ]}
                >
                  Profile
                </Text>
              </View>
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
                  {driverName}
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
                  {driverEmail}
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
                <Text style={styles.detailValue}>{phoneNumber}</Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="card-account-details" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>License Number</Text>
                <Text style={styles.detailValue}>{licenseNumber}</Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="calendar" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>License Expiry</Text>
                <View style={styles.expiryContainer}>
                  <Text style={styles.detailValue}>{licenceExpiry}</Text>
                  <View style={[styles.validBadge, isLicenseExpired(profileData?.licenceExpiry) ? styles.expiredBadge : styles.validBadgeStyle]}>
                    <Text style={[styles.validText, isLicenseExpired(profileData?.licenceExpiry) ? styles.expiredText : {}]}>
                      {isLicenseExpired(profileData?.licenceExpiry) ? 'Expired' : 'Valid'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="calendar" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Joined Date</Text>
                <Text style={styles.detailValue}>{profileData?.joinedDate || 'N/A'}</Text>
              </View>
            </View>

            <View style={[styles.detailItem, styles.lastItem]}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="briefcase" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Experience</Text>
                <Text style={styles.detailValue}>{profileData?.yearsOfExperience || 0} Years</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Bank Details</Text>
            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="card-account-details" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Bank Account Number</Text>
                <Text style={styles.detailValue}>{profileData?.accountNumber || 'N/A'}</Text>
              </View>
            </View>

            <View style={[styles.detailItem, styles.lastItem]}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="bank" size={16} color="#0066FF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Bank Name</Text>
                <Text style={styles.detailValue}>{profileData?.bankName || 'N/A'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Current Assignment</Text>
            <View style={styles.assignmentItem}>
              <MaterialCommunityIcons name="bus" size={20} color="#0066FF" />
              <View style={styles.assignmentContent}>
                <Text style={styles.detailLabel}>Bus Information</Text>
                <Text style={styles.assignmentValue}>
                  {assignment
                    ? `${assignment.busNumber} (${assignment.busBrand})` //$ combines the two variables to be displayed
                    : 'No active assignment'}
                </Text>
                <Text style={styles.assignmentValue}>
                  {assignment?.registrationNumber ?? 'N/A'}
                </Text>       
              </View>
            </View>

            <View style={[styles.assignmentItem, styles.lastItem]}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#0066FF" />
              <View style={styles.assignmentContent}>
                <Text style={styles.detailLabel}>Route</Text>
                <Text style={styles.assignmentValue}>
                  {assignment?.routeName ?? 'No route assigned'}
                  </Text>
                  <Text style={styles.assignmentValue}>
                  Route ID: {assignment?.routeId ?? 'N/A'}
                  </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ratings</Text>
            <TouchableOpacity style={styles.rowButton} onPress={() => Alert.alert('Your reviews and feedback will appear here...')}>
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
                setLanguageModalVisible(true)
              }
            >
              <MaterialCommunityIcons name="translate" size={20} color="#0066FF" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>Language</Text>
                <Text style={styles.settingValue}>{selectedLanguage}</Text>
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
                onValueChange={handleShareLocationChange}
                trackColor={{ false: '#E0E0E0', true: '#0066FF' }}
                thumbColor="#FFF" // Thumb color
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

            <TouchableOpacity style={styles.supportItem} onPress={() => Alert.alert('Help & Support', 'Loading help and support information...')}>
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
            <View style={[styles.switchRow, styles.lastItem]}>
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
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notifications</Text>

            <View style={styles.switchRow}>
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

            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <MaterialCommunityIcons name="message-alert" size={20} color="#0066FF" />
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
                <MaterialCommunityIcons name="message-text" size={20} color="#0066FF" />
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
                <MaterialCommunityIcons name="email" size={20} color="#0066FF" />
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
                <MaterialCommunityIcons name="calendar" size={20} color="#0066FF" />
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
      )}
      <Modal
        transparent={true} //transparent bg
        visible={languageModalVisible} //state to control visibility
         animationType='fade'//fade animation means it will fade in and out
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}> 
            <Text style={styles.modalTitle}>
              Choose Language
            </Text>
            {['English', 'Sinhala', 'Tamil'].map((language) => (
              <TouchableOpacity
                key={language}
                style={styles.languageOption}
                onPress={() => {
                  setSelectedLanguage(language);
                  //setLanguageModalVisible(false);
                }}
              >
                <Text style={styles.languageText}>
                  {language}
                  {selectedLanguage === language && (
                <MaterialCommunityIcons
                  name="check"
                  size={20}
                  color="#0066FF"
                  style={styles.checkIcon}
                />
                )}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setLanguageModalVisible(false)}
              >
                <Text style={styles.okText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    validBadgeStyle:{
      backgroundColor: '#E7F5EC',
    },
    expiredBadge: {
      backgroundColor: '#FDE8E8',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 3,
    },
    expiredText: {
      fontSize: 9,
      fontWeight: '700',
      color: '#DC2626',
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
    photoUploadOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContainer: {
    width: '85%',
    backgroundColor: theme.card,
    borderRadius: 3,
    padding: 20,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
  },
    languageOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor:theme.card,
  },

  languageText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.text,
  },
  modalFooter: {
  marginTop: 10,
  flexDirection: 'row',
  justifyContent: 'flex-end',
  },

  okText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0066FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
    checkIcon: {
      width: 20,
      height: 20,
    },
  });
}

function getUploadFileName(asset: ImagePicker.ImagePickerAsset) {
  if (asset.fileName) {
    return asset.fileName;
  }

  const extension = getUploadMimeType(asset).split('/')[1] || 'jpg';
  return `driver-profile.${extension === 'jpeg' ? 'jpg' : extension}`;
}

function getUploadMimeType(asset: ImagePicker.ImagePickerAsset) {
  if (asset.mimeType) {
    return asset.mimeType;
  }

  const extension = asset.uri.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}
