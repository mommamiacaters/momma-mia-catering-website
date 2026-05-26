import { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { CatalogItem } from '@momma-mia/supabase';
import { formatPeso } from '../lib/format';
import { QtyControl } from './QtyControl';

interface MenuItemRowProps {
  item: CatalogItem;
}

// Grab-style horizontal row: bordered image LEFT, details RIGHT, inline stepper.
// Takes ONLY `item` (stable per id) and builds navigation from item.id internally
// so React.memo isn't defeated by an inline onPress prop.
function MenuItemRowBase({ item }: MenuItemRowProps) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
      className="mx-4 mb-3 flex-row items-center rounded-2xl border border-brand-divider bg-white p-3 active:opacity-90"
    >
      <View className="h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-xl bg-brand-secondary">
        {item.image ? (
          <Image
            source={item.image}
            style={{ width: 88, height: 88 }}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={item.id}
            transition={100}
          />
        ) : (
          <Ionicons name="fast-food-outline" size={28} color="#D9CDBE" />
        )}
      </View>

      <View className="ml-3 flex-1">
        <Text numberOfLines={1} className="font-bold text-brand-text">
          {item.name}
        </Text>
        <Text numberOfLines={2} className="mt-1 text-xs text-brand-muted">
          {item.description ?? ''}
        </Text>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="font-extrabold text-brand-primary">{formatPeso(item.price)}</Text>
          <QtyControl item={item} />
        </View>
      </View>
    </Pressable>
  );
}

export const MenuItemRow = memo(MenuItemRowBase);
