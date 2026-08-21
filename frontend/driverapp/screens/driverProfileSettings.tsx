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
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router'; //navigation
import { useUser } from '@/context/UserContext'; //gloablly shared user data and auth functions
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; //prevent content overlap
import { Image } from 'react-native'; //why because we need to diplay dp img
import { apiUrl } from '@/config/env';
import { useTheme } from '@/context/ThemeContext'; //global theme data
import { useLanguage } from '@/context/LanguageContext'; //global language/translation data
import { LANGUAGE_CODES, LANGUAGE_NAMES } from '@/locales';
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
  const { language, setLanguage, t } = useLanguage(); //global language/translation data
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<DriverAssignment | null>(null);

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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
    background: darkMode ? '#111' : '#F1F5F9',
    card: darkMode ? '#1E1E1E' : '#FFF',
    text: darkMode ? '#FFF' : '#000',
    secondaryText: darkMode ? '#AAA' : '#666',
    border: darkMode ? '#333' : '#E2E8F0',

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
    Alert.alert(t('settings.logoutConfirmTitle'), t('settings.logoutConfirmMessage'), [
      { text: t('common.cancel'), onPress: () => {} }, //if cancel do nothing
      {
        text: t('settings.logoutConfirmTitle'),
        onPress: () => {
          logout();
          router.replace('/login');
        },
      },
    ]);
  };

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordModalVisible(true);
  };

  const changePassword = async () => {
    if (!user?.userId || !user.token) {
      setPasswordError('Please log in again before changing your password.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('The new password must contain at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The new passwords do not match.');
      return;
    }

    try {
      setIsChangingPassword(true);
      setPasswordError('');
      const response = await fetch(apiUrl(`/api/users/${user.userId}/password`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) : null;
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || 'Could not change your password.');
      }
      setPasswordModalVisible(false);
      Alert.alert('Password changed', 'Your driver account password was updated successfully.');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Could not change your password.');
    } finally {
      setIsChangingPassword(false);
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
          <ActivityIndicator size="large" color="#2F6BFF" />
          <Text style={{ marginTop: 10, color: theme.text }}>{t('settings.loadingProfile')}</Text>
        </View>
      )}

      {profileError && ( // If there's an error, display a message and a retry button
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
          <MaterialCommunityIcons name="alert-circle" size={48} color="#EF4444" />
          <Text style={{ marginTop: 10, color: theme.text, textAlign: 'center', marginHorizontal: 20 }}>
            {profileError}
          </Text>
          <TouchableOpacity
            style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#2F6BFF', borderRadius: 8 }}
            onPress={fetchDriverProfile}
          >
            <Text style={{ color: 'white', fontWeight: "700" }}>{t('common.retry')}</Text>
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
              {t('settings.headerTitle')}
            </Text>

            <View style={styles.headerSide} />
          </View>

          <View style={styles.card}>
            <View style={styles.profileSection}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.profileImage} resizeMode="cover"/> //display the profile image resizeMode  means how the image should fit in the container
                ) : (
                  <MaterialCommunityIcons
                    name="account"
                    size={isSmallPhone ? 42 : 50}
                    color="#2F6BFF"
                  />
                )}
                </View>
              </View>

              <Text style={styles.profileName} numberOfLines={1}>
                {driverName}
              </Text>
              <Text style={styles.profileId}>{t('settings.idPrefix', { id: String(driverId ?? '') })}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.completionHeader}>
              <Text style={styles.sectionTitle}>{t('settings.profileCompletion')}</Text>
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
                  {t('settings.tabLicense')}
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
                  {t('settings.tabBackground')}
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
                  {t('settings.tabProfile')}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('settings.professionalDetails')}</Text>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="pencil" size={16} color="#2F6BFF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('settings.fullName')}</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {driverName}
                </Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="email" size={16} color="#2F6BFF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('settings.emailAddress')}</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {driverEmail}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.detailItem}
              onPress={openPasswordModal}
            >
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="lock" size={16} color="#2F6BFF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('settings.changePassword')}</Text>
                <Text style={styles.detailValue}>••••••••••</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999"/>
              </TouchableOpacity>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="phone" size={16} color="#2F6BFF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('settings.mobileNumber')}</Text>
                <Text style={styles.detailValue}>{phoneNumber}</Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="card-account-details" size={16} color="#2F6BFF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('settings.licenseNumber')}</Text>
                <Text style={styles.detailValue}>{licenseNumber}</Text>
              </View>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="calendar" size={16} color="#2F6BFF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('settings.licenseExpiry')}</Text>
                <View style={styles.expiryContainer}>
                  <Text style={styles.detailValue}>{licenceExpiry}</Text>
                  <View style={[styles.validBadge, isLicenseExpired(profileData?.licenceExpiry) ? styles.expiredBadge : styles.validBadgeStyle]}>
                    <Text style={[styles.validText, isLicenseExpired(profileData?.licenceExpiry) ? styles.expiredText : {}]}>
                      {isLicenseExpired(profileData?.licenceExpiry) ? t('settings.expired') : t('settings.valid')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="calendar" size={16} color="#2F6BFF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('settings.joinedDate')}</Text>
                <Text style={styles.detailValue}>{profileData?.joinedDate || t('common.notAvailable')}</Text>
              </View>
            </View>

            <View style={[styles.detailItem, styles.lastItem]}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="briefcase" size={16} color="#2F6BFF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('settings.experience')}</Text>
                <Text style={styles.detailValue}>{t('settings.experienceYears', { count: profileData?.yearsOfExperience || 0 })}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('settings.bankDetails')}</Text>
            <View style={styles.detailItem}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="card-account-details" size={16} color="#2F6BFF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('settings.bankAccountNumber')}</Text>
                <Text style={styles.detailValue}>{profileData?.accountNumber || t('common.notAvailable')}</Text>
              </View>
            </View>

            <View style={[styles.detailItem, styles.lastItem]}>
              <View style={styles.detailIcon}>
                <MaterialCommunityIcons name="bank" size={16} color="#2F6BFF" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('settings.bankName')}</Text>
                <Text style={styles.detailValue}>{profileData?.bankName || t('common.notAvailable')}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('settings.currentAssignment')}</Text>
            <View style={styles.assignmentItem}>
              <MaterialCommunityIcons name="bus" size={20} color="#2F6BFF" />
              <View style={styles.assignmentContent}>
                <Text style={styles.detailLabel}>{t('settings.busInformation')}</Text>
                <Text style={styles.assignmentValue}>
                  {assignment
                    ? `${assignment.busNumber} (${assignment.busBrand})` //$ combines the two variables to be displayed
                    : t('settings.noActiveAssignment')}
                </Text>
                <Text style={styles.assignmentValue}>
                  {assignment?.registrationNumber ?? t('common.notAvailable')}
                </Text>
              </View>
            </View>

            <View style={[styles.assignmentItem, styles.lastItem]}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#2F6BFF" />
              <View style={styles.assignmentContent}>
                <Text style={styles.detailLabel}>{t('settings.route')}</Text>
                <Text style={styles.assignmentValue}>
                  {assignment?.routeName ?? t('settings.noRouteAssigned')}
                  </Text>
                  <Text style={styles.assignmentValue}>
                  {t('settings.routeIdPrefix', { id: assignment?.routeId ?? t('common.notAvailable') })}
                  </Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('settings.feedback')}</Text>
            <TouchableOpacity style={styles.rowButton} onPress={() => router.push('/reviews-and-ratings')}>
              <MaterialCommunityIcons name="star-half" size={20} color="#2F6BFF" />
              <Text style={styles.rowButtonText}>{t('settings.ratingsAndComplaints')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('settings.privacy')}</Text>
            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <MaterialCommunityIcons name="map-marker" size={20} color="#2F6BFF" />
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchLabel}>{t('settings.shareLocation')}</Text>
                  <Text style={styles.switchDescription}>{t('settings.requiredForTracking')}</Text>
                </View>
              </View>
              <Switch
                value={shareLocation}
                onValueChange={handleShareLocationChange}
                trackColor={{ false: '#E2E8F0', true: '#2F6BFF' }}
                thumbColor="#FFF" // Thumb color
              />
            </View>

            <View style={[styles.switchRow, styles.lastItem]}>
              <View style={styles.switchLeft}>
                <MaterialCommunityIcons name="shield-account" size={20} color="#2F6BFF" />
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchLabel}>{t('settings.twoFactorAuth')}</Text>
                </View>
              </View>
              <Switch
                value={twoFactor}
                onValueChange={setTwoFactor}
                trackColor={{ false: '#E2E8F0', true: '#2F6BFF' }}
                thumbColor="#FFF"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('settings.preferences')}</Text>
            <TouchableOpacity
              style={styles.rowButton}
              onPress={() =>
                setLanguageModalVisible(true)
              }
            >
              <MaterialCommunityIcons name="translate" size={20} color="#2F6BFF" />
              <View style={styles.settingContent}>
                <Text style={styles.settingLabel}>{t('settings.language')}</Text>
                <Text style={styles.settingValue}>{LANGUAGE_NAMES[language]}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <View style={[styles.switchRow, styles.lastItem]}>
              <View style={styles.switchLeft}>
                <MaterialCommunityIcons
                  name="moon-waning-crescent"
                  size={20}
                  color="#2F6BFF"
                />
                <View style={styles.switchTextWrap}>
                  <Text style={styles.switchLabel}>{t('settings.lightDarkMode')}</Text>
                </View>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: '#E2E8F0', true: '#2F6BFF' }}
                thumbColor="#FFF"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t('settings.supportAndLegal')}</Text>

            <TouchableOpacity style={styles.supportItem} onPress={() => Alert.alert(t('settings.helpAndSupport'), t('settings.helpAndSupportLoading'))}>
              <MaterialCommunityIcons name="help-circle" size={20} color="#2F6BFF" />
              <Text style={styles.rowButtonText}>{t('settings.helpAndSupport')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.supportItem}  onPress={() => Alert.alert(t('settings.privacyPolicy'), t('settings.privacyPolicyLoading'))}>
              <MaterialCommunityIcons name="lock" size={20} color="#2F6BFF" />
              <Text style={styles.rowButtonText}>{t('settings.privacyPolicy')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.supportItem} onPress={() => Alert.alert(t('settings.termsAndConditions'), t('settings.termsLoading'))}>
              <MaterialCommunityIcons name="file-document" size={20} color="#2F6BFF" />
              <Text style={styles.rowButtonText}>{t('settings.termsAndConditions')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.supportItem, styles.lastItem]} onPress={() => Alert.alert(t('settings.aboutUs'), t('settings.aboutUsLoading'))}>
              <MaterialCommunityIcons name="information" size={20} color="#2F6BFF" />
              <Text style={styles.rowButtonText}>{t('settings.aboutUs')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={20} color="#FFFFFF" />
            <Text style={styles.logoutText}>{t('settings.logOut')}</Text>
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
              {t('settings.chooseLanguage')}
            </Text>
            {LANGUAGE_CODES.map((code) => (
              <TouchableOpacity
                key={code}
                style={styles.languageOption}
                onPress={() => {
                  setLanguage(code);
                  //setLanguageModalVisible(false);
                }}
              >
                <Text style={styles.languageText}>
                  {LANGUAGE_NAMES[code]}
                  {language === code && (
                <MaterialCommunityIcons
                  name="check"
                  size={20}
                  color="#2F6BFF"
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
                <Text style={styles.okText}>{t('common.ok')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        transparent
        visible={passwordModalVisible}
        animationType="fade"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.passwordModalContainer}>
            <Text style={styles.modalTitle}>Change Password</Text>
            <Text style={styles.passwordHint}>Only you can change your account password.</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor="#999"
              secureTextEntry
              style={styles.passwordInput}
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password"
              placeholderTextColor="#999"
              secureTextEntry
              style={styles.passwordInput}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor="#999"
              secureTextEntry
              style={styles.passwordInput}
            />
            {passwordError ? <Text style={styles.passwordError}>{passwordError}</Text> : null}
            <View style={styles.passwordActions}>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)} disabled={isChangingPassword}>
                <Text style={styles.cancelPasswordText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.savePasswordButton} onPress={() => void changePassword()} disabled={isChangingPassword}>
                {isChangingPassword ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.savePasswordText}>Save password</Text>}
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
      fontSize: isSmallPhone ? 16 : 18,
      fontWeight: "700",
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
      backgroundColor: '#EAF2FF',
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
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
      marginBottom: 4,
      maxWidth: '80%',
    },
    profileId: {
      fontSize: 11,
      color: '#999',
      fontWeight: "500",
    },
    card: {
      marginHorizontal: horizontalPadding,
      marginVertical: 12,
      padding: 16,
      backgroundColor: theme.card,
      borderRadius: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
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
      fontSize: 16,
      fontWeight: "700",
      color: '#2F6BFF',
    },
    progressBar: {
      height: 5,
      backgroundColor: '#E2E8F0',
      borderRadius: 2.5,
      marginBottom: 12,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#2F6BFF',
      borderRadius: 2.5,
    },
    completionSubtitle: {
      fontSize: 11,
      color: '#999',
      marginBottom: 12,
      fontWeight: "500",
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
      backgroundColor: '#F1F5F9',
      borderRadius: 8,
      minWidth: isCompact ? '47%' : 0,
      flexGrow: 1,
    },
    activeCompletionTab: {
      backgroundColor: '#EAF2FF',
    },
    completionTabText: {
      fontSize: 10,
      fontWeight: "600",
      color: '#666',
    },
    activeCompletionTabText: {
      color: '#2F6BFF',
      fontWeight: "700",
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
      backgroundColor: '#F1F5F9',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
    },
    detailContent: {
      flex: 1,
      minWidth: 0,
    },
    detailLabel: {
      fontSize: 11,
      color: '#999',
      fontWeight: "600",
      marginBottom: 2,
    },
    detailValue: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.text,
    },
    expiryContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    validBadge: {
      backgroundColor: '#DCFCE7',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 3,
    },
    validText: {
      fontSize: 10,
      fontWeight: "700",
      color: '#22C55E',
    },
    validBadgeStyle:{
      backgroundColor: '#DCFCE7',
    },
    expiredBadge: {
      backgroundColor: '#FEE2E2',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 3,
    },
    expiredText: {
      fontSize: 10,
      fontWeight: "700",
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
      fontSize: 13,
      fontWeight: "600",
      color: theme.text,
    },
    routeCode: {
      fontSize: 10,
      fontWeight: "700",
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
      fontSize: 14,
      fontWeight: "700",
      color: theme.text,
      minWidth: 0,
    },
    settingContent: {
      flex: 1,
      minWidth: 0,
    },
    settingLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    settingValue: {
      fontSize: 13,
      color: '#999',
      marginTop: 2,
      fontWeight: "500",
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
      fontSize: 14,
      fontWeight: "600",
      color: theme.text,
    },
    switchDescription: {
      fontSize: 10,
      color: '#999',
      marginTop: 2,
      fontWeight: "500",
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
      borderColor: '#E53935',
      backgroundColor: '#E53935',
    },
    logoutText: {
      fontSize: 14,
      fontWeight: "700",
      color: '#FFFFFF',
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
    passwordModalContainer: {
      width: '88%',
      backgroundColor: theme.card,
      borderRadius: 14,
      padding: 20,
    },
    passwordHint: {
      marginTop: 8,
      marginBottom: 14,
      color: theme.secondaryText,
      fontSize: 12,
      textAlign: 'center',
    },
    passwordInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 9,
      color: theme.text,
      paddingHorizontal: 12,
      paddingVertical: 11,
      marginTop: 10,
      backgroundColor: theme.background,
    },
    passwordError: {
      marginTop: 10,
      color: '#DC2626',
      fontSize: 12,
      textAlign: 'center',
    },
    passwordActions: {
      marginTop: 18,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 14,
    },
    cancelPasswordText: {
      color: theme.secondaryText,
      fontSize: 14,
      fontWeight: "700",
      padding: 8,
    },
    savePasswordButton: {
      backgroundColor: '#2F6BFF',
      borderRadius: 9,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    savePasswordText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: "700",
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
    fontWeight: "700",
    color: theme.text,
    textAlign: 'center',
  },
    languageOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor:theme.card,
  },

  languageText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.text,
  },
  modalFooter: {
  marginTop: 10,
  flexDirection: 'row',
  justifyContent: 'flex-end',
  },

  okText: {
    fontSize: 16,
    fontWeight: "700",
    color: '#2F6BFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
    checkIcon: {
      width: 20,
      height: 20,
    },
  });
}
