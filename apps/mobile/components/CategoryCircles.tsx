import { memo } from 'react';
import { ScrollView, Pressable, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

interface CategoryCirclesProps {
  categories: { title: string; image: string | null }[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

const RAIL_SHADOW = {
  elevation: 3,
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
  zIndex: 2,
} as const;

// Grab-style circular category rail. Active = brand-orange ring + check badge
// (border-based ring; Tailwind `ring-*` doesn't map to RN).
function CategoryCirclesBase({ categories, activeIndex, onSelect }: CategoryCirclesProps) {
  // Up to 5 categories divide the screen width evenly (flex-1) so every label is
  // fully visible — no horizontal scroll, no "Check-a-Lunc" clipping. With 6+ we
  // fall back to a scrolling rail so the circles don't get crushed.
  const even = categories.length <= 5;

  const renderItem = (c: CategoryCirclesProps['categories'][number], i: number) => {
    const active = i === activeIndex;
    return (
      <Pressable
        key={c.title}
        onPress={() => onSelect(i)}
        className={`${even ? 'flex-1' : 'w-[68px]'} items-center`}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
      >
        <View
          className={`h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 bg-brand-secondary ${
            active ? 'border-brand-primary' : 'border-brand-divider'
          }`}
        >
          {c.image ? (
            <Image
              source={c.image}
              style={{ width: 56, height: 56 }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <Ionicons name="fast-food-outline" size={22} color="#D9CDBE" />
          )}
          {active && (
            <View className="absolute bottom-0 right-0 h-5 w-5 items-center justify-center rounded-full border border-white bg-brand-primary">
              <Ionicons name="checkmark" size={12} color="#fff" />
            </View>
          )}
        </View>
        <Text
          numberOfLines={2}
          ellipsizeMode="tail"
          className={`mt-1.5 w-full text-center text-[11px] leading-tight ${
            active ? 'font-bold text-brand-primary' : 'text-brand-muted'
          }`}
        >
          {c.title}
        </Text>
      </Pressable>
    );
  };

  // Bottom border + hairline shadow separate the pinned rail from the scrolling
  // content (otherwise the circles look like they float over it).
  if (even) {
    return (
      <View
        className="flex-row items-start border-b border-brand-divider bg-brand-cream px-2 pb-3 pt-3"
        style={RAIL_SHADOW}
      >
        {categories.map(renderItem)}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="border-b border-brand-divider bg-brand-cream"
      style={RAIL_SHADOW}
      contentContainerClassName="gap-4 px-4 pb-3 pt-3"
    >
      {categories.map(renderItem)}
    </ScrollView>
  );
}

export const CategoryCircles = memo(CategoryCirclesBase);
