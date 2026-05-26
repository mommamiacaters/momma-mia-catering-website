import { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { CatalogItem } from '@momma-mia/supabase';
import { formatPeso } from '../lib/format';
import { useCart } from '../store/cart';

interface MenuItemCardProps {
  item: CatalogItem;
}

// Fixed-width tile used in the horizontal "Popular picks" rail.
function MenuItemCardBase({ item }: MenuItemCardProps) {
  const add = useCart((s) => s.add); // stable fn ref → no re-render on cart changes

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      className="mr-3 w-40 overflow-hidden rounded-2xl border border-brand-divider bg-white active:opacity-90"
    >
      <View className="h-28 items-center justify-center bg-brand-secondary">
        {item.image ? (
          <Image
            source={item.image}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={100}
            recyclingKey={item.id}
          />
        ) : (
          <Ionicons name="fast-food-outline" size={32} color="#D9CDBE" />
        )}
      </View>
      <View className="p-3">
        <Text numberOfLines={1} className="font-bold text-brand-text">
          {item.name}
        </Text>
        <Text numberOfLines={2} className="mt-1 h-8 text-xs text-brand-muted">
          {item.description ?? ''}
        </Text>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="font-extrabold text-brand-primary">{formatPeso(item.price)}</Text>
          <Pressable
            onPress={() => add(item)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name}`}
            className="h-11 w-11 items-center justify-center rounded-full bg-brand-primary active:opacity-80"
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// Memoized: virtualized rows re-render often; the item prop is stable per id.
export const MenuItemCard = memo(MenuItemCardBase);
