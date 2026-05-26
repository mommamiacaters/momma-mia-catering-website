import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { Ionicons } from '@expo/vector-icons';
import { useCart, useCartSubtotal } from '../store/cart';
import { formatPeso } from '../lib/format';
import { QtyControl } from '../components/QtyControl';

export default function CartScreen() {
  // useShallow: derives a new array each call — shallow-compare to avoid the v5 loop.
  const lines = useCart(useShallow((s) => Object.values(s.lines)));
  const remove = useCart((s) => s.remove);
  const subtotal = useCartSubtotal();
  const insets = useSafeAreaInsets();
  const [manage, setManage] = useState(false);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-brand-cream">
      {/* "My Cart" header — centered title, back-arrow left, Manage right */}
      <View className="flex-row items-center justify-between border-b border-brand-divider px-2 py-3">
        <Pressable
          onPress={() => router.dismiss()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-9 min-w-[64px] items-start justify-center px-1"
        >
          <Ionicons name="chevron-back" size={26} color="#2E2A26" />
        </Pressable>
        <Text className="text-lg font-extrabold text-brand-text">My Cart</Text>
        {lines.length > 0 ? (
          <Pressable
            onPress={() => setManage((m) => !m)}
            hitSlop={8}
            accessibilityRole="button"
            className="h-9 min-w-[64px] items-end justify-center px-2"
          >
            <Text numberOfLines={1} className="font-bold text-brand-primary">
              {manage ? 'Done' : 'Manage'}
            </Text>
          </Pressable>
        ) : (
          <View className="min-w-[64px] px-2" />
        )}
      </View>

      {lines.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="bag-outline" size={48} color="#E36A2E" />
          <Text className="mt-4 text-center text-2xl font-extrabold text-brand-text">Your cart is empty</Text>
          <Text className="mt-2 text-center text-brand-muted">
            Add items from the menu to get started.
          </Text>
          <Pressable
            onPress={() => router.dismiss()}
            accessibilityRole="button"
            className="mt-6 rounded-2xl bg-brand-primary px-6 py-3 active:opacity-80"
          >
            <Text className="font-bold text-white">Browse menu</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerClassName="p-4 pb-40">
            {lines.map(({ item, qty }) => (
              <View
                key={item.id}
                className="mb-3 flex-row items-center rounded-2xl border border-brand-divider bg-white p-3"
              >
                <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-brand-secondary">
                  {item.image ? (
                    <Image
                      source={item.image}
                      style={{ width: 64, height: 64 }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <Ionicons name="fast-food-outline" size={22} color="#D9CDBE" />
                  )}
                </View>
                <View className="ml-3 flex-1">
                  <Text numberOfLines={1} className="font-bold text-brand-text">
                    {item.name}
                  </Text>
                  <Text className="mt-1 font-extrabold text-brand-primary">
                    {formatPeso((item.price ?? 0) * qty)}
                  </Text>
                </View>
                {manage ? (
                  <Pressable
                    onPress={() => remove(item.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.name}`}
                    className="h-11 w-11 items-center justify-center"
                  >
                    <Ionicons name="trash-outline" size={20} color="#C0392B" />
                  </Pressable>
                ) : (
                  <QtyControl item={item} />
                )}
              </View>
            ))}
          </ScrollView>

          <View
            className="absolute bottom-0 left-0 right-0 border-t border-brand-divider bg-white px-4 pt-4"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <View className="mb-3 flex-row justify-between">
              <Text className="text-brand-muted">Subtotal</Text>
              <Text className="text-lg font-extrabold text-brand-text">{formatPeso(subtotal)}</Text>
            </View>
            <Pressable
              onPress={() => router.push('/checkout')}
              accessibilityRole="button"
              className="items-center rounded-2xl bg-brand-primary py-4 active:opacity-80"
            >
              <Text className="font-bold text-white">Go to checkout</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
