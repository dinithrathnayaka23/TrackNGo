import { Stack } from 'expo-router';
import DriverQrScanScreen from '@/screens/driverQrScan';

export default function QrScan() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DriverQrScanScreen />
    </>
  );
}
