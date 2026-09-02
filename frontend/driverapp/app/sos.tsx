import { Stack } from 'expo-router';
import DriverSosScreen from '@/screens/driverSos';

export default function Sos() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DriverSosScreen />
    </>
  );
}
