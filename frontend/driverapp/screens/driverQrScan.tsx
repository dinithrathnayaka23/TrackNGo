import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { seatBookingService } from '@/services/seatBookingService';

export default function DriverQrScanScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{
    seatBookingId?: string;
    bookingReference?: string;
    seatId?: string;
    passengerName?: string;
  }>();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const expectedReference = (params.bookingReference || '').trim().toUpperCase();

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned || isVerifying) return;
    setScanned(true);

    let ticket: { bookingRef?: string } | null = null;
    try {
      ticket = JSON.parse(result.data);
    } catch {
      ticket = null;
    }

    if (!ticket || !ticket.bookingRef) {
      Alert.alert(t('allocations.qrScanInvalidTitle'), t('allocations.qrScanInvalidMessage'), [
        { text: t('allocations.scanAgain'), onPress: () => setScanned(false) },
        { text: t('common.cancel'), onPress: () => router.back() },
      ]);
      return;
    }

    if (!expectedReference || ticket.bookingRef.trim().toUpperCase() !== expectedReference) {
      Alert.alert(t('allocations.qrScanMismatchTitle'), t('allocations.qrScanMismatchMessage'), [
        { text: t('allocations.scanAgain'), onPress: () => setScanned(false) },
        { text: t('common.cancel'), onPress: () => router.back() },
      ]);
      return;
    }

    const seatBookingId = Number(params.seatBookingId);
    if (!Number.isFinite(seatBookingId)) {
      Alert.alert(t('allocations.error'), t('allocations.failedToMarkBoarded'), [
        { text: t('common.cancel'), onPress: () => router.back() },
      ]);
      return;
    }

    try {
      setIsVerifying(true);
      const token = await seatBookingService.getToken();
      const success = await seatBookingService.markPassengerBoarded(seatBookingId, token);

      if (success) {
        Alert.alert(t('allocations.success'), t('allocations.qrScanSuccessMessage'), [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(t('allocations.error'), t('allocations.failedToMarkBoarded'), [
          { text: t('allocations.scanAgain'), onPress: () => setScanned(false) },
          { text: t('common.cancel'), onPress: () => router.back() },
        ]);
      }
    } catch (err) {
      console.error('Error verifying scanned ticket:', err);
      Alert.alert(t('allocations.error'), t('allocations.failedToMarkBoarded'), [
        { text: t('allocations.scanAgain'), onPress: () => setScanned(false) },
        { text: t('common.cancel'), onPress: () => router.back() },
      ]);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <MaterialCommunityIcons name="camera-off" size={48} color="#FFFFFF" />
        <Text style={styles.permissionTitle}>{t('allocations.cameraPermissionTitle')}</Text>
        <Text style={styles.permissionMessage}>{t('allocations.cameraPermissionMessage')}</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={() => void requestPermission()}>
          <Text style={styles.permissionButtonText}>{t('allocations.grantPermission')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeLink} onPress={() => router.back()}>
          <Text style={styles.closeLinkText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : (result) => void handleBarcodeScanned(result)}
      />

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('allocations.qrScanTitle')}</Text>
          <View style={styles.closeButton} />
        </View>

        <View style={styles.frameContainer}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
          <Text style={styles.instructions}>{t('allocations.qrScanInstructions')}</Text>
          {params.passengerName ? (
            <Text style={styles.passengerHint}>
              {t('allocations.seatNumber', { seat: params.seatId ?? '' })} · {params.passengerName}
            </Text>
          ) : null}
        </View>

        {isVerifying ? (
          <View style={styles.verifyingBanner}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.verifyingText}>{t('allocations.loadingSeatLayout')}</Text>
          </View>
        ) : (
          <View style={styles.spacer} />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
  },
  permissionMessage: {
    fontSize: 13,
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionButton: {
    backgroundColor: '#2F6BFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  closeLink: {
    marginTop: 8,
    padding: 8,
  },
  closeLinkText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  frameContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  frame: {
    width: 240,
    height: 240,
    alignSelf: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#22C55E',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instructions: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  passengerHint: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '500',
  },
  verifyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    marginHorizontal: 40,
    marginBottom: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  verifyingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  spacer: {
    height: 80,
  },
});
