import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Brand palette (mirrors tailwind.config.js). Tab bar styling can't use className.
const BRAND = {
  primary: '#E36A2E',
  muted: '#6B6358',
  cream: '#F4EBDD',
  text: '#2E2A26',
  divider: '#D9CDBE',
};

// Cart is no longer a tab — it's a full-screen modal opened from the Menu's
// top-right cart icon + the floating "View cart" bar.
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || 10;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: BRAND.primary,
        tabBarInactiveTintColor: BRAND.muted,
        headerStyle: { backgroundColor: BRAND.cream },
        headerTitleStyle: { color: BRAND.text, fontWeight: '800' },
        headerShadowVisible: false,
        // Taller bar + top padding so the icon+label group sits centered with
        // breathing room above the labels (was cramped to the top edge), and
        // bottom padding clears the gesture/home-indicator inset.
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: BRAND.divider,
          height: 60 + bottomInset,
          paddingTop: 10,
          paddingBottom: bottomInset,
        },
        tabBarLabelStyle: { fontSize: 11, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Menu',
          headerShown: false, // home renders its own search header at the very top
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          headerShown: false, // renders its own header inside ScreenBackground (matches Menu)
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          headerShown: false, // renders its own header inside ScreenBackground (matches Menu)
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
