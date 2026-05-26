import '../global.css'; // load NativeWind styles once, at the root
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../store/auth';

export default function RootLayout() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    const unsubscribe = init(); // load persisted session + subscribe to auth changes
    return unsubscribe; // tear the auth listener down on unmount (no leak)
  }, [init]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cart" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
