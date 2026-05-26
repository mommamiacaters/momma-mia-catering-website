import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCartCount, useCartSubtotal } from '../store/cart';
import { formatPeso } from '../lib/format';
import { openCart } from '../lib/nav';

// Persistent "View cart" bar. Uses RN's CORE Animated API (not Reanimated) so it
// works in Expo Go (Reanimated 4 worklets are a native module that mismatches the
// Expo Go binary). Always mounted; visibility driven by one Animated.Value keyed
// on `count > 0` so 1→2→3 doesn't re-trigger and rapid 0↔1 can't yo-yo.
export function ViewCartBar() {
  const count = useCartCount();
  const subtotal = useCartSubtotal();
  const visible = count > 0;
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [visible, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [90, 0] });

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={{
        // The Home tab screen is already inset ABOVE the tab bar, so a small
        // offset floats this just above the nav (Menu/Orders/Account). Adding
        // the tab-bar height here double-counts and floats it way too high.
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 12,
        opacity: progress,
        transform: [{ translateY }],
      }}
    >
      <Pressable
        onPress={openCart}
        accessibilityRole="button"
        accessibilityLabel={`View cart, ${count} items, ${formatPeso(subtotal)}`}
        style={{
          elevation: 6,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
        className="flex-row items-center justify-between rounded-2xl bg-brand-primary px-5 py-4 active:opacity-90"
      >
        <View className="flex-row items-center">
          <View className="h-7 w-7 items-center justify-center rounded-full bg-white/25">
            <Text className="font-bold text-white">{count}</Text>
          </View>
          <Text className="ml-3 font-extrabold text-white">{formatPeso(subtotal)}</Text>
        </View>
        <View className="flex-row items-center">
          <Ionicons name="bag-handle" size={18} color="#fff" />
          <Text className="ml-2 font-bold text-white">View cart</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
