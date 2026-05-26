import { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMenu } from '../../hooks/useMenu';
import { useCart } from '../../store/cart';
import { formatPeso } from '../../lib/format';
import { BRAND } from '../../lib/colors';

const HEADER = {
  headerShown: true,
  headerStyle: { backgroundColor: BRAND.cream },
  headerTintColor: BRAND.text,
} as const;

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, loading } = useMenu();
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);

  const item = items.find((i) => i.id === id);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-cream">
        <Stack.Screen options={{ ...HEADER, title: '' }} />
        <ActivityIndicator color="#E36A2E" />
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center bg-brand-cream">
        <Stack.Screen options={{ ...HEADER, title: 'Not found' }} />
        <Text className="text-brand-muted">Item not found.</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-brand-cream">
      <Stack.Screen options={{ ...HEADER, title: item.name }} />

      <ScrollView contentContainerClassName="pb-32">
        <View className="h-64 items-center justify-center bg-brand-secondary">
          {item.image ? (
            <Image
              source={item.image}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          ) : (
            <Ionicons name="fast-food-outline" size={64} color="#D9CDBE" />
          )}
        </View>
        <View className="p-5">
          <Text className="text-2xl font-extrabold text-brand-text">{item.name}</Text>
          <Text className="mt-1 text-xl font-extrabold text-brand-primary">
            {formatPeso(item.price)}
          </Text>
          <Text className="mt-3 leading-5 text-brand-muted">
            {item.description ?? 'No description available.'}
          </Text>
          <View className="mt-4 self-start rounded-full bg-brand-secondary px-3 py-1">
            <Text className="text-xs font-semibold text-brand-muted">{item.categoryName}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky bottom action bar: quantity stepper + add-to-cart */}
      <SafeAreaView
        edges={['bottom']}
        className="absolute bottom-0 left-0 right-0 border-t border-brand-divider bg-white"
      >
        {item.price == null ? (
          // "Price on request" item — not orderable online (the create_order RPC
          // rejects null-price items), so offer no add control.
          <View className="items-center p-4">
            <Text className="font-semibold text-brand-muted">
              This item is available on request — please contact us to order.
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center justify-between p-4">
            <View className="flex-row items-center rounded-full border border-brand-divider">
              <Pressable
                onPress={() => setQty((q) => Math.max(1, q - 1))}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                className="h-11 w-11 items-center justify-center"
              >
                <Ionicons name="remove" size={20} color="#2E2A26" />
              </Pressable>
              <Text className="w-8 text-center font-bold text-brand-text">{qty}</Text>
              <Pressable
                onPress={() => setQty((q) => q + 1)}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                className="h-11 w-11 items-center justify-center"
              >
                <Ionicons name="add" size={20} color="#2E2A26" />
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                add(item, qty);
                router.back();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Add ${qty} ${item.name} to cart`}
              className="ml-4 flex-1 items-center rounded-2xl bg-brand-primary py-3 active:opacity-80"
            >
              <Text className="font-bold text-white">
                Add {qty} • {formatPeso(item.price * qty)}
              </Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
