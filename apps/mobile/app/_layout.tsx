import '../global.css'; // load NativeWind styles once, at the root
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { useAuth } from '../store/auth';

export default function RootLayout() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    const unsubscribe = init(); // load persisted session + subscribe to auth changes
    return unsubscribe; // tear the auth listener down on unmount (no leak)
  }, [init]);

  // SafeAreaProvider at the root is REQUIRED for react-native-safe-area-context.
  // initialMetrics={initialWindowMetrics} seeds insets SYNCHRONOUSLY at app start
  // — without this, the first render returns {top:0,...} and only "settles" to
  // real values after the native bridge measures the device, which causes
  // content to draw briefly under the Dynamic Island / battery on iPhone. In
  // fullScreenModal presentations that first frame can stick, so the cart's
  // "Manage" button ends up where the battery indicator lives — untappable.
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="cart" options={{ presentation: 'fullScreenModal' }} />
        {/* Checkout renders its OWN header (chevron-back + title) so we don't
            depend on native-stack's header pipeline, which has been unreliable
            in expo-router 6.x on SDK 54. headerShown:false here, custom header
            inside checkout.tsx — same pattern as cart, proven working. */}
        <Stack.Screen name="checkout" options={{ headerShown: false }} />
        <Stack.Screen
          name="order-confirmation"
          options={{ headerShown: false, gestureEnabled: false }}
        />
      </Stack>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
