import { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatPeso } from '../lib/format';

// Peak-End "end" moment: a celebratory close to the order flow (the skill's #1
// emotional principle) instead of a throwaway Alert. Animated check + order ref
// + reassuring copy + a clear next step.
export default function OrderConfirmationScreen() {
  const { ref, total } = useLocalSearchParams<{ ref?: string; total?: string }>();
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.15, duration: 260, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
  }, [scale]);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-brand-cream">
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View
          style={{ transform: [{ scale }] }}
          className="h-28 w-28 items-center justify-center rounded-full bg-brand-primary"
        >
          <Ionicons name="checkmark" size={64} color="#fff" />
        </Animated.View>

        <Text className="mt-8 text-center text-3xl font-extrabold text-brand-text">Order placed! 🎉</Text>
        <Text className="mt-2 text-center leading-6 text-brand-muted">
          Thank you for ordering with Mia. We&apos;ve got it from here — you&apos;ll hear from
          us shortly to confirm your delivery.
        </Text>

        {ref && (
          <View className="mt-6 rounded-2xl border border-brand-divider bg-white px-6 py-4">
            <Text className="text-center text-xs uppercase tracking-widest text-brand-muted">
              Order reference
            </Text>
            <Text className="mt-1 text-center text-lg font-extrabold text-brand-text">{ref}</Text>
            {total && (
              <Text className="mt-1 text-center font-bold text-brand-primary">
                {formatPeso(Number(total))}
              </Text>
            )}
          </View>
        )}
      </View>

      <View className="px-6" style={{ paddingBottom: insets.bottom + 16 }}>
        <Pressable
          onPress={() => {
            router.dismissAll();
            router.navigate('/(tabs)/orders');
          }}
          accessibilityRole="button"
          className="mb-3 items-center rounded-2xl bg-brand-primary py-4 active:opacity-80"
        >
          <Text className="font-bold text-white">View my orders</Text>
        </Pressable>
        <Pressable
          onPress={() => router.dismissAll()}
          accessibilityRole="button"
          className="items-center rounded-2xl border border-brand-divider bg-white py-4 active:opacity-80"
        >
          <Text className="font-bold text-brand-primary">Back to menu</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
